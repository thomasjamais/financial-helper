import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { StrategyExecutionService } from '../services/StrategyExecutionService'
import { StrategyTradingService } from '../services/StrategyTradingService'
import { createDb } from '@pkg/db'
import { createLogger } from '../logger'

export class StrategyExecutionWorker {
  private db: Kysely<DB>
  private logger: Logger
  private executionService: StrategyExecutionService
  private tradingService: StrategyTradingService
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null
  private encKey: string

  constructor(
    encKey: string,
    db?: Kysely<DB>,
    logger?: Logger,
  ) {
    this.encKey = encKey
    this.db = db ?? createDb()
    this.logger = logger ?? createLogger()
    this.executionService = new StrategyExecutionService(this.db, this.logger)
    this.tradingService = new StrategyTradingService(this.db, this.logger, encKey)
  }

  async processExecution(executionId: number): Promise<void> {
    const log = this.logger.child({ executionId })

    try {
      log.info('Processing strategy execution')

      const result = await this.tradingService.executeStrategy(executionId)

      if (result.executed && result.tradeId) {
        log.info({ tradeId: result.tradeId, signal: result.signal }, 'Strategy trade executed')
      } else if (result.signal === 'hold') {
        log.debug('Strategy signal: hold')
      } else {
        log.warn({ error: result.error }, 'Strategy execution did not result in trade')
      }

      await this.executionService.updateExecutionAfterRun(executionId)
    } catch (error) {
      log.error({ error }, 'Failed to process strategy execution')
    }
  }

  async processReadyExecutions(): Promise<number> {
    const executions = await this.executionService.getExecutionsReadyToRun(10)
    let processed = 0

    for (const execution of executions) {
      try {
        await this.processExecution(execution.id)
        processed++
      } catch (error) {
        this.logger.error({ error, executionId: execution.id }, 'Failed to process execution')
      }
    }

    return processed
  }

  async start(pollIntervalMs = 60000): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker is already running')
      return
    }

    this.isRunning = true
    this.logger.info({ pollIntervalMs }, 'Starting strategy execution worker')

    const poll = async () => {
      if (!this.isRunning) {
        return
      }

      try {
        const processed = await this.processReadyExecutions()
        if (processed > 0) {
          this.logger.info({ processed }, 'Processed strategy executions')
        }
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
    this.logger.info('Strategy execution worker stopped')
  }
}

