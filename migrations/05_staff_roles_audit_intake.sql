create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'assistant' check (role in ('dentist', 'assistant', 'front_desk')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "authenticated_full_access" on profiles for all to authenticated using (true) with check (true);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'assistant');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table visits add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table payments add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table appointments add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table stock_movements add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table purchase_orders add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table lab_cases add column if not exists created_by uuid references auth.users(id) default auth.uid();

alter table patients add column if not exists medical_history jsonb not null default '{}'::jsonb;
alter table patients add column if not exists consent_signed_at timestamptz;
