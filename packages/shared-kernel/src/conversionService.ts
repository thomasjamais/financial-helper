import { BinancePriceService, type PriceService } from './priceService'
import type { Balance } from './types'

export type ConversionTarget = 'BTC' | 'BNB' | 'ETH'

export type ConversionResult = {
  fromAsset: string
  fromAmount: number
  toAsset: ConversionTarget
  toAmount: number
  rate: number
  timestamp: number
}

export async function calculateConversion(
  balances: Balance[],
  fromAsset: string,
  fromAmount: number,
  toAsset: ConversionTarget,
  priceService: PriceService = new BinancePriceService(),
): Promise<ConversionResult | null> {
  const balance = balances.find(
    (b) => b.asset.toUpperCase() === fromAsset.toUpperCase(),
  )

  if (!balance) {
    return null
  }

  const available = balance.free
  if (fromAmount > available) {
    return null
  }

  const allAssets = [fromAsset, toAsset]
  const prices = await priceService.getPrices(allAssets)

  const fromPrice = prices.get(fromAsset)
  const toPrice = prices.get(toAsset)

  if (!fromPrice || !toPrice) {
    return null
  }

  const fromValueUSD = fromAmount * fromPrice.priceUSD
  const toAmount = fromValueUSD / toPrice.priceUSD
  const rate = toPrice.priceUSD / fromPrice.priceUSD

  return {
    fromAsset: fromAsset.toUpperCase(),
    fromAmount,
    toAsset,
    toAmount,
    rate,
    timestamp: Date.now(),
  }
}

