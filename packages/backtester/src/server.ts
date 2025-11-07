import express from 'express'
import { z } from 'zod'
import { runBacktest } from './engine'
import type { Candle } from './types'
import { SmaCrossParamsSchema, SmaCrossStrategy } from './strategies'

const app = express()
app.use(express.json())

const BacktestRequestSchema = z.object({
  candles: z.array(
    z.object({
      timestamp: z.number().int(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number().optional()
    })
  ),
  strategy: z.string(),
  params: z.record(z.any()).optional(),
  initialBalance: z.number().positive()
})

app.post('/backtest', (req, res) => {
  const parsed = BacktestRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() })
  }

  const { candles, strategy, params, initialBalance } = parsed.data

  let strategyImpl
  if (strategy === 'smaCross') {
    const p = SmaCrossParamsSchema.parse(params ?? { shortWindow: 10, longWindow: 20 })
    strategyImpl = new SmaCrossStrategy(p)
  } else {
    return res.status(400).json({ error: 'unknown_strategy', strategy })
  }

  const result = runBacktest(candles as Candle[], strategyImpl, initialBalance)
  return res.json({ ok: true, result })
})

const port = Number(process.env.PORT) || 8081
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`backtester listening on :${port}`)
  })
}

export default app


