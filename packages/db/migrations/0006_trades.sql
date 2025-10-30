create table if not exists trades (
  id serial primary key,
  user_id text not null,
  idea_id integer,
  exchange text not null,
  symbol text not null,
  side text not null,
  budget_usd double precision not null,
  quantity double precision not null,
  entry_price double precision not null,
  tp_pct double precision not null,
  sl_pct double precision not null,
  status text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  pnl_usd double precision,
  metadata jsonb
);

create index if not exists idx_trades_user_opened on trades(user_id, opened_at desc);
