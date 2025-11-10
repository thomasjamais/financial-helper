import { describe, it, expect } from 'vitest'
import {
  calculateExitStrategy,
  getNextExitLevel,
  shouldExecutePartialExit,
  calculateExitQuantity,
} from '../exitStrategy.js'
import type { TradeState } from '../types.js'

describe('exitStrategy', () => {
  describe('calculateExitStrategy', () => {
    it('should calculate exit strategy for small TP', () => {
      const strategy = calculateExitStrategy(0.015) // 1.5% TP
      expect(strategy.autoCalculated).toBe(true)
      expect(strategy.levels.length).toBeGreaterThanOrEqual(2)
      expect(strategy.levels.length).toBeLessThanOrEqual(3)
      expect(strategy.levels[0].profitPct).toBeGreaterThan(0)
      expect(strategy.levels[strategy.levels.length - 1].profitPct).toBe(0.015)
    })

    it('should calculate exit strategy for medium TP', () => {
      const strategy = calculateExitStrategy(0.04) // 4% TP
      expect(strategy.autoCalculated).toBe(true)
      expect(strategy.levels.length).toBeGreaterThanOrEqual(3)
      expect(strategy.levels.length).toBeLessThanOrEqual(4)
      expect(strategy.levels[strategy.levels.length - 1].profitPct).toBe(0.04)
    })

    it('should calculate exit strategy for large TP', () => {
      const strategy = calculateExitStrategy(0.08) // 8% TP
      expect(strategy.autoCalculated).toBe(true)
      expect(strategy.levels.length).toBeGreaterThanOrEqual(4)
      expect(strategy.levels[strategy.levels.length - 1].profitPct).toBe(0.08)
    })

    it('should distribute quantities evenly across levels', () => {
      const strategy = calculateExitStrategy(0.06)
      const totalQuantity = strategy.levels.reduce(
        (sum, level) => sum + level.quantityPct,
        0,
      )
      expect(totalQuantity).toBeCloseTo(1.0, 5)
    })
  })

  describe('getNextExitLevel', () => {
    it('should return next exit level when profit not reached', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: {
          levels: [
            { profitPct: 0.02, quantityPct: 0.25 },
            { profitPct: 0.04, quantityPct: 0.25 },
            { profitPct: 0.06, quantityPct: 0.5 },
          ],
          autoCalculated: true,
        },
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 101, // 1% profit
      }

      const nextLevel = getNextExitLevel(trade)
      expect(nextLevel).not.toBeNull()
      expect(nextLevel?.profitPct).toBe(0.02)
    })

    it('should return null when all levels executed', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 10, // All exited
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: {
          levels: [
            { profitPct: 0.02, quantityPct: 0.25 },
            { profitPct: 0.04, quantityPct: 0.25 },
            { profitPct: 0.06, quantityPct: 0.5 },
          ],
          autoCalculated: true,
        },
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 106,
      }

      const nextLevel = getNextExitLevel(trade)
      expect(nextLevel).toBeNull()
    })

    it('should return null when no exit strategy', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const nextLevel = getNextExitLevel(trade)
      expect(nextLevel).toBeNull()
    })
  })

  describe('shouldExecutePartialExit', () => {
    it('should return true when profit target reached', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: {
          levels: [{ profitPct: 0.02, quantityPct: 0.25 }],
          autoCalculated: true,
        },
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 102, // 2% profit
      }

      const shouldExecute = shouldExecutePartialExit(trade, {
        profitPct: 0.02,
        quantityPct: 0.25,
      })
      expect(shouldExecute).toBe(true)
    })

    it('should return false when profit target not reached', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: {
          levels: [{ profitPct: 0.02, quantityPct: 0.25 }],
          autoCalculated: true,
        },
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 101, // 1% profit
      }

      const shouldExecute = shouldExecutePartialExit(trade, {
        profitPct: 0.02,
        quantityPct: 0.25,
      })
      expect(shouldExecute).toBe(false)
    })

    it('should handle SELL trades correctly', () => {
      const trade: TradeState = {
        id: 1,
        side: 'SELL',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 0,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: {
          levels: [{ profitPct: 0.02, quantityPct: 0.25 }],
          autoCalculated: true,
        },
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 98, // 2% profit (price went down)
      }

      const shouldExecute = shouldExecutePartialExit(trade, {
        profitPct: 0.02,
        quantityPct: 0.25,
      })
      expect(shouldExecute).toBe(true)
    })
  })

  describe('calculateExitQuantity', () => {
    it('should calculate exit quantity correctly', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 2,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const exitQuantity = calculateExitQuantity(trade, {
        profitPct: 0.02,
        quantityPct: 0.25,
      })

      // Remaining quantity is 8, 25% of that is 2
      expect(exitQuantity).toBe(2)
    })

    it('should not exceed remaining quantity', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 9,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const exitQuantity = calculateExitQuantity(trade, {
        profitPct: 0.02,
        quantityPct: 0.5, // Would be 0.5, but only 1 remaining
      })

      expect(exitQuantity).toBe(1)
    })
  })
})

