import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { z } from 'zod'
import {
  BitgetAdapter,
  type BitgetConfig,
} from '@pkg/exchange-adapters'

const app = express()
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
app.use(pinoHttp({ logger }))
app.use(cors())
app.use(express.json())

app.get('/healthz', (_req, res) => res.json({ ok: true }))

// Placeholder: link Bitget keys (store encrypted later)
const LinkSchema = z.object({
  exchange: z.literal('bitget'),
  key: z.string(),
  secret: z.string(),
  passphrase: z.string().optional(),
  env: z.enum(['paper','live']).default('paper')
})

app.post('/v1/exchanges', (req, res) => {
  const parsed = LinkSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  // TODO: encrypt and persist
  return res.status(201).json({ id: 'ex_1', ...parsed.data })
})

// Simple in-memory session store (replace with encrypted storage later)
let currentCfg: BitgetConfig | undefined

// Set credentials (temporary)
app.post('/v1/bitget/config', (req, res) => {
  const Schema = z.object({
    key: z.string().min(10),
    secret: z.string().min(10),
    passphrase: z.string().min(1),
    env: z.enum(['paper', 'live']).default('paper'),
    baseUrl: z.string().url().optional(),
  })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  currentCfg = parsed.data
  return res.json({ ok: true })
})

function getAdapter(): BitgetAdapter | undefined {
  if (!currentCfg) return undefined
  return new BitgetAdapter(currentCfg)
}

app.get('/v1/balances', async (_req, res) => {
  const adapter = getAdapter()
  if (!adapter) return res.status(400).json({ error: 'Bitget config not set' })
  const spot = await adapter.getBalances('spot')
  const futures = await adapter.getBalances('futures')
  return res.json({ spot, futures })
})

app.get('/v1/positions', async (_req, res) => {
  const adapter = getAdapter()
  if (!adapter) return res.status(400).json({ error: 'Bitget config not set' })
  const positions = await adapter.getPositions()
  return res.json({ positions })
})

const PlaceOrderSchema = z.object({
  symbol: z.string().toUpperCase(),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT']),
  qty: z.number().positive(),
  price: z.number().positive().optional(),
  clientOid: z.string().min(1).default(() => `oid_${Date.now()}`),
})

app.post('/v1/orders', async (req, res) => {
  const parsed = PlaceOrderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const adapter = getAdapter()
  if (!adapter) return res.status(400).json({ error: 'Bitget config not set' })
  try {
    const order = await adapter.placeOrder(parsed.data)
    return res.status(201).json(order)
  } catch (e: any) {
    return res.status(400).json({ error: String(e?.message ?? e) })
  }
})

const port = Number(process.env.PORT ?? 8080)
app.listen(port, () => {
  logger.info({ port }, 'API listening')
})
