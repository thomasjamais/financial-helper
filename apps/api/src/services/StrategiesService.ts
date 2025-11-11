import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { StrategySandbox } from '@pkg/strategy-engine'
import { HistoricalDataService } from '@pkg/shared-kernel'
import { runMultiCryptoBacktest } from '@pkg/backtester'
import type { Candle } from '@pkg/backtester'

export type CreateStrategyInput = {
  name: string
  code: string
  params_schema?: unknown
  allocated_amount_usd?: number
}

export type UpdateStrategyInput = {
  name?: string
  code?: string
  params_schema?: unknown
  allocated_amount_usd?: number
  is_active?: boolean
}

export type BacktestStrategyInput = {
  symbols: string[]
  interval?: string
  months?: number
  initial_balance?: number
}

export class StrategiesService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async create(
    userId: string,
    input: CreateStrategyInput,
    correlationId?: string,
  ): Promise<{ id: number }> {
    const log = this.logger.child({ correlationId, userId })

    try {
      const sandbox = StrategySandbox.createStrategy(input.code)
      const result = await this.db
        .insertInto('strategies')
        .values({
          user_id: userId,
          name: input.name,
          code: input.code,
          params_schema: input.params_schema ?? null,
          allocated_amount_usd: input.allocated_amount_usd ?? 0,
          is_active: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      log.info({ strategyId: result.id, name: input.name }, 'Strategy created')
      return { id: result.id }
    } catch (error) {
      log.error({ error, input }, 'Failed to create strategy')
      throw error
    }
  }

  async list(userId: string): Promise<
    Array<{
      id: number
      name: string
      code: string
      params_schema: unknown
      allocated_amount_usd: number
      is_active: boolean
      created_at: Date
      updated_at: Date
    }>
  > {
    const rows = await this.db
      .selectFrom('strategies')
      .select([
        'id',
        'name',
        'code',
        'params_schema',
        'allocated_amount_usd',
        'is_active',
        'created_at',
        'updated_at',
      ])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute()

    return rows.map((row) => ({
      ...row,
      params_schema: row.params_schema as unknown,
    }))
  }

  async getById(userId: string, strategyId: number): Promise<{
    id: number
    name: string
    code: string
    params_schema: unknown
    allocated_amount_usd: number
    is_active: boolean
    created_at: Date
    updated_at: Date
  } | null> {
    const row = await this.db
      .selectFrom('strategies')
      .select([
        'id',
        'name',
        'code',
        'params_schema',
        'allocated_amount_usd',
        'is_active',
        'created_at',
        'updated_at',
      ])
      .where('user_id', '=', userId)
      .where('id', '=', strategyId)
      .executeTakeFirst()

    if (!row) {
      return null
    }

    return {
      ...row,
      params_schema: row.params_schema as unknown,
    }
  }

  async update(
    userId: string,
    strategyId: number,
    input: UpdateStrategyInput,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, userId, strategyId })

    const strategy = await this.getById(userId, strategyId)
    if (!strategy) {
      throw new Error('Strategy not found')
    }

    const updateData: {
      name?: string
      code?: string
      params_schema?: unknown
      allocated_amount_usd?: number
      is_active?: boolean
    } = {}

    if (input.name !== undefined) {
      updateData.name = input.name
    }

    if (input.code !== undefined) {
      try {
        StrategySandbox.createStrategy(input.code)
        updateData.code = input.code
      } catch (error) {
        log.error({ error }, 'Invalid strategy code')
        throw new Error(`Invalid strategy code: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (input.params_schema !== undefined) {
      updateData.params_schema = input.params_schema
    }

    if (input.allocated_amount_usd !== undefined) {
      updateData.allocated_amount_usd = input.allocated_amount_usd
    }

    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active
    }

    await this.db
      .updateTable('strategies')
      .set(updateData)
      .where('user_id', '=', userId)
      .where('id', '=', strategyId)
      .execute()

    log.info({ updateData }, 'Strategy updated')
  }

  async delete(userId: string, strategyId: number, correlationId?: string): Promise<void> {
    const log = this.logger.child({ correlationId, userId, strategyId })

    const deleted = await this.db
      .deleteFrom('strategies')
      .where('user_id', '=', userId)
      .where('id', '=', strategyId)
      .execute()

    if (deleted.length === 0) {
      throw new Error('Strategy not found')
    }

    log.info('Strategy deleted')
  }

  async updateAllocation(
    userId: string,
    strategyId: number,
    allocated_amount_usd: number,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, userId, strategyId })

    if (allocated_amount_usd < 0) {
      throw new Error('Allocated amount must be non-negative')
    }

    await this.db
      .updateTable('strategies')
      .set({ allocated_amount_usd })
      .where('user_id', '=', userId)
      .where('id', '=', strategyId)
      .execute()

    log.info({ allocated_amount_usd }, 'Strategy allocation updated')
  }

  async backtest(
    userId: string,
    strategyId: number,
    input: BacktestStrategyInput,
    correlationId?: string,
  ): Promise<{
    aggregated: unknown
    perCrypto: Array<{ symbol: string; result: unknown }>
    backtestId: number
  }> {
    const log = this.logger.child({ correlationId, userId, strategyId })

    const strategy = await this.getById(userId, strategyId)
    if (!strategy) {
      throw new Error('Strategy not found')
    }

    const interval = input.interval ?? '1h'
    const months = input.months ?? 6
    const initialBalance = input.initial_balance ?? (strategy.allocated_amount_usd || 1000)

    log.info({ symbols: input.symbols, interval, months, initialBalance }, 'Starting backtest')

    const historicalDataService = new HistoricalDataService()
    const candlesMap = await historicalDataService.fetchKlinesForMultipleSymbols(
      input.symbols,
      interval,
      months,
    )

    const sandbox = StrategySandbox.createStrategy(strategy.code)
    const strategyInstance = {
      name: strategy.name,
      initialize: (candles: Candle[]) => {
        sandbox.initialize(candles)
      },
      onCandle: (candle: Candle, index: number, candles: Candle[]) => {
        const result = sandbox.execute(candle, index, candles)
        if (!result.success || !result.signal) {
          return 'hold' as const
        }
        return result.signal
      },
    }

    const backtestResult = runMultiCryptoBacktest({
      symbols: input.symbols,
      candlesMap,
      strategy: strategyInstance,
      initialBalance,
    })

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - months * 30 * 24 * 60 * 60 * 1000)

    const backtestRecord = await this.db
      .insertInto('strategy_backtests')
      .values({
        strategy_id: strategyId,
        symbols: input.symbols,
        start_date: startDate,
        end_date: endDate,
        metrics: backtestResult.aggregated.metrics as unknown,
        results_json: backtestResult as unknown,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    log.info({ backtestId: backtestRecord.id }, 'Backtest completed')

    return {
      aggregated: backtestResult.aggregated,
      perCrypto: backtestResult.perCrypto,
      backtestId: backtestRecord.id,
    }
  }

  async duplicate(
    userId: string,
    sourceStrategyId: number,
    newName: string,
    correlationId?: string,
  ): Promise<{ id: number }> {
    const log = this.logger.child({ correlationId, userId, sourceStrategyId })

    // Get source strategy - can be from user or system (examples)
    const sourceStrategy = await this.db
      .selectFrom('strategies')
      .selectAll()
      .where('id', '=', sourceStrategyId)
      .where((eb) =>
        eb.or([
          eb('user_id', '=', userId),
          eb('user_id', '=', 'system'),
          eb('user_id', 'is', null),
        ]),
      )
      .executeTakeFirst()

    if (!sourceStrategy) {
      throw new Error('Strategy not found or access denied')
    }

    // Validate new name
    if (!newName || newName.trim().length === 0) {
      throw new Error('Strategy name is required')
    }

    // Create new strategy with copied data
    try {
      const sandbox = StrategySandbox.createStrategy(sourceStrategy.code)
      const result = await this.db
        .insertInto('strategies')
        .values({
          user_id: userId,
          name: newName.trim(),
          code: sourceStrategy.code,
          params_schema: sourceStrategy.params_schema,
          allocated_amount_usd: sourceStrategy.allocated_amount_usd,
          is_active: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      log.info(
        { strategyId: result.id, sourceStrategyId, newName },
        'Strategy duplicated',
      )
      return { id: result.id }
    } catch (error) {
      log.error({ error, sourceStrategyId }, 'Failed to duplicate strategy')
      throw error
    }
  }

  async listExamples(): Promise<
    Array<{
      id: number
      name: string
      code: string
      params_schema: unknown
      allocated_amount_usd: number
      is_active: boolean
      created_at: Date
      updated_at: Date
    }>
  > {
    const rows = await this.db
      .selectFrom('strategies')
      .select([
        'id',
        'name',
        'code',
        'params_schema',
        'allocated_amount_usd',
        'is_active',
        'created_at',
        'updated_at',
      ])
      .where((eb) =>
        eb.or([
          eb('user_id', '=', 'system'),
          eb('user_id', 'is', null),
        ]),
      )
      .orderBy('created_at', 'desc')
      .execute()

    return rows.map((row) => ({
      ...row,
      params_schema: row.params_schema as unknown,
    }))
  }
}

