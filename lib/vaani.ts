import crypto from "node:crypto";

/** Verify X-VaaniYantra-Signature: sha256=<hex HMAC-SHA256 of raw body>. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type Turn = { role: "AGENT" | "CALLER" | string; text: string; startMs?: number };

export type NormalisedCall = {
  vaaniCallId: string;
  event: string;
  status: string;
  callerNumber: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number;
  summary: string;
  collected: Record<string, unknown>;
  transcript: Turn[];
  recordingUrl: string | null;
  bookedSlot: string | null;
};

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), o);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

/**
 * Vaani's webhook shape is documented loosely, so read it defensively.
 * Adjust the key lists below once you see a real payload in the Supabase log.
 */
export function normalise(payload: any): NormalisedCall {
  const c = payload?.data ?? payload?.call ?? payload;
  const transcriptRaw: any[] = pick(c, "transcript", "transcript.turns") ?? [];
  const collected = (pick(c, "collectedData", "collected_data") ?? {}) as Record<string, unknown>;
  return {
    vaaniCallId: String(pick(c, "id", "callId", "call_id") ?? crypto.randomUUID()),
    event: String(pick(payload, "event", "type") ?? "call.completed"),
    status: String(pick(c, "status") ?? "unknown"),
    callerNumber: (pick(c, "from", "fromNumber", "callerNumber", "caller.number") as string) ?? null,
    startedAt: (pick(c, "startedAt", "started_at", "createdAt") as string) ?? null,
    endedAt: (pick(c, "endedAt", "ended_at") as string) ?? null,
    durationSec: Number(pick(c, "duration", "durationSec", "duration_seconds") ?? 0),
    summary: String(pick(c, "summary") ?? ""),
    collected,
    transcript: Array.isArray(transcriptRaw)
      ? transcriptRaw.map((t) => ({
          role: t.role ?? t.speaker ?? "UNKNOWN",
          text: t.text ?? t.content ?? "",
          startMs: t.startMs ?? t.start_ms,
        }))
      : [],
    recordingUrl: (pick(c, "recordingUrl", "recording_url") as string) ?? null,
    bookedSlot:
      (pick(c, "appointment.startTime", "appointment.start", "booking.start") as string) ??
      (collected["booked_slot"] as string | undefined) ??
      null,
  };
}

/** Studio hours are 10am–7pm IST. */
export function isAfterHours(iso: string | null): boolean {
  const d = iso ? new Date(iso) : new Date();
  const hourIST = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(d)
  );
  return hourIST < 10 || hourIST >= 19;
}
