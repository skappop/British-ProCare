-- Approximation of the pre-existing base schema (not in the repo's migrations).
create table patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, phone text, email text, file_number text, date_of_birth date, gender text,
  is_ortho boolean default false, medical_history text, odontogram jsonb default '{}'::jsonb,
  status text default 'active', consent_signed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table procedures (
  id uuid primary key default gen_random_uuid(), code text, name text not null, category text,
  base_fee numeric default 0, is_active boolean default true, created_at timestamptz default now()
);
create table inventory (
  id uuid primary key default gen_random_uuid(), sku text, name text not null, category text, unit text,
  stock numeric not null default 0, reorder_level numeric default 0, supplier text, expiry_date date,
  attributes jsonb default '{}'::jsonb, is_active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table procedure_bom (
  id uuid primary key default gen_random_uuid(), procedure_id uuid references procedures(id) on delete cascade,
  inventory_id uuid references inventory(id) on delete cascade, quantity numeric not null default 1
);
create table visits (
  id uuid primary key default gen_random_uuid(), patient_id uuid references patients(id) on delete cascade,
  visit_date timestamptz default now(), notes text, fee_charged numeric, ortho_quick_log jsonb, paid_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz default now()
);
create table visit_procedures (
  id uuid primary key default gen_random_uuid(), visit_id uuid references visits(id) on delete cascade,
  procedure_id uuid references procedures(id), fee numeric, quantity integer default 1
);
create table inventory_transactions (
  id uuid primary key default gen_random_uuid(), inventory_id uuid references inventory(id) on delete cascade,
  change numeric, reason text, visit_id uuid, created_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['patients','procedures','inventory','procedure_bom','visits','visit_procedures','inventory_transactions'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy authenticated_full_access on %I for all to authenticated using (true) with check (true)', t);
  end loop; end $$;

create or replace function log_visit_with_deduction(p_patient_id uuid, p_procedure_ids uuid[], p_notes text, p_fee numeric, p_quick_log jsonb)
returns jsonb language plpgsql as $$
declare v_visit uuid; r record; v_warn jsonb := '[]'::jsonb; v_left numeric;
begin
  insert into visits (patient_id, notes, fee_charged, ortho_quick_log) values (p_patient_id, p_notes, p_fee, p_quick_log) returning id into v_visit;
  insert into visit_procedures (visit_id, procedure_id, fee) select v_visit, p.id, p.base_fee from procedures p where p.id = any(p_procedure_ids);
  for r in select b.inventory_id, sum(b.quantity) q from procedure_bom b where b.procedure_id = any(p_procedure_ids) group by b.inventory_id loop
    update inventory set stock = stock - r.q where id = r.inventory_id returning stock into v_left;
    if v_left < 0 then raise exception 'INSUFFICIENT_STOCK: %', (select name from inventory where id = r.inventory_id); end if;
    insert into inventory_transactions (inventory_id, change, reason, visit_id) values (r.inventory_id, -r.q, 'visit', v_visit);
    if v_left <= (select reorder_level from inventory where id = r.inventory_id) then
      v_warn := v_warn || jsonb_build_object('item', (select name from inventory where id = r.inventory_id), 'remaining', v_left);
    end if;
  end loop;
  return jsonb_build_object('visit_id', v_visit, 'reorder_warnings', v_warn);
end $$;
