import type { ExchangePort, Balance, Position, Order } from '../types'
import { BitgetConfigSchema, type BitgetConfig } from '../config'
import { BitgetHttpClient, type BitgetHttpClientConfig } from '../http/bitgetHttpClient'
import { enforceCaps, parseCapsFromEnv } from '../utils/caps'
import { 
  calculateFuturesPositionSize, 
  parseRiskConfigFromEnv,
  type RiskConfig 
} from '../utils/riskEngine'

export class BitgetAdapter implements ExchangePort {
  private readonly cfg: BitgetConfig
  private readonly http: BitgetHttpClient
  
  constructor(opts: {
    key: string
    secret: string
    passphrase: string
    env?: 'paper' | 'live'
    baseUrl?: string
    httpConfig?: Partial<BitgetHttpClientConfig>
  }, httpInstance?: BitgetHttpClient) {
    this.cfg = BitgetConfigSchema.parse(opts)
    
    const httpConfig: BitgetHttpClientConfig = {
      rateLimit: { capacity: 10, refillPerSec: 10 },
      circuitBreaker: { failureThreshold: 5, recoveryTimeout: 30000, successThreshold: 2 },
      backoff: { attempts: 5, baseMs: 200 },
      ...opts.httpConfig,
    }
    
    this.http = httpInstance ?? new BitgetHttpClient(this.cfg, httpConfig)
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
      const usdtBalance = balances.find(b => b.asset === 'USDT')?.free ?? 0
      
      if (usdtBalance > 0) {
        const leverage = Math.min(5, riskConfig.maxLeverage) // Use min of 5 or max leverage
        const sizing = calculateFuturesPositionSize(
          usdtBalance,
          o.price ?? 0,
          riskConfig,
          leverage
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
