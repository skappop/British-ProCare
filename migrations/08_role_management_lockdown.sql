-- 08 — Lock role management to the Owner
--
-- Before this, profiles used a blanket "authenticated_full_access" policy, so any
-- logged-in user could update any profile's role (including their own) straight
-- through the public API. This restricts writes to owners while keeping profiles
-- readable (the app needs to read roles). Enforced at the database, so it can't
-- be bypassed from the browser.

-- Security-definer helper: reads the caller's role WITHOUT triggering the
-- profiles RLS policy (avoids infinite recursion when used inside that policy).
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

grant execute on function public.is_owner() to authenticated;

-- Replace the blanket policy: everyone authenticated may READ; only owners WRITE.
drop policy if exists "authenticated_full_access" on profiles;
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_owner_write" on profiles;

create policy "profiles_select" on profiles
  for select to authenticated
  using (true);

create policy "profiles_owner_write" on profiles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Note: the signup trigger handle_new_user() is SECURITY DEFINER, so new users
-- still get their default 'assistant' profile row created automatically. The
-- first owner is set via the Supabase SQL editor (service role bypasses RLS);
-- after that, owners manage everyone else from /staff.
