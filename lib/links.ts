import crypto from "node:crypto";
import { env } from "./env";

/** Signed action links in the handoff email, so only the email's recipient can claim. */
export function sign(callId: string, action: string): string {
  return crypto.createHmac("sha256", env("LINK_SECRET")).update(`${action}:${callId}`).digest("hex").slice(0, 32);
}
export function verify(callId: string, action: string, sig: string | null): boolean {
  if (!sig) return false;
  const a = Buffer.from(sign(callId, action));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function actionUrl(callId: string, action: "claim" | "reschedule", by?: string): string {
  const u = new URL(`/api/lead/${action}`, env("APP_URL"));
  u.searchParams.set("id", callId);
  u.searchParams.set("sig", sign(callId, action));
  if (by) u.searchParams.set("by", by);
  return u.toString();
}
