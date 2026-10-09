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

Classify as exactly one of:
- "qualified": meets the rules above.
- "not_fit": outside services, area, or budget in the rules.
- "complaint": an existing client with a problem, or anything angry or sensitive. A human must handle it.
- "unclear": not enough information (dropped call, wrong number, caller refused to answer).

Set asked_pricing true if the caller asked about cost, rates or per-square-foot price.
Never include any price, rate or estimate in your output.

handoff_note: plain text, at most 8 short lines, for a designer reading on a phone. Lead with what the client wants, then property, budget band, timeline, anything to prepare. If asked_pricing, add the line "Asked about pricing; told designer will cover it."

Reply with JSON only, matching this shape:
{"classification":"...","fit_reason":"one sentence","asked_pricing":false,"segment":"home|office|unknown","lead":{"name":null,"area":null,"property_type":null,"size_sqft":null,"scope":null,"budget_band":null,"timeline":null,"source":null},"handoff_note":"..."}`;

export async function classifyCall(call: NormalisedCall): Promise<{ result: Classification; costInr: number }> {
  const model = env("GEMINI_MODEL", "gemini-3.8-flash");
  const transcript = call.transcript.map((t) => `${t.role}: ${t.text}`).join("\n");
  const user = `Call summary from the voice agent: ${call.summary || "(none)"}
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
  const pricey = /(per\s*sq\.?\s*ft|\/\s*sq\.?\s*ft|psf|estimate|would cost|will cost|quote)/i;
  const lines = r.handoff_note
    .split("\n")
    .filter((l) => /budget/i.test(l) || !pricey.test(l));
  return { ...r, handoff_note: lines.join("\n") };
}
