-- Create backtest_jobs table for async backtest job tracking
create table if not exists backtest_jobs (
  id serial primary key,
  user_id text not null,
  strategy_id integer not null references strategies(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  input jsonb not null,
  result_id integer references strategy_backtests(id) on delete set null,
  error_message text,
  progress_pct integer not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Create indexes
create index if not exists idx_backtest_jobs_user_status on backtest_jobs(user_id, status);
create index if not exists idx_backtest_jobs_strategy_id on backtest_jobs(strategy_id);
create index if not exists idx_backtest_jobs_created_at on backtest_jobs(created_at desc);
create index if not exists idx_backtest_jobs_status on backtest_jobs(status) where status in ('pending', 'running');

