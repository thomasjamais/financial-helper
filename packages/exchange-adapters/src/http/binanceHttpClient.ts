import { request } from 'undici'
import crypto from 'crypto'
import type { BinanceConfig } from '../config'
import {
  PerEndpointRateLimiter,
  type RateLimitConfig,
} from '../utils/rateLimiter'
import {
  CircuitBreaker,
  CircuitState,
  type CircuitBreakerConfig,
} from '../utils/circuitBreaker'
import { withBackoff } from '../utils/backoff'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export interface BinanceHttpClientConfig {
  rateLimit: RateLimitConfig
  circuitBreaker: CircuitBreakerConfig
  backoff: { attempts: number; baseMs: number }
  logger?: {
    debug: (msg: string, data?: unknown) => void
    info: (msg: string, data?: unknown) => void
    warn: (msg: string, data?: unknown) => void
    error: (msg: string, data?: unknown) => void
  }
}

export class BinanceHttpClient {
  private rateLimiter: PerEndpointRateLimiter
  private circuitBreaker: CircuitBreaker

  constructor(
    private cfg: BinanceConfig,
    private clientConfig: BinanceHttpClientConfig = {
      rateLimit: { capacity: 10, refillPerSec: 10 },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        successThreshold: 2,
      },
      backoff: { attempts: 5, baseMs: 200 },
    },
  ) {
    this.rateLimiter = new PerEndpointRateLimiter(clientConfig.rateLimit)
    this.circuitBreaker = new CircuitBreaker(clientConfig.circuitBreaker)

    this.setupEndpointLimits()
  }

  private setupEndpointLimits(): void {
    this.rateLimiter.setEndpointConfig('/api/v3/account', {
      capacity: 10,
      refillPerSec: 1,
    })
    this.rateLimiter.setEndpointConfig('/fapi/v2/account', {
      capacity: 10,
      refillPerSec: 1,
    })
  }

  private createSignature(queryString: string, body: string): string {
    const message = queryString + body
    const signature = crypto
      .createHmac('sha256', this.cfg.secret)
      .update(message)
      .digest('hex')
    return signature
  }

  async call<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>,
  ): Promise<T> {
    const endpointPattern = path.split('?')[0]
    const state = this.circuitBreaker.getState()

    if (state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN')
    }

    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.take(endpointPattern)

      return withBackoff(
        async () => {
          const timestamp = Date.now().toString()

          let bodyStr = ''
          if (body) {
            if (typeof body === 'object') {
              bodyStr = JSON.stringify(body)
            } else {
              bodyStr = String(body)
            }
          }

          const params: Record<string, string> = {
            timestamp,
            ...queryParams,
          }

          const sortedKeys = Object.keys(params).sort()
          const queryString = sortedKeys
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join('&')

          const signature = this.createSignature(queryString, bodyStr)

          const fullQueryString = `${queryString}&signature=${signature}`

          const baseUrlObj = new URL(this.cfg.baseUrl)
          const urlObj = new URL(path, baseUrlObj)
          urlObj.search = fullQueryString
          const url = urlObj.toString()

          this.clientConfig.logger?.info('Making Binance API request', {
            method,
            url,
            path,
            queryString: fullQueryString.substring(0, 200),
            hasBody: !!body,
            bodyStr,
          })

          const headers: Record<string, string> = {
            'X-MBX-APIKEY': this.cfg.key,
            'Content-Type': 'application/json',
          }

          const r = await request(url, {
            method,
            headers,
            body: bodyStr || undefined,
          })

          const responseText = await r.body.text()
          this.clientConfig.logger?.debug('Binance API response', {
            statusCode: r.statusCode,
            path,
            responseLength: responseText.length,
            responsePreview: responseText.substring(0, 200),
          })

          if (r.statusCode >= 200 && r.statusCode < 300) {
            try {
              const data = JSON.parse(responseText)
              return data as T
            } catch {
              throw new Error(
                `Invalid JSON response: ${responseText.substring(0, 100)}`,
              )
            }
          }

          let errorData: any
          try {
            errorData = JSON.parse(responseText)
          } catch {
            errorData = { msg: responseText }
          }

          this.clientConfig.logger?.error('Binance API error', {
            method,
            path,
            statusCode: r.statusCode,
            response: responseText,
          })

          throw new Error(`HTTP ${r.statusCode}: ${JSON.stringify(errorData)}`)
        },
        this.clientConfig.backoff.attempts,
        this.clientConfig.backoff.baseMs,
      )
    })
  }
}
