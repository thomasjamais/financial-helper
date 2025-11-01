import type { Logger } from '../logger'
import {
  BinanceEarnClient,
  BinanceHttpClient,
  BinanceAdapter,
  type BinanceConfig,
} from '@pkg/exchange-adapters'
import { scoreOpportunity } from '@pkg/shared-kernel'
import { buildPortfolio } from '@pkg/shared-kernel'
import { getBinanceConfig, setBinanceConfig } from './binanceState'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import { getActiveExchangeConfig } from './exchangeConfigService'

export type EarnOpportunity = {
  id: string
  asset: string
  name: string
  type?: 'flexible' | 'locked' | 'staking' | 'launchpool'
  apr: number
  durationDays?: number
  redeemable: boolean
  score: number
}

export type EarnAutoPlanParams = {
  assetPool?: Array<'USDT' | 'USDC'>
  minApr?: number
  totalPct?: number
  maxPerProductPct?: number
  minAmount?: number
  roundTo?: number
}

export type EarnAutoPlanResult = {
  assetPool: Array<'USDT' | 'USDC'>
  minApr: number
  totalPct: number
  maxPerProductPct: number
  minAmount: number
  roundTo: number
  spotStable: Record<string, number>
  selectedProducts: Array<{ id: string; asset: string; apr: number }>
  plan: Array<{ productId: string; asset: string; apr: number; amount: number }>
  dryRun: boolean
  stats: {
    totalPlanned: number
    unusedBudgetTotal: number
    cappedCount: number
  }
}

