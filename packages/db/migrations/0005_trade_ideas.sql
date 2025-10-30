create table if not exists trade_ideas (
  id serial primary key,
  user_id text not null,
  exchange text not null,
  symbol text not null,
  side text not null,
  score double precision not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_ideas_user_created on trade_ideas(user_id, created_at desc);

