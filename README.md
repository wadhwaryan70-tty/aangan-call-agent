# Aangan Call Agent

An AI front desk for **Aangan Studio**, an interior design studio in Pune (MESA Case 03).
It answers every call to the studio number, day or night, qualifies the caller against the founder's own rules, books a consultation inside the call, and emails the designer everything that was already asked.

> **Live:** https://aangan-call-agent.vercel.app (dashboard is password protected, user `aangan`)

## How a call flows

```
📞 Call ──► Vaani Labs voice agent ──► intake + qualify + book slot (live, on the call)
                 │
                 ▼  webhook: call.completed
        /api/vaani/webhook  (this app, on Vercel)
                 │  verify signature → log to Supabase
                 ▼
        Gemini Flash classifies against knowledge/qualified.md
                 │
   ┌─────────────┼───────────────┬─────────────────┐
qualified     not a fit       complaint          unclear
   │              │               │                 │
   ├─ email designer (Resend)     └─ email front desk
   ├─ HubSpot deal                                  │
   └──────────────┴───────────────┴─────────────────┴──► Supabase call log ──► dashboard
```

**The Cut (check 06):** the agent never quotes a price. `pricing.md` is never loaded, and a filter strips any rate or estimate from the designer note.

## Stack

| Class stack | Role here |
|---|---|
| Claude Chat | Wrote the qualification logic and call script (`vaani/agent-setup.md`) |
| Claude Code | Built this repo end to end |
| Vaani Labs | Voice, telephony and call orchestration |
| Gemini Flash | Call classification, routing and the handoff note |
| Cal.com / Google Calendar | Consultation booking inside the call (via Vaani booking) |
| Resend | Designer handoff email, chosen over Telegram (see `docs/case-brief.md`) |
| HubSpot | Qualified calls become deals |
| Supabase | Call log and state (`supabase/migrations`) |
| Vercel | Hosts the webhook and Nikhil's dashboard |
| GitHub | This repo |

## Repo layout

```
app/
  api/vaani/webhook/     Vaani posts every finished call here
  api/lead/claim/        "Claim this lead" button in the email
  api/lead/reschedule/   "Reschedule" button in the email
  page.tsx               Nikhil's dashboard: calls, qualified, booked, wins, cost
lib/                     gemini, email (Resend), hubspot, supabase, vaani, signed links
knowledge/               qualified.md + services.md (pricing.md deliberately absent)
vaani/agent-setup.md     Paste-ready script and settings for the Vaani agent
supabase/migrations/     Database schema
scripts/                 Fake webhook for testing without a real call
docs/                    Case brief, nine checks, component map
```

## Setup

1. `cp .env.example .env.local` and fill in the keys (each line says where to get it).
2. `npm install && npm run dev`
3. Apply `supabase/migrations/*.sql` in order (already applied on the live project).
4. Add designers in Supabase → `designers` (name, email, specialties `{home}` or `{office}`).
5. Deploy to Vercel and add the same env vars there.
6. Configure the Vaani agent from `vaani/agent-setup.md`, with the webhook pointing at `/api/vaani/webhook`.
7. Test without a real call:
   `VAANI_WEBHOOK_SECRET=... bash scripts/send-test-webhook.sh https://aangan-call-agent.vercel.app`

## Dashboard metrics

Calls answered · after-hours calls · qualified · consultations booked · show-ups · projects won (₹) · cost to run (voice + AI) · cost per booking.
Mark `showed_up`, `project_won` and `project_value_inr` on a call row to complete the funnel.

## Extending to WhatsApp and the web form

Only the trigger and input change: add a webhook route per channel that normalises into the same `NormalisedCall` shape. Classification, handoff, CRM and dashboard are reused.
