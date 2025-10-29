import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: resolve(__dirname, '../../../.env') })
config({ path: resolve(__dirname, '../.env') })
import { createDb, runMigrations } from '@pkg/db'
import { createLogger } from './logger'
import { loadEnv } from './env'
import { createApp } from './app'

async function main() {
  const env = loadEnv()
  const logger = createLogger(env.LOG_LEVEL)
  logger.info({ port: env.PORT ?? 8080 }, 'Starting API server')

  logger.info('Connecting to database')
  const db = createDb(env.DATABASE_URL)

  logger.info('Running migrations')
  try {
    await runMigrations(db)
    logger.info('Migrations completed successfully')
  } catch (err) {
    logger.error(
      {
        err: {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      },
      'Migration failed',
    )
    process.exit(1)
  }

  const app = createApp(db, logger, env.API_ENC_KEY, env.JWT_SECRET, env.JWT_REFRESH_SECRET)
  const port = Number(env.PORT ?? 8080)
  app.listen(port, () => {
    logger.info({ port }, 'API listening')
  })
}

main().catch((err) => {
  const logger = createLogger()
  logger.fatal(
    {
      err: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    },
    'Fatal error during startup',
  )
  process.exit(1)
})
