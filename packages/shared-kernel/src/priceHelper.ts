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

/**
 * Gets the actual trading pair price from Binance API
 * Returns the price as it appears on Binance (e.g., FETBTC returns price in BTC)
 */
export async function getTradingPairPrice(
  symbol: string,
  baseUrl: string = 'https://api.binance.com',
): Promise<number | null> {
  try {
    const url = `${baseUrl}/api/v3/ticker/price?symbol=${symbol}`
    const response = await fetch(url, { timeout: 5000 } as any)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    const price = parseFloat(data.price)
    if (!isFinite(price) || price <= 0) {
      return null
    }
    return price
  } catch {
    return null
  }
}

/**
 * Checks if a symbol is quoted in USD (USDT, USDC, FDUSD, TUSD)
 */
export function isUSDQuoted(symbol: string): boolean {
  const usdQuotePattern = /(USDT|USDC|FDUSD|TUSD)$/i
  return usdQuotePattern.test(symbol)
}

/**
 * Extracts the quote asset from a trading pair symbol
 * Returns null if not found
 */
export function extractQuoteAsset(symbol: string): string | null {
  const quoteAssets = ['BTC', 'ETH', 'BNB', 'BUSD', 'USDC', 'USDT', 'FDUSD', 'TUSD', 'DAI', 'PAX']

  for (const quote of quoteAssets) {
    if (symbol.toUpperCase().endsWith(quote)) {
      return quote.toUpperCase()
    }
  }

  // Fallback: try to extract last 3-4 characters as quote asset
  const match = symbol.match(/^([A-Z]+)([A-Z]{2,4})$/i)
  if (match && match[2]) {
    return match[2].toUpperCase()
  }

  return null
}

