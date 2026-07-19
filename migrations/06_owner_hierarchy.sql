-- Restrict roles to owner / dentist / assistant (was dentist / assistant / front_desk)
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('owner', 'dentist', 'assistant'));

update profiles set role = 'assistant' where role = 'front_desk';

-- After running this, go to /staff in the app and manually set your own
-- profile's role to "Owner" -- Supabase has no way to infer who the real
-- clinic owner is.
