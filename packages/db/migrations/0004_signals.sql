create table if not exists signals (
  id serial primary key,
  user_id text not null,
  source text not null,
  asset text not null,
  action text not null,
  confidence double precision not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_signals_user_created on signals(user_id, created_at desc);

