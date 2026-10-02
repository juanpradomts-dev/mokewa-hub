-- Imitación mínima de lo que Supabase trae de fábrica (roles, auth, storage y permisos por defecto),
-- para probar las migraciones en PGlite sin Docker. Solo para pruebas (tests/esquema.test.mjs).
create role authenticated nologin;
create role anon nologin;
grant usage on schema public to anon, authenticated;
-- Supabase da todos los permisos sobre public a anon y authenticated: lo que protege es RLS.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default clock_timestamp()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
