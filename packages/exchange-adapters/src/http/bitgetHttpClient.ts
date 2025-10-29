import { request } from 'undici'
import crypto from 'crypto'
import type { BitgetConfig } from '../config'
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

export interface BitgetHttpClientConfig {
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

export class BitgetHttpClient {
  private rateLimiter: PerEndpointRateLimiter
  private circuitBreaker: CircuitBreaker

  constructor(
    private cfg: BitgetConfig,
    private clientConfig: BitgetHttpClientConfig = {
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

  async call<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>,
  ): Promise<T> {
    const endpointPattern = this.extractEndpointPattern(path)

    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.take(endpointPattern)

      return withBackoff(
        async () => {
          const timestamp = Date.now().toString()
          let bodyStr = ''
          if (body) {
            if (typeof body === 'object') {
              const sortedBody = Object.keys(body)
                .sort()
                .reduce(
                  (acc, key) => {
                    acc[key] = (body as Record<string, unknown>)[key]
                    return acc
                  },
                  {} as Record<string, unknown>,
                )
              bodyStr = JSON.stringify(sortedBody)
            } else {
              bodyStr = String(body)
            }
          }

          let fullPath = path
          let queryString = ''
          if (queryParams && Object.keys(queryParams).length > 0) {
            const sortedParams = Object.keys(queryParams)
              .sort()
              .reduce(
                (acc, key) => {
                  acc[key] = queryParams[key]
                  return acc
                },
                {} as Record<string, string>,
              )
            queryString = new URLSearchParams(sortedParams).toString()
            fullPath = `${path}?${queryString}`
          }

          const signaturePath = method === 'POST' ? path : fullPath
          const signatureMessage =
            timestamp + method.toUpperCase() + signaturePath + bodyStr

          this.clientConfig.logger?.info('Signature calculation details', {
            timestamp,
            method: method.toUpperCase(),
            signaturePath,
            bodyStr,
            bodyStrLength: bodyStr.length,
            signatureMessage,
            signatureMessageLength: signatureMessage.length,
          })

          const signature = this.createSignature(
            method,
            signaturePath,
            timestamp,
            bodyStr,
          )

          const passphraseEncoded = crypto
            .createHmac('sha256', this.cfg.secret)
            .update(this.cfg.passphrase)
            .digest('base64')

          const passphraseToUse = this.cfg.passphrase

          this.clientConfig.logger?.info('Bitget authentication details', {
            key: `${this.cfg.key.substring(0, 8)}...${this.cfg.key.substring(this.cfg.key.length - 4)}`,
            passphraseRaw: `${this.cfg.passphrase.substring(0, 2)}***${this.cfg.passphrase.length > 4 ? this.cfg.passphrase.substring(this.cfg.passphrase.length - 2) : ''}`,
            passphraseLength: this.cfg.passphrase.length,
            passphrasePlain: this.cfg.passphrase,
            passphraseEncoded: `${passphraseEncoded.substring(0, 10)}...${passphraseEncoded.substring(passphraseEncoded.length - 6)}`,
            passphraseEncodedFull: passphraseEncoded,
            passphraseEncodedLength: passphraseEncoded.length,
            secretLength: this.cfg.secret.length,
            usingPassphrase: 'plain',
            method,
            signatureMessage,
            signaturePreview: `${signature.substring(0, 10)}...${signature.substring(signature.length - 6)}`,
            signaturePath,
            timestamp,
            bodyStr,
          })

          const headers: Record<string, string> = {
            'ACCESS-KEY': this.cfg.key,
            'ACCESS-SIGN': signature,
            'ACCESS-TIMESTAMP': timestamp,
            'ACCESS-PASSPHRASE': passphraseToUse,
            'content-type': 'application/json',
            locale: 'en-US',
          }

          const baseUrlObj = new URL(this.cfg.baseUrl)
          const urlObj = new URL(fullPath, baseUrlObj)
          const url = urlObj.toString()

          this.clientConfig.logger?.info('Making Bitget API request', {
            method,
            url,
            path: fullPath,
            signaturePath,
            hasBody: !!body,
            bodyStr,
            queryParams,
            signatureMessage,
            signatureLength: signature.length,
            headers: Object.keys(headers),
          })

          const r = await request(url, {
            method,
            headers,
            body: bodyStr || undefined,
          })

          const responseText = await r.body.text()
          this.clientConfig.logger?.debug('Bitget API response', {
            statusCode: r.statusCode,
            path: fullPath,
            responseLength: responseText.length,
            responsePreview: responseText.substring(0, 200),
          })

          if (r.statusCode >= 400) {
            const errorMsg = `HTTP ${r.statusCode}: ${responseText}`
            this.clientConfig.logger?.error('Bitget API error', {
              statusCode: r.statusCode,
              method,
              path: fullPath,
              signaturePath,
              bodyStr,
              response: responseText,
            })
            throw new Error(errorMsg)
          }

          try {
            const json = JSON.parse(responseText) as T
            this.clientConfig.logger?.debug('Bitget API response parsed', {
              path: fullPath,
              hasData: !!(json as any)?.data,
              dataType: Array.isArray((json as any)?.data)
                ? 'array'
                : typeof (json as any)?.data,
            })
            return json
          } catch (parseErr) {
            this.clientConfig.logger?.error(
              'Failed to parse Bitget API response',
              {
                path: fullPath,
                responseText,
                error:
                  parseErr instanceof Error
                    ? parseErr.message
                    : String(parseErr),
              },
            )
            throw new Error(
              `Invalid JSON response: ${responseText.substring(0, 100)}`,
            )
          }
        },
        this.clientConfig.backoff.attempts,
        this.clientConfig.backoff.baseMs,
      )
    })
  }

  private createSignature(
    method: string,
    path: string,
    timestamp: string,
    body: string,
  ): string {
    const message = timestamp + method.toUpperCase() + path + body
    const signature = crypto
      .createHmac('sha256', this.cfg.secret)
      .update(message)
      .digest('base64')
    return signature
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
