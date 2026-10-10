# Eval: 10 real September enquiries vs the live agent

Run on 10 Oct 2026 against production (`POST /api/eval`, dry run: no database row, email or HubSpot deal).
Model: gemini-3.8-flash (free tier). Rules: Nikhil's `qualified.md` and `services.md`.

| Call | What happened | Expected | Agent said | Deciding criterion | Match |
|---|---|---|---|---|---|
| T01 | Kothrud 3BHK, full redesign, done by March, owner | qualified | qualified | All five pass | ✅ |
| T02 | Wakad 2BHK, asked for a price twice | qualified | qualified, pricing flagged | Asking price does not disqualify | ✅ |
| T03 | Nashik home office | not a fit | not_fit | 2: service area | ✅ |
| T04 | Wants colour and furniture ideas only | not a fit | not_fit | 1: advice, not a project | ✅ |
| T07 | Living room + kitchen before Diwali (3 weeks) | not a fit | not_fit | 3: timeline | ✅ |
| T09 | Existing client, designer silent 5 days | complaint | complaint (front desk emailed) | Human only | ✅ |
| T10 | Kharadi 1BHK, volunteered ₹1–1.5 lakh | not a fit | not_fit | 4: volunteered budget too low | ✅ |
| T11 | Rented Baner 2BHK, no structural work | qualified | qualified | Rented is fine | ✅ |
| T14 | Son calling for parents, Hadapsar 3BHK | qualified + note | qualified, note says parents decide and will attend | 5: represented | ✅ |
| T19 | Restaurant in Koregaon Park | not a fit | not_fit | Out of scope (hospitality) | ✅ |

**10 / 10 correct.** No price, rate or estimate appeared in any handoff note.

Sample handoff note (T02):

```
Wants full redesign: modular kitchen, wardrobes, living room, and 2 bedrooms.
Property: 2BHK in Wakad (~950 sq ft).
Timeline: Design starting October, moving in November.
Budget band: Not specified.
Asked about pricing; told designer will cover it.
Found studio via Instagram.
```

Watch item: T02 wants to move in November with design starting in October, which is tight against the 6-week minimum. It is correctly qualified (the front desk accepted it), but the designer should confirm the timeline at the consultation.
