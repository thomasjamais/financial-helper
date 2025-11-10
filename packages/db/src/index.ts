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
}

export interface TradePnlTable {
  id: Generated<number>
  trade_id: number
  ts: Generated<Date>
  mark_price: number
  pnl_usd: number
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
}

export function createDb(connectionString?: string): Kysely<DB> {
  const { Pool } = pg
  const dbUrl = connectionString ?? process.env.DATABASE_URL
  
  // Determine if we should use SSL
  // Use SSL for RDS connections (contains .rds.amazonaws.com) or in production
  const useSSL = 
    process.env.NODE_ENV === 'production' ||
    (dbUrl && (dbUrl.includes('.rds.amazonaws.com') || dbUrl.includes('?sslmode=')))
  
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
