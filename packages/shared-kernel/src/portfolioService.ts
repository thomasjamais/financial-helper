import { BinancePriceService, type PriceService, type PriceData } from './priceService'
import type { Balance } from './types'

export type PortfolioAsset = {
  asset: string
  amount: number
  amountLocked: number | undefined
  priceUSD: number
  priceEUR: number
  valueUSD: number
  valueEUR: number
}

export type Portfolio = {
  assets: PortfolioAsset[]
  totalValueUSD: number
  totalValueEUR: number
  timestamp: number
}

export async function buildPortfolio(
  balances: Balance[],
  priceService: PriceService = new BinancePriceService(),
): Promise<Portfolio> {
  const assets = balances.map((b) => b.asset)
  const prices = await priceService.getPrices(assets)

  const portfolioAssets: PortfolioAsset[] = balances
    .map((balance) => {
      const priceData = prices.get(balance.asset) || {
        asset: balance.asset,
        priceUSD: 0,
        priceEUR: 0,
        timestamp: Date.now(),
      }

      const totalAmount = balance.free + (balance.locked || 0)
      const valueUSD = totalAmount * priceData.priceUSD
      const valueEUR = totalAmount * priceData.priceEUR

      return {
        asset: balance.asset,
        amount: balance.free,
        amountLocked:
          balance.locked && balance.locked > 0 ? balance.locked : undefined,
        priceUSD: priceData.priceUSD,
        priceEUR: priceData.priceEUR,
        valueUSD,
        valueEUR,
      }
    })
    .sort((a, b) => b.valueUSD - a.valueUSD)

  const totalValueUSD = portfolioAssets.reduce(
    (sum, asset) => sum + asset.valueUSD,
    0,
  )
  const totalValueEUR = portfolioAssets.reduce(
    (sum, asset) => sum + asset.valueEUR,
    0,
  )

  return {
    assets: portfolioAssets,
    totalValueUSD,
    totalValueEUR,
    timestamp: Date.now(),
  }
}

