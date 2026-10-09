import { env } from "./env";

/** Send through Resend's REST API. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`);
  return data.id as string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function handoffEmail(o: {
  heading: string;
  facts: [string, string | null | undefined][];
  note: string;
  buttons: { label: string; url: string }[];
  footer?: string;
}) {
  const facts = o.facts.filter(([, v]) => v);
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;color:#16211F">
  <h2 style="margin:0 0 12px;font-size:20px">${esc(o.heading)}</h2>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:14px">${facts
    .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#56635F">${esc(k)}</td><td style="padding:3px 0">${esc(String(v))}</td></tr>`)
    .join("")}</table>
  <div style="white-space:pre-wrap;font-size:14px;line-height:1.5;background:#F3F5F4;border-radius:8px;padding:12px 14px">${esc(o.note)}</div>
  <p style="margin:18px 0">${o.buttons
    .map((b, i) => `<a href="${b.url}" style="display:inline-block;margin-right:8px;padding:9px 16px;border-radius:6px;text-decoration:none;font-size:14px;${i === 0 ? "background:#1F5E57;color:#fff" : "border:1px solid #1F5E57;color:#1F5E57"}">${esc(b.label)}</a>`)
    .join("")}</p>
  ${o.footer ? `<p style="font-size:12px;color:#56635F">${esc(o.footer)}</p>` : ""}
</div>`;
  const text = [o.heading, "", ...facts.map(([k, v]) => `${k}: ${v}`), "", o.note, "", ...o.buttons.map((b) => `${b.label}: ${b.url}`), o.footer ?? ""].join("\n");
  return { html, text };
}
