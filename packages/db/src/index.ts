import {
  Kysely,
  PostgresDialect,
  Insertable,
  Updateable,
  Selectable,
  Generated,
} from 'kysely'
import pg from 'pg'
export { runMigrations } from './migrate'

export interface UserTable {
  id: Generated<string>
  email: string
  password_hash: string
  name: string | null
  is_active: boolean
  email_verified: boolean
  failed_login_attempts: number
  locked_until: Date | null
  last_login_at: Date | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface RefreshTokenTable {
  id: Generated<number>
  user_id: string
  token_hash: string
  expires_at: Date
  revoked: boolean
  revoked_at: Date | null
  created_at: Generated<Date>
  ip_address: string | null
  user_agent: string | null
}

export interface AuthAuditLogTable {
  id: Generated<number>
  user_id: string | null
  email: string
  event_type:
    | 'signup'
    | 'signin'
    | 'signout'
    | 'refresh'
    | 'failed_login'
    | 'password_reset'
    | 'account_locked'
  ip_address: string | null
  user_agent: string | null
  correlation_id: string | null
  success: boolean
  failure_reason: string | null
  created_at: Generated<Date>
}

export interface ExchangeConfigTable {
  id: Generated<number>
  exchange: 'bitget' | 'binance'
  label: string
  key_enc: string
  secret_enc: string
  passphrase_enc: string | null
  env: 'paper' | 'live'
  base_url: string | null
  is_active: boolean
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface ScalpingStrategyTable {
  id: Generated<number>
  user_id: string
  exchange: 'bitget' | 'binance'
  symbol: string
  max_capital: number
  leverage: number
  risk_per_trade: number
  min_confidence: number
  max_open_positions: number
  is_active: boolean
  fee_rate: number
  slippage_bps: number
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface SignalTable {
  id: Generated<number>
  user_id: string
  source: string
  asset: string
  action: string
  confidence: number
  reason: string | null
  metadata: unknown | null
  created_at: Generated<Date>
}

export interface TradeIdeaTable {
  id: Generated<number>
  user_id: string
  exchange: string
  symbol: string
  side: string
  score: number
  reason: string | null
  metadata: unknown | null
  created_at: Generated<Date>
  history: unknown
}

export interface TradeTable {
  id: Generated<number>
  user_id: string
  idea_id: number | null
  exchange: string
  symbol: string
  side: string
  budget_usd: number
  quantity: number
  entry_price: number
  tp_pct: number
  sl_pct: number
  status: string
  opened_at: Generated<Date>
  closed_at: Date | null
  pnl_usd: number | null
  metadata: unknown | null
  exit_strategy: unknown | null
  trailing_stop_config: unknown | null
  current_trailing_stop_price: number | null
  exited_quantity: number | null
  exited_pnl_usd: number | null
}

export interface TradePnlTable {
  id: Generated<number>
  trade_id: number
  ts: Generated<Date>
  mark_price: number
  pnl_usd: number
}

export interface TradeExitTable {
  id: Generated<number>
  trade_id: number
  exit_type: 'partial' | 'trailing_stop' | 'final'
  quantity: number
  price: number
  pnl_usd: number
  order_id: string | null
  executed_at: Generated<Date>
}

export interface StrategyTable {
  id: Generated<number>
  user_id: string
  name: string
  code: string
  params_schema: unknown | null
  allocated_amount_usd: number
  is_active: boolean
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface StrategyBacktestTable {
  id: Generated<number>
  strategy_id: number
  symbols: string[]
  start_date: Date
  end_date: Date
  metrics: unknown
  results_json: unknown
  created_at: Generated<Date>
}

export interface BacktestJobTable {
  id: Generated<number>
  user_id: string
  strategy_id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: unknown
  result_id: number | null
  error_message: string | null
  progress_pct: number
  created_at: Generated<Date>
  started_at: Date | null
  completed_at: Date | null
}

export interface StrategyExecutionTable {
  id: Generated<number>
  strategy_id: number
  user_id: string
  symbols: string[]
  interval: string
  status: 'active' | 'paused' | 'stopped'
  last_execution_at: Date | null
  next_execution_at: Date | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface StrategyTradeTable {
  id: Generated<number>
  strategy_id: number
  strategy_execution_id: number
  trade_id: number
  signal: 'buy' | 'sell'
  symbol: string
  created_at: Generated<Date>
}

export interface TradeFeelingTable {
  id: Generated<number>
  trade_id: number
  user_id: string
  feeling_text: string | null
  sentiment_score: number | null
  timeframe: '1min' | '5min' | '30min' | '1h' | '4h' | '1d' | '1w' | '1m' | '1y'
  created_at: Generated<Date>
}

export interface BinanceListingAlertTable {
  id: Generated<number>
  event_type: 'IPO' | 'Launchpool' | 'new_listing' | 'delisting'
  symbol: string | null
  title: string
  description: string | null
  announcement_url: string | null
  detected_at: Generated<Date>
  metadata: unknown | null
}

export type User = Selectable<UserTable>
export type NewUser = Insertable<UserTable>
export type UserUpdate = Updateable<UserTable>

export type RefreshToken = Selectable<RefreshTokenTable>
export type NewRefreshToken = Insertable<RefreshTokenTable>
export type RefreshTokenUpdate = Updateable<RefreshTokenTable>

export type AuthAuditLog = Selectable<AuthAuditLogTable>
export type NewAuthAuditLog = Insertable<AuthAuditLogTable>

export type ExchangeConfig = Selectable<ExchangeConfigTable>
export type NewExchangeConfig = Insertable<ExchangeConfigTable>
export type ExchangeConfigUpdate = Updateable<ExchangeConfigTable>

export interface DB {
  users: UserTable
  refresh_tokens: RefreshTokenTable
  auth_audit_log: AuthAuditLogTable
  exchange_configs: ExchangeConfigTable
  signals: SignalTable
  trade_ideas: TradeIdeaTable
  trades: TradeTable
  trade_pnl: TradePnlTable
  trade_exits: TradeExitTable
  strategies: StrategyTable
  strategy_backtests: StrategyBacktestTable
  backtest_jobs: BacktestJobTable
  strategy_executions: StrategyExecutionTable
  strategy_trades: StrategyTradeTable
  trade_feelings: TradeFeelingTable
  binance_listing_alerts: BinanceListingAlertTable
}

export function createDb(connectionString?: string): Kysely<DB> {
  const { Pool } = pg
  const dbUrl = connectionString ?? process.env.DATABASE_URL

  // Determine if we should use SSL
  // Use SSL for RDS connections (contains .rds.amazonaws.com) or in production
  const useSSL =
    process.env.NODE_ENV === 'production' ||
    (dbUrl &&
      (dbUrl.includes('.rds.amazonaws.com') || dbUrl.includes('?sslmode=')))

  const pool = new Pool({
    connectionString: dbUrl,
    // Enable SSL for RDS connections
    ssl: useSSL
      ? {
          rejectUnauthorized: false, // RDS uses AWS-managed certificates
        }
      : undefined,
  })
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  })
}
