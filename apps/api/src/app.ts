import express, { type Express } from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { healthRouter } from './routes/health'
import { exchangesRouter } from './routes/exchanges'
import { bitgetRouter } from './routes/bitget'
import { binanceRouter } from './routes/binance'
import { exchangeConfigsRouter } from './routes/exchangeConfigs'
import { Kysely } from 'kysely'
import type { Logger } from './logger'
import { correlationIdMiddleware } from './middleware/correlationId'
import { errorHandler } from './middleware/errorHandler'

export function createApp(
  db: Kysely<unknown>,
  logger: Logger,
  encKey: string,
): Express {
  const app = express()

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
  app.use(exchangesRouter())
  app.use(bitgetRouter(db, logger, encKey))
  app.use(binanceRouter(db, logger, encKey))
  app.use(exchangeConfigsRouter(db, logger, encKey))

  app.use(errorHandler(logger))

  return app
}
