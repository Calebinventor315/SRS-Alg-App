-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Creates per-user SRS state storage, username profiles, and username->email login lookup.

create table if not exists public.user_srs_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_srs_state enable row level security;

drop policy if exists "Users can read own SRS state" on public.user_srs_state;
create policy "Users can read own SRS state"
  on public.user_srs_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own SRS state" on public.user_srs_state;
create policy "Users can insert own SRS state"
  on public.user_srs_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own SRS state" on public.user_srs_state;
create policy "Users can update own SRS state"
  on public.user_srs_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Username profiles for signing in with username or email
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Automatically create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    new.email
  )
  on conflict (id) do update
    set username = coalesce(excluded.username, public.profiles.username),
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Resolve username -> email for sign-in (safe: only returns email for exact username match)
create or replace function public.resolve_login_email(p_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(p_identifier))
  limit 1;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;
