import type {
  Candle,
  PortfolioState,
  Trade,
  BacktestConfig,
} from './types.js'
import {
  calculateSpotPositionSize,
  getDefaultRiskConfig,
  type RiskConfig,
} from '@pkg/risk-engine'

export class PortfolioSimulator {
  private state: PortfolioState
  private config: BacktestConfig
  private riskConfig: RiskConfig
  private trades: Trade[] = []

  constructor(config: BacktestConfig, riskConfig?: RiskConfig) {
    this.config = config
    this.riskConfig = riskConfig ?? getDefaultRiskConfig()
    this.state = {
      balance: config.initialCapital,
      positionSize: 0,
      positionSymbol: null,
      entryPrice: null,
      lastTradeIndex: null,
    }
  }

  getState(): PortfolioState {
    return { ...this.state }
  }

  getTrades(): Trade[] {
    return [...this.trades]
  }

  getEquity(currentPrice: number): number {
    return this.state.balance + this.state.positionSize * currentPrice
  }

  /**
   * Validate if a trade can be executed
   */
  validateTrade(
    action: 'buy' | 'sell',
    price: number,
    symbol: string,
  ): { valid: boolean; error?: string } {
    if (action === 'buy') {
      // Check if already have a position
      if (this.state.positionSize > 0) {
        return { valid: false, error: 'Position already open' }
      }

      // Check symbol matches
      if (symbol !== this.config.symbol) {
        return { valid: false, error: `Symbol mismatch: expected ${this.config.symbol}` }
      }

      // Check if we have enough balance
      const positionSizing = calculateSpotPositionSize(
        this.state.balance,
        price,
        this.riskConfig,
      )

      if (positionSizing.recommendedNotional > this.state.balance) {
        return { valid: false, error: 'Insufficient balance' }
      }

      return { valid: true }
    } else {
      // sell
      if (this.state.positionSize === 0) {
        return { valid: false, error: 'No position to sell' }
      }

      if (this.state.positionSymbol !== symbol) {
        return { valid: false, error: 'Symbol mismatch' }
      }

      return { valid: true }
    }
  }

  /**
   * Execute a buy order
   */
  buy(candle: Candle, index: number): { success: boolean; error?: string } {
    const validation = this.validateTrade('buy', candle.close, this.config.symbol)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Calculate position size using risk engine
    const positionSizing = calculateSpotPositionSize(
      this.state.balance,
      candle.close,
      this.riskConfig,
    )

    const notional = positionSizing.recommendedNotional

    // Apply slippage
    const slippageMultiplier = 1 + this.config.slippageBps / 10000
    const executionPrice = candle.close * slippageMultiplier

    // Calculate fee
    const fee = notional * this.config.feeRate

    // Check if we have enough after fees
    const totalCost = notional + fee
    if (totalCost > this.state.balance) {
      return { success: false, error: 'Insufficient balance after fees' }
    }

    // Execute trade
    const positionSize = notional / executionPrice
    this.state.balance -= totalCost
    this.state.positionSize = positionSize
    this.state.positionSymbol = this.config.symbol
    this.state.entryPrice = executionPrice
    this.state.lastTradeIndex = index

    // Record trade
    this.trades.push({
      timestamp: candle.timestamp,
      action: 'buy',
      price: executionPrice,
      size: positionSize,
      fee,
    })

    return { success: true }
  }

  /**
   * Execute a sell order
   */
  sell(candle: Candle, index: number): { success: boolean; error?: string } {
    const validation = this.validateTrade('sell', candle.close, this.config.symbol)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    if (this.state.entryPrice === null) {
      return { success: false, error: 'No entry price recorded' }
    }

    // Apply slippage
    const slippageMultiplier = 1 - this.config.slippageBps / 10000
    const executionPrice = candle.close * slippageMultiplier

    // Calculate proceeds
    const notional = this.state.positionSize * executionPrice
    const fee = notional * this.config.feeRate
    const proceeds = notional - fee

    // Calculate PnL
    const entryNotional = this.state.positionSize * this.state.entryPrice
    const pnl = proceeds - entryNotional

    // Update balance
    this.state.balance += proceeds

    // Record trade
    this.trades.push({
      timestamp: candle.timestamp,
      action: 'sell',
      price: executionPrice,
      size: this.state.positionSize,
      fee,
      pnl,
    })

    // Reset position
    this.state.positionSize = 0
    this.state.positionSymbol = null
    this.state.entryPrice = null
    this.state.lastTradeIndex = index

    return { success: true }
  }
}

