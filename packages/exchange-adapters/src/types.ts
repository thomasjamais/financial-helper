export type Balance = { asset: string; free: number; locked?: number }

export type Position = {
  symbol: string
  side: 'LONG' | 'SHORT'
  qty: number
  avgPrice: number
  leverage?: number
}

export type Order = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET'
  qty: number
  price?: number
  status: string
  clientOid: string
}

export interface ExchangePort {
  getBalances(kind: 'spot' | 'futures'): Promise<Balance[]>
  getPositions(): Promise<Position[]>
  listOrders(status?: string): Promise<Order[]>
  placeOrder(o: Omit<Order, 'id' | 'status'>): Promise<Order>
  cancelOrder(idOrClientOid: string): Promise<void>
  transferInternal?(params: {
    asset: string
    amount: number
    from: 'spot' | 'futures'
    to: 'spot' | 'futures'
  }): Promise<{ txId: string }>
}
