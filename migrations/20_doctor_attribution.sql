-- Migration 20: shared-PC doctor attribution, profiles, notes and ortho log
-- Paste this whole file into Supabase SQL Editor after migrations 1-19.
-- The statements are intentionally idempotent so it is safe to rerun.

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text,
  specialization text,
  phone text,
  email text,
  bio text,
  profile_image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctors add column if not exists title text;
alter table public.doctors add column if not exists specialization text;
alter table public.doctors add column if not exists phone text;
alter table public.doctors add column if not exists email text;
alter table public.doctors add column if not exists bio text;
alter table public.doctors add column if not exists profile_image_path text;
alter table public.doctors add column if not exists active boolean not null default true;
alter table public.doctors add column if not exists updated_at timestamptz not null default now();

create table if not exists public.doctor_clinics (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (doctor_id, clinic_id)
);

alter table public.appointments add column if not exists doctor_id uuid references public.doctors(id) on delete set null;
alter table public.visits add column if not exists doctor_id uuid references public.doctors(id) on delete set null;
alter table public.visits add column if not exists report_notes text;
alter table public.visits add column if not exists private_notes text;
alter table public.visits add column if not exists ortho_log jsonb;
alter table public.patients add column if not exists report_notes text;
alter table public.patients add column if not exists private_notes text;

update public.visits
set report_notes = notes
where report_notes is null and notes is not null and btrim(notes) <> '';

update public.visits
set ortho_log = ortho_quick_log
where ortho_log is null and ortho_quick_log is not null;

create index if not exists appointments_doctor_day_idx on public.appointments (doctor_id, status, scheduled_at);
create index if not exists visits_doctor_idx on public.visits (doctor_id, visit_date desc);
create index if not exists doctor_clinics_clinic_idx on public.doctor_clinics (clinic_id, doctor_id);

alter table public.doctors enable row level security;
alter table public.doctor_clinics enable row level security;

drop policy if exists "authenticated_full_access_doctors" on public.doctors;
create policy "authenticated_full_access_doctors" on public.doctors
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access_doctor_clinics" on public.doctor_clinics;
create policy "authenticated_full_access_doctor_clinics" on public.doctor_clinics
  for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('doctor-profiles', 'doctor-profiles', false)
on conflict (id) do nothing;

drop policy if exists "authenticated_read_doctor_profiles" on storage.objects;
create policy "authenticated_read_doctor_profiles" on storage.objects
  for select to authenticated
  using (bucket_id = 'doctor-profiles');

drop policy if exists "authenticated_write_doctor_profiles" on storage.objects;
create policy "authenticated_write_doctor_profiles" on storage.objects
  for all to authenticated
  using (bucket_id = 'doctor-profiles')
  with check (bucket_id = 'doctor-profiles');

comment on table public.doctors is 'Owner-managed clinician profiles used for shared-PC attribution.';
comment on table public.doctor_clinics is 'Clinics where each clinician can be selected by reception or the doctor.';
comment on column public.appointments.doctor_id is 'Optional doctor assignment made at booking or check-in.';
comment on column public.visits.doctor_id is 'Clinician who performed the visit; never inferred from the logged-in account.';
comment on column public.patients.report_notes is 'Patient-level notes included in generated clinical reports.';
comment on column public.patients.private_notes is 'Patient-level clinician notes excluded from generated reports.';
