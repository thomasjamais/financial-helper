import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import type { BacktestStrategyInput } from './StrategiesService'

export type BacktestJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type CreateBacktestJobInput = {
  userId: string
  strategyId: number
  input: BacktestStrategyInput
  correlationId?: string
}

export type BacktestJob = {
  id: number
  user_id: string
  strategy_id: number
  status: BacktestJobStatus
  input: BacktestStrategyInput
  result_id: number | null
  error_message: string | null
  progress_pct: number
  created_at: Date
  started_at: Date | null
  completed_at: Date | null
}

export type ListBacktestJobsOptions = {
  userId: string
  strategyId?: number
  status?: BacktestJobStatus
  limit?: number
  offset?: number
  sortBy?: 'created_at' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export class BacktestJobService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async createJob(
    input: CreateBacktestJobInput,
  ): Promise<{ id: number; status: BacktestJobStatus }> {
    const log = this.logger.child({
      correlationId: input.correlationId,
      userId: input.userId,
      strategyId: input.strategyId,
    })

    const job = await this.db
      .insertInto('backtest_jobs')
      .values({
        user_id: input.userId,
        strategy_id: input.strategyId,
        status: 'pending',
        input: input.input as unknown,
        progress_pct: 0,
      })
      .returning(['id', 'status'])
      .executeTakeFirstOrThrow()

    log.info({ jobId: job.id }, 'Backtest job created')

    return {
      id: job.id,
      status: job.status as BacktestJobStatus,
    }
  }

  async getJob(userId: string, jobId: number): Promise<BacktestJob | null> {
    const job = await this.db
      .selectFrom('backtest_jobs')
      .selectAll()
      .where('id', '=', jobId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!job) {
      return null
    }

    return {
      id: job.id,
      user_id: job.user_id,
      strategy_id: job.strategy_id,
      status: job.status as BacktestJobStatus,
      input: job.input as BacktestStrategyInput,
      result_id: job.result_id,
      error_message: job.error_message,
      progress_pct: job.progress_pct,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    }
  }

  async listJobs(options: ListBacktestJobsOptions): Promise<{
    jobs: BacktestJob[]
    total: number
  }> {
    let baseQuery = this.db
      .selectFrom('backtest_jobs')
      .where('user_id', '=', options.userId)

    if (options.strategyId !== undefined) {
      baseQuery = baseQuery.where('strategy_id', '=', options.strategyId)
    }

    if (options.status !== undefined) {
      baseQuery = baseQuery.where('status', '=', options.status)
    }

    const total = await baseQuery
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst()
      .then((row) => Number(row?.count ?? 0))

    const sortBy = options.sortBy ?? 'created_at'
    const sortOrder = options.sortOrder ?? 'desc'

    let jobsQuery = this.db
      .selectFrom('backtest_jobs')
      .selectAll()
      .where('user_id', '=', options.userId)

    if (options.strategyId !== undefined) {
      jobsQuery = jobsQuery.where('strategy_id', '=', options.strategyId)
    }

    if (options.status !== undefined) {
      jobsQuery = jobsQuery.where('status', '=', options.status)
    }

    const jobs = await jobsQuery
      .orderBy(sortBy, sortOrder)
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0)
      .execute()

    return {
      jobs: jobs.map((job) => ({
        id: job.id,
        user_id: job.user_id,
        strategy_id: job.strategy_id,
        status: job.status as BacktestJobStatus,
        input: job.input as BacktestStrategyInput,
        result_id: job.result_id,
        error_message: job.error_message,
        progress_pct: job.progress_pct,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
      })),
      total,
    }
  }

  async getPendingJobs(limit = 10): Promise<Array<{
    id: number
    user_id: string
    strategy_id: number
    input: BacktestStrategyInput
  }>> {
    const jobs = await this.db
      .selectFrom('backtest_jobs')
      .select(['id', 'user_id', 'strategy_id', 'input'])
      .where('status', '=', 'pending')
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute()

    return jobs.map((job) => ({
      id: job.id,
      user_id: job.user_id,
      strategy_id: job.strategy_id,
      input: job.input as BacktestStrategyInput,
    }))
  }

  async updateJobStatus(
    jobId: number,
    status: BacktestJobStatus,
    updates?: {
      progress_pct?: number
      error_message?: string
    },
  ): Promise<void> {
    const updateData: {
      status: BacktestJobStatus
      progress_pct?: number
      error_message?: string
      started_at?: Date
      completed_at?: Date
    } = { status }

    if (updates?.progress_pct !== undefined) {
      updateData.progress_pct = updates.progress_pct
    }

    if (updates?.error_message !== undefined) {
      updateData.error_message = updates.error_message
    }

    if (status === 'running' && !updates?.error_message) {
      updateData.started_at = new Date()
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date()
    }

    await this.db
      .updateTable('backtest_jobs')
      .set(updateData)
      .where('id', '=', jobId)
      .execute()
  }

  async markJobCompleted(
    jobId: number,
    resultId: number,
  ): Promise<void> {
    await this.db
      .updateTable('backtest_jobs')
      .set({
        status: 'completed',
        result_id: resultId,
        progress_pct: 100,
        completed_at: new Date(),
      })
      .where('id', '=', jobId)
      .execute()
  }

  async markJobFailed(
    jobId: number,
    errorMessage: string,
  ): Promise<void> {
    await this.db
      .updateTable('backtest_jobs')
      .set({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date(),
      })
      .where('id', '=', jobId)
      .execute()
  }
}

