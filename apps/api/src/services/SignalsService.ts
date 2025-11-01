import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'

export type CreateSignalInput = {
  source: string
  asset: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reason?: string
  metadata?: Record<string, any>
}

export class SignalsService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async create(
    userId: string,
    input: CreateSignalInput,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, userId })
    
    await this.db
      .insertInto('signals')
      .values({
        user_id: userId,
        source: input.source,
        asset: input.asset,
        action: input.action,
        confidence: input.confidence,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
      })
      .execute()

    log.info({ signal: input }, 'Signal created')
  }

  async list(userId: string, limit = 200): Promise<Array<{
    id: number
    source: string
    asset: string
    action: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    reason: string | null
    metadata: any
    created_at: Date
  }>> {
    const rows = await this.db
      .selectFrom('signals')
      .select([
        'id',
        'source',
        'asset',
        'action',
        'confidence',
        'reason',
        'metadata',
        'created_at',
      ])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute()

    return rows.map((row) => ({
      ...row,
      action: row.action as 'BUY' | 'SELL' | 'HOLD',
      metadata: row.metadata as any,
    }))
  }
}

