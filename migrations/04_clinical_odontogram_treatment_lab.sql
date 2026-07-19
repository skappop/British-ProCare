alter table patients add column if not exists odontogram jsonb not null default '{}'::jsonb;

create table if not exists treatment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  started_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists treatment_plan_phases (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references treatment_plans(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  planned_weeks int,
  actual_start_date date,
  actual_end_date date,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  notes text
);
create index if not exists treatment_plan_phases_plan_id_idx on treatment_plan_phases(treatment_plan_id);

alter table visits add column if not exists treatment_plan_phase_id uuid references treatment_plan_phases(id) on delete set null;

alter table treatment_plans enable row level security;
alter table treatment_plan_phases enable row level security;
create policy "authenticated_full_access" on treatment_plans for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on treatment_plan_phases for all to authenticated using (true) with check (true);

create table if not exists lab_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  case_type text not null check (case_type in ('crown', 'bridge', 'denture', 'night_guard', 'retainer', 'other')),
  lab_name text,
  sent_at date not null default current_date,
  due_at date,
  received_at date,
  lab_fee numeric(10,2),
  status text not null default 'sent' check (status in ('sent', 'in_progress', 'received', 'fitted', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists lab_cases_patient_id_idx on lab_cases(patient_id);
create index if not exists lab_cases_status_idx on lab_cases(status);
alter table lab_cases enable row level security;
create policy "authenticated_full_access" on lab_cases for all to authenticated using (true) with check (true);
