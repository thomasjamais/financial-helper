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

    const strategy = await this.getById(userId, strategyId)
    if (!strategy) {
      throw new Error('Strategy not found')
    }

    await this.db
      .updateTable('strategies')
      .set({ allocated_amount_usd })
      .where('user_id', '=', userId)
      .where('id', '=', strategyId)
      .execute()

    const { StrategyExecutionService } = await import('./StrategyExecutionService')
    const executionService = new StrategyExecutionService(this.db, this.logger)

    const existingExecution = await executionService.getExecution(userId, strategyId)

    if (allocated_amount_usd > 0 && strategy.is_active && !existingExecution) {
      log.info('Starting strategy execution due to allocation')
      await executionService.startExecution({
        userId,
        strategyId,
        symbols: ['BTCUSDT'],
        interval: '1h',
        correlationId,
      })
    } else if ((allocated_amount_usd === 0 || !strategy.is_active) && existingExecution) {
      log.info('Stopping strategy execution')
      await executionService.stopExecution(userId, strategyId, correlationId)
    }

    log.info({ allocated_amount_usd }, 'Strategy allocation updated')
  }

  async backtest(
    userId: string,
    strategyId: number,
    input: BacktestStrategyInput,
    correlationId?: string,
  ): Promise<{
    jobId: number
    status: 'pending'
  }> {
    const log = this.logger.child({ correlationId, userId, strategyId })

    const strategy = await this.getById(userId, strategyId)
    if (!strategy) {
      throw new Error('Strategy not found')
    }

    const { BacktestJobService } = await import('./BacktestJobService')
    const jobService = new BacktestJobService(this.db, this.logger)

    const job = await jobService.createJob({
      userId,
      strategyId,
      input,
      correlationId,
    })

    log.info({ jobId: job.id }, 'Backtest job created')

    return {
      jobId: job.id,
      status: 'pending',
    }
  }

  async listBacktestResults(
    userId: string,
    strategyId: number,
    limit = 50,
    offset = 0,
  ): Promise<Array<{
    id: number
    symbols: string[]
    start_date: Date
    end_date: Date
    metrics: unknown
    created_at: Date
  }>> {
    const results = await this.db
      .selectFrom('strategy_backtests')
      .innerJoin('strategies', 'strategies.id', 'strategy_backtests.strategy_id')
      .select([
        'strategy_backtests.id',
        'strategy_backtests.symbols',
        'strategy_backtests.start_date',
        'strategy_backtests.end_date',
        'strategy_backtests.metrics',
        'strategy_backtests.created_at',
      ])
      .where('strategies.user_id', '=', userId)
      .where('strategy_backtests.strategy_id', '=', strategyId)
      .orderBy('strategy_backtests.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return results.map((r) => ({
      id: r.id,
      symbols: r.symbols,
      start_date: r.start_date,
      end_date: r.end_date,
      metrics: r.metrics as unknown,
      created_at: r.created_at,
    }))
  }

  async getBacktestResult(
    userId: string,
    resultId: number,
  ): Promise<{
    id: number
    strategy_id: number
    symbols: string[]
    start_date: Date
    end_date: Date
    metrics: unknown
    results_json: unknown
    created_at: Date
  } | null> {
    const result = await this.db
      .selectFrom('strategy_backtests')
      .innerJoin('strategies', 'strategies.id', 'strategy_backtests.strategy_id')
      .selectAll('strategy_backtests')
      .where('strategies.user_id', '=', userId)
      .where('strategy_backtests.id', '=', resultId)
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      strategy_id: result.strategy_id,
      symbols: result.symbols,
      start_date: result.start_date,
      end_date: result.end_date,
      metrics: result.metrics as unknown,
      results_json: result.results_json as unknown,
      created_at: result.created_at,
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

