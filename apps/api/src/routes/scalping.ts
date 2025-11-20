import { Router, Request, Response } from 'express'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { ScalpingService } from '../services/scalpingService'

export function scalpingRouter(
  db: Kysely<DB>,
  logger: Logger,
): Router {
  const r = Router()
  const scalpingService = new ScalpingService(logger)

  r.get('/v1/scalping/analyze/:symbol', async (req: Request, res: Response) => {
    const log =
      req.logger || logger.child({ endpoint: '/v1/scalping/analyze/:symbol' })
    const startTime = Date.now()

    try {
      const symbol = req.params.symbol.toUpperCase()

      if (!symbol || !symbol.endsWith('USDT')) {
        return res.status(400).json({
          error: 'Invalid symbol. Must be a USDT futures pair (e.g., BTCUSDT)',
          correlationId: req.correlationId,
        })
      }

      log.info({ symbol }, 'Analyzing symbol for scalping')

      const analysis = await scalpingService.analyzeSymbol(symbol)

      const duration = Date.now() - startTime
      log.info(
        {
          symbol,
          hasEntry: !!analysis.recommendedEntry,
          durationMs: duration,
        },
        'Scalping analysis completed',
      )

      return res.json({ analysis })
    } catch (err) {
      const duration = Date.now() - startTime
      log.error(
        {
          err: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          durationMs: duration,
        },
        'Failed to analyze symbol',
      )
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Unknown error',
        correlationId: req.correlationId,
      })
    }
  })

  return r
}

