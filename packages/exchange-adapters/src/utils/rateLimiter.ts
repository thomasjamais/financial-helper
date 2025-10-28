export interface RateLimitConfig {
  capacity: number
  refillPerSec: number
  cost?: number
}

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
  }

  async take(cost = 1): Promise<void> {
    while (true) {
      this.refill()
      if (this.tokens >= cost) {
        this.tokens -= cost
        return
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  private refill(): void {
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

  getTokens(): number {
    this.refill()
    return this.tokens
  }
}

export class PerEndpointRateLimiter {
  private limiters = new Map<string, RateLimiter>()
  private endpointConfigs = new Map<string, RateLimitConfig>()

  constructor(defaultConfig: RateLimitConfig) {
    this.setDefaultConfig(defaultConfig)
  }

  setDefaultConfig(config: RateLimitConfig): void {
    this.endpointConfigs.set('*', config)
  }

  setEndpointConfig(endpoint: string, config: RateLimitConfig): void {
    this.endpointConfigs.set(endpoint, config)
  }

  private getLimiter(endpoint: string): RateLimiter {
    if (!this.limiters.has(endpoint)) {
      const config = this.endpointConfigs.get(endpoint) || this.endpointConfigs.get('*')!
      this.limiters.set(endpoint, new RateLimiter(config.capacity, config.refillPerSec))
    }
    return this.limiters.get(endpoint)!
  }

  async take(endpoint: string, cost?: number): Promise<void> {
    const config = this.endpointConfigs.get(endpoint) || this.endpointConfigs.get('*')!
    const limiter = this.getLimiter(endpoint)
    await limiter.take(cost ?? config.cost ?? 1)
  }

  getTokens(endpoint: string): number {
    const limiter = this.getLimiter(endpoint)
    return limiter.getTokens()
  }
}
