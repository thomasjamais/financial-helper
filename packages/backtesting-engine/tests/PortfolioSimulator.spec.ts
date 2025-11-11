import { describe, it, expect } from 'vitest'
import { PortfolioSimulator } from '../src/PortfolioSimulator.js'
import type { BacktestConfig, Candle } from '../src/types.js'
import { getDefaultRiskConfig } from '@pkg/risk-engine'

describe('PortfolioSimulator', () => {
  const createConfig = (overrides?: Partial<BacktestConfig>): BacktestConfig => ({
    initialCapital: 10000,
    feeRate: 0.001,
    slippageBps: 5,
    symbol: 'BTCUSDT',
    timeframeMs: 60000,
    ...overrides,
  })

  const createCandle = (overrides?: Partial<Candle>): Candle => ({
    open: 50000,
    high: 51000,
    low: 49000,
    close: 50000,
    volume: 100,
    timestamp: Date.now(),
    ...overrides,
  })

  describe('initialization', () => {
    it('should initialize with correct state', () => {
      const config = createConfig()
      const simulator = new PortfolioSimulator(config)

      const state = simulator.getState()
      expect(state.balance).toBe(10000)
      expect(state.positionSize).toBe(0)
      expect(state.positionSymbol).toBeNull()
      expect(state.entryPrice).toBeNull()
    })
  })

  describe('validateTrade', () => {
    it('should reject buy when position already open', () => {
      const simulator = new PortfolioSimulator(createConfig())
      const candle = createCandle()

      // Open a position first
      simulator.buy(candle, 0)

      // Try to buy again
      const result = simulator.validateTrade('buy', 50000, 'BTCUSDT')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Position already open')
    })

    it('should reject buy with insufficient balance', () => {
      const config = createConfig({ initialCapital: 10 })
      const simulator = new PortfolioSimulator(config)

      const result = simulator.validateTrade('buy', 50000, 'BTCUSDT')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Insufficient')
    })

    it('should reject buy with wrong symbol', () => {
      const simulator = new PortfolioSimulator(createConfig())

      const result = simulator.validateTrade('buy', 50000, 'ETHUSDT')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Symbol mismatch')
    })

    it('should reject sell when no position', () => {
      const simulator = new PortfolioSimulator(createConfig())

      const result = simulator.validateTrade('sell', 50000, 'BTCUSDT')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('No position to sell')
    })

    it('should accept valid buy', () => {
      const simulator = new PortfolioSimulator(createConfig())

      const result = simulator.validateTrade('buy', 50000, 'BTCUSDT')
      expect(result.valid).toBe(true)
    })

    it('should accept valid sell', () => {
      const simulator = new PortfolioSimulator(createConfig())
      const candle = createCandle()

      simulator.buy(candle, 0)
      const result = simulator.validateTrade('sell', 50000, 'BTCUSDT')
      expect(result.valid).toBe(true)
    })
  })

  describe('buy', () => {
    it('should execute buy order with fees and slippage', () => {
      const config = createConfig({ feeRate: 0.001, slippageBps: 10 })
      const simulator = new PortfolioSimulator(config)
      const candle = createCandle({ close: 50000 })

      const result = simulator.buy(candle, 0)

      expect(result.success).toBe(true)
      const state = simulator.getState()
      expect(state.positionSize).toBeGreaterThan(0)
      expect(state.positionSymbol).toBe('BTCUSDT')
      expect(state.entryPrice).toBeGreaterThan(50000) // Slippage applied

      const trades = simulator.getTrades()
      expect(trades.length).toBe(1)
      expect(trades[0].action).toBe('buy')
      expect(trades[0].fee).toBeGreaterThan(0)
    })

    it('should reduce balance by notional + fee', () => {
      const config = createConfig()
      const simulator = new PortfolioSimulator(config)
      const candle = createCandle({ close: 50000 })
      const initialBalance = simulator.getState().balance

      simulator.buy(candle, 0)

      const state = simulator.getState()
      expect(state.balance).toBeLessThan(initialBalance)
    })

    it('should fail if insufficient balance after fees', () => {
      const config = createConfig({ initialCapital: 1 })
      const simulator = new PortfolioSimulator(config)
      const candle = createCandle({ close: 50000 })

      const result = simulator.buy(candle, 0)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient')
    })
  })

  describe('sell', () => {
    it('should execute sell order with fees and slippage', () => {
      const config = createConfig({ feeRate: 0.001, slippageBps: 10 })
      const simulator = new PortfolioSimulator(config)
      const buyCandle = createCandle({ close: 50000, timestamp: 1000 })
      const sellCandle = createCandle({ close: 51000, timestamp: 2000 })

      simulator.buy(buyCandle, 0)
      const result = simulator.sell(sellCandle, 1)

      expect(result.success).toBe(true)
      const state = simulator.getState()
      expect(state.positionSize).toBe(0)
      expect(state.positionSymbol).toBeNull()

      const trades = simulator.getTrades()
      expect(trades.length).toBe(2)
      expect(trades[1].action).toBe('sell')
      expect(trades[1].pnl).toBeDefined()
      expect(trades[1].fee).toBeGreaterThan(0)
    })

    it('should calculate PnL correctly', () => {
      const config = createConfig()
      const simulator = new PortfolioSimulator(config)
      const buyCandle = createCandle({ close: 50000, timestamp: 1000 })
      const sellCandle = createCandle({ close: 55000, timestamp: 2000 })

      simulator.buy(buyCandle, 0)
      simulator.sell(sellCandle, 1)

      const trades = simulator.getTrades()
      const sellTrade = trades[1]
      expect(sellTrade.pnl).toBeDefined()
      expect(sellTrade.pnl!).toBeGreaterThan(0) // Profit
    })

    it('should fail if no position to sell', () => {
      const simulator = new PortfolioSimulator(createConfig())
      const candle = createCandle()

      const result = simulator.sell(candle, 0)
      expect(result.success).toBe(false)
    })
  })

  describe('getEquity', () => {
    it('should calculate equity correctly with position', () => {
      const simulator = new PortfolioSimulator(createConfig())
      const candle = createCandle({ close: 50000 })

      simulator.buy(candle, 0)
      const equity = simulator.getEquity(51000)

      expect(equity).toBeGreaterThan(simulator.getState().balance)
    })

    it('should return balance when no position', () => {
      const simulator = new PortfolioSimulator(createConfig())
      const equity = simulator.getEquity(50000)

      expect(equity).toBe(10000)
    })
  })
})

