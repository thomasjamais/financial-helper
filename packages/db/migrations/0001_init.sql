-- Initial schema
create extension if not exists citext;

create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists api_keys(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exchange text not null,
  key_enc bytea not null,
  secret_enc bytea not null,
  passphrase_enc bytea,
  created_at timestamptz not null default now()
);

create table if not exists exchange_accounts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exchange text not null,
  label text,
  type text not null, -- spot|futures|unified
  paper boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists balance_snapshots(
  id uuid primary key default gen_random_uuid(),
  exchange_account_id uuid not null references exchange_accounts(id) on delete cascade,
  ts timestamptz not null,
  asset text not null,
  free numeric not null,
  locked numeric not null default 0,
  context jsonb not null default '{}'
);
