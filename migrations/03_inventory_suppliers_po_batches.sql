create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
alter table suppliers enable row level security;
create policy "authenticated_full_access" on suppliers for all to authenticated using (true) with check (true);

create table if not exists inventory_batches (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id) on delete cascade,
  lot_number text,
  quantity numeric(10,3) not null default 0,
  expiry_date date,
  received_at timestamptz not null default now(),
  supplier_id uuid references suppliers(id) on delete set null,
  cost_per_unit numeric(10,2)
);
create index if not exists inventory_batches_inventory_id_idx on inventory_batches(inventory_id);
create index if not exists inventory_batches_expiry_idx on inventory_batches(expiry_date);
alter table inventory_batches enable row level security;
create policy "authenticated_full_access" on inventory_batches for all to authenticated using (true) with check (true);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  ordered_at timestamptz,
  expected_at date,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  inventory_id uuid not null references inventory(id) on delete cascade,
  quantity numeric(10,3) not null,
  unit_cost numeric(10,2),
  expiry_date date
);
create index if not exists po_items_po_id_idx on purchase_order_items(purchase_order_id);

alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
create policy "authenticated_full_access" on purchase_orders for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on purchase_order_items for all to authenticated using (true) with check (true);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id) on delete cascade,
  change_qty numeric(10,3) not null,
  reason text not null check (reason in ('restock', 'qr_pull', 'po_receipt', 'manual_adjustment', 'visit_deduction')),
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_inventory_id_idx on stock_movements(inventory_id);
create index if not exists stock_movements_created_at_idx on stock_movements(created_at);
alter table stock_movements enable row level security;
create policy "authenticated_full_access" on stock_movements for all to authenticated using (true) with check (true);

create or replace view expiring_batches as
select
  b.id as batch_id,
  b.inventory_id,
  i.name as item_name,
  i.unit,
  b.lot_number,
  b.quantity,
  b.expiry_date,
  (b.expiry_date - current_date) as days_until_expiry
from inventory_batches b
join inventory i on i.id = b.inventory_id
where b.expiry_date is not null
  and b.expiry_date <= current_date + interval '60 days'
  and b.quantity > 0
order by b.expiry_date asc;
