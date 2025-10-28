import { describe, it, expect } from 'vitest'
import {
  calculateMaxPositionSize,
  calculateSpotPositionSize,
  calculateFuturesPositionSize,
  validateLeverage,
  getDefaultRiskConfig,
  parseRiskConfigFromEnv,
  type RiskConfig,
} from '../src'

describe('Risk Engine', () => {
  const defaultConfig: RiskConfig = getDefaultRiskConfig()

  describe('calculateMaxPositionSize', () => {
    it('should calculate position size within limits', () => {
      const result = calculateMaxPositionSize({
        balance: 1000,
        price: 50000,
        riskConfig: defaultConfig,
        leverage: 2,
        stopLossPercent: 0.02,
      })

      expect(result.maxQuantity).toBeGreaterThan(0)
      expect(result.maxNotional).toBeLessThanOrEqual(1000 * 0.1) // maxPositionSize
      expect(result.recommendedQuantity).toBeGreaterThanOrEqual(0.001) // minOrderSize
      expect(result.recommendedQuantity).toBeLessThanOrEqual(1000) // maxOrderSize
      expect(result.leverageUsed).toBe(2)
    })

    it('should respect max position size limit', () => {
      const result = calculateMaxPositionSize({
        balance: 10000,
        price: 1000,
        riskConfig: { ...defaultConfig, maxPositionSize: 0.05 }, // 5%
        leverage: 1,
      })

      expect(result.maxNotional).toBeLessThanOrEqual(10000 * 0.05)
    })

    it('should respect leverage limit', () => {
      const result = calculateMaxPositionSize({
        balance: 1000,
        price: 1000,
        riskConfig: { ...defaultConfig, maxLeverage: 5 },
        leverage: 3,
      })

      expect(result.maxNotional).toBeLessThanOrEqual(1000 * 3)
    })
  })

  describe('calculateSpotPositionSize', () => {
    it('should calculate spot position with no leverage', () => {
      const result = calculateSpotPositionSize(1000, 50000, defaultConfig)

      expect(result.leverageUsed).toBe(1)
      expect(result.maxNotional).toBeLessThanOrEqual(1000)
    })
  })

  describe('calculateFuturesPositionSize', () => {
    it('should calculate futures position with leverage', () => {
      const result = calculateFuturesPositionSize(1000, 50000, defaultConfig, 5)

      expect(result.leverageUsed).toBe(5)
      expect(result.maxNotional).toBeLessThanOrEqual(1000 * 5)
    })

    it('should reject excessive leverage', () => {
      expect(() => {
        calculateFuturesPositionSize(1000, 50000, defaultConfig, 20)
      }).toThrow('Leverage 20 exceeds maximum 10')
    })
  })

  describe('validateLeverage', () => {
    it('should accept valid leverage', () => {
      expect(validateLeverage(5, defaultConfig)).toBe(true)
      expect(validateLeverage(1, defaultConfig)).toBe(true)
      expect(validateLeverage(10, defaultConfig)).toBe(true)
    })

    it('should reject invalid leverage', () => {
      expect(validateLeverage(0, defaultConfig)).toBe(false)
      expect(validateLeverage(-1, defaultConfig)).toBe(false)
      expect(validateLeverage(11, defaultConfig)).toBe(false)
    })
  })

  describe('getDefaultRiskConfig', () => {
    it('should return sensible defaults', () => {
      const config = getDefaultRiskConfig()

      expect(config.maxLeverage).toBe(10)
      expect(config.maxRiskPerTrade).toBe(0.02)
      expect(config.maxPositionSize).toBe(0.1)
      expect(config.minOrderSize).toBe(0.001)
      expect(config.maxOrderSize).toBe(1000)
    })
  })

  describe('parseRiskConfigFromEnv', () => {
    it('should parse environment variables', () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        MAX_LEVERAGE: '5',
        MAX_RISK_PER_TRADE: '0.01',
        MAX_POSITION_SIZE: '0.2',
        MIN_ORDER_SIZE: '0.01',
        MAX_ORDER_SIZE: '500',
      }

      const config = parseRiskConfigFromEnv()

      expect(config.maxLeverage).toBe(5)
      expect(config.maxRiskPerTrade).toBe(0.01)
      expect(config.maxPositionSize).toBe(0.2)
      expect(config.minOrderSize).toBe(0.01)
      expect(config.maxOrderSize).toBe(500)

      process.env = originalEnv
    })

    it('should use defaults when env vars are missing', () => {
      const originalEnv = process.env
      process.env = {}

      const config = parseRiskConfigFromEnv()

      expect(config.maxLeverage).toBe(10)
      expect(config.maxRiskPerTrade).toBe(0.02)
      expect(config.maxPositionSize).toBe(0.1)
      expect(config.minOrderSize).toBe(0.001)
      expect(config.maxOrderSize).toBe(1000)

      process.env = originalEnv
    })
  })
})
