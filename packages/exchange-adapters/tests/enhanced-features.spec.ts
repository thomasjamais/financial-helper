import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BitgetAdapter, BitgetConfigSchema, RateLimiter, PerEndpointRateLimiter, CircuitBreaker, CircuitState } from '../src'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(5, 2) // 5 tokens, refill 2 per second
  })

  it('should allow requests within capacity', async () => {
    await limiter.take(3)
    expect(limiter.getTokens()).toBeGreaterThan(1.9)
  })

  it('should block requests when capacity exceeded', async () => {
    // Test that taking more tokens than capacity will eventually succeed
    await limiter.take(5) // Exhaust all tokens
    expect(limiter.getTokens()).toBe(0)
    
    // Taking more should work after refill
    const start = Date.now()
    await limiter.take(1) // This should wait for refill
    const duration = Date.now() - start
    expect(duration).toBeGreaterThan(400) // Should have waited for refill
  }, 10000)

  it('should refill tokens over time', async () => {
    await limiter.take(5) // Exhaust all tokens
    expect(limiter.getTokens()).toBe(0)
    
    // Wait for refill
    await new Promise(resolve => setTimeout(resolve, 600)) // 0.6 seconds
    expect(limiter.getTokens()).toBeGreaterThan(0)
  })
})

describe('PerEndpointRateLimiter', () => {
  let limiter: PerEndpointRateLimiter

  beforeEach(() => {
    limiter = new PerEndpointRateLimiter({ capacity: 10, refillPerSec: 10 })
  })

  it('should use default config for unknown endpoints', async () => {
    await limiter.take('/unknown/endpoint')
    expect(limiter.getTokens('/unknown/endpoint')).toBe(9)
  })

  it('should use custom config for specific endpoints', async () => {
    limiter.setEndpointConfig('/api/orders', { capacity: 3, refillPerSec: 1 })
    await limiter.take('/api/orders')
    expect(limiter.getTokens('/api/orders')).toBe(2)
  })

  it('should maintain separate token buckets per endpoint', async () => {
    limiter.setEndpointConfig('/api/orders', { capacity: 2, refillPerSec: 1 })
    
    await limiter.take('/api/orders', 2) // Exhaust orders bucket
    await limiter.take('/api/account', 1) // Use default bucket
    
    expect(limiter.getTokens('/api/orders')).toBe(0)
    expect(limiter.getTokens('/api/account')).toBe(9)
  })
})

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 100, // Shorter timeout for tests
      successThreshold: 2,
    })
  })

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('should open circuit after failure threshold', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Test error'))
    
    // Trigger failures up to threshold
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFn)
      } catch {
        // Expected to fail
      }
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN)
    expect(circuitBreaker.getFailureCount()).toBe(3)
  })

  it('should transition to HALF_OPEN after recovery timeout', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Test error'))
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFn)
      } catch {
        // Expected to fail
      }
    }
    
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN)
    
    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Check state should transition to HALF_OPEN
    expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN)
  })

  it('should close circuit after success threshold in HALF_OPEN', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Test error'))
    const successFn = vi.fn().mockResolvedValue('success')
    
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFn)
      } catch {
        // Expected to fail
      }
    }
    
    // Wait for recovery timeout
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Transition to HALF_OPEN and succeed
    await circuitBreaker.execute(successFn)
    await circuitBreaker.execute(successFn)
    
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('should reset circuit breaker', () => {
    circuitBreaker.reset()
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED)
    expect(circuitBreaker.getFailureCount()).toBe(0)
  })
})

describe('BitgetAdapter enhanced features', () => {
  it('should provide circuit breaker monitoring', () => {
    const adapter = new BitgetAdapter({
      key: 'k'.repeat(16),
      secret: 's'.repeat(32),
      passphrase: 'p',
      env: 'paper',
      baseUrl: 'https://example.invalid',
    })
    
    expect(adapter.getCircuitState()).toBe(CircuitState.CLOSED)
    expect(adapter.getFailureCount()).toBe(0)
  })

  it('should allow custom HTTP configuration', () => {
    const adapter = new BitgetAdapter({
      key: 'k'.repeat(16),
      secret: 's'.repeat(32),
      passphrase: 'p',
      env: 'paper',
      baseUrl: 'https://example.invalid',
      httpConfig: {
        rateLimit: { capacity: 20, refillPerSec: 20 },
        circuitBreaker: { failureThreshold: 10, recoveryTimeout: 60000, successThreshold: 3 },
        backoff: { attempts: 3, baseMs: 100 },
      },
    })
    
    expect(adapter.getCircuitState()).toBe(CircuitState.CLOSED)
  })

  it('should provide rate limit token monitoring', () => {
    const adapter = new BitgetAdapter({
      key: 'k'.repeat(16),
      secret: 's'.repeat(32),
      passphrase: 'p',
      env: 'paper',
      baseUrl: 'https://example.invalid',
    })
    
    const tokens = adapter.getRateLimitTokens('/api/spot/v1/account/assets')
    expect(typeof tokens).toBe('number')
    expect(tokens).toBeGreaterThanOrEqual(0)
  })
})
