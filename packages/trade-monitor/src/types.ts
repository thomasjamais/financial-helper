export type ExitLevel = {
  profitPct: number
  quantityPct: number
}

export type ExitStrategy = {
  levels: ExitLevel[]
  autoCalculated: boolean
}

export type TrailingStopConfig = {
  enabled: boolean
  activationProfitPct: number
  trailDistancePct: number
  minTrailDistancePct: number
}

export type TradeState = {
  id: number
  side: 'BUY' | 'SELL'
  entryPrice: number
  quantity: number
  exitedQuantity: number
  tpPct: number
  slPct: number
  exitStrategy: ExitStrategy | null
  trailingStopConfig: TrailingStopConfig | null
  currentTrailingStopPrice: number | null
  currentPrice: number
}

export type TradeAction = 
  | { type: 'partial_exit'; level: ExitLevel; quantity: number }
  | { type: 'update_trailing_stop'; newTrailingStopPrice: number }
  | { type: 'trigger_trailing_stop'; quantity: number }
  | { type: 'no_action' }

export type TradeEvaluation = {
  actions: TradeAction[]
  currentProfitPct: number
  remainingQuantity: number
}

