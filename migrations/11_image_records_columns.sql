-- Bring image_records up to the shape the upload path actually writes.
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
--
-- Symptom this fixes: uploads reach storage but every insert fails, so the
-- agent reports "No images could be registered". That happens when the live
-- table predates the columns the bridge and agent write.
--
-- Every statement is idempotent; running it twice is harmless.

alter table image_records add column if not exists storage_path text;
alter table image_records add column if not exists image_type   text;
alter table image_records add column if not exists category     text;
alter table image_records add column if not exists source       text default 'manual';
alter table image_records add column if not exists metadata     jsonb default '{}'::jsonb;
alter table image_records add column if not exists notes        text;
alter table image_records add column if not exists is_baseline  boolean default false;
alter table image_records add column if not exists taken_at     timestamptz not null default now();
alter table image_records add column if not exists uploaded_at  timestamptz not null default now();

-- Categorise anything that predates the column, then constrain it.
update image_records
set category = case
  when image_type::text in ('panoramic', 'cephalometric', 'xray', 'radiograph') then 'radiograph'
  when image_type::text = 'document' then 'document'
  else 'intraoral'
end
where category is null;

alter table image_records alter column category set default 'intraoral';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'image_records_category_check'
  ) then
    alter table image_records
      add constraint image_records_category_check
      check (category in ('radiograph', 'intraoral', 'document'));
  end if;
end $$;

create index if not exists idx_image_records_patient_id       on image_records(patient_id);
create index if not exists idx_image_records_category         on image_records(category);
create index if not exists idx_image_records_patient_category on image_records(patient_id, category);
create index if not exists idx_image_records_taken_at         on image_records(taken_at desc);
create index if not exists idx_image_records_source           on image_records(source);
