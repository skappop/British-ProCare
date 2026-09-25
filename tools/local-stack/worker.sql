\set r random(1, 100)
\set k random(1, 17)
begin;
select set_config('request.jwt.claims', '{"sub":"__USER__","role":"authenticated"}', true);
set local role authenticated;
insert into torture_log select torture_step(:r, :k);
commit;
