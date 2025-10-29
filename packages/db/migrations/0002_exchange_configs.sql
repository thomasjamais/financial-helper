-- Exchange configs table for storing Bitget and Binance configurations
create table if not exists exchange_configs (
  id serial primary key,
  exchange text not null check (exchange in ('bitget', 'binance')),
  label text not null,
  key_enc text not null,
  secret_enc text not null,
  passphrase_enc text,
  env text not null check (env in ('paper', 'live')),
  base_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exchange, label)
);

create index if not exists idx_exchange_configs_exchange on exchange_configs(exchange);
create index if not exists idx_exchange_configs_active on exchange_configs(is_active);

-- Function to update updated_at timestamp
create or replace function update_exchange_configs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_exchange_configs_updated_at
  before update on exchange_configs
  for each row
  execute function update_exchange_configs_updated_at();

