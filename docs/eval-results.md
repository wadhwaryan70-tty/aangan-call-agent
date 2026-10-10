# Eval: the 20 real September phone enquiries against the live agent

Run on 10 Oct 2026 against https://aangan-call-agent-aryan.vercel.app (`POST /api/eval`, a dry run: no database row, email or CRM deal).
Model: gemini-3.8-flash (free tier). Rules: Nikhil's `qualified.md` and `services.md`, word for word; `pricing.md` is never loaded.
Cases: T01–T20 from the case pack (`Aangan_Sep 2026_Enquiries.pdf`), in `scripts/eval-cases.json`. Front-desk notes are removed, because the agent would not have them. Each case carries its real call date.
Rerun: `APP_URL=... VAANI_WEBHOOK_SECRET=... node scripts/run-eval.mjs`

| Call | Expected | Agent said | Deciding criterion | Price in output | Match |
|---|---|---|---|---|---|
| T01 | qualified | qualified | Passes all five criteria: full residential redesign and execution in Kothrud, timeline to March, and authorised decision-maker. | no | ✅ |
| T02 | qualified + pricing flag | qualified (asked price) | Passes all five criteria for a complete 2BHK interior redesign and execution in Wakad with a feasible timeline. | no | ✅ |
| T03 | not_fit | not_fit | The project is located in Nashik, which is outside our Pune and PCMC service area (Criterion 2). | no | ✅ |
| T04 | not_fit | not_fit | Fails Criterion 1 (Real project — not just advice) as the caller is seeking ideas and consultation on colours and layout without execution. | no | ✅ |
| T05 | qualified | qualified | Passes all five criteria including full scope redesign and execution, Koregaon Park location, and a realistic 4-month timeline. | no | ✅ |
| T06 | qualified | qualified | Passes all five rubric criteria for a full design and execution office fitout in Baner within a viable timeline. | no | ✅ |
| T07 | not_fit | not_fit | Fails criterion 3 (realistic timeline) as the client required completion within three weeks before Diwali. | no | ✅ |
| T08 | unclear | unclear | Call did not connect | no | ✅ |
| T09 | complaint | complaint | Existing client with an ongoing project reporting lack of response from assigned designer. | no | ✅ |
| T10 | not_fit | not_fit | Fails Criterion 4 (Budget band) as the volunteered budget is significantly below the scope for a kitchen and bedroom execution. | no | ✅ |
| T11 | qualified | qualified | Passes all criteria: real design and execution scope for a rented 2BHK in Baner with no structural changes. | no | ✅ |
| T12 | qualified | qualified | Passes all five criteria: full end-to-end residential project in Kalyani Nagar with a realistic timeline for March move-in and an available site. | no | ✅ |
| T13 | qualified + pricing flag | qualified (asked price) | Passes all criteria as a real residential redesign project in Aundh within our service area. | no | ✅ |
| T14 | qualified | qualified | Passes location and project scope criteria; decision-maker criterion is uncertain but treated as qualified per rubric since parents will attend the consultation. | no | ✅ |
| T15 | qualified | qualified | Passes all five criteria: full home scope in Undri, site ready for design now with possession in six weeks, and decision-maker authorized to book. | no | ✅ |
| T16 | qualified | qualified | Passes Criterion 1 and Criterion 2 as a 3BHK home project located in Viman Nagar, Pune, with no disqualifying factors. | no | ✅ |
| T17 | qualified | qualified | Passes all criteria: real residential redesign and execution project in Pimple Saudagar with a realistic timeline. | no | ✅ |
| T18 | not_fit | not_fit | Criterion 1: Project scope of a 180 sq ft commercial pod is too small for our minimum engagement. | no | ✅ |
| T19 | not_fit | not_fit | Failed Criterion 1 (scope of project) as restaurant and hospitality interiors are outside our service scope. | no | ✅ |
| T20 | qualified | qualified | Passes all five criteria: full 2BHK interior redesign project located in Magarpatta with realistic timeline and verified decision-maker. | no | ✅ |

**20 / 20 correct.**

## What the eval changed

| Run | Score | Fix |
|---|---|---|
| 1 | 9 / 10 (reconstructed transcripts) | — |
| 2 | 19 / 20 (real transcripts) | The classifier now gets the **date of the call**. T02 ("we move in November", said on 3 Sep) had been judged against today's date. |
| 3 | **20 / 20** | **Complaint means an existing client.** T16, a new prospect annoyed that we missed his callback, had been routed to the front desk as a complaint and would never reach a designer. He is now qualified, with a "Handle with care" note. |

Expected labels apply Nikhil's rubric: T05, T12 (site visit asked for) and T15 (6 weeks to possession) are qualified; T08 (missed call, no conversation) is unclear; T18 (180 sq ft pod) is not a fit on minimum scope.
