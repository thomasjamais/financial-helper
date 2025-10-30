create table if not exists trade_pnl (
  id serial primary key,
  trade_id integer not null,
  ts timestamptz not null default now(),
  mark_price double precision not null,
  pnl_usd double precision not null
);

create index if not exists idx_trade_pnl_trade_ts on trade_pnl(trade_id, ts desc);

