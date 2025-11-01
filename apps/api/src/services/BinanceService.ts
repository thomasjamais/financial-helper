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
}

