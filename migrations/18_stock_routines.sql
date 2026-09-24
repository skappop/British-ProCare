-- 18 — Stock routines: end-of-day container check, daily count, to-order list.
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query).
-- Only adds columns, one table and functions; nothing existing is changed or
-- removed. Safe to run again.
--
-- How the clinic works: tools and materials move between the cabinet and the
-- procedure containers all day and nobody records it. So nothing is recorded
-- during the day. At closing, each container is checked against its "full"
-- list (short items are refilled from the cabinet, which takes them off
-- stock); a few cabinet items are counted each day; anything low is on the
-- To-order list. Every change is logged and can be undone.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------

alter table containers add column if not exists sort_order integer not null default 0;
alter table containers add column if not exists last_checked_at timestamptz;
alter table containers add column if not exists last_checked_by uuid references auth.users(id) on delete set null;

-- Reusable tools (mirrors, pliers…) come back after sterilising; a short one is
-- missing, not used up. Consumables short in a container were used.
alter table container_items add column if not exists reusable boolean not null default false;
alter table container_items add column if not exists missing_quantity integer not null default 0;
alter table container_items add column if not exists missing_since timestamptz;

alter table inventory add column if not exists shelf text;
alter table inventory add column if not exists order_quantity numeric;
alter table inventory add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table inventory add column if not exists last_counted_at timestamptz;
alter table inventory add column if not exists ordered_at timestamptz;
alter table inventory add column if not exists ordered_quantity numeric;

-- ---------------------------------------------------------------------------
-- History: every change the routines make, grouped per save so a whole save
-- can be undone.
-- ---------------------------------------------------------------------------

create table if not exists stock_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  kind text not null check (kind in ('refill', 'empty', 'missing', 'found', 'written_off', 'count', 'ordered', 'received')),
  inventory_id uuid references inventory(id) on delete cascade,
  container_id uuid references containers(id) on delete set null,
  container_item_id uuid references container_items(id) on delete set null,
  quantity numeric not null default 0,        -- change to cabinet stock
  container_change integer not null default 0, -- change to what the container holds
  missing_change integer not null default 0,   -- change to the container's missing count
  stock_before numeric,
  stock_after numeric,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  prev_ordered_at timestamptz,   -- for undoing a delivery: back to "waiting"
  prev_ordered_quantity numeric
);
alter table stock_events add column if not exists prev_ordered_at timestamptz;
alter table stock_events add column if not exists prev_ordered_quantity numeric;

create index if not exists stock_events_batch_idx on stock_events (batch_id);
create index if not exists stock_events_created_idx on stock_events (created_at desc);
create index if not exists stock_events_inventory_idx on stock_events (inventory_id, created_at desc);

alter table stock_events enable row level security;
drop policy if exists "authenticated_full_access" on stock_events;
create policy "authenticated_full_access" on stock_events
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- End-of-day container check.
-- p_lines: [{ "item": <container_items.id>, "short": <int>, "refilled": <bool> }]
--   short    = how many were missing from the container when checked
--   refilled = true  -> put back from the cabinet (taken off cabinet stock,
--                       unless a procedure lists it: then the saved visits
--                       already took it off)
--              false -> consumable: the cabinet had none left (stock set to 0)
--                       reusable tool: it is missing (flagged, stock untouched)
-- Items not listed are full. Runs as one transaction: all or nothing.
-- ---------------------------------------------------------------------------

-- p_seen: when the container was last checked, as the phone saw it. If someone
-- else saved a check since, this one is refused so nothing is refilled twice.
drop function if exists stock_check_container(uuid, jsonb);
create or replace function stock_check_container(p_container uuid, p_lines jsonb, p_seen timestamptz default null)
returns jsonb
language plpgsql
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_line jsonb;
  v_ci record;
  v_stock numeric;
  v_short integer;
  v_refilled boolean;
  v_taken numeric;
  v_recount boolean;
  v_summary jsonb := '[]'::jsonb;
  v_by_visits boolean;
  v_has_bom boolean := to_regclass('public.procedure_bom') is not null;
  v_last timestamptz;
