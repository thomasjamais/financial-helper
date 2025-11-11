-- Create binance_listing_alerts table to store detected listing events
create table if not exists binance_listing_alerts (
  id serial primary key,
  event_type text not null check (event_type in ('IPO', 'Launchpool', 'new_listing', 'delisting')),
  symbol text,
  title text not null,
  description text,
  announcement_url text,
  detected_at timestamptz not null default now(),
  metadata jsonb default '{}'
);

-- Create indexes for efficient querying
create index if not exists idx_listing_alerts_detected_at on binance_listing_alerts(detected_at desc);
create index if not exists idx_listing_alerts_event_type on binance_listing_alerts(event_type);
create index if not exists idx_listing_alerts_symbol on binance_listing_alerts(symbol);

