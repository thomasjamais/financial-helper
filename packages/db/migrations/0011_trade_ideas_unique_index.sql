-- Finalize unique constraint for trade_ideas after history column exists and dedupe ran
drop index if exists ux_trade_ideas_user_ex_symbol;
create unique index if not exists ux_trade_ideas_user_ex_symbol on trade_ideas(user_id, exchange, symbol);

