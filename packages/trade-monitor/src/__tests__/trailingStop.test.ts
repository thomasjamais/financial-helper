import { describe, it, expect } from 'vitest'
import {
  calculateTrailingStop,
  shouldUpdateTrailingStop,
  shouldTriggerTrailingStop,
  reconfigureTrailingStop,
} from '../trailingStop.js'
import type { TradeState, TrailingStopConfig } from '../types.js'

describe('trailingStop', () => {
  describe('calculateTrailingStop', () => {
    it('should return null when disabled', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: false,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const result = calculateTrailingStop(trade, trade.trailingStopConfig!)
      expect(result).toBeNull()
    })

    it('should return null when activation threshold not reached', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.02, // Need 2% profit
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 100.5, // Only 0.5% profit
      }

      const result = calculateTrailingStop(trade, trade.trailingStopConfig!)
      expect(result).toBeNull()
    })

    it('should calculate trailing stop for BUY trade', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005, // 0.5%
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 102, // 2% profit
      }

      const result = calculateTrailingStop(trade, trade.trailingStopConfig!)
      expect(result).not.toBeNull()
      // Trailing stop should be 0.5% below current price
      expect(result).toBeCloseTo(102 * (1 - 0.005), 2)
    })

    it('should calculate trailing stop for SELL trade', () => {
      const trade: TradeState = {
        id: 1,
        side: 'SELL',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005, // 0.5%
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 98, // 2% profit (price went down)
      }

      const result = calculateTrailingStop(trade, trade.trailingStopConfig!)
      expect(result).not.toBeNull()
      // Trailing stop should be 0.5% above current price
      expect(result).toBeCloseTo(98 * (1 + 0.005), 2)
    })
  })

  describe('shouldUpdateTrailingStop', () => {
    it('should return false when disabled', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: false,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const result = shouldUpdateTrailingStop(trade, 101.5)
      expect(result).toBe(false)
    })

    it('should return true when no trailing stop set yet', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const result = shouldUpdateTrailingStop(trade, 101.5)
      expect(result).toBe(true)
    })

    it('should return true when new trailing stop is better for BUY', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101.0,
        currentPrice: 103, // Price increased
      }

      const newTrailingStop = 102.5 // Higher = better for BUY
      const result = shouldUpdateTrailingStop(trade, newTrailingStop)
      expect(result).toBe(true)
    })

    it('should return false when new trailing stop is worse for BUY', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101.5,
        currentPrice: 102,
      }

      const newTrailingStop = 101.0 // Lower = worse for BUY
      const result = shouldUpdateTrailingStop(trade, newTrailingStop)
      expect(result).toBe(false)
    })
  })

  describe('shouldTriggerTrailingStop', () => {
    it('should return false when disabled', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: false,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101,
        currentPrice: 100.5,
      }

      const result = shouldTriggerTrailingStop(trade)
      expect(result).toBe(false)
    })

    it('should return true when price hits trailing stop for BUY', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101,
        currentPrice: 101, // Price equals trailing stop
      }

      const result = shouldTriggerTrailingStop(trade)
      expect(result).toBe(true)
    })

    it('should return true when price below trailing stop for BUY', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101,
        currentPrice: 100.5, // Price below trailing stop
      }

      const result = shouldTriggerTrailingStop(trade)
      expect(result).toBe(true)
    })

    it('should return true when price hits trailing stop for SELL', () => {
      const trade: TradeState = {
        id: 1,
        side: 'SELL',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 99,
        currentPrice: 99, // Price equals trailing stop
      }

      const result = shouldTriggerTrailingStop(trade)
      expect(result).toBe(true)
    })
  })

  describe('reconfigureTrailingStop', () => {
    it('should return same config when volatility change is small', () => {
      const config: TrailingStopConfig = {
        enabled: true,
        activationProfitPct: 0.01,
        trailDistancePct: 0.005,
        minTrailDistancePct: 0.002,
      }

      const result = reconfigureTrailingStop(config, 0.02, 0.021) // Small change
      expect(result).toEqual(config)
    })

    it('should widen trail when volatility increases significantly', () => {
      const config: TrailingStopConfig = {
        enabled: true,
        activationProfitPct: 0.01,
        trailDistancePct: 0.005,
        minTrailDistancePct: 0.002,
      }

      const result = reconfigureTrailingStop(config, 0.05, 0.02) // Volatility doubled
      expect(result.trailDistancePct).toBeGreaterThan(config.trailDistancePct)
    })

    it('should tighten trail when volatility decreases significantly', () => {
      const config: TrailingStopConfig = {
        enabled: true,
        activationProfitPct: 0.01,
        trailDistancePct: 0.005,
        minTrailDistancePct: 0.002,
      }

      const result = reconfigureTrailingStop(config, 0.01, 0.05) // Volatility halved
      expect(result.trailDistancePct).toBeLessThan(config.trailDistancePct)
      expect(result.trailDistancePct).toBeGreaterThanOrEqual(
        config.minTrailDistancePct,
      )
    })
  })
})

