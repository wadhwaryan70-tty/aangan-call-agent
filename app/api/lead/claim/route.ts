import { NextRequest } from "next/server";
import { db } from "@/lib/supabase";
import { verify } from "@/lib/links";
import { page, btn } from "@/lib/page";

export const runtime = "nodejs";
const ACTION: string = "claim";

// GET only shows a confirm button. Email security scanners open links automatically,
// so the actual change happens on POST when a person taps the button.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const id = q.get("id") ?? "", sig = q.get("sig"), by = q.get("by") ?? "";
  if (!verify(id, ACTION, sig)) return page("Link not valid", "<h2>This link isn't valid</h2><p>Open the button from the original email.</p>", 403);
  const { data } = await db().from("calls").select("claimed_by, handoff_note").eq("id", id).single();
  if (ACTION === "claim" && data?.claimed_by)
    return page("Already claimed", `<h2>Already claimed</h2><p>${esc(data.claimed_by)} has this lead.</p>`);
  const label = ACTION === "claim" ? "Claim this lead" : "I'm rescheduling this";
  return page(label, `<h2 style="margin-top:0">${label}</h2>
<form method="post"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="sig" value="${esc(sig!)}">
<label style="display:block;margin:12px 0 6px;font-size:14px">Your name</label>
<input name="by" value="${esc(by)}" required style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #D5DDDA;border-radius:6px;font-size:15px;margin-bottom:14px">
${btn(label)}</form>`);
}

export async function POST(req: NextRequest) {
  const f = await req.formData();
  const id = String(f.get("id") ?? ""), sig = String(f.get("sig") ?? ""), by = String(f.get("by") ?? "").trim() || "A designer";
  if (!verify(id, ACTION, sig)) return page("Link not valid", "<h2>This link isn't valid</h2>", 403);
  const supa = db();
  if (ACTION === "claim") {
    // Only claim if nobody has yet, so two designers can't both take it.
    const { data } = await supa.from("calls").update({ claimed_by: by, claimed_at: new Date().toISOString() })
      .eq("id", id).is("claimed_by", null).select("id");
    if (!data?.length) {
      const { data: c } = await supa.from("calls").select("claimed_by").eq("id", id).single();
      return page("Already claimed", `<h2>Already claimed</h2><p>${esc(c?.claimed_by ?? "Someone")} got there first.</p>`);
    }
    return page("Claimed", `<h2>It's yours, ${esc(by)}</h2><p>The lead is marked as claimed on Nikhil's dashboard.</p>`);
  }
  await supa.from("calls").update({ reschedule_requested_at: new Date().toISOString(), claimed_by: by }).eq("id", id);
  return page("Noted", "<h2>Noted</h2><p>Move the slot in the calendar and call the client to confirm the new time.</p>");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
