import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'

export type StrategyExecutionStatus = 'active' | 'paused' | 'stopped'

export type StrategyExecution = {
  id: number
  strategy_id: number
  user_id: string
  symbols: string[]
  interval: string
  status: StrategyExecutionStatus
  last_execution_at: Date | null
  next_execution_at: Date | null
  created_at: Date
  updated_at: Date
}

export type StartExecutionInput = {
  userId: string
  strategyId: number
  symbols: string[]
  interval?: string
  correlationId?: string
}

export class StrategyExecutionService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async startExecution(input: StartExecutionInput): Promise<{ id: number }> {
    const log = this.logger.child({
      correlationId: input.correlationId,
      userId: input.userId,
      strategyId: input.strategyId,
    })

    const interval = input.interval ?? '1h'
    const intervalMs = this.getIntervalMs(interval)
    const nextExecutionAt = new Date(Date.now() + intervalMs)

    const execution = await this.db
      .insertInto('strategy_executions')
      .values({
        strategy_id: input.strategyId,
        user_id: input.userId,
        symbols: input.symbols,
        interval,
        status: 'active',
        next_execution_at: nextExecutionAt,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    log.info({ executionId: execution.id, symbols: input.symbols, interval }, 'Strategy execution started')

    return { id: execution.id }
  }

  async stopExecution(
    userId: string,
    strategyId: number,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({
      correlationId,
      userId,
      strategyId,
    })

    const updated = await this.db
      .updateTable('strategy_executions')
      .set({ status: 'stopped' })
      .where('strategy_id', '=', strategyId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .execute()

    log.info({ count: updated.length }, 'Strategy execution stopped')
  }

  async getExecution(
    userId: string,
    strategyId: number,
  ): Promise<StrategyExecution | null> {
    const execution = await this.db
      .selectFrom('strategy_executions')
      .selectAll()
      .where('strategy_id', '=', strategyId)
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!execution) {
      return null
    }

    return {
      id: execution.id,
      strategy_id: execution.strategy_id,
      user_id: execution.user_id,
      symbols: execution.symbols,
      interval: execution.interval,
      status: execution.status as StrategyExecutionStatus,
      last_execution_at: execution.last_execution_at,
      next_execution_at: execution.next_execution_at,
      created_at: execution.created_at,
      updated_at: execution.updated_at,
    }
  }

  async getActiveExecutions(userId: string): Promise<StrategyExecution[]> {
    const executions = await this.db
      .selectFrom('strategy_executions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .execute()

    return executions.map((e) => ({
      id: e.id,
      strategy_id: e.strategy_id,
      user_id: e.user_id,
      symbols: e.symbols,
      interval: e.interval,
      status: e.status as StrategyExecutionStatus,
      last_execution_at: e.last_execution_at,
      next_execution_at: e.next_execution_at,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }))
  }

  async getExecutionsReadyToRun(limit = 10): Promise<StrategyExecution[]> {
    const now = new Date()
    const executions = await this.db
      .selectFrom('strategy_executions')
      .selectAll()
      .where('status', '=', 'active')
      .where('next_execution_at', '<=', now)
      .orderBy('next_execution_at', 'asc')
      .limit(limit)
      .execute()

    return executions.map((e) => ({
      id: e.id,
      strategy_id: e.strategy_id,
      user_id: e.user_id,
      symbols: e.symbols,
      interval: e.interval,
      status: e.status as StrategyExecutionStatus,
      last_execution_at: e.last_execution_at,
      next_execution_at: e.next_execution_at,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }))
  }

  async updateExecutionAfterRun(
    executionId: number,
    correlationId?: string,
  ): Promise<void> {
    const execution = await this.db
      .selectFrom('strategy_executions')
      .select(['interval'])
      .where('id', '=', executionId)
      .executeTakeFirst()

    if (!execution) {
      return
    }

    const intervalMs = this.getIntervalMs(execution.interval)
    const now = new Date()
    const nextExecutionAt = new Date(now.getTime() + intervalMs)

    await this.db
      .updateTable('strategy_executions')
      .set({
        last_execution_at: now,
        next_execution_at: nextExecutionAt,
      })
      .where('id', '=', executionId)
      .execute()
  }

  private getIntervalMs(interval: string): number {
    const intervalMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    }

    return intervalMap[interval] ?? 60 * 60 * 1000
  }
}

