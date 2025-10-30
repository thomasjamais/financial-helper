import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app'

// Minimal mocks for DB and logger
const mockDb: any = {}
const mockLogger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => mockLogger }

describe('POST /v1/binance/earn/auto/plan', () => {
  it('validates input and returns 400 on bad payload', async () => {
    const app = createApp(mockDb, mockLogger, 'enc', 'secret', 'secret2')
    const res = await request(app).post('/v1/binance/earn/auto/plan').send({ minApr: -1 })
    expect(res.status).toBe(400)
  })
})

describe('POST /v1/binance/earn/auto/execute', () => {
  it('requires plan items', async () => {
    const app = createApp(mockDb, mockLogger, 'enc', 'secret', 'secret2')
    const res = await request(app).post('/v1/binance/earn/auto/execute').send({ plan: [] })
    expect(res.status).toBe(400)
  })
})

describe('POST /v1/binance/earn/auto/unsubscribe/plan', () => {
  it('validates input', async () => {
    const app = createApp(mockDb, mockLogger, 'enc', 'secret', 'secret2')
    const res = await request(app).post('/v1/binance/earn/auto/unsubscribe/plan').send({ minApr: -1 })
    expect(res.status).toBe(400)
  })
})


