/** Tiny HTML page for the claim / reschedule links. */
export function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#F3F5F4;color:#16211F;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border:1px solid #D5DDDA;border-radius:12px;padding:28px;max-width:420px;width:100%">${body}</div></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
export const btn = (label: string) =>
  `<button type="submit" style="background:#1F5E57;color:#fff;border:0;border-radius:6px;padding:10px 18px;font-size:15px;cursor:pointer">${label}</button>`;
