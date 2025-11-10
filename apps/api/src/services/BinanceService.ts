import type { Balance } from '@pkg/exchange-adapters'
import {
  BinanceAdapter,
  BinanceHttpClient,
  BinanceEarnClient,
  type BinanceConfig,
} from '@pkg/exchange-adapters'
import {
  buildPortfolio,
  calculateConversion,
  type ConversionTarget,
  computeSpotTrades,
  type PortfolioAssetUSD,
} from '@pkg/shared-kernel'
import type { Logger } from '../logger'
import { getBinanceConfig, setBinanceConfig } from './binanceState'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import { getActiveExchangeConfig } from './exchangeConfigService'

export type BinanceBalanceResult = {
  spot: Balance[]
  futures: Balance[]
}

export class BinanceService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private encKey: string,
  ) {}

  async ensureConfig(): Promise<BinanceConfig> {
    let cfg = getBinanceConfig()
    if (!cfg) {
      const dbConfig = await getActiveExchangeConfig(this.db, this.encKey, 'binance')
      if (!dbConfig) {
        throw new Error('Binance config not set')
      }
      cfg = {
        key: dbConfig.key,
        secret: dbConfig.secret,
        env: dbConfig.env,
        baseUrl: dbConfig.baseUrl || 'https://api.binance.com',
      }
      setBinanceConfig(cfg)
    }
    return cfg
  }

  private async createAdapter(): Promise<BinanceAdapter> {
    const cfg = await this.ensureConfig()
    return new BinanceAdapter({
      ...cfg,
      logger: {
        debug: (msg: string, data?: unknown) => this.logger.debug(data, msg),
        info: (msg: string, data?: unknown) => this.logger.info(data, msg),
        warn: (msg: string, data?: unknown) => this.logger.warn(data, msg),
        error: (msg: string, data?: unknown) => this.logger.error(data, msg),
      },
    })
  }

  private async createHttpClient(): Promise<BinanceHttpClient> {
    const cfg = await this.ensureConfig()
    return new BinanceHttpClient({
      ...cfg,
      baseUrl: cfg.baseUrl || 'https://api.binance.com',
      env: cfg.env || 'live',
    })
  }

  async getBalances(): Promise<BinanceBalanceResult> {
    const adapter = await this.createAdapter()
    const spotRaw = await adapter.getBalances('spot')
    const futuresRaw: Balance[] = []
    return { spot: spotRaw, futures: futuresRaw }
  }

  async getPositions() {
    const adapter = await this.createAdapter()
    return await adapter.getPositions()
  }

  async getOrders(status?: string) {
    const adapter = await this.createAdapter()
    return await adapter.listOrders(status)
  }

  async getPortfolio(balances: Balance[]) {
    return await buildPortfolio(balances)
  }

  async getEarnBalances(): Promise<Balance[]> {
    const http = await this.createHttpClient()
    const earnClient = new BinanceEarnClient(http)
    return await earnClient.getEarnBalances()
  }

  async getPortfolioWithEarn(): Promise<{
    assets: Array<{
      asset: string
      amount: number
      amountLocked: number | undefined
      priceUSD: number
      priceEUR: number
      valueUSD: number
      valueEUR: number
    }>
    totalValueUSD: number
    totalValueEUR: number
    timestamp: number
  }> {
    const adapter = await this.createAdapter()
    const spotBalances = await adapter.getBalances('spot')

    const earnBalances = await this.getEarnBalances()
    const allBalances = [...spotBalances, ...earnBalances]
    return await buildPortfolio(allBalances)
  }

  async calculateConversion(
    balances: Balance[],
    fromAsset: string,
    fromAmount: number,
    toAsset: ConversionTarget,
  ) {
    return await calculateConversion(
      balances,
      fromAsset,
      fromAmount,
      toAsset,
    )
  }

  async getRebalancingTrades(
    portfolio: Array<PortfolioAssetUSD>,
    recommendedAllocations: Record<string, number>,
    totalValueUSD: number,
    minAbsoluteUsd = 5,
  ) {
    return computeSpotTrades(
      portfolio,
      recommendedAllocations,
      totalValueUSD,
      minAbsoluteUsd,
    )
  }

  async getUSDTBalance(): Promise<number> {
    const balances = await this.getBalances()
    const usdtBalance = balances.spot.find(
      (b) => b.asset.toUpperCase() === 'USDT',
    )
    return usdtBalance?.free ?? 0
  }

  /**
   * Gets the LOT_SIZE filter constraints for a symbol from Binance exchange info
   * Returns minQty, maxQty, and stepSize
   */
  async getLotSizeFilter(symbol: string): Promise<{
    minQty: number
    maxQty: number
    stepSize: number
  } | null> {
    try {
      // Use public endpoint (no auth needed) to get exchange info
      const baseUrl = 'https://api.binance.com'
      const url = `${baseUrl}/api/v3/exchangeInfo?symbol=${symbol}`
      const response = await fetch(url, { timeout: 5000 } as any)
      
      if (!response.ok) {
        this.logger.warn({ symbol, status: response.status }, 'Failed to fetch exchange info')
        return null
      }

      const data = await response.json() as any
      
      if (!data || !data.symbols || !Array.isArray(data.symbols)) {
        return null
      }

      const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol)
      if (!symbolInfo || !symbolInfo.filters || !Array.isArray(symbolInfo.filters)) {
        return null
      }

      const lotSizeFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === 'LOT_SIZE',
      )

      if (!lotSizeFilter) {
        return null
      }

      const minQty = parseFloat(lotSizeFilter.minQty || '0')
      const maxQty = parseFloat(lotSizeFilter.maxQty || '999999999')
      const stepSize = parseFloat(lotSizeFilter.stepSize || '1')

      if (!isFinite(minQty) || !isFinite(maxQty) || !isFinite(stepSize)) {
        return null
      }

      return { minQty, maxQty, stepSize }
    } catch (err) {
      this.logger.debug({ err, symbol }, 'Failed to get LOT_SIZE filter')
      return null
    }
  }

  /**
   * Validates and adjusts quantity to meet Binance LOT_SIZE filter requirements
   * Ensures quantity is:
   * - >= minQty
   * - <= maxQty  
   * - Rounded to the correct step size
   */
  async adjustQuantityForLotSize(symbol: string, quantity: number): Promise<number> {
    const lotSize = await this.getLotSizeFilter(symbol)
    
    if (!lotSize) {
      // Fallback: round to 8 decimal places if we can't fetch filter
      this.logger.warn({ symbol }, 'Could not fetch LOT_SIZE filter, using fallback rounding')
      const rounded = Math.floor(quantity * 100000000) / 100000000
      if (rounded <= 0) {
        throw new Error(`Quantity ${quantity} too small after rounding for symbol ${symbol}`)
      }
      return rounded
    }

    // Round to step size first
    // Calculate how many steps fit in the quantity
    const steps = Math.floor(quantity / lotSize.stepSize)
    let adjustedQty = steps * lotSize.stepSize

    // Ensure it's not below minimum
    if (adjustedQty < lotSize.minQty) {
      // Round up to minimum if below
      const minSteps = Math.ceil(lotSize.minQty / lotSize.stepSize)
      adjustedQty = minSteps * lotSize.stepSize
      
      if (adjustedQty > lotSize.maxQty) {
        throw new Error(
          `Quantity ${quantity} too small for symbol ${symbol}. Minimum: ${lotSize.minQty}, but rounded minimum exceeds maximum: ${lotSize.maxQty}`,
        )
      }
      
      this.logger.debug(
        {
          symbol,
          originalQty: quantity,
          adjustedQty,
          minQty: lotSize.minQty,
        },
        'Adjusted quantity to meet minimum requirement',
      )
    }

    // Ensure it's not above maximum
    if (adjustedQty > lotSize.maxQty) {
      // Round down to maximum
      const maxSteps = Math.floor(lotSize.maxQty / lotSize.stepSize)
      adjustedQty = maxSteps * lotSize.stepSize
      
      if (adjustedQty < lotSize.minQty) {
        throw new Error(
          `Quantity ${quantity} too large for symbol ${symbol}. Maximum: ${lotSize.maxQty}, but rounded maximum is below minimum: ${lotSize.minQty}`,
        )
      }
      
      this.logger.debug(
        {
          symbol,
          originalQty: quantity,
          adjustedQty,
          maxQty: lotSize.maxQty,
        },
        'Adjusted quantity to meet maximum requirement',
      )
    }

    if (adjustedQty <= 0) {
      throw new Error(`Invalid quantity after adjustment: ${adjustedQty} for symbol ${symbol}`)
    }

    this.logger.debug(
      {
        symbol,
        originalQty: quantity,
        adjustedQty,
        minQty: lotSize.minQty,
        maxQty: lotSize.maxQty,
        stepSize: lotSize.stepSize,
      },
      'Quantity adjusted for LOT_SIZE filter',
    )

    return adjustedQty
  }

  async placeSpotOrder(input: {
    symbol: string
    side: 'BUY' | 'SELL'
    type: 'MARKET' | 'LIMIT'
    quantity: number
    price?: number
  }) {
    const adapter = await this.createAdapter()
    
    // Adjust quantity to meet LOT_SIZE filter requirements
    const adjustedQuantity = await this.adjustQuantityForLotSize(
      input.symbol,
      input.quantity,
    )

    this.logger.debug(
      {
        symbol: input.symbol,
        originalQuantity: input.quantity,
        adjustedQuantity,
      },
      'Adjusted quantity for order',
    )

    return await adapter.placeOrder({
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      qty: adjustedQuantity,
      price: input.price,
      clientOid: `auto_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    })
  }

  async placePartialExitOrder(input: {
    symbol: string
    side: 'BUY' | 'SELL'
    quantity: number
  }) {
    // Partial exit is just a market order to sell the specified quantity
    return await this.placeSpotOrder({
      symbol: input.symbol,
      side: input.side,
      type: 'MARKET',
      quantity: input.quantity,
    })
  }
}

