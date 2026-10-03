-- Migration 23: unified clinical tasks.
-- Links chart findings, planned work, visit completion and follow-up.

create table if not exists public.clinical_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null check (category in ('general', 'restorative', 'endo', 'surgical', 'prosthetic', 'ortho')),
  title text not null,
  tooth_fdi text,
  site text,
  finding_code text,
  procedure_id uuid references public.procedures(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'deferred', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  source_visit_id uuid references public.visits(id) on delete set null,
  completed_visit_id uuid references public.visits(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_tasks_patient_status_idx on public.clinical_tasks (patient_id, status, created_at desc);
create index if not exists clinical_tasks_due_idx on public.clinical_tasks (status, due_at);
create index if not exists clinical_tasks_tooth_idx on public.clinical_tasks (patient_id, tooth_fdi, status);

alter table public.clinical_tasks enable row level security;
drop policy if exists "authenticated_full_access_clinical_tasks" on public.clinical_tasks;
create policy "authenticated_full_access_clinical_tasks" on public.clinical_tasks
  for all to authenticated using (true) with check (true);

comment on table public.clinical_tasks is 'Linked clinical work: chart finding, planned treatment, visit completion and follow-up.';

-- Convert existing actionable odontogram findings into open tasks. Existing
-- chart data is preserved; this only adds the linked work queue.
do $$
declare
  patient_row record;
  tooth_row record;
  finding jsonb;
  code text;
  category text;
begin
  for patient_row in select id, odontogram from public.patients where odontogram is not null and odontogram <> '{}'::jsonb loop
    for tooth_row in select key as fdi, value as tooth from jsonb_each(patient_row.odontogram) loop
      for finding in select value from jsonb_array_elements(coalesce(tooth_row.tooth->'findings', '[]'::jsonb)) loop
        code := finding->>'code';
        if code in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'caries', 'need_filling', 'fracture', 'watch', 'planned', 'need_rct', 'need_crown', 'extract') then
          category := case when code = 'need_rct' then 'endo' when code = 'need_crown' then 'prosthetic' when code = 'extract' then 'surgical' else 'restorative' end;
          insert into public.clinical_tasks (patient_id, category, title, tooth_fdi, finding_code, status, details)
          select patient_row.id, category, coalesce(finding->>'detail', code) || ' on tooth ' || tooth_row.fdi, tooth_row.fdi, code, 'open', finding
          where not exists (
            select 1 from public.clinical_tasks t
            where t.patient_id = patient_row.id and t.tooth_fdi = tooth_row.fdi and t.finding_code = code and t.status in ('open', 'in_progress')
          );
        end if;
      end loop;
    end loop;
  end loop;
end $$;
