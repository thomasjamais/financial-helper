-- Create strategies table
create table if not exists strategies (
  id serial primary key,
  user_id text not null,
  name text not null,
  code text not null,
  params_schema jsonb,
  allocated_amount_usd double precision not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create strategy_backtests table
create table if not exists strategy_backtests (
  id serial primary key,
  strategy_id integer not null references strategies(id) on delete cascade,
  symbols text[] not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  metrics jsonb not null,
  results_json jsonb not null,
  created_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_strategies_user_id on strategies(user_id);
create index if not exists idx_strategies_user_active on strategies(user_id, is_active);
create index if not exists idx_strategy_backtests_strategy_id on strategy_backtests(strategy_id);
create index if not exists idx_strategy_backtests_created_at on strategy_backtests(created_at desc);

-- Add updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_strategies_updated_at
  before update on strategies
  for each row
  execute function update_updated_at_column();

