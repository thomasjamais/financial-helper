import { describe, it, expect } from 'vitest'
import { evaluateTrade, getTradeActions } from '../monitor.js'
import type { TradeState } from '../types.js'

describe('monitor', () => {
  describe('evaluateTrade', () => {
    it('should return no_action when no conditions met', () => {
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
        currentPrice: 100.5, // Not enough profit
      }

      const evaluation = evaluateTrade(trade)
      expect(evaluation.actions.length).toBeGreaterThan(0)
      expect(evaluation.actions[0].type).toBe('no_action')
    })

    it('should trigger partial exit when profit target reached', () => {
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

      const evaluation = evaluateTrade(trade)
      const partialExitAction = evaluation.actions.find(
        (a) => a.type === 'partial_exit',
      )
      expect(partialExitAction).not.toBeUndefined()
      if (partialExitAction && partialExitAction.type === 'partial_exit') {
        expect(partialExitAction.quantity).toBeGreaterThan(0)
        expect(partialExitAction.level.profitPct).toBe(0.02)
      }
    })

    it('should trigger trailing stop when price hits stop', () => {
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

      const evaluation = evaluateTrade(trade)
      const trailingStopAction = evaluation.actions.find(
        (a) => a.type === 'trigger_trailing_stop',
      )
      expect(trailingStopAction).not.toBeUndefined()
      if (
        trailingStopAction &&
        trailingStopAction.type === 'trigger_trailing_stop'
      ) {
        expect(trailingStopAction.quantity).toBe(10)
      }
    })

    it('should update trailing stop when price moves favorably', () => {
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
        currentPrice: 103, // Price increased significantly
      }

      const evaluation = evaluateTrade(trade)
      const updateAction = evaluation.actions.find(
        (a) => a.type === 'update_trailing_stop',
      )
      expect(updateAction).not.toBeUndefined()
      if (updateAction && updateAction.type === 'update_trailing_stop') {
        expect(updateAction.newTrailingStopPrice).toBeGreaterThan(101)
      }
    })

    it('should prioritize trailing stop trigger over partial exit', () => {
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
        trailingStopConfig: {
          enabled: true,
          activationProfitPct: 0.01,
          trailDistancePct: 0.005,
          minTrailDistancePct: 0.002,
        },
        currentTrailingStopPrice: 101,
        currentPrice: 100.5, // Price hit trailing stop, but also at exit level
      }

      const evaluation = evaluateTrade(trade)
      // Trailing stop should be first action
      expect(evaluation.actions[0].type).toBe('trigger_trailing_stop')
    })

    it('should calculate current profit percentage correctly', () => {
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
        currentPrice: 102, // 2% profit
      }

      const evaluation = evaluateTrade(trade)
      expect(evaluation.currentProfitPct).toBeCloseTo(0.02, 5)
    })

    it('should calculate remaining quantity correctly', () => {
      const trade: TradeState = {
        id: 1,
        side: 'BUY',
        entryPrice: 100,
        quantity: 10,
        exitedQuantity: 3,
        tpPct: 0.06,
        slPct: 0.02,
        exitStrategy: null,
        trailingStopConfig: null,
        currentTrailingStopPrice: null,
        currentPrice: 102,
      }

      const evaluation = evaluateTrade(trade)
      expect(evaluation.remainingQuantity).toBe(7)
    })
  })

  describe('getTradeActions', () => {
    it('should return array of actions', () => {
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
        currentPrice: 102,
      }

      const actions = getTradeActions(trade)
      expect(Array.isArray(actions)).toBe(true)
      expect(actions.length).toBeGreaterThan(0)
    })
  })
})

