import type { ExchangePort, Balance, Position, Order } from '../types'
import { BinanceConfigSchema, type BinanceConfig } from '../config'
import {
  BinanceHttpClient,
  type BinanceHttpClientConfig,
} from '../http/binanceHttpClient'

type Logger = {
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
}

export class BinanceAdapter implements ExchangePort {
  private readonly cfg: BinanceConfig
  private readonly httpSpot: BinanceHttpClient
  private readonly httpFutures: BinanceHttpClient
  private readonly logger?: Logger

  constructor(
    opts: {
      key: string
      secret: string
      env?: 'paper' | 'live'
      baseUrl?: string
      httpConfig?: Partial<BinanceHttpClientConfig>
      logger?: Logger
    },
    httpInstance?: BinanceHttpClient,
  ) {
    this.cfg = BinanceConfigSchema.parse(opts)
    this.logger = opts.logger

    const httpConfig: BinanceHttpClientConfig = {
      rateLimit: { capacity: 10, refillPerSec: 10 },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        successThreshold: 2,
      },
      backoff: { attempts: 5, baseMs: 200 },
      logger: this.logger,
      ...opts.httpConfig,
    }

    const spotBaseUrl =
      opts.baseUrl ||
      (opts.env === 'paper'
        ? 'https://testnet.binance.vision'
        : 'https://api.binance.com')
    const futuresBaseUrl =
      opts.env === 'paper'
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com'

    const spotConfig = { ...this.cfg, baseUrl: spotBaseUrl }
    const futuresConfig = { ...this.cfg, baseUrl: futuresBaseUrl }

    this.httpSpot =
      httpInstance ?? new BinanceHttpClient(spotConfig, httpConfig)
    this.httpFutures = new BinanceHttpClient(futuresConfig, httpConfig)
  }

  async getBalances(kind: 'spot' | 'futures'): Promise<Balance[]> {
    if (kind === 'futures') {
      this.logger?.warn(
        'Futures balances not supported for Binance (Spot only)',
      )
      return []
    }

    const path = '/api/v3/account'
    const http = this.httpSpot

    this.logger?.info(`Fetching ${kind} balances`, { path })

    try {
      const data = await http.call<any>('GET', path)

      this.logger?.debug(`${kind} balances API response`, {
        hasData: !!data,
        hasBalances: !!data?.balances,
        balancesLength: Array.isArray(data?.balances)
          ? data.balances.length
          : 'not-array',
      })

      if (!data || !Array.isArray(data.balances)) {
        this.logger?.warn(`${kind} balances API returned invalid data`, {
          data: data ? JSON.stringify(data).substring(0, 200) : 'null',
        })
        return []
      }

      const balances = data.balances
        .map((item: any) => {
          const free = parseFloat(item.free || '0')
          const locked = parseFloat(item.locked || '0')
          const asset = item.asset || item.coin || item.symbol

          if (!asset) {
            return null
          }

          return {
            asset,
            free,
            locked: locked > 0 ? locked : undefined,
          }
        })
        .filter((b: Balance | null): b is Balance => b !== null)
        .filter((b: Balance) => b.free > 0 || (b.locked && b.locked > 0))

      this.logger?.info(`${kind} balances processed`, {
        totalItems: data.balances.length,
        nonZeroBalances: balances.length,
        assets: balances.map((b: Balance) => b.asset),
      })

      return balances
    } catch (err) {
      this.logger?.error(`Failed to fetch ${kind} balances`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      throw err
    }
  }

  async getPositions(): Promise<Position[]> {
    this.logger?.info('Fetching positions')
    try {
      const data = await this.httpFutures.call<any>(
        'GET',
        '/fapi/v2/positionRisk',
      )
      if (!Array.isArray(data)) {
        return []
      }
      return data
        .filter((p: any) => parseFloat(p.positionAmt || '0') !== 0)
        .map((p: any) => ({
          symbol: p.symbol,
          side: parseFloat(p.positionAmt || '0') > 0 ? 'LONG' : 'SHORT',
          qty: Math.abs(parseFloat(p.positionAmt || '0')),
          avgPrice: parseFloat(p.entryPrice || '0'),
          leverage: p.leverage ? parseInt(p.leverage, 10) : undefined,
        }))
    } catch (err) {
      this.logger?.error('Failed to fetch positions', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  async listOrders(status?: string): Promise<Order[]> {
    this.logger?.info('Listing orders', { status })
    try {
      const params: Record<string, string> = {}
      if (status) {
        params.status = status
      }
      const data = await this.httpSpot.call<any>(
        'GET',
        '/api/v3/openOrders',
        undefined,
        params,
      )
      if (!Array.isArray(data)) {
        return []
      }
      return data.map((o: any) => ({
        id: o.orderId.toString(),
        symbol: o.symbol,
        side: o.side.toUpperCase() as 'BUY' | 'SELL',
        type: o.type.toUpperCase() as 'LIMIT' | 'MARKET',
        qty: parseFloat(o.origQty || '0'),
        price: o.price ? parseFloat(o.price) : undefined,
        status: o.status,
        clientOid: o.clientOrderId || o.orderId.toString(),
      }))
    } catch (err) {
      this.logger?.error('Failed to list orders', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  async placeOrder(o: Omit<Order, 'id' | 'status'>): Promise<Order> {
    this.logger?.info('Placing order', {
      symbol: o.symbol,
      side: o.side,
      type: o.type,
    })
    try {
      const params: Record<string, string> = {
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.qty.toString(),
      }
      if (o.price) {
        params.price = o.price.toString()
      }
      const data = await this.httpSpot.call<any>(
        'POST',
        '/api/v3/order',
        undefined,
        params,
      )
      return {
        id: data.orderId.toString(),
        symbol: data.symbol,
        side: data.side.toUpperCase() as 'BUY' | 'SELL',
        type: data.type.toUpperCase() as 'LIMIT' | 'MARKET',
        qty: parseFloat(data.executedQty || '0'),
        price: data.price ? parseFloat(data.price) : undefined,
        status: data.status,
        clientOid: data.clientOrderId || data.orderId.toString(),
      }
    } catch (err) {
      this.logger?.error('Failed to place order', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  async cancelOrder(idOrClientOid: string): Promise<void> {
    this.logger?.info('Cancelling order', { idOrClientOid })
    try {
      await this.httpSpot.call('DELETE', '/api/v3/order', undefined, {
        orderId: idOrClientOid,
      })
    } catch (err) {
      this.logger?.error('Failed to cancel order', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}
