export type Balance = { asset: string; free: number; locked?: number }
export type Position = { symbol: string; side: 'LONG'|'SHORT'; qty: number; avgPrice: number; leverage?: number }
export type Order = { id: string; symbol: string; side: 'BUY'|'SELL'; type: 'LIMIT'|'MARKET'; qty: number; price?: number; status: string; clientOid: string }

export interface ExchangePort {
  getBalances(kind: 'spot'|'futures'): Promise<Balance[]>
  getPositions(): Promise<Position[]>
  listOrders(status?: string): Promise<Order[]>
  placeOrder(o: Omit<Order,'id'|'status'>): Promise<Order>
  cancelOrder(idOrClientOid: string): Promise<void>
  transferInternal?(params: { asset: string; amount: number; from: 'spot'|'futures'; to: 'spot'|'futures' }): Promise<{ txId: string }>
}

export class BitgetAdapter implements ExchangePort {
  constructor(private opts: { key: string; secret: string; passphrase?: string; env?: 'paper'|'live' }) {}
  async getBalances(kind: 'spot'|'futures'): Promise<Balance[]> {
    // TODO: call Bitget REST, normalize
    return []
  }
  async getPositions(): Promise<Position[]> { return [] }
  async listOrders(status?: string): Promise<Order[]> { return [] }
  async placeOrder(o: Omit<Order,'id'|'status'>): Promise<Order> {
    return { ...o, id: 'TBD', status: 'NEW' }
  }
  async cancelOrder(idOrClientOid: string): Promise<void> {}
}
