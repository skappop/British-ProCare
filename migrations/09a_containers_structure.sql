-- 09a — Container inventory: structure only
--
-- Migration 09 creates these tables AND seeds 38 specific inventory items with
-- preset container quantities. That seed is one clinic's real stock list; on a
-- system whose inventory differs it creates duplicates and wrong baselines.
-- This is 09 without the seed, so containers can be built in the UI instead.
--
-- Run 09a for the tables. Run 09 only if you want that stock list too.
-- Safe to re-run.

create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists container_items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  inventory_id uuid not null references inventory(id) on delete cascade,
  baseline_quantity integer not null default 1,
  current_quantity integer not null default 0,
  grid_section text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (container_id, inventory_id, grid_section)
);

create table if not exists rapid_scan_log (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id),
  inventory_id uuid not null references inventory(id),
  scan_mode text not null check (scan_mode in ('consume', 'restock')),
  quantity_change integer not null,
  batch_id uuid references inventory_batches(id),
  scanned_by uuid references auth.users(id),
  scanned_at timestamptz default now()
);

create index if not exists idx_containers_name            on containers(name);
create index if not exists idx_container_items_container  on container_items(container_id);
create index if not exists idx_container_items_inventory  on container_items(inventory_id);
create index if not exists idx_rapid_scan_log_container   on rapid_scan_log(container_id);
create index if not exists idx_rapid_scan_log_date        on rapid_scan_log(scanned_at desc);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Postgres has no CREATE TRIGGER IF NOT EXISTS, so drop first to stay re-runnable.
drop trigger if exists trigger_update_containers_updated_at on containers;
create trigger trigger_update_containers_updated_at
  before update on containers
  for each row execute function touch_updated_at();

drop trigger if exists trigger_update_container_items_updated_at on container_items;
create trigger trigger_update_container_items_updated_at
  before update on container_items
  for each row execute function touch_updated_at();

alter table containers     enable row level security;
alter table container_items enable row level security;
alter table rapid_scan_log  enable row level security;

drop policy if exists "authenticated_full_access" on containers;
create policy "authenticated_full_access" on containers
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on container_items;
create policy "authenticated_full_access" on container_items
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on rapid_scan_log;
create policy "authenticated_full_access" on rapid_scan_log
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
