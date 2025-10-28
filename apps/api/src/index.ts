import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { z } from 'zod'

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

const port = Number(process.env.PORT ?? 8080)
app.listen(port, () => {
  logger.info({ port }, 'API listening')
})

// GET /status endpoint
app.get('/status', (req, res) => {
  res.json({ ok: true, message: 'GET /status endpoint' })
})

// POST /trigger/rebalance endpoint
app.post('/trigger/rebalance', (req, res) => {
  res.json({ ok: true, message: 'POST /trigger/rebalance endpoint' })
})

// POST /trigger/strategy endpoint
app.post('/trigger/strategy', (req, res) => {
  res.json({ ok: true, message: 'POST /trigger/strategy endpoint' })
})

// GET /status endpoint
app.get('/status', (req, res) => {
  res.json({ ok: true, message: 'GET /status endpoint' })
})

// POST /trigger/rebalance endpoint
app.post('/trigger/rebalance', (req, res) => {
  res.json({ ok: true, message: 'POST /trigger/rebalance endpoint' })
})

// POST /trigger/strategy endpoint
app.post('/trigger/strategy', (req, res) => {
  res.json({ ok: true, message: 'POST /trigger/strategy endpoint' })
})