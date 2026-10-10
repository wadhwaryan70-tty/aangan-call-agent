import crypto from "node:crypto";

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** VaaniYantra-style HMAC header: X-VaaniYantra-Signature: sha256=<hex>. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  return safeEq(header, "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex"));
}

/**
 * Vaani AI (vaanivoice.ai) webhooks are unsigned, so the URL carries a secret:
 * /api/vaani/webhook?token=<VAANI_WEBHOOK_SECRET>. Either check passes.
 */
export function verifyRequest(rawBody: string, sigHeader: string | null, token: string | null, secret: string): boolean {
  return verifySignature(rawBody, sigHeader, secret) || (!!token && safeEq(token, secret));
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

/** "[13:33:14] AGENT: hi\n\n[13:33:19] USER: hello" -> turns */
export function parseTranscriptString(t: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of t.split(/\n+/)) {
    const m = line.match(/^\s*(?:\[[^\]]*\]\s*)?(AGENT|USER|CALLER|BOT|ASSISTANT|CUSTOMER)\s*:\s*(.*)$/i);
    if (m) turns.push({ role: /^(USER|CALLER|CUSTOMER)$/i.test(m[1]) ? "CALLER" : "AGENT", text: m[2].trim() });
    else if (line.trim() && turns.length) turns[turns.length - 1].text += " " + line.trim();
  }
  return turns;
}

/**
 * Reads both Vaani AI (vaanivoice.ai: call_started / call_ended / call_postprocessing)
 * and VaaniYantra (call.completed) payloads defensively.
 */
export function normalise(payload: any): NormalisedCall {
  const c = payload?.data ?? payload?.call ?? payload;
  const tRaw = pick(c, "transcript", "transcript.turns");
  const entities = (pick(c, "entities") ?? {}) as Record<string, unknown>;
  const dispositions = (pick(c, "dispositions") ?? {}) as Record<string, unknown>;
  const collected: Record<string, unknown> = {
    ...((pick(c, "collectedData", "collected_data") ?? {}) as Record<string, unknown>),
    ...entities,
    ...(Object.keys(dispositions).length ? { dispositions } : {}),
  };
  const event = String(pick(payload, "event", "type") ?? "call.completed");
  // Vaani AI reports call_duration in milliseconds on call_postprocessing, seconds on call_ended.
  const rawDur = Number(pick(c, "call_duration", "duration", "durationSec", "duration_seconds", "call_details.call_duration", "call_details.duration") ?? 0);
  const durationSec = event === "call_postprocessing" ? Math.round(rawDur / 1000) : Math.round(rawDur);
  const endedAt = (pick(c, "endedAt", "ended_at") as string) ?? (pick(payload, "timestamp") as string) ?? null;
  const startedAt =
    (pick(c, "startedAt", "started_at", "createdAt") as string) ??
    (endedAt && durationSec ? new Date(new Date(endedAt).getTime() - durationSec * 1000).toISOString() : null);
  const slotGuess = ["booked_slot", "appointment_time", "consultation_slot", "slot", "appointment"]
    .map((k) => entities[k]).find((v) => typeof v === "string" && !isNaN(Date.parse(v as string))) as string | undefined;
  return {
    vaaniCallId: String(pick(c, "room_name", "id", "callId", "call_id") ?? pick(payload, "room_name", "call_id") ?? crypto.randomUUID()),
    event,
    status: String(pick(c, "status", "end_reason") ?? "unknown"),
    callerNumber:
      (pick(c, "phone_number", "from", "fromNumber", "callerNumber", "caller.number") as string) ??
      (pick(payload, "phone_number") as string) ??
      ((entities["phone"] ?? entities["phone_number"]) as string | undefined) ??
      null,
    startedAt,
    endedAt,
    durationSec,
    summary: String(pick(c, "summary") ?? ""),
    collected,
    transcript: typeof tRaw === "string"
      ? parseTranscriptString(tRaw)
      : Array.isArray(tRaw)
      ? tRaw.map((t: any) => ({ role: t.role ?? t.speaker ?? "UNKNOWN", text: t.text ?? t.content ?? "", startMs: t.startMs ?? t.start_ms }))
      : [],
    recordingUrl: (pick(c, "recordingUrl", "recording_url") as string) ?? null,
    bookedSlot:
      (pick(c, "appointment.startTime", "appointment.start", "booking.start") as string) ??
      slotGuess ??
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
