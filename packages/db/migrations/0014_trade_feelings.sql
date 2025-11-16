-- Create trade_feelings table
create table if not exists trade_feelings (
  id serial primary key,
  trade_id integer not null references trades(id) on delete cascade,
  user_id text not null,
  feeling_text text,
  sentiment_score double precision check (sentiment_score >= -1 and sentiment_score <= 1),
  timeframe text not null check (timeframe in ('1min', '5min', '30min', '1h', '4h', '1d', '1w', '1m', '1y')),
  created_at timestamptz not null default now()
);

-- Create indexes
create index if not exists idx_trade_feelings_trade_id on trade_feelings(trade_id);
create index if not exists idx_trade_feelings_user_id on trade_feelings(user_id);
create index if not exists idx_trade_feelings_timeframe on trade_feelings(timeframe);
create index if not exists idx_trade_feelings_trade_timeframe on trade_feelings(trade_id, timeframe);



