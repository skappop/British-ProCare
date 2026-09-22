-- 13 — Two-clinic routing + live board updates
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
--
-- Patients stay shared: one chart per person, with each visit attributed to the
-- clinic it happened at. Only appointments and visits carry a clinic.

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table clinics enable row level security;

drop policy if exists "authenticated_full_access" on clinics;
create policy "authenticated_full_access" on clinics
  for all to authenticated using (true) with check (true);

-- Seed only when empty, so renaming a clinic later is not undone by a re-run.
insert into clinics (name, short_name, sort_order)
select * from (values
  ('Clinic 1', 'C1', 1),
  ('Clinic 2', 'C2', 2)
) as seed(name, short_name, sort_order)
where not exists (select 1 from clinics);

-- Where the work happens. Null means "not routed yet", so existing rows stay valid.
alter table appointments add column if not exists clinic_id uuid references clinics(id) on delete set null;
alter table visits       add column if not exists clinic_id uuid references clinics(id) on delete set null;

create index if not exists appointments_clinic_day_idx on appointments (clinic_id, status, scheduled_at);
create index if not exists visits_clinic_idx           on visits (clinic_id);

-- Live updates: without these the board only refreshes for whoever clicked, so
-- reception sending a patient never reaches the doctor's screen.
do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'visits', 'payments', 'image_records'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
