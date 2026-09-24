-- Phase 11: Payments & Ledger
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query)

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'instapay', 'other')),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payments_patient_id_idx on payments(patient_id);
create index if not exists payments_visit_id_idx on payments(visit_id);
create index if not exists payments_paid_at_idx on payments(paid_at);

alter table payments enable row level security;

-- Same policy shape as your other authenticated-only tables.
-- If your existing tables use a different policy name/condition, mirror that instead.
create policy "Authenticated users full access to payments"
  on payments for all
  to authenticated
  using (true)
  with check (true);

-- Patient balance view: total charged vs total paid, computed on the fly.
create or replace view patient_balances as
select
  p.id as patient_id,
  p.full_name,
  coalesce(v.total_charged, 0) as total_charged,
  coalesce(pay.total_paid, 0) as total_paid,
  coalesce(v.total_charged, 0) - coalesce(pay.total_paid, 0) as balance
from patients p
left join (
  select patient_id, sum(fee_charged) as total_charged
  from visits
  where fee_charged is not null
  group by patient_id
) v on v.patient_id = p.id
left join (
  select patient_id, sum(amount) as total_paid
  from payments
  group by patient_id
) pay on pay.patient_id = p.id;
