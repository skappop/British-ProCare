-- 14 — Patient self-registration
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
-- Safe to re-run.
--
-- Patients fill in their details on a public page before they arrive. The form
-- is public, so submissions land HERE rather than in patients: anyone can post
-- to it, and writing straight into a patient's chart would let someone who
-- knows a phone number rewrite that patient's allergies. Reception confirms
-- each one with a tap, which is when it becomes (or updates) a patient.

create table if not exists patient_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name text not null,
  phone text not null,
  date_of_birth date,
  gender text,
  reason text,
  preferred_clinic_id uuid references clinics(id) on delete set null,
  medical_history jsonb not null default '{}'::jsonb,
  consent boolean not null default false,

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  patient_id uuid references patients(id) on delete set null,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create index if not exists patient_registrations_pending_idx
  on patient_registrations (status, created_at desc);

alter table patient_registrations enable row level security;

-- Staff only. There is deliberately no anon policy: the public page writes
-- through a server action, so the table itself is never exposed to the internet.
drop policy if exists "authenticated_full_access" on patient_registrations;
create policy "authenticated_full_access" on patient_registrations
  for all to authenticated using (true) with check (true);

-- Live updates: new registrations appear at reception, and the patients list
-- refreshes on its own.
do $$
declare
  t text;
begin
  foreach t in array array['patient_registrations', 'patients'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
