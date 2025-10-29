import { describe, it, expect } from 'vitest'
import { calculateConversion } from '../conversionService'
import type { Balance } from '@pkg/exchange-adapters'

describe('calculateConversion', () => {
  const mockBalances: Balance[] = [
    { asset: 'USDT', free: 1000 },
    { asset: 'BTC', free: 0.1 },
    { asset: 'ETH', free: 5 },
  ]

  it('should return null when asset not found in balances', async () => {
    const result = await calculateConversion(
      mockBalances,
      'INVALID',
      100,
      'BTC',
    )
    expect(result).toBeNull()
  })

  it('should return null when amount exceeds available balance', async () => {
    const result = await calculateConversion(mockBalances, 'USDT', 2000, 'BTC')
    expect(result).toBeNull()
  })

  it('should calculate conversion when valid input provided', async () => {
    const result = await calculateConversion(mockBalances, 'USDT', 100, 'BTC')

    expect(result).not.toBeNull()
    if (result) {
      expect(result.fromAsset).toBe('USDT')
      expect(result.fromAmount).toBe(100)
      expect(result.toAsset).toBe('BTC')
      expect(result.toAmount).toBeGreaterThan(0)
      expect(result.rate).toBeGreaterThan(0)
    }
  })
})
