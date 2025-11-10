-- Add trade monitoring fields to trades table
alter table trades
  add column if not exists exit_strategy jsonb,
  add column if not exists trailing_stop_config jsonb,
  add column if not exists current_trailing_stop_price double precision,
  add column if not exists exited_quantity double precision default 0,
  add column if not exists exited_pnl_usd double precision default 0;

-- Create trade_exits table to track partial exit executions
create table if not exists trade_exits (
  id serial primary key,
  trade_id integer not null references trades(id) on delete cascade,
  exit_type text not null check (exit_type in ('partial', 'trailing_stop', 'final')),
  quantity double precision not null,
  price double precision not null,
  pnl_usd double precision not null,
  order_id text,
  executed_at timestamptz not null default now()
);

create index if not exists idx_trade_exits_trade_id on trade_exits(trade_id);
create index if not exists idx_trade_exits_executed_at on trade_exits(executed_at desc);

