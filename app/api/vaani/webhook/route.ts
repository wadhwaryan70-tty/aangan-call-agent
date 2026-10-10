import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { env, optionalEnv } from "@/lib/env";
import { isAfterHours, normalise, verifyRequest } from "@/lib/vaani";
import { classifyCall } from "@/lib/gemini";
import { sendEmail, handoffEmail } from "@/lib/email";
import { actionUrl } from "@/lib/links";
import { createDeal } from "@/lib/hubspot";

export const runtime = "nodejs";
export const maxDuration = 30;

const fmtSlot = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const token = req.nextUrl.searchParams.get("token");
  if (!verifyRequest(raw, req.headers.get("x-vaaniyantra-signature"), token, env("VAANI_WEBHOOK_SECRET"))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const call = normalise(JSON.parse(raw));
  const supa = db();

  // Vaani AI sends several lifecycle events per call. Only call_started (caller's number)
  // and the final call_postprocessing matter; acknowledge the rest.
  if (call.event === "call_started") {
    await supa.from("calls").upsert(
      { vaani_call_id: call.vaaniCallId, caller_number: call.callerNumber, status: "in_progress",
        started_at: new Date().toISOString(), after_hours: isAfterHours(null) },
      { onConflict: "vaani_call_id" }
    );
    return NextResponse.json({ ok: true, stored: "call_started" });
  }
  const FINAL = ["call_postprocessing", "call.completed", "call.failed", "call_failed"];
  if (!FINAL.includes(call.event)) return NextResponse.json({ ok: true, ignored: call.event });

  // Idempotency: Vaani may retry. Skip calls we've already classified.
  const { data: existing } = await supa
    .from("calls").select("id, classification").eq("vaani_call_id", call.vaaniCallId).maybeSingle();
  if (existing?.classification) return NextResponse.json({ ok: true, duplicate: true });

  const voiceCost = (call.durationSec / 60) * Number(process.env.VAANI_RATE_INR_PER_MIN ?? 5);
  const failed = call.event === "call.failed" || call.event === "call_failed";
  // Drop empty values so we don't wipe the caller number / start time saved at call_started.
  const base = Object.fromEntries(Object.entries({
    vaani_call_id: call.vaaniCallId,
    caller_number: call.callerNumber,
    status: failed ? "failed" : call.status,
    started_at: call.startedAt,
    ended_at: call.endedAt,
    duration_sec: call.durationSec,
    after_hours: call.startedAt ? isAfterHours(call.startedAt) : null,
    recording_url: call.recordingUrl,
    summary: call.summary,
    collected: call.collected,
    transcript: call.transcript,
    booked_slot: call.bookedSlot,
    cost_voice_inr: voiceCost,
  }).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  const { data: row, error } = await supa.from("calls").upsert(base, { onConflict: "vaani_call_id" }).select("id, caller_number, started_at").single();
  if (error) throw error;
  call.callerNumber = call.callerNumber ?? row.caller_number ?? null;
  // Vaani AI does not always send call_duration; derive it from call_started -> end.
  if (!call.durationSec && row.started_at) {
    const end = call.endedAt ? new Date(call.endedAt).getTime() : Date.now();
    const sec = Math.max(0, Math.round((end - new Date(row.started_at).getTime()) / 1000));
    if (sec > 0 && sec < 3600) {
      call.durationSec = sec;
      await supa.from("calls").update({
        duration_sec: sec,
        cost_voice_inr: (sec / 60) * Number(process.env.VAANI_RATE_INR_PER_MIN ?? 5),
      }).eq("id", row.id);
    }
  }

  // A call that never connected is logged for the dashboard but not classified.
  if (failed || call.transcript.length === 0) {
    await supa.from("calls").update({ classification: "unclear", fit_reason: "Call did not connect" }).eq("id", row.id);
    return NextResponse.json({ ok: true, classified: "unclear" });
  }

  // If the AI step fails, never lose the lead: log the error and send the raw call to the front desk.
  let classified;
  try {
    classified = await classifyCall(call);
  } catch (e: any) {
    const reason = `AI step failed: ${String(e?.message ?? e).slice(0, 300)}`;
    await supa.from("calls").update({ classification: "unclear", fit_reason: reason }).eq("id", row.id);
    try {
      const { html, text } = handoffEmail({
        heading: "New call: AI could not classify it, please review",
        facts: [["Phone", call.callerNumber], ["Duration", `${Math.round(call.durationSec / 60)} min`]],
        note: [call.summary, "", ...call.transcript.map((t) => `${t.role}: ${t.text}`)].join("\n"),
        buttons: call.recordingUrl ? [{ label: "Recording", url: call.recordingUrl }] : [],
      });
      await sendEmail({ to: env("FRONT_DESK_EMAIL"), subject: `[Review] Call from ${call.callerNumber ?? "unknown"}`, html, text });
    } catch {}
    return NextResponse.json({ ok: false, error: reason }, { status: 200 });
  }
  const { result, costInr } = classified;

  // Route: match designer by segment, then the one with the fewest leads this week.
  let designer: { id: string; name: string; email: string | null } | null = null;
  if (result.classification === "qualified") {
    const { data: ds } = await supa.from("designers").select("id, name, email, specialties").eq("active", true);
    const pool = (ds ?? []).filter((d) => result.segment === "unknown" || (d.specialties ?? []).includes(result.segment));
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const loads = await Promise.all(
      (pool.length ? pool : ds ?? []).map(async (d) => {
        const { count } = await supa.from("calls").select("id", { count: "exact", head: true })
          .eq("designer_id", d.id).gte("created_at", weekAgo);
        return { d, count: count ?? 0 };
      })
    );
    designer = loads.sort((a, b) => a.count - b.count)[0]?.d ?? null;
  }

  const L = result.lead;
  const update: Record<string, unknown> = {
    classification: result.classification,
    fit_reason: result.fit_reason,
    asked_pricing: result.asked_pricing,
    handoff_note: result.handoff_note,
    designer_id: designer?.id ?? null,
    cost_llm_inr: costInr,
  };

  // Outputs. Each is best-effort so one failing service doesn't lose the lead.
  const errors: string[] = [];
  const frontDesk = env("FRONT_DESK_EMAIL");

  if (result.classification === "qualified") {
    const slot = call.bookedSlot ? fmtSlot(call.bookedSlot) : null;
    const who = L.name ?? "New caller";
    const subject = slot
      ? `New consultation ${slot}: ${who}, ${L.property_type ?? "interiors"}, ${L.area ?? "Pune"}`
      : `Qualified lead, no slot booked: ${who}, ${L.area ?? "Pune"}`;
    const { html, text } = handoffEmail({
      heading: slot ? `New consultation: ${slot}` : "New qualified lead (no slot booked)",
      facts: [
        ["Client", L.name], ["Phone", call.callerNumber], ["Area", L.area], ["Property", L.property_type],
        ["Size", L.size_sqft ? `~${L.size_sqft} sq ft` : null], ["Scope", L.scope],
        ["Budget band", L.budget_band], ["Timeline", L.timeline],
        ["Assigned to", designer?.name ?? "Unassigned, first to claim takes it"],
      ],
      note: result.handoff_note,
      buttons: [
        { label: "Claim this lead", url: actionUrl(row.id, "claim", designer?.name) },
        { label: "Reschedule", url: actionUrl(row.id, "reschedule", designer?.name) },
        ...(call.recordingUrl ? [{ label: "Recording", url: call.recordingUrl }] : []),
        ...(!slot && optionalEnv("CALCOM_BOOKING_URL") ? [{ label: "Booking link for client", url: process.env.CALCOM_BOOKING_URL! }] : []),
      ],
      footer: "Sent by the Aangan call agent. Pricing was not discussed on the call; the client expects it from you.",
    });
    try {
      update.email_message_id = await sendEmail({ to: designer?.email ?? frontDesk, subject, html, text });
    } catch (e: any) { errors.push(e.message); }

    // HubSpot is optional: skip quietly until a token is configured.
    if (optionalEnv("HUBSPOT_PRIVATE_APP_TOKEN")) try {
      update.hubspot_deal_id = await createDeal({
        phone: call.callerNumber,
        name: L.name,
        dealName: `${L.name ?? "Caller"} · ${L.property_type ?? "Interiors"} · ${L.area ?? "Pune"}`,
        description: result.handoff_note,
      });
    } catch (e: any) { errors.push(e.message); }
  }

  if (result.classification === "complaint") {
    const { html, text } = handoffEmail({
      heading: "Needs a human: first thing tomorrow",
      facts: [["Phone", call.callerNumber], ["Name", L.name]],
      note: result.handoff_note,
      buttons: call.recordingUrl ? [{ label: "Recording", url: call.recordingUrl }] : [],
      footer: "The agent took a message and made no commitments.",
    });
    try {
      await sendEmail({ to: frontDesk, subject: `[Action needed] Caller ${call.callerNumber ?? ""} needs a human`, html, text });
    } catch (e: any) { errors.push(e.message); }
  }

  await supa.from("calls").update(update).eq("id", row.id);
  if (errors.length) console.error("Output errors", errors);
  return NextResponse.json({ ok: true, classified: result.classification, errors });
}
