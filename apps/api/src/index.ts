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

// GET /healthz endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true, message: 'GET /healthz endpoint' })
})

// GET /v1/balances endpoint
app.get('/v1/balances', (req, res) => {
  res.json({ ok: true, message: 'GET /v1/balances endpoint' })
})

// POST /v1/rebalance endpoint
app.post('/v1/rebalance', (req, res) => {
  res.json({ ok: true, message: 'POST /v1/rebalance endpoint' })
})

// GET /healthz endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true, message: 'GET /healthz endpoint' })
})

// GET /v1/balances endpoint
app.get('/v1/balances', (req, res) => {
  res.json({ ok: true, message: 'GET /v1/balances endpoint' })
})

// POST /v1/rebalance endpoint
app.post('/v1/rebalance', (req, res) => {
  res.json({ ok: true, message: 'POST /v1/rebalance endpoint' })
})