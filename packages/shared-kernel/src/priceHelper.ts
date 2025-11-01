import { BinancePriceService, type PriceService } from './priceService'

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
 * Gets the price of a symbol in USD
 * For USDT/USDC pairs: extracts base asset and gets USD price
 * For other pairs: gets pair price and converts via quote asset to USD
 */
export async function getSymbolPrice(
  symbol: string,
  priceService: PriceService = new BinancePriceService(),
): Promise<number | null> {
  // Check if it's a USD-quoted pair
  const usdQuotePattern = /(USDT|USDC|FDUSD|TUSD)$/i
  if (usdQuotePattern.test(symbol)) {
    // Extract base asset from symbol (e.g., BTCUSDT -> BTC)
    const baseAsset = symbol.replace(/USDT|USDC|FDUSD|TUSD$/i, '')
    
    const prices = await priceService.getPrices([baseAsset])
    const priceData = prices.get(baseAsset)
    
    if (!priceData || priceData.priceUSD <= 0 || !isFinite(priceData.priceUSD)) {
      return null
    }
    
    return priceData.priceUSD
  }

  // For non-USD pairs (e.g., FETBTC), get the pair price and convert via quote asset
  const pairPrice = await getTradingPairPrice(symbol)
  if (!pairPrice || !isFinite(pairPrice) || pairPrice <= 0) {
    return null
  }

  // Extract quote asset by matching known quote assets at the end
  // Try common quote assets: BTC, ETH, BNB, BUSD, etc.
  const quoteAssets = ['BTC', 'ETH', 'BNB', 'BUSD', 'USDC', 'USDT', 'FDUSD', 'TUSD', 'DAI', 'PAX']
  let quoteAsset: string | null = null
  
  for (const quote of quoteAssets) {
    if (symbol.toUpperCase().endsWith(quote)) {
      quoteAsset = quote
      break
    }
  }
  
  if (!quoteAsset) {
    // Fallback: try to extract last 3-4 characters as quote asset
    const match = symbol.match(/^([A-Z]+)([A-Z]{2,4})$/i)
    if (match && match[2]) {
      quoteAsset = match[2].toUpperCase()
    } else {
      return null
    }
  }

  // Get quote asset price in USD
  const quotePrices = await priceService.getPrices([quoteAsset])
  const quotePriceData = quotePrices.get(quoteAsset)
  
  if (!quotePriceData || quotePriceData.priceUSD <= 0 || !isFinite(quotePriceData.priceUSD)) {
    return null
  }

  // Convert: symbol price in USD = pair price * quote asset price in USD
  // Example: FETBTC = 0.000002 BTC, BTC = 50000 USD -> FET = 0.000002 * 50000 = 0.1 USD
  return pairPrice * quotePriceData.priceUSD
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

