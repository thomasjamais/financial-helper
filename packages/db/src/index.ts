import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
export { runMigrations } from './migrate'

export interface DB {}

export function createDb(connectionString?: string): Kysely<unknown> {
  const { Pool } = pg
  const pool = new Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  })
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  }) as Kysely<unknown>
}
