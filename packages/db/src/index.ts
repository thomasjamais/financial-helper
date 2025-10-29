import { Kysely, PostgresDialect, Insertable, Updateable, Selectable, Generated } from 'kysely'
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
  event_type: 'signup' | 'signin' | 'signout' | 'refresh' | 'failed_login' | 'password_reset' | 'account_locked'
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
}

export function createDb(connectionString?: string): Kysely<DB> {
  const { Pool } = pg
  const pool = new Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  })
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  })
}
