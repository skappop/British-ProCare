create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'no_show', 'cancelled')),
  visit_id uuid references visits(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_patient_id_idx on appointments(patient_id);
create index if not exists appointments_scheduled_at_idx on appointments(scheduled_at);
create index if not exists appointments_status_idx on appointments(status);

alter table appointments enable row level security;

create policy "authenticated_full_access" on appointments
  for all to authenticated using (true) with check (true);
