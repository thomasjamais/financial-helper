import type { Balance, Order } from '@pkg/exchange-adapters'
import { BitgetAdapter, type BitgetConfig } from '@pkg/exchange-adapters'
import type { Logger } from '../logger'
import { getBitgetConfig, setBitgetConfig } from './bitgetState'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import { getActiveExchangeConfig } from './exchangeConfigService'

export type BitgetBalanceResult = {
  spot: Balance[]
  futures: Balance[]
}

export type PlaceOrderInput = {
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'MARKET' | 'LIMIT'
  qty: number
  price?: number
  clientOid?: string
}

export class BitgetService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
    private encKey: string,
  ) {}

  private async ensureConfig(): Promise<BitgetConfig> {
    let cfg = getBitgetConfig()
    if (!cfg) {
      const dbConfig = await getActiveExchangeConfig(
        this.db,
        this.encKey,
        'bitget',
      )
      if (!dbConfig) {
        throw new Error('Bitget config not set')
      }
      cfg = {
        key: dbConfig.key,
        secret: dbConfig.secret,
        passphrase: dbConfig.passphrase || '',
        env: dbConfig.env,
        baseUrl: dbConfig.baseUrl || 'https://api.bitget.com',
      }
      setBitgetConfig(cfg)
    }
    return cfg
  }

  private async createAdapter(): Promise<BitgetAdapter> {
    const cfg = await this.ensureConfig()
    const log = this.logger.child({ exchange: 'bitget' })
    return new BitgetAdapter({
      ...cfg,
      logger: {
        debug: (msg: string, data?: unknown) => log.debug(data, msg),
        info: (msg: string, data?: unknown) => log.info(data, msg),
        warn: (msg: string, data?: unknown) => log.warn(data, msg),
        error: (msg: string, data?: unknown) => log.error(data, msg),
      },
    })
  }

  async getBalances(): Promise<BitgetBalanceResult> {
    const adapter = await this.createAdapter()
    const spotRaw = await adapter.getBalances('spot')
    const futuresRaw = await adapter.getBalances('futures')
    return { spot: spotRaw, futures: futuresRaw }
  }

  async getPositions() {
    const adapter = await this.createAdapter()
    return await adapter.getPositions()
  }

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const adapter = await this.createAdapter()
    const clientOid = input.clientOid || `oid_${Date.now()}`
    return await adapter.placeOrder({
      ...input,
      clientOid,
    })
  }
}

