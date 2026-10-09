-- Handoff moved from Telegram to email (Resend).
alter table public.designers add column if not exists email text;
alter table public.calls rename column telegram_message_id to email_message_id;
alter table public.calls add column if not exists reschedule_requested_at timestamptz;
