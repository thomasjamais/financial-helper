alter table trade_ideas add column if not exists history jsonb not null default '[]'::jsonb;

