-- Ensure unique (user_id, exchange, symbol) by removing duplicates, then create index

-- Drop any existing conflicting index first (safe if absent)
drop index if exists ux_trade_ideas_user_ex_symbol;

-- Remove duplicates, keeping the most recent per (user, exchange, symbol)
with ranked as (
  select id,
         row_number() over(partition by user_id, exchange, symbol order by created_at desc, id desc) as rn
  from trade_ideas
)
delete from trade_ideas t
using ranked r
where t.id = r.id and r.rn > 1;

-- Create the unique index now that duplicates are removed
create unique index if not exists ux_trade_ideas_user_ex_symbol on trade_ideas(user_id, exchange, symbol);

