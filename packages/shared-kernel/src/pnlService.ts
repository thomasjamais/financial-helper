export type TradePnLInput = {
  side: 'BUY' | 'SELL'
  entryPrice: number
  quantity: number
  markPrice: number
}

export function calculatePnL(input: TradePnLInput): number {
  const { side, entryPrice, quantity, markPrice } = input

  if (!isFinite(entryPrice) || entryPrice <= 0) {
    return 0
  }

  if (!isFinite(quantity) || quantity <= 0) {
    return 0
  }

  if (!isFinite(markPrice) || markPrice <= 0) {
    return 0
  }

  const direction = side === 'BUY' ? 1 : -1
  const pnl = direction * (markPrice - entryPrice) * quantity

  return Number(pnl.toFixed(2))
}

export function calculateQuantity(budgetUSD: number, price: number): number {
  if (!isFinite(budgetUSD) || budgetUSD <= 0) {
    throw new Error('Budget must be a positive number')
  }

  if (!isFinite(price) || price <= 0) {
    throw new Error('Price must be a positive number')
  }

  return budgetUSD / price
}

