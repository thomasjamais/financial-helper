-- Create strategy_executions table for tracking live strategy runs
create table if not exists strategy_executions (
  id serial primary key,
  strategy_id integer not null references strategies(id) on delete cascade,
  user_id text not null,
  symbols text[] not null,
  interval text not null default '1h',
  status text not null default 'active' check (status in ('active', 'paused', 'stopped')),
  last_execution_at timestamptz,
  next_execution_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create strategy_trades table for tracking trades made by strategies
create table if not exists strategy_trades (
  id serial primary key,
  strategy_id integer not null references strategies(id) on delete cascade,
  strategy_execution_id integer not null references strategy_executions(id) on delete cascade,
  trade_id integer not null references trades(id) on delete cascade,
  signal text not null check (signal in ('buy', 'sell')),
  symbol text not null,
  created_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_strategy_executions_strategy_id on strategy_executions(strategy_id);
create index if not exists idx_strategy_executions_user_status on strategy_executions(user_id, status);
create index if not exists idx_strategy_executions_next_execution on strategy_executions(next_execution_at) where status = 'active';
create index if not exists idx_strategy_trades_strategy_id on strategy_trades(strategy_id);
create index if not exists idx_strategy_trades_execution_id on strategy_trades(strategy_execution_id);
create index if not exists idx_strategy_trades_trade_id on strategy_trades(trade_id);

-- Add updated_at trigger
create trigger update_strategy_executions_updated_at
  before update on strategy_executions
  for each row
  execute function update_updated_at_column();

