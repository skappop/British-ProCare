-- Migration 24: optional scheduled payment plans.
-- Quick partial payments continue to work without a plan.

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  total_amount numeric not null check (total_amount >= 0),
  installment_count integer not null check (installment_count between 2 and 24),
  interval_days integer not null default 30 check (interval_days between 7 and 365),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans(id) on delete cascade,
  sequence integer not null check (sequence >= 1),
  due_at timestamptz not null,
  amount numeric not null check (amount >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  unique (plan_id, sequence)
);

alter table public.payments add column if not exists payment_plan_id uuid references public.payment_plans(id) on delete set null;
alter table public.payments add column if not exists installment_id uuid references public.payment_plan_installments(id) on delete set null;

create index if not exists payment_plans_patient_status_idx on public.payment_plans (patient_id, status, created_at desc);
create index if not exists payment_plan_installments_due_idx on public.payment_plan_installments (status, due_at);
create index if not exists payments_installment_idx on public.payments (installment_id);

alter table public.payment_plans enable row level security;
alter table public.payment_plan_installments enable row level security;

drop policy if exists "authenticated_full_access_payment_plans" on public.payment_plans;
create policy "authenticated_full_access_payment_plans" on public.payment_plans
  for all to authenticated using (true) with check (true);
drop policy if exists "authenticated_full_access_payment_plan_installments" on public.payment_plan_installments;
create policy "authenticated_full_access_payment_plan_installments" on public.payment_plan_installments
  for all to authenticated using (true) with check (true);
