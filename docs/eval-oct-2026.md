# Eval: 10 September cases against the live agent

Run on 10 Oct 2026 against https://aangan-call-agent-aryan.vercel.app (`POST /api/eval`, dry run: no database row, email or HubSpot deal).
Model: gemini-3.8-flash (free tier). Rules: Nikhil's `qualified.md` and `services.md`; `pricing.md` never loaded.
Transcripts: short reconstructions of the September enquiries from the class guide (`scripts/eval-cases.json`). Rerun with `node scripts/run-eval.mjs`.

| Call | Expected | Agent said | Deciding criterion | Price in output | Match |
|---|---|---|---|---|---|
| T01 | qualified | qualified | Passes all five: full home in Kothrud, possession ready, realistic timeline, decision-maker on board | no | ✅ |
| T02 | qualified + pricing flag | not_fit (asked price) | Criterion 3: full 2BHK designed and executed in about a month | no | ❌ |
| T03 | not_fit | not_fit | Criterion 2: service area (Nashik) | no | ✅ |
| T04 | not_fit | not_fit | Criterion 1: ideas only, caller will execute themselves | no | ✅ |
| T07 | not_fit | not_fit | Criterion 3: must be done in three weeks, no flexibility | no | ✅ |
| T09 | complaint | complaint | Existing client, designer unresponsive, site work halted | no | ✅ |
| T10 | not_fit | not_fit | Criterion 4: volunteered budget far below a full flat | no | ✅ |
| T11 | qualified | qualified | Passes all five: rented Baner 2BHK, no structural work, authorised | no | ✅ |
| T14 | qualified | qualified | Passes all five: parents decide and will attend the consultation | no | ✅ |
| T19 | not_fit | not_fit | Out of scope: restaurant (hospitality) | no | ✅ |

**9 / 10 correct. No price, rate or estimate in any output.**

**T02:** the reconstructed transcript says "design in October, move in November", which on 10 October is 3–7 weeks for a full 2BHK. The model applied Nikhil's 6-week minimum. The pricing behaviour (flagged, not disqualifying, never quoted) held. Not tuned away: rerun with the real T02 transcript from the case pack.
