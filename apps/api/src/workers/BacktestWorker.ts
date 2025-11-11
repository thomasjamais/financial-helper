import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import type { Candle } from '@pkg/backtester'
import { BacktestJobService } from '../services/BacktestJobService'
import { StrategiesService } from '../services/StrategiesService'
import { createDb } from '@pkg/db'
import { createLogger } from '../logger'

export class BacktestWorker {
  private db: Kysely<DB>
  private logger: Logger
  private jobService: BacktestJobService
  private strategiesService: StrategiesService
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null

  constructor(
    db?: Kysely<DB>,
    logger?: Logger,
  ) {
    this.db = db ?? createDb()
    this.logger = logger ?? createLogger()
    this.jobService = new BacktestJobService(this.db, this.logger)
    this.strategiesService = new StrategiesService(this.db, this.logger)
  }

  async processJob(jobId: number): Promise<void> {
    const log = this.logger.child({ jobId })

    try {
      const pendingJobs = await this.jobService.getPendingJobs(1)
      const job = pendingJobs.find((j) => j.id === jobId)

      if (!job) {
        log.warn('Job not found or not pending')
        return
      }

      const fullJob = await this.jobService.getJob(job.user_id, job.id)
      if (!fullJob || fullJob.status !== 'pending') {
        log.warn({ status: fullJob?.status }, 'Job is not in pending status')
        return
      }

      log.info('Starting backtest job processing')

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 10 })

      const strategy = await this.strategiesService.getById(job.user_id, job.strategy_id)
      if (!strategy) {
        throw new Error('Strategy not found')
      }

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 20 })

      const interval = job.input.interval ?? '1h'
      const months = job.input.months ?? 6
      const initialBalance =
        job.input.initial_balance ?? (strategy.allocated_amount_usd || 1000)

      log.info({ symbols: job.input.symbols, interval, months, initialBalance }, 'Running backtest')

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 30 })

      const { HistoricalDataService } = await import('@pkg/shared-kernel')
      const historicalDataService = new HistoricalDataService()
      const candlesMap = await historicalDataService.fetchKlinesForMultipleSymbols(
        job.input.symbols,
        interval,
        months,
      )

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 50 })

      const { StrategySandbox } = await import('@pkg/strategy-engine')
      const { runMultiCryptoBacktest } = await import('@pkg/backtester')

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

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 70 })

      const backtestResult = runMultiCryptoBacktest({
        symbols: job.input.symbols,
        candlesMap,
        strategy: strategyInstance,
        initialBalance,
      })

      await this.jobService.updateJobStatus(job.id, 'running', { progress_pct: 90 })

      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - months * 30 * 24 * 60 * 60 * 1000)

      const backtestRecord = await this.db
        .insertInto('strategy_backtests')
        .values({
          strategy_id: job.strategy_id,
          symbols: job.input.symbols,
          start_date: startDate,
          end_date: endDate,
          metrics: backtestResult.aggregated.metrics as unknown,
          results_json: backtestResult as unknown,
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      await this.jobService.markJobCompleted(job.id, backtestRecord.id)

      log.info({ backtestId: backtestRecord.id }, 'Backtest job completed successfully')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      log.error({ error }, 'Backtest job failed')

      await this.jobService.markJobFailed(jobId, errorMessage)
    }
  }

  async processNextJob(): Promise<boolean> {
    const pendingJobs = await this.jobService.getPendingJobs(1)

    if (pendingJobs.length === 0) {
      return false
    }

    const job = pendingJobs[0]
    await this.processJob(job.id)
    return true
  }

  async start(pollIntervalMs = 5000): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker is already running')
      return
    }

    this.isRunning = true
    this.logger.info({ pollIntervalMs }, 'Starting backtest worker')

    const poll = async () => {
      if (!this.isRunning) {
        return
      }

      try {
        await this.processNextJob()
      } catch (error) {
        this.logger.error({ error }, 'Error in worker poll cycle')
      }

      if (this.isRunning) {
        this.pollInterval = setTimeout(poll, pollIntervalMs)
      }
    }

    await poll()
  }

  stop(): void {
    this.isRunning = false
    if (this.pollInterval) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }
    this.logger.info('Backtest worker stopped')
  }
}

