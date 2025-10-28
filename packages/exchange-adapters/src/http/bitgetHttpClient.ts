import { request } from 'undici'
import type { BitgetConfig } from '../config'
import { PerEndpointRateLimiter, type RateLimitConfig } from '../utils/rateLimiter'
import { CircuitBreaker, CircuitState, type CircuitBreakerConfig } from '../utils/circuitBreaker'
import { withBackoff } from '../utils/backoff'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export interface BitgetHttpClientConfig {
  rateLimit: RateLimitConfig
  circuitBreaker: CircuitBreakerConfig
  backoff: { attempts: number; baseMs: number }
}

export class BitgetHttpClient {
  private rateLimiter: PerEndpointRateLimiter
  private circuitBreaker: CircuitBreaker

  constructor(
    private cfg: BitgetConfig,
    private clientConfig: BitgetHttpClientConfig = {
      rateLimit: { capacity: 10, refillPerSec: 10 },
      circuitBreaker: { failureThreshold: 5, recoveryTimeout: 30000, successThreshold: 2 },
      backoff: { attempts: 5, baseMs: 200 },
    },
  ) {
    this.rateLimiter = new PerEndpointRateLimiter(clientConfig.rateLimit)
    this.circuitBreaker = new CircuitBreaker(clientConfig.circuitBreaker)
    
    // Set per-endpoint rate limits (Bitget-specific)
    this.setupEndpointLimits()
  }

  private setupEndpointLimits(): void {
    // Account endpoints - more restrictive
    this.rateLimiter.setEndpointConfig('/api/spot/v1/account/assets', {
      capacity: 5,
      refillPerSec: 2,
      cost: 1,
    })
    
    this.rateLimiter.setEndpointConfig('/api/mix/v1/account/accounts', {
      capacity: 5,
      refillPerSec: 2,
      cost: 1,
    })
    
    // Order endpoints - most restrictive
    this.rateLimiter.setEndpointConfig('/api/spot/v1/trade/orders', {
      capacity: 3,
      refillPerSec: 1,
      cost: 2,
    })
    
    this.rateLimiter.setEndpointConfig('/api/mix/v1/order/placeOrder', {
      capacity: 2,
      refillPerSec: 1,
      cost: 3,
    })
  }

  async call<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    // Extract endpoint pattern for rate limiting
    const endpointPattern = this.extractEndpointPattern(path)
    
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.take(endpointPattern)
      
      return withBackoff(
        async () => {
          const r = await request(`${this.cfg.baseUrl}${path}`, {
            method,
            headers: { 'content-type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          })
          
          if (r.statusCode >= 400) {
            throw new Error(`HTTP ${r.statusCode}: ${await r.body.text()}`)
          }
          
          const json = await r.body.json()
          return json as T
        },
        this.clientConfig.backoff.attempts,
        this.clientConfig.backoff.baseMs,
      )
    })
  }

  private extractEndpointPattern(path: string): string {
    // Extract the main endpoint pattern for rate limiting
    const parts = path.split('/')
    if (parts.length >= 4) {
      return `/${parts[1]}/${parts[2]}/${parts[3]}`
    }
    return path
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState()
  }

  getFailureCount(): number {
    return this.circuitBreaker.getFailureCount()
  }

  getRateLimitTokens(endpoint: string): number {
    return this.rateLimiter.getTokens(endpoint)
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }
}
