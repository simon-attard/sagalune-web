-- Sagalune waitlist table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run)

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  source      text,
  referrer    text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Enable Row Level Security (RLS) with NO policies:
-- this locks down the table to everyone except the service_role key.
-- Our Vercel serverless function uses service_role and is the only writer.
alter table public.waitlist enable row level security;

-- Optional: index for faster lookups if you ever need to query by email
create index if not exists waitlist_email_idx on public.waitlist (email);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

-- Grant the service_role permission on the table (it has it by default, but explicit doesn't hurt)
grant all on public.waitlist to service_role;

-- Revoke from anon and authenticated to be safe (no public access at all)
revoke all on public.waitlist from anon;
revoke all on public.waitlist from authenticated;

-- ============================================================================
-- Useful queries once the waitlist starts filling up:
-- ============================================================================
--
-- Count:
--   select count(*) from waitlist;
--
-- Recent signups:
--   select email, source, created_at
--   from waitlist
--   order by created_at desc
--   limit 50;
--
-- Signups by day (last 30 days):
--   select date_trunc('day', created_at) as day, count(*)
--   from waitlist
--   where created_at > now() - interval '30 days'
--   group by day
--   order by day desc;
--
-- Export for email service import:
--   copy (select email, created_at from waitlist order by created_at)
--   to stdout with csv header;
-- ============================================================================
