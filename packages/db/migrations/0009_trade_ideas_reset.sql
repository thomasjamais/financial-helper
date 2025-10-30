-- Reset trade_ideas to allow adding a unique index cleanly
truncate table trade_ideas;

-- Recreate unique index to enforce single row per (user, exchange, symbol)
create unique index if not exists ux_trade_ideas_user_ex_symbol on trade_ideas(user_id, exchange, symbol);

