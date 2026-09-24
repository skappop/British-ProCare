-- Live dental chart: when the assistant charts on a phone, the doctor's
-- computer showing the same patient updates by itself (and the other way
-- round). Safe to run more than once.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patients'
  ) then
    alter publication supabase_realtime add table public.patients;
  end if;
end $$;
