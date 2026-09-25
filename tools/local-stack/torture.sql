-- For the concurrency torture test (see README): one random stock operation,
-- refused steps recorded instead of aborting the client.
create or replace function torture_step(r int, k int) returns text language plpgsql as $$
declare ci record;
begin
  if r <= 35 then
    perform log_visit_with_deduction((select id from patients order by random() limit 1), array[(select id from procedures where code = (array['FILL','RCT','EXAM'])[1 + r % 3])], 'torture', 100, null);
    return 'visit';
  elsif r <= 70 then
    select * into ci from container_items order by id offset (k - 1) limit 1;
    perform stock_check_container(ci.container_id, jsonb_build_array(jsonb_build_object('item', ci.id, 'short', 1 + r % 3, 'refilled', r % 5 <> 0)), (select last_checked_at from containers where id = ci.container_id));
    return 'check';
  elsif r <= 80 then
    perform stock_record_count(jsonb_build_array(jsonb_build_object('inventory_id', (select id from inventory order by random() limit 1), 'counted', 4000 + r)));
    return 'count';
  elsif r <= 90 then
    perform stock_receive((select id from inventory order by random() limit 1), r);
    return 'receive';
  else
    perform stock_undo((select batch_id from stock_events where undone_at is null order by random() limit 1));
    return 'undo';
  end if;
exception when others then
  return 'refused: ' || split_part(sqlerrm, ':', 1);
end $$;
grant execute on function torture_step(int, int) to authenticated;
create table if not exists torture_log (what text);
grant insert on torture_log to authenticated;
create table if not exists torture_start as select id, stock from inventory where false;
