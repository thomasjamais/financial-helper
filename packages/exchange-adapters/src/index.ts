export type Balance = { asset: string; free: number; locked?: number }
export type Position = {
  symbol: string
  side: 'LONG' | 'SHORT'
  qty: number
  avgPrice: number
  leverage?: number
}
export type Order = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET'
  qty: number
  price?: number
  status: string
  clientOid: string
}

import { z } from 'zod'
import { request } from 'undici'

export interface ExchangePort {
  getBalances(kind: 'spot' | 'futures'): Promise<Balance[]>
  getPositions(): Promise<Position[]>
  listOrders(status?: string): Promise<Order[]>
  placeOrder(o: Omit<Order, 'id' | 'status'>): Promise<Order>
  cancelOrder(idOrClientOid: string): Promise<void>
  transferInternal?(params: {
    asset: string
    amount: number
    from: 'spot' | 'futures'
    to: 'spot' | 'futures'
  }): Promise<{ txId: string }>
}

export const BitgetConfigSchema = z.object({
  key: z.string().min(10),
  secret: z.string().min(10),
  passphrase: z.string().min(1),
  env: z.enum(['paper', 'live']).default('paper'),
  baseUrl: z.string().url().default('https://api.bitget.com'),
})
export type BitgetConfig = z.infer<typeof BitgetConfigSchema>

type HttpMethod = 'GET' | 'POST' | 'DELETE'

class RateLimiter {
  private tokens: number
  private lastRefill: number
  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }
  async take(cost = 1) {
    while (true) {
      this.refill()
      if (this.tokens >= cost) {
        this.tokens -= cost
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  private refill() {
    const now = Date.now()
    const delta = (now - this.lastRefill) / 1000
    if (delta > 0) {
      this.tokens = Math.min(
        this.capacity,
        this.tokens + delta * this.refillPerSec,
      )
      this.lastRefill = now
    }
  }
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = 5,
  baseMs = 200,
) {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const jitter = Math.floor(Math.random() * baseMs)
      const delay = Math.min(5000, baseMs * 2 ** i) + jitter
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

class BitgetHttpClient {
  private limiter = new RateLimiter(10, 10)
  constructor(
    private cfg: BitgetConfig,
    private backoff: { attempts: number; baseMs: number } = {
      attempts: 5,
      baseMs: 200,
    },
  ) {}
  async call<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    await this.limiter.take(1)
    const url = `${this.cfg.baseUrl}${path}`
    return withBackoff(
      async () => {
        const r = await request(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        })
        if (r.statusCode >= 400) throw new Error(`HTTP ${r.statusCode}`)
        const json = await r.body.json()
        return json as T
      },
      this.backoff.attempts,
      this.backoff.baseMs,
    )
  }
}

export class BitgetAdapter implements ExchangePort {
  private readonly cfg: BitgetConfig
  private readonly http: BitgetHttpClient
  constructor(opts: {
    key: string
    secret: string
    passphrase: string
    env?: 'paper' | 'live'
    baseUrl?: string
    backoffAttempts?: number
    backoffBaseMs?: number
  }) {
    const { backoffAttempts, backoffBaseMs, ...rest } = opts as any
    this.cfg = BitgetConfigSchema.parse({ ...rest })
    this.http = new BitgetHttpClient(this.cfg, {
      attempts: backoffAttempts ?? 5,
      baseMs: backoffBaseMs ?? 200,
    })
  }
  async getBalances(kind: 'spot' | 'futures'): Promise<Balance[]> {
    // NOTE: Placeholder endpoint paths; replace with actual Bitget routes
    const path =
      kind === 'spot'
        ? '/api/spot/v1/account/assets'
        : '/api/mix/v1/account/accounts'
    try {
      const data = await this.http.call<any>('GET', path)
      // Normalize to Balance[]; tolerate provider shape differences
      const items: any[] = Array.isArray(data?.data) ? data.data : []
      return items.map((it) => ({
        asset: it.symbol?.toUpperCase?.() || it.asset || 'USDT',
        free: Number(it.available || it.free || 0),
      }))
    } catch {
      return []
    }
  }
  async getPositions(): Promise<Position[]> {
    return []
  }
  async listOrders(status?: string): Promise<Order[]> {
    return []
  }
  async placeOrder(o: Omit<Order, 'id' | 'status'>): Promise<Order> {
    return { ...o, id: 'TBD', status: 'NEW' }
  }
  async cancelOrder(idOrClientOid: string): Promise<void> {}
}
