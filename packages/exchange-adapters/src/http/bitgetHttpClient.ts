import { request } from 'undici'
import type { BitgetConfig } from '../config'
import { RateLimiter } from '../utils/rateLimiter'
import { withBackoff } from '../utils/backoff'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export class BitgetHttpClient {
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
