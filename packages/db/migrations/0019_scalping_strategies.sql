-- Scalping strategies table for automated trading
create table if not exists scalping_strategies (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  exchange text not null check (exchange in ('bitget', 'binance')),
  symbol text not null,
  max_capital numeric not null check (max_capital > 0),
  leverage integer not null check (leverage > 0 and leverage <= 125),
  risk_per_trade numeric not null check (risk_per_trade > 0 and risk_per_trade <= 1),
  min_confidence numeric not null check (min_confidence >= 0 and min_confidence <= 1),
  max_open_positions integer not null check (max_open_positions > 0),
  is_active boolean not null default false,
  fee_rate numeric not null default 0.001 check (fee_rate >= 0 and fee_rate <= 0.01),
  slippage_bps integer not null default 5 check (slippage_bps >= 0 and slippage_bps <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, exchange, symbol)
);

create index if not exists idx_scalping_strategies_user_id on scalping_strategies(user_id);
create index if not exists idx_scalping_strategies_exchange on scalping_strategies(exchange);
create index if not exists idx_scalping_strategies_active on scalping_strategies(is_active);
create index if not exists idx_scalping_strategies_symbol on scalping_strategies(symbol);

-- Function to update updated_at timestamp
create or replace function update_scalping_strategies_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_scalping_strategies_updated_at
  before update on scalping_strategies
  for each row
  execute function update_scalping_strategies_updated_at();

