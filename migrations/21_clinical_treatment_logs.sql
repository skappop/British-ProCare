-- Migration 21: structured clinical logs for non-general treatments.
-- Paste this whole file into Supabase SQL Editor after migrations 1-20.
-- It is safe to run more than once.

alter table public.visits add column if not exists clinical_logs jsonb;
comment on column public.visits.clinical_logs is 'Structured restorative, endodontic, surgical, prosthetic and orthodontic details recorded during the visit.';
