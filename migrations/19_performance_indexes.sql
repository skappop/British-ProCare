-- 19 — Speed for years of history
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
-- Optional but recommended. Adds lookup indexes to the oldest tables (visits,
-- the procedures on each visit, payments), which were created before these
-- migration files and may never have had them. Tested with three years of two
-- clinics' records: the Recall page went from 16 s to 0.2 s, Reports from
-- 4.6 s to under 0.1 s. Changes no data. Safe to run again: an index that
-- already exists, or a column that does not, is skipped.

do $$
declare
  ix record;
begin
  for ix in
    select * from (values
      ('visits_patient_date_idx',     'visits',           'patient_id, visit_date desc', array['patient_id', 'visit_date']),
      ('visits_visit_date_idx',       'visits',           'visit_date',                  array['visit_date']),
      ('visit_procedures_visit_idx',  'visit_procedures', 'visit_id',                    array['visit_id']),
      ('procedure_bom_procedure_idx', 'procedure_bom',    'procedure_id',                array['procedure_id']),
      ('procedure_bom_inventory_idx', 'procedure_bom',    'inventory_id',                array['inventory_id']),
      ('payments_patient_id_idx',     'payments',         'patient_id',                  array['patient_id']),
      ('payments_paid_at_idx',        'payments',         'paid_at',                     array['paid_at']),
      ('payments_created_at_idx',     'payments',         'patient_id, created_at',       array['patient_id', 'created_at']),
      ('patient_registrations_phone_idx', 'patient_registrations', 'phone, status',      array['phone', 'status'])
    ) as t(name, tbl, cols, needs)
  loop
    if to_regclass('public.' || ix.tbl) is not null
       and (select count(*) from information_schema.columns
             where table_schema = 'public' and table_name = ix.tbl and column_name = any(ix.needs)) = cardinality(ix.needs)
    then
      execute format('create index if not exists %I on public.%I (%s)', ix.name, ix.tbl, ix.cols);
    end if;
  end loop;
end $$;

analyze visits;
analyze payments;
