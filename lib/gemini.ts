import { env } from "./env";
import { knowledge } from "./knowledge";
import type { NormalisedCall } from "./vaani";

export type Classification = {
  classification: "qualified" | "not_fit" | "complaint" | "unclear";
  fit_reason: string;
  asked_pricing: boolean;
  lead: {
    name: string | null;
    area: string | null;
    property_type: string | null;
    size_sqft: number | null;
    scope: string | null;
    budget_band: string | null;
    timeline: string | null;
    source: string | null;
  };
  segment: "home" | "office" | "unknown";
  handoff_note: string;
};

const SYSTEM = (k: ReturnType<typeof knowledge>) => `You review finished phone calls for Aangan Studio, an interior design studio in Pune.
Decide what kind of call it was and write a short note for the designer.

Rules for a qualified lead (written by Nikhil, the founder):
<qualified>
${k.qualified}
</qualified>

What the studio does and does not do:
<services>
${k.services}
</services>

Apply Nikhil's rubric above exactly. Classify as one of:
- "qualified": passes the five criteria, including cases the rubric says to treat as qualified (budget not mentioned; unclear on budget or decision-maker; rented flat with no structural change; asking about price).
- "not_fit": clearly fails the rubric or services: outside Pune/PCMC, advice or decor only, out-of-scope type (restaurant, hotel, retail, gym, structural work), too small, a timeline that makes execution impossible, or a volunteered budget clearly below the described scope.
- "complaint": an existing client (a project already signed or under way) with a problem. A human must handle it.
  A new enquirer who is annoyed (for example, we missed their callback) is NOT a complaint: judge them on the five criteria and start the handoff note with "Handle with care:" and why.
- "unclear": not enough information (dropped call, wrong number, caller gave almost nothing).

In fit_reason, name the rubric criterion that decided it. If a criterion was uncertain (for example the caller is not the owner), say so in the handoff note.

Set asked_pricing true if the caller asked about cost, rates or per-square-foot price.
Never include any price, rate or estimate in your output.

handoff_note: plain text, at most 8 short lines, for a designer reading on a phone. Lead with what the client wants, then property, budget band, timeline, anything to prepare. If asked_pricing, add the line "Asked about pricing; told designer will cover it."

Reply with JSON only, matching this shape:
{"classification":"...","fit_reason":"one sentence","asked_pricing":false,"segment":"home|office|unknown","lead":{"name":null,"area":null,"property_type":null,"size_sqft":null,"scope":null,"budget_band":null,"timeline":null,"source":null},"handoff_note":"..."}`;

export async function classifyCall(call: NormalisedCall): Promise<{ result: Classification; costInr: number }> {
  const model = env("GEMINI_MODEL", "gemini-3.8-flash");
  const transcript = call.transcript.map((t) => `${t.role}: ${t.text}`).join("\n");
  // Timelines ("we move in November") only make sense against the day of the call.
  const callDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" })
    .format(call.startedAt ? new Date(call.startedAt) : new Date());
  const user = `Date of the call: ${callDate}
Call summary from the voice agent: ${call.summary || "(none)"}
Fields the voice agent collected: ${JSON.stringify(call.collected)}
Transcript:
${transcript || "(no transcript)"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM(knowledge()) }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
  const result = JSON.parse(text) as Classification;

  const inTok = data?.usageMetadata?.promptTokenCount ?? 0;
  const outTok = (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0);
  const costInr =
    (inTok / 1e6) * Number(process.env.GEMINI_INR_PER_M_INPUT ?? 25) +
    (outTok / 1e6) * Number(process.env.GEMINI_INR_PER_M_OUTPUT ?? 210);

  return { result: guard(result), costInr };
}

/**
 * Belt and braces for check 06: drop any note line that states a rate or estimate.
 * The caller's own budget band is allowed through.
 */
export function guard(r: Classification): Classification {
  const strip = (s: string) =>
    s.split("\n").filter((l) => isCallersBudget(l) || !PRICEY.test(l)).join("\n");
  const lead = { ...r.lead };
  if (lead.budget_band && !isCallersBudget(`budget ${lead.budget_band}`)) lead.budget_band = null;
  return { ...r, lead, handoff_note: strip(r.handoff_note ?? ""), fit_reason: strip(r.fit_reason ?? "") || "Reason withheld: it mentioned a price." };
}

// A rate, an estimate, or any rupee amount. Catches "₹1,800/sq ft", "around 10 lakh for this scope", "Rs 12L".
const PRICEY =
  /(per\s*(sq|square)|\/\s*sq|\bpsf\b|estimat|would cost|will cost|should cost|costs? around|\bquote|price (is|would|will)|₹|\brs\.?\s*\d|\binr\b|\d\s*(lakh|lac|lakhs|l\b|k\b|cr|crore))/i;

// The caller's own volunteered budget may pass, but not a line that also states a rate or our estimate.
function isCallersBudget(l: string): boolean {
  return /budget/i.test(l) && !/(per\s*(sq|square)|\/\s*sq|\bpsf\b|estimat|would cost|will cost|our (rate|price))/i.test(l);
}
