-- Storage gauge on the owner's dashboard: how much of the free plan's space
-- the patient images and the database use. Owner only. Safe to run again.

create or replace function public.storage_usage()
returns table (images_bytes bigint, images_count bigint, database_bytes bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can see storage use';
  end if;

  return query
  select
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint,
    count(*)::bigint,
    pg_database_size(current_database())::bigint
  from storage.objects o
  where o.bucket_id = 'patient-images';
end;
$$;

revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;

notify pgrst, 'reload schema';
