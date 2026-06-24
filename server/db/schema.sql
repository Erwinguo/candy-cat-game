create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'wechat', 'guest')),
  provider_user_id text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  guest_name text,
  score integer not null check (score >= 0),
  moves_left integer not null check (moves_left >= 0),
  level text not null default 'classic',
  created_at timestamptz not null default now()
);

create index if not exists scores_rank_idx
  on scores (level, score desc, moves_left desc, created_at asc);

create table if not exists share_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  score_id uuid references scores(id) on delete cascade,
  share_token text not null unique,
  created_at timestamptz not null default now()
);
