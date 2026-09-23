-- 15 — Imaging from the website
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
-- Safe to re-run.
--
-- The Dental Agent now runs in the background on each chairside PC. The doctor
-- starts and ends imaging from the patient's page; the agent on the chosen PC
-- sees the request, opens the camera or X-ray software, and uploads each image
-- as it is taken. These two tables are how the website and the agents talk.

-- One row per PC running the agent. The agent generates its own id and
-- reports in every few seconds, so last_seen_at doubles as "is it online".
create table if not exists imaging_stations (
  id uuid primary key,
  name text not null,
  clinic_id uuid references clinics(id) on delete set null,
  last_seen_at timestamptz,
  agent_version text,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- One row per imaging session: requested on the website, carried out by the
-- agent, finished when every image has landed.
create table if not exists imaging_sessions (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references imaging_stations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  clinic_id uuid references clinics(id) on delete set null,
  mode text not null check (mode in ('intraoral', 'xray', 'both')),
  status text not null default 'requested'
    check (status in ('requested', 'active', 'uploading', 'completed', 'failed', 'cancelled')),
  end_requested boolean not null default false,
  images_captured integer not null default 0,
  images_uploaded integer not null default 0,
  images_failed integer not null default 0,
  message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

-- A PC can only image one patient at a time. Enforced here rather than only in
-- the app, so two people pressing Start at once cannot both win.
create unique index if not exists imaging_sessions_one_open_per_station
  on imaging_sessions (station_id)
  where status in ('requested', 'active', 'uploading');

create index if not exists imaging_sessions_patient_idx
  on imaging_sessions (patient_id, created_at desc);

create or replace function touch_imaging_session()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists imaging_sessions_touch on imaging_sessions;
create trigger imaging_sessions_touch
  before update on imaging_sessions
  for each row execute function touch_imaging_session();

alter table imaging_stations enable row level security;
alter table imaging_sessions enable row level security;

-- Staff read and request through the website. The agents never touch these
-- tables directly: they go through the bridge API with its own key.
drop policy if exists "authenticated_full_access" on imaging_stations;
create policy "authenticated_full_access" on imaging_stations
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on imaging_sessions;
create policy "authenticated_full_access" on imaging_sessions
  for all to authenticated using (true) with check (true);

-- Only sessions are published. Stations are rewritten by every heartbeat, a
-- few seconds apart; publishing them would re-render every open patient page
-- that often. The panel reads station status on its own timer instead.
do $$
declare
  t text;
begin
  foreach t in array array['imaging_sessions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
