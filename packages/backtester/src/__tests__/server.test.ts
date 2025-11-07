import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../server'

function mkCandles(n: number) {
  const arr = [] as { timestamp: number; open: number; high: number; low: number; close: number }[]
  for (let i = 0; i < n; i++) {
    const price = 100 + Math.sin(i / 5) * 5 + i * 0.05
    arr.push({ timestamp: i, open: price, high: price, low: price, close: price })
  }
  return arr
}

describe('server /backtest', () => {
  it('runs a backtest via HTTP and returns result', async () => {
    const res = await request(app)
      .post('/backtest')
      .send({
        candles: mkCandles(100),
        strategy: 'smaCross',
        params: { shortWindow: 5, longWindow: 20 },
        initialBalance: 10000
      })
      .set('Content-Type', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.result.finalEquity).toBeGreaterThan(0)
    expect(res.body.result.snapshots.length).toBe(100)
  })
})






