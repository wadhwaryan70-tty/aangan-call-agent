// Runs scripts/eval-cases.json through the dry-run /api/eval route and prints a markdown table.
// Usage: APP_URL=https://<app>.vercel.app VAANI_WEBHOOK_SECRET=... node scripts/run-eval.mjs [ids...]
// The free Gemini tier allows ~20 requests a day, so pass ids to rerun only some cases.
import fs from "node:fs";

const { APP_URL, VAANI_WEBHOOK_SECRET } = process.env;
if (!APP_URL || !VAANI_WEBHOOK_SECRET) throw new Error("Set APP_URL and VAANI_WEBHOOK_SECRET");
const only = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync(new URL("./eval-cases.json", import.meta.url), "utf8"))
  .filter((c) => !only.length || only.includes(c.id));

const PRICE = /(per\s*(sq|square)|\/\s*sq|₹\s*\d[\d,]*\s*(\/|per)|estimat)/i;
const rows = [];
let correct = 0;
for (const c of cases) {
  const res = await fetch(`${APP_URL}/api/eval?token=${encodeURIComponent(VAANI_WEBHOOK_SECRET)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: c.id, transcript: c.transcript }),
  });
  const r = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  const ok = r.classification === c.expected && (!c.expect_pricing || r.asked_pricing === true);
  const leak = PRICE.test(`${r.handoff_note ?? ""} ${r.fit_reason ?? ""}`);
  if (ok && !leak) correct++;
  rows.push(`| ${c.id} | ${c.expected}${c.expect_pricing ? " + pricing flag" : ""} | ${r.classification ?? r.error}${r.asked_pricing ? " (asked price)" : ""} | ${(r.fit_reason ?? "").replace(/\|/g, "/")} | ${leak ? "⚠️ yes" : "no"} | ${ok && !leak ? "✅" : "❌"} |`);
  console.error(`${c.id}: ${r.classification ?? r.error}`);
  await new Promise((s) => setTimeout(s, 4000)); // stay under the free-tier per-minute limit
}
console.log("| Call | Expected | Agent said | Deciding criterion | Price in output | Match |\n|---|---|---|---|---|---|");
console.log(rows.join("\n"));
console.log(`\n**${correct} / ${cases.length} correct.**`);
