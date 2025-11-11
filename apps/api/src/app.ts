import express, { type Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { healthRouter } from './routes/health'
import { exchangesRouter } from './routes/exchanges'
import { bitgetRouter } from './routes/bitget'
import { binanceRouter } from './routes/binance'
import { exchangeConfigsRouter } from './routes/exchangeConfigs'
import { binanceEarnRouter } from './routes/binanceEarn'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { signalsRouter } from './routes/signals'
import { AuthService } from './services/AuthService'
import { tradeIdeasRouter } from './routes/tradeIdeas'
import { strategiesRouter } from './routes/strategies'
import { backtestRouter } from './routes/backtest'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from './logger'
import { correlationIdMiddleware } from './middleware/correlationId'
import { runMigrations } from '@pkg/db'
import { errorHandler } from './middleware/errorHandler'

export function createApp(
  db: Kysely<DB>,
  logger: Logger,
  encKey: string,
  jwtSecret: string,
  jwtRefreshSecret: string,
): Express {
  const app = express()

  // Ensure database schema is up-to-date
  runMigrations(db).catch((err) => {
    logger.error({ err }, 'Failed to run database migrations')
  })

  app.use(correlationIdMiddleware(logger))
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 400 && res.statusCode < 500) return 'warn'
        if (res.statusCode >= 500 || err) return 'error'
        return 'info'
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
      customProps: (req) => ({
        correlationId: req.correlationId,
      }),
    }),
  )
  app.use(cors())
  app.use(express.json())

  app.use(healthRouter())
  app.use(authRouter(db, logger, jwtSecret, jwtRefreshSecret))
  app.use(exchangesRouter())
  app.use(bitgetRouter(db, logger, encKey))
  app.use(binanceRouter(db, logger, encKey))
  app.use(binanceEarnRouter(db, logger, encKey))
  app.use(exchangeConfigsRouter(db, logger, encKey))
  app.use(usersRouter(db, logger))
  const authService = new AuthService(db, logger, jwtSecret, jwtRefreshSecret)
  app.use(signalsRouter(db, logger, authService))
  app.use(tradeIdeasRouter(db, logger, authService, encKey))
  app.use(strategiesRouter(db, logger, authService))
  app.use(backtestRouter(logger, authService))

  app.use(errorHandler(logger))

  return app
}
