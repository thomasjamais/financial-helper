import type { ExchangePort, Balance, Position, Order } from '../types'
import { BitgetConfigSchema, type BitgetConfig } from '../config'
import {
  BitgetHttpClient,
  type BitgetHttpClientConfig,
} from '../http/bitgetHttpClient'
import { enforceCaps, parseCapsFromEnv } from '../utils/caps'
import {
  calculateFuturesPositionSize,
  parseRiskConfigFromEnv,
  type RiskConfig,
} from '../utils/riskEngine'

type Logger = {
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
}

export class BitgetAdapter implements ExchangePort {
  private readonly cfg: BitgetConfig
  private readonly http: BitgetHttpClient
  private readonly logger?: Logger

  constructor(
    opts: {
      key: string
      secret: string
      passphrase: string
      env?: 'paper' | 'live'
      baseUrl?: string
      httpConfig?: Partial<BitgetHttpClientConfig>
      logger?: Logger
    },
    httpInstance?: BitgetHttpClient,
  ) {
    this.cfg = BitgetConfigSchema.parse(opts)
    this.logger = opts.logger

    const httpConfig: BitgetHttpClientConfig = {
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

    this.http = httpInstance ?? new BitgetHttpClient(this.cfg, httpConfig)
  }

  async getBalances(kind: 'spot' | 'futures'): Promise<Balance[]> {
    const path =
      kind === 'spot'
        ? '/api/spot/v1/account/assets'
        : '/api/mix/v1/account/accounts'

    this.logger?.info(`Fetching ${kind} balances`, { path })

    try {
      let data: any
      if (kind === 'futures') {
        console.log('🔵 FUTURES BALANCE: Using POST method with body')
        this.logger?.debug('*** FUTURES: Using POST method with body ***')
        this.logger?.debug(
          '*** FUTURES: Body will be {"productType":"USDT-FUTURES"} ***',
        )
        data = await this.http.call<any>(
          'POST',
          path,
          { productType: 'USDT-FUTURES' },
          undefined,
        )
      } else {
        console.log('🟢 SPOT BALANCE: Using GET method')
        this.logger?.debug('*** SPOT: Using GET method ***')
        data = await this.http.call<any>('GET', path)
      }

      this.logger?.debug(`${kind} balances API response`, {
        hasData: !!data?.data,
        dataType: Array.isArray(data?.data) ? 'array' : typeof data?.data,
        dataLength: Array.isArray(data?.data) ? data.data.length : 'not-array',
        code: data?.code,
        msg: data?.msg,
        fullResponse: JSON.stringify(data).substring(0, 500),
      })

      if (!data || data.code !== '00000') {
        this.logger?.warn(`${kind} balances API returned error`, {
          code: data?.code,
          msg: data?.msg,
          data: data?.data,
        })
        return []
      }

      const items: any[] = Array.isArray(data?.data) ? data.data : []

      if (items.length === 0) {
        this.logger?.warn(`No ${kind} balance items found`, {
          dataExists: !!data?.data,
          dataType: typeof data?.data,
        })
        return []
      }

      const balances = items
        .map((it) => {
          const asset = (
            it.coin ||
            it.symbol ||
            it.asset ||
            'USDT'
          ).toUpperCase()
          const free = Number(
            it.available || it.availableBalance || it.free || 0,
          )
          const locked = Number(it.locked || it.frozen || it.lockedBalance || 0)

          return {
            asset,
            free,
            locked: locked > 0 ? locked : undefined,
          }
        })
        .filter((b) => b.free > 0 || b.locked)

      this.logger?.info(`${kind} balances processed`, {
        totalItems: items.length,
        nonZeroBalances: balances.length,
        assets: balances.map((b) => b.asset),
      })

      return balances
    } catch (err) {
      this.logger?.error(`Failed to fetch ${kind} balances`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        path,
      })
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
    const caps = parseCapsFromEnv()
    const riskConfig = parseRiskConfigFromEnv()

    // Calculate position size based on order type
    const notional = (o.price ?? 0) * o.qty

    // Apply caps guard
    enforceCaps({ symbol: o.symbol, orderNotionalUSDT: notional, caps })

    // Apply risk sizing for futures orders
    if (o.type === 'MARKET' || o.type === 'LIMIT') {
      // Get current balance for risk calculation
      const balances = await this.getBalances('futures')
      const usdtBalance = balances.find((b) => b.asset === 'USDT')?.free ?? 0

      if (usdtBalance > 0) {
        const leverage = Math.min(5, riskConfig.maxLeverage) // Use min of 5 or max leverage
        const sizing = calculateFuturesPositionSize(
          usdtBalance,
          o.price ?? 0,
          riskConfig,
          leverage,
        )

        // Adjust quantity if it exceeds risk limits
        if (o.qty > sizing.recommendedQuantity) {
          o.qty = sizing.recommendedQuantity
        }
      }
    }

    return { ...o, id: 'TBD', status: 'NEW' }
  }

  async cancelOrder(idOrClientOid: string): Promise<void> {}

  // Additional monitoring methods
  getCircuitState() {
    return this.http.getCircuitState()
  }

  getFailureCount() {
    return this.http.getFailureCount()
  }

  getRateLimitTokens(endpoint: string) {
    return this.http.getRateLimitTokens(endpoint)
  }

  resetCircuitBreaker() {
    this.http.resetCircuitBreaker()
  }
}
