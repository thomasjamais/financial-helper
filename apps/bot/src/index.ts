import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pino from 'pino'
import pinoHttp from 'pino-http'

const app = express()
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
app.use(pinoHttp({ logger }))
app.use(cors())
app.use(express.json())

// Status endpoint
app.get('/status', (req, res) => {
  logger.info({ endpoint: '/status' }, 'Status endpoint called')
  res.json({ ok: true })
})

const port = Number(process.env.PORT ?? 8081)
app.listen(port, () => {
  logger.info({ port }, 'Bot service listening')
})

export { app }
