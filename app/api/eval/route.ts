import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { classifyCall } from "@/lib/gemini";
import { parseTranscriptString, verifyRequest } from "@/lib/vaani";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Dry run: classify a transcript with the live rules and model, with NO side effects
 * (no database row, no email, no HubSpot deal). Used to test past enquiries.
 * POST /api/eval?token=<VAANI_WEBHOOK_SECRET>  body: { id, transcript }
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyRequest(raw, null, req.nextUrl.searchParams.get("token"), env("VAANI_WEBHOOK_SECRET"))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const { id, transcript, call_date } = JSON.parse(raw);
  const turns = parseTranscriptString(String(transcript));
  // Same rule as the webhook: a call with no conversation is logged as unclear without the AI step.
  if (!turns.length) return NextResponse.json({ id, turns: 0, classification: "unclear", fit_reason: "Call did not connect", asked_pricing: false });
  const started = call_date && !isNaN(Date.parse(call_date)) ? new Date(Date.parse(call_date)).toISOString() : null;
  const { result } = await classifyCall({
    vaaniCallId: id ?? "eval", event: "eval", status: "eval", callerNumber: null,
    startedAt: started, endedAt: null, durationSec: 0, summary: "", collected: {},
    transcript: turns, recordingUrl: null, bookedSlot: null,
  });
  return NextResponse.json({ id, turns: turns.length, ...result });
}
