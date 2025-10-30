alter table trade_ideas add column if not exists history jsonb not null default '[]'::jsonb;

create unique index if not exists ux_trade_ideas_user_ex_symbol on trade_ideas(user_id, exchange, symbol);

