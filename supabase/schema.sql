-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Creates per-user SRS state storage with Row Level Security.

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
