import type { ExchangePort, Balance, Position, Order } from '../types'
import { BitgetConfigSchema, type BitgetConfig } from '../config'
import { BitgetHttpClient } from '../http/bitgetHttpClient'

export class BitgetAdapter implements ExchangePort {
  private readonly cfg: BitgetConfig
  private readonly http: BitgetHttpClient
  constructor(opts: {
    key: string
    secret: string
    passphrase: string
    env?: 'paper' | 'live'
    baseUrl?: string
    backoffAttempts?: number
    backoffBaseMs?: number
  }) {
    const { backoffAttempts, backoffBaseMs, ...rest } = opts as any
    this.cfg = BitgetConfigSchema.parse({ ...rest })
    this.http = new BitgetHttpClient(this.cfg, {
      attempts: backoffAttempts ?? 5,
      baseMs: backoffBaseMs ?? 200,
    })
  }

  async getBalances(kind: 'spot' | 'futures'): Promise<Balance[]> {
    const path =
      kind === 'spot'
        ? '/api/spot/v1/account/assets'
        : '/api/mix/v1/account/accounts'
    try {
      const data = await this.http.call<any>('GET', path)
      const items: any[] = Array.isArray(data?.data) ? data.data : []
      return items.map((it) => ({
        asset: it.symbol?.toUpperCase?.() || it.asset || 'USDT',
        free: Number(it.available || it.free || 0),
      }))
    } catch {
      return []
    }
  }

  async getPositions(): Promise<Position[]> {
    return []
  }

  async listOrders(status?: string): Promise<Order[]> {
    return []
  }

  async placeOrder(o: Omit<Order, 'id' | 'status'>): Promise<Order> {
    return { ...o, id: 'TBD', status: 'NEW' }
  }

  async cancelOrder(idOrClientOid: string): Promise<void> {}
}