export class BinanceEarnService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private encKey: string,
  ) {}

  private async ensureConfig(): Promise<BinanceConfig> {
    let cfg = getBinanceConfig()
    if (!cfg) {
      const dbConfig = await getActiveExchangeConfig(
        this.db,
        this.encKey,
        'binance',
      )
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

  private async createHttpClient(): Promise<BinanceHttpClient> {
    const cfg = await this.ensureConfig()
    return new BinanceHttpClient({
      ...cfg,
      baseUrl: cfg.baseUrl || 'https://api.binance.com',
      env: cfg.env || 'live',
    })
  }

  private async createEarnClient(): Promise<BinanceEarnClient> {
    const http = await this.createHttpClient()
    return new BinanceEarnClient(http)
  }

  async listOpportunities(minScore = 0): Promise<EarnOpportunity[]> {
    const earn = await this.createEarnClient()
    const live = await earn.listProducts()

    const mapped = live
      .filter(
        (p) =>
          typeof p.asset === 'string' &&
          typeof p.name === 'string' &&
          typeof p.apr === 'number',
      )
      .map((p) => ({
        id: p.id,
        asset: p.asset as string,
        name: p.name as string,
        type: p.type,
        apr: Number(p.apr),
        durationDays:
          typeof p.durationDays === 'number' ? p.durationDays : undefined,
        redeemable:
          typeof p.redeemable === 'boolean' ? p.redeemable : false,
      }))

    const scored = mapped.map((p) => ({
      ...p,
      score: scoreOpportunity({
        apr: p.apr,
        durationDays: p.durationDays,
        redeemable: p.redeemable,
      }),
    }))

    return scored.filter((x) => x.score >= minScore)
  }

  async getEarnBalances() {
    const earn = await this.createEarnClient()
    return await earn.getEarnBalances()
  }

  async getEarnPortfolio() {
    const earn = await this.createEarnClient()
    const earnBalances = await earn.getEarnBalances()
    return await buildPortfolio(earnBalances)
  }

  async generateAutoPlan(params: EarnAutoPlanParams): Promise<EarnAutoPlanResult> {
    const cfg = await this.ensureConfig()
    const assetPool = params.assetPool ?? ['USDT', 'USDC']
    const minApr = params.minApr ?? 0.03
    const totalPct = params.totalPct ?? 0.5
    const maxPerProductPct = params.maxPerProductPct ?? 0.2
    const minAmount = params.minAmount ?? 5
    const roundTo = params.roundTo ?? 0.01

    const http = await this.createHttpClient()
    const earn = new BinanceEarnClient(http)

    const adapter = new BinanceAdapter({
      key: cfg.key,
      secret: cfg.secret,
      baseUrl: cfg.baseUrl || 'https://api.binance.com',
      env: cfg.env || 'live',
    })

    const spot = await adapter.getBalances('spot')
    const stableFree = (
      spot as Array<{ asset: 'USDT' | 'USDC' | string; free: number }>
    )
      .filter((b) =>
        (assetPool as Array<'USDT' | 'USDC'>).includes(b.asset as any),
      )
      .reduce<Record<string, number>>((acc, b) => {
        acc[b.asset] = (acc[b.asset] || 0) + Number(b.free || 0)
        return acc
      }, {})

    const products = (await earn.listProducts())
      .filter(
        (p) =>
          p.type === 'flexible' &&
          p.apr >= minApr &&
          (assetPool as ReadonlyArray<string>).includes(p.asset),
      )
      .sort((a, b) => b.apr - a.apr)

    const plan: Array<{
      productId: string
      asset: string
      apr: number
      amount: number
    }> = []
    let cappedCount = 0
    let unusedBudgetTotal = 0

    for (const asset of assetPool) {
      const free = stableFree[asset] || 0
      if (free <= 0) continue
      const budget = free * totalPct
      let remaining = budget
      const assetProducts = products.filter((p) => p.asset === asset)
      for (const p of assetProducts) {
        if (remaining <= 0) break
        const cap = budget * maxPerProductPct
        let amount = Math.min(cap, remaining)
        amount = Math.floor(amount / roundTo) * roundTo
        if (amount >= minAmount) {
          plan.push({
            productId: p.id,
            asset: p.asset,
            apr: p.apr,
            amount: Number(amount.toFixed(2)),
          })
          remaining -= amount
          if (amount + 1e-9 >= cap) cappedCount += 1
        }
      }
      if (remaining > 0) unusedBudgetTotal += Number(remaining.toFixed(2))
    }

    const totalPlanned = plan.reduce((s, x) => s + x.amount, 0)

    return {
      assetPool,
      minApr,
      totalPct,
      maxPerProductPct,
      minAmount,
      roundTo,
      spotStable: stableFree,
      selectedProducts: products.map((p) => ({
        id: p.id,
        asset: p.asset,
        apr: p.apr,
      })),
      plan,
      dryRun: true,
      stats: {
        totalPlanned,
        unusedBudgetTotal,
        cappedCount,
      },
    }
  }

  async executeAutoPlan(
    plan: Array<{ productId: string; asset: string; amount: number }>,
    dryRun: boolean,
    confirm: boolean,
  ): Promise<{
    executed: boolean
    dryRun: boolean
    steps?: Array<{ action: string; productId: string; asset: string; amount: number }>
    results?: Array<{ asset: string; amount: number; ok: boolean }>
  }> {
    if (dryRun) {
      return {
        executed: false,
        dryRun: true,
        steps: plan.map((p) => ({ action: 'subscribe', ...p })),
      }
    }

    if (!confirm) {
      throw new Error('Confirmation required for live execution')
    }

    const earn = await this.createEarnClient()
    const results: Array<{ asset: string; amount: number; ok: boolean }> =
      []

    for (const p of plan) {
      try {
        await earn.subscribeFlexible({ asset: p.asset, amount: p.amount })
        results.push({ asset: p.asset, amount: p.amount, ok: true })
      } catch {
        results.push({ asset: p.asset, amount: p.amount, ok: false })
      }
    }

    return { executed: true, dryRun: false, results }
  }

  async generateUnsubscribePlan(params: {
    minApr: number
    targetFreeAmount: number
    assetPool: Array<'USDT' | 'USDC'>
  }): Promise<{
    minApr: number
    targetFreeAmount: number
    plan: Array<{
      asset: string
      amount: number
      reason: string
      apr?: number
    }>
    dryRun: boolean
  }> {
    const earn = await this.getEarnBalances()
    const products = (await this.listOpportunities(0)).filter(
      (p) => p.type === 'flexible',
    )

    const assetApr = new Map<string, number>()
    for (const p of products) {
      if (!assetApr.has(p.asset)) assetApr.set(p.asset, p.apr)
      else
        assetApr.set(p.asset, Math.max(assetApr.get(p.asset) || 0, p.apr))
    }

    let remaining = params.targetFreeAmount
    const plan: Array<{
      asset: string
      amount: number
      reason: string
      apr?: number
    }> = []

    for (const pos of earn) {
      if (!params.assetPool.includes(pos.asset as any)) continue
      const apr = assetApr.get(pos.asset) || 0
      const amt = Number(pos.free || 0)
      if (amt <= 0) continue
      if (apr < params.minApr) {
        plan.push({
          asset: pos.asset,
          amount: Number(amt.toFixed(2)),
          reason: 'apr_below_threshold',
          apr,
        })
        remaining -= amt
      }
    }

    if (remaining > 0) {
      const candidates = earn
        .filter((p) => params.assetPool.includes(p.asset as any))
        .map((p) => ({
          asset: p.asset,
          amt: Number(p.free || 0),
          apr: assetApr.get(p.asset) || 0,
        }))
        .sort((a, b) => b.apr - a.apr)
      for (const c of candidates) {
        if (remaining <= 0) break
        if (c.amt <= 0) continue
        const take = Math.min(c.amt, remaining)
        plan.push({
          asset: c.asset,
          amount: Number(take.toFixed(2)),
          reason: 'free_liquidity',
          apr: c.apr,
        })
        remaining -= take
      }
    }

    return {
      minApr: params.minApr,
      targetFreeAmount: params.targetFreeAmount,
      plan,
      dryRun: true,
    }
  }
}

