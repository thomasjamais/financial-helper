import { BinancePriceService, type PriceService } from './priceService'

export async function getSymbolPrice(
  symbol: string,
  priceService: PriceService = new BinancePriceService(),
): Promise<number | null> {
  // Extract base asset from symbol (e.g., BTCUSDT -> BTC)
  const baseAsset = symbol.replace(/USDT|USDC|FDUSD|TUSD$/i, '')
  
  const prices = await priceService.getPrices([baseAsset])
  const priceData = prices.get(baseAsset)
  
  if (!priceData || priceData.priceUSD <= 0 || !isFinite(priceData.priceUSD)) {
    return null
  }
  
  return priceData.priceUSD
}

export async function getSymbolPrices(
  symbols: string[],
  priceService: PriceService = new BinancePriceService(),
): Promise<Map<string, number>> {
  const assetMap = new Map<string, string>()
  const assets = new Set<string>()
  
  // Extract base assets from symbols
  for (const symbol of symbols) {
    const baseAsset = symbol.replace(/USDT|USDC|FDUSD|TUSD$/i, '')
    assetMap.set(symbol, baseAsset)
    assets.add(baseAsset)
  }
  
  const prices = await priceService.getPrices(Array.from(assets))
  const result = new Map<string, number>()
  
  for (const [symbol, baseAsset] of assetMap.entries()) {
    const priceData = prices.get(baseAsset)
    if (priceData && priceData.priceUSD > 0 && isFinite(priceData.priceUSD)) {
      result.set(symbol, priceData.priceUSD)
    }
  }
  
  return result
}

