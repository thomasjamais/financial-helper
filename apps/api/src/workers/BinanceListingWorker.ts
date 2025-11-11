import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { BinanceListingAlertService } from '../services/BinanceListingAlertService'
import { createDb } from '@pkg/db'
import { createLogger } from '../logger'

export class BinanceListingWorker {
  private db: Kysely<DB>
  private logger: Logger
  private alertService: BinanceListingAlertService
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null

  constructor(db?: Kysely<DB>, logger?: Logger) {
    this.db = db ?? createDb()
    this.logger = logger ?? createLogger()
    this.alertService = new BinanceListingAlertService(this.db, this.logger)
  }

  async checkListings(): Promise<void> {
    const log = this.logger.child({ operation: 'checkListings' })

    try {
      log.info('Checking for new Binance listings')
      const events = await this.alertService.checkForNewListings()

      if (events.length > 0) {
        log.info({ count: events.length }, 'Detected new listing events')
      } else {
        log.debug('No new listing events detected')
      }
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to check listings',
      )
    }
  }

  async checkAnnouncements(): Promise<void> {
    const log = this.logger.child({ operation: 'checkAnnouncements' })

    try {
      log.info('Checking for Binance announcements (IPO/Launchpool)')
      const events = await this.alertService.checkForAnnouncements()

      if (events.length > 0) {
        log.info({ count: events.length }, 'Detected announcement events')
      } else {
        log.debug('No new announcement events detected')
      }
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to check announcements',
      )
    }
  }

  async start(pollIntervalMs = 3600000): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Binance listing worker is already running')
      return
    }

    this.isRunning = true
    this.logger.info({ pollIntervalMs }, 'Starting Binance listing worker')

    const poll = async () => {
      if (!this.isRunning) {
        return
      }

      try {
        await this.checkListings()
        await this.checkAnnouncements()
      } catch (error) {
        this.logger.error({ error }, 'Error in listing worker poll cycle')
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
    this.logger.info('Binance listing worker stopped')
  }
}

