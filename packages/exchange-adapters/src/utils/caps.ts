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
    if (!params.caps.symbolWhitelist.includes(symbol)) {
      throw new Error(`Symbol ${symbol} not whitelisted`)
    }
  }

  if (params.orderNotionalUSDT != null && params.caps.maxOrderUSDT > 0) {
    if (params.orderNotionalUSDT > params.caps.maxOrderUSDT) {
      throw new Error(
        `Order notional ${params.orderNotionalUSDT} exceeds max ${params.caps.maxOrderUSDT}`,
      )
    }
  }

  if (
    params.positionNotionalUSDT != null &&
    params.caps.maxPositionUSDT > 0
  ) {
    if (params.positionNotionalUSDT > params.caps.maxPositionUSDT) {
      throw new Error(
        `Position notional ${params.positionNotionalUSDT} exceeds max ${params.caps.maxPositionUSDT}`,
      )
    }
  }
}