begin
  select last_checked_at into v_last from containers where id = p_container for update;
  if not found then
    raise exception 'Container not found';
  end if;
  if v_last is not null and v_last > coalesce(p_seen, '-infinity'::timestamptz) + interval '1 second' then
    raise exception 'ALREADY_CHECKED: %', to_char(v_last at time zone 'Africa/Cairo', 'HH24:MI');
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select ci.*, i.name as item_name
      into v_ci
      from container_items ci
      join inventory i on i.id = ci.inventory_id
     where ci.id = (v_line->>'item')::uuid and ci.container_id = p_container
     for update of ci;
    if not found then
      continue; -- an item removed from the container meanwhile: ignore
    end if;

    -- Never more than the container holds when full.
    v_short := least(greatest(coalesce((v_line->>'short')::integer, 0), 0), v_ci.baseline_quantity);
    if v_short = 0 then
      continue;
    end if;
    v_refilled := coalesce((v_line->>'refilled')::boolean, true);

    select stock into v_stock from inventory where id = v_ci.inventory_id for update;
    v_stock := coalesce(v_stock, 0);

    -- Items a procedure lists as materials were already taken off stock when
    -- the visit was saved; refilling the container only moves them from the
    -- cabinet. Everything is taken off stock once, never twice.
    v_by_visits := false;
    if v_has_bom then
      execute 'select exists (select 1 from procedure_bom where inventory_id = $1)'
        into v_by_visits using v_ci.inventory_id;
    end if;

    if v_refilled and v_by_visits then
      update container_items set current_quantity = baseline_quantity where id = v_ci.id;
      insert into stock_events (batch_id, kind, inventory_id, container_id, container_item_id,
                                quantity, container_change, stock_before, stock_after, note)
      values (v_batch, 'refill', v_ci.inventory_id, p_container, v_ci.id,
              0, v_ci.baseline_quantity - v_ci.current_quantity, v_stock, v_stock,
              'Already taken off stock when the visits were saved');
      v_summary := v_summary || jsonb_build_object('item', v_ci.item_name, 'kind', 'refill', 'quantity', v_short);

    elsif v_refilled then
      -- The physical refill is the truth. If the records say the cabinet had
      -- less, stock stops at 0 and the item goes to the front of the count.
      v_taken := least(v_short, greatest(v_stock, 0));
      v_recount := v_stock < v_short;
      update inventory
         set stock = greatest(v_stock - v_short, 0),
             last_counted_at = case when v_recount then null else last_counted_at end
       where id = v_ci.inventory_id;
      update container_items set current_quantity = baseline_quantity where id = v_ci.id;
      insert into stock_events (batch_id, kind, inventory_id, container_id, container_item_id,
                                quantity, container_change, stock_before, stock_after, note)
      values (v_batch, 'refill', v_ci.inventory_id, p_container, v_ci.id,
              -v_taken, v_ci.baseline_quantity - v_ci.current_quantity, v_stock, greatest(v_stock - v_short, 0),
              case when v_recount then 'Records showed fewer in the cabinet than were taken; recount' end);
      v_summary := v_summary || jsonb_build_object('item', v_ci.item_name, 'kind', 'refill', 'quantity', v_short);

    elsif v_ci.reusable then
      update container_items
         set missing_quantity = least(missing_quantity + v_short, baseline_quantity),
             missing_since = coalesce(missing_since, now()),
             current_quantity = greatest(baseline_quantity - least(missing_quantity + v_short, baseline_quantity), 0)
       where id = v_ci.id;
      insert into stock_events (batch_id, kind, inventory_id, container_id, container_item_id,
                                missing_change, container_change, stock_before, stock_after)
      values (v_batch, 'missing', v_ci.inventory_id, p_container, v_ci.id,
              v_short, -v_short, v_stock, v_stock);
      v_summary := v_summary || jsonb_build_object('item', v_ci.item_name, 'kind', 'missing', 'quantity', v_short);

    else
      -- Consumable, cabinet empty: records now agree there are none left, so
      -- it appears on the To-order list.
      update inventory set stock = 0 where id = v_ci.inventory_id;
      update container_items set current_quantity = greatest(baseline_quantity - v_short, 0) where id = v_ci.id;
      insert into stock_events (batch_id, kind, inventory_id, container_id, container_item_id,
                                quantity, container_change, stock_before, stock_after, note)
      values (v_batch, 'empty', v_ci.inventory_id, p_container, v_ci.id,
              -v_stock, (v_ci.baseline_quantity - v_short) - v_ci.current_quantity, v_stock, 0,
              'Cabinet had none left');
      v_summary := v_summary || jsonb_build_object('item', v_ci.item_name, 'kind', 'empty', 'quantity', v_short);
    end if;
  end loop;

  update containers set last_checked_at = now(), last_checked_by = auth.uid() where id = p_container;
  return jsonb_build_object('batch', v_batch, 'changes', v_summary);
