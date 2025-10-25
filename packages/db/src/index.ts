import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

export interface DB {}

export function createDb(connectionString?: string) {
  const { Pool } = pg
  const pool = new Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL,
  })
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  })
}
