-- Migration 22: transparent visit pricing and discounts.
-- Paste after migrations 1-21. Safe to rerun.

alter table public.visits add column if not exists gross_fee numeric;
alter table public.visits add column if not exists discount_type text;
alter table public.visits add column if not exists discount_value numeric not null default 0;
alter table public.visits add column if not exists discount_amount numeric not null default 0;
alter table public.visits add column if not exists discount_note text;

update public.visits
set gross_fee = fee_charged
where gross_fee is null and fee_charged is not null;

comment on column public.visits.gross_fee is 'Price before any receptionist discount.';
comment on column public.visits.discount_type is 'percent or fixed, when a discount was applied.';
comment on column public.visits.discount_value is 'The entered discount value before calculation.';
comment on column public.visits.discount_amount is 'The calculated amount deducted from gross_fee.';
comment on column public.visits.discount_note is 'Optional reason for the discount, shown on invoices.';