end;
$$;

-- A missing reusable tool turned up, or is written off (and replaced from the
-- cabinet if p_replace).
create or replace function stock_resolve_missing(p_item uuid, p_outcome text, p_replace boolean default false)
returns jsonb
language plpgsql
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_ci record;
  v_stock numeric;
  v_take numeric := 0;
begin
  select * into v_ci from container_items where id = p_item for update;
  if not found or v_ci.missing_quantity <= 0 then
    return jsonb_build_object('batch', null);
  end if;
  if p_outcome not in ('found', 'written_off') then
    raise exception 'Unknown outcome %', p_outcome;
  end if;

  select stock into v_stock from inventory where id = v_ci.inventory_id for update;
  v_stock := coalesce(v_stock, 0);
  if p_outcome = 'written_off' and p_replace then
    v_take := least(v_ci.missing_quantity, greatest(v_stock, 0));
    update inventory set stock = greatest(v_stock - v_ci.missing_quantity, 0) where id = v_ci.inventory_id;
  end if;

  update container_items
     set missing_quantity = 0,
         missing_since = null,
         current_quantity = case when p_outcome = 'found' or p_replace then baseline_quantity else current_quantity end
   where id = p_item;

  insert into stock_events (batch_id, kind, inventory_id, container_id, container_item_id,
                            quantity, container_change, missing_change, stock_before, stock_after, note)
  values (v_batch, p_outcome, v_ci.inventory_id, v_ci.container_id, p_item,
          -v_take,
          case when p_outcome = 'found' or p_replace then v_ci.baseline_quantity - v_ci.current_quantity else 0 end,
          -v_ci.missing_quantity, v_stock, greatest(v_stock - v_take, 0),
          case when p_replace then 'Replaced from the cabinet' end);
  return jsonb_build_object('batch', v_batch);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cabinet count. p_lines: [{ "inventory_id": <uuid>, "counted": <number> }]
-- The count becomes the stock; the difference is logged.
-- ---------------------------------------------------------------------------

