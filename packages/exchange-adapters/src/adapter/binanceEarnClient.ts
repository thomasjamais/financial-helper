import { BinanceHttpClient } from '../http/binanceHttpClient'

export type EarnProduct = {
  id: string
  asset: string
  name: string
  type: 'flexible' | 'locked' | 'staking' | 'launchpool'
  apr: number
  durationDays?: number
  redeemable: boolean
}

export class BinanceEarnClient {
  private readonly http: BinanceHttpClient

  constructor() {
    // Public endpoints; using empty creds and live env for discovery
    this.http = new BinanceHttpClient(
      { key: '', secret: '', baseUrl: 'https://api.binance.com', env: 'live' },
      {
        rateLimit: { capacity: 5, refillPerSec: 5 },
        circuitBreaker: { failureThreshold: 5, recoveryTimeout: 30000, successThreshold: 2 },
        backoff: { attempts: 3, baseMs: 200 },
      },
    )
  }

  async listProducts(): Promise<EarnProduct[]> {
    // Placeholder implementation returning empty list to keep API/web stable
    return []
  }
}


