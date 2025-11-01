export type UUID = string

export type Money = {
  amount: number // in base currency units
  currency: string
}

export * from './types'
export * from './priceService'
export * from './priceHelper'
export {
  getTradingPairPrice,
  isUSDQuoted,
  extractQuoteAsset,
} from './priceHelper'
export * from './portfolioService'
export * from './conversionService'
export * from './tradeService'
export * from './pnlService'
export * from './opportunityScoring'

export function assert(condition: any, msg: string): asserts condition {
  if (!condition) throw new Error(msg)
}

export function correlationId(): string {
  return `corr_${crypto.randomUUID()}`
}

export type CapsConfig = {
  maxOrderUSDT: number
  maxPositionUSDT: number
  symbolWhitelist: string[]
}

export function parseCapsFromEnv(env = process.env): CapsConfig {
  const maxOrder = Number(env.MAX_ORDER_USDT ?? '0')
  const maxPos = Number(env.MAX_POSITION_USDT ?? '0')
  const whitelist = String(env.SYMBOL_WHITELIST ?? 'BTCUSDT,ETHUSDT,BNBUSDT')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)

  return {
    maxOrderUSDT: Number.isFinite(maxOrder) && maxOrder > 0 ? maxOrder : 0,
    maxPositionUSDT: Number.isFinite(maxPos) && maxPos > 0 ? maxPos : 0,
    symbolWhitelist: whitelist,
  }
}

export function enforceCaps(params: {
  symbol: string
  orderNotionalUSDT?: number
  positionNotionalUSDT?: number
  caps: CapsConfig
}) {
  const symbol = params.symbol.toUpperCase()
  if (params.caps.symbolWhitelist.length > 0) {
    assert(
      params.caps.symbolWhitelist.includes(symbol),
      `Symbol ${symbol} not whitelisted`,
    )
  }

  if (params.orderNotionalUSDT != null && params.caps.maxOrderUSDT > 0) {
    assert(
      params.orderNotionalUSDT <= params.caps.maxOrderUSDT,
      `Order notional ${params.orderNotionalUSDT} exceeds max ${params.caps.maxOrderUSDT}`,
    )
  }

  if (params.positionNotionalUSDT != null && params.caps.maxPositionUSDT > 0) {
    assert(
      params.positionNotionalUSDT <= params.caps.maxPositionUSDT,
      `Position notional ${params.positionNotionalUSDT} exceeds max ${params.caps.maxPositionUSDT}`,
    )
  }
}