create or replace function stock_record_count(p_lines jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_line jsonb;
  v_stock numeric;
  v_counted numeric;
  v_changes integer := 0;
begin
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_counted := (v_line->>'counted')::numeric;
    if v_counted is null or v_counted < 0 then
      continue;
    end if;
    select stock into v_stock from inventory where id = (v_line->>'inventory_id')::uuid for update;
    if not found then
      continue;
    end if;
    v_stock := coalesce(v_stock, 0);
    update inventory set stock = v_counted, last_counted_at = now() where id = (v_line->>'inventory_id')::uuid;
    insert into stock_events (batch_id, kind, inventory_id, quantity, stock_before, stock_after)
    values (v_batch, 'count', (v_line->>'inventory_id')::uuid, v_counted - v_stock, v_stock, v_counted);
    if v_counted <> v_stock then
      v_changes := v_changes + 1;
    end if;
  end loop;
  return jsonb_build_object('batch', v_batch, 'differences', v_changes);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordering. Marking as ordered stops it being ordered twice; receiving adds
-- the delivery to stock.
-- ---------------------------------------------------------------------------

create or replace function stock_mark_ordered(p_lines jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_line jsonb;
begin
  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    update inventory
       set ordered_at = now(), ordered_quantity = nullif((v_line->>'quantity')::numeric, 0)
     where id = (v_line->>'inventory_id')::uuid;
    if found then
      insert into stock_events (batch_id, kind, inventory_id, note)
      values (v_batch, 'ordered', (v_line->>'inventory_id')::uuid, 'Ordered ' || coalesce(v_line->>'quantity', ''));
    end if;
  end loop;
  return jsonb_build_object('batch', v_batch);
end;
$$;

create or replace function stock_receive(p_inventory uuid, p_quantity numeric)
returns jsonb
language plpgsql
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_item record;
  v_stock numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Enter how many arrived';
  end if;
  select stock, ordered_at, ordered_quantity into v_item from inventory where id = p_inventory for update;
  if not found then
    raise exception 'Item not found';
  end if;
  v_stock := coalesce(v_item.stock, 0);
  update inventory
     set stock = v_stock + p_quantity, ordered_at = null, ordered_quantity = null
   where id = p_inventory;
  insert into stock_events (batch_id, kind, inventory_id, quantity, stock_before, stock_after,
                            prev_ordered_at, prev_ordered_quantity)
  values (v_batch, 'received', p_inventory, p_quantity, v_stock, v_stock + p_quantity,
          v_item.ordered_at, v_item.ordered_quantity);
  return jsonb_build_object('batch', v_batch);
end;
$$;

-- ---------------------------------------------------------------------------
-- Undo a whole save (a container check, a count, a delivery) within a day.
-- Each change is reversed by its own difference, so later saves are kept.
-- ---------------------------------------------------------------------------

create or replace function stock_undo(p_batch uuid)
returns jsonb
language plpgsql
as $$
declare
  v_event record;
  v_undone integer := 0;
begin
  for v_event in
    select * from stock_events
     where batch_id = p_batch and undone_at is null and created_at > now() - interval '24 hours'
     order by created_at desc
     for update
  loop
    if v_event.kind = 'ordered' then
      update inventory set ordered_at = null, ordered_quantity = null where id = v_event.inventory_id;
    else
      if v_event.quantity <> 0 then
        update inventory set stock = greatest(coalesce(stock, 0) - v_event.quantity, 0) where id = v_event.inventory_id;
      end if;
      if v_event.kind = 'received' and v_event.prev_ordered_at is not null then
        update inventory
           set ordered_at = v_event.prev_ordered_at, ordered_quantity = v_event.prev_ordered_quantity
         where id = v_event.inventory_id and ordered_at is null;
      end if;
      if v_event.container_item_id is not null and (v_event.container_change <> 0 or v_event.missing_change <> 0) then
        update container_items
           set current_quantity = greatest(current_quantity - v_event.container_change, 0),
               missing_quantity = greatest(missing_quantity - v_event.missing_change, 0),
               missing_since = case when missing_quantity - v_event.missing_change > 0 then coalesce(missing_since, now()) else null end
         where id = v_event.container_item_id;
      end if;
    end if;
    update stock_events set undone_at = now() where id = v_event.id;
    v_undone := v_undone + 1;
  end loop;
  return jsonb_build_object('undone', v_undone);
end;
$$;

grant execute on function stock_check_container(uuid, jsonb, timestamptz) to authenticated;
grant execute on function stock_resolve_missing(uuid, text, boolean) to authenticated;
grant execute on function stock_record_count(jsonb) to authenticated;
grant execute on function stock_mark_ordered(jsonb) to authenticated;
grant execute on function stock_receive(uuid, numeric) to authenticated;
grant execute on function stock_undo(uuid) to authenticated;

-- Live updates: a check saved on one phone shows on the others.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_events'
  ) then
    alter publication supabase_realtime add table public.stock_events;
  end if;
end $$;

notify pgrst, 'reload schema';
