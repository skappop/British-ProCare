-- Phase: Bridge active-patient state
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query)
--
-- /api/bridge/active-patient used to hold the active patient in a module-level
-- variable. That cannot work on Vercel: every serverless instance has its own
-- memory, so the browser's POST and the local agent's polling GET land on
-- different instances and the agent almost always reads back null. This table
-- moves that state into Postgres, where both sides see the same row.

create table if not exists active_patient (
  station text primary key default 'default',
  patient_id uuid references patients(id) on delete set null,
  set_by uuid references auth.users(id) on delete set null,
  last_activity timestamptz not null default now()
);

alter table active_patient enable row level security;

drop policy if exists "authenticated_full_access" on active_patient;
create policy "authenticated_full_access" on active_patient
  for all to authenticated using (true) with check (true);

-- Single shared workstation slot, matching the existing bridge/agent clients
-- (they send no station, so they all use 'default').
insert into active_patient (station, patient_id)
values ('default', null)
on conflict (station) do nothing;
