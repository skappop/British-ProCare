-- What a Supabase project has before any of our migrations: its roles, the
-- auth and storage schemas, and the realtime publication.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login password 'pw' noinherit;
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login password 'pw' superuser createrole;
create role supabase_admin login superuser;
create role dashboard_user nologin;
create schema auth authorization supabase_auth_admin;
create extension if not exists pgcrypto;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
