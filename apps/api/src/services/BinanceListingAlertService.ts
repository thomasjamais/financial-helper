import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import {
  BinanceListingMonitor,
  type ListingEvent,
  BinanceAnnouncementsParser,
  type AnnouncementEvent,
} from '@pkg/exchange-adapters'

export type ListingAlert = {
  id: number
  event_type: 'IPO' | 'Launchpool' | 'new_listing' | 'delisting'
  symbol: string | null
  title: string
  description: string | null
  announcement_url: string | null
  detected_at: Date
  metadata: unknown | null
}

export type ListingAlertFilter = {
  eventType?: 'IPO' | 'Launchpool' | 'new_listing' | 'delisting'
  limit?: number
  offset?: number
  since?: Date
}

export class BinanceListingAlertService {
  private monitor: BinanceListingMonitor
  private announcementsParser: BinanceAnnouncementsParser
  private lastKnownSymbols: Set<string> = new Set()
  private lastAnnouncementCheck: Date | null = null

  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {
    this.monitor = new BinanceListingMonitor()
    this.announcementsParser = new BinanceAnnouncementsParser()
  }

  async checkForNewListings(): Promise<ListingEvent[]> {
    const log = this.logger.child({ operation: 'checkForNewListings' })

    try {
      log.info('Fetching current symbols from Binance')
      const currentSymbols = await this.monitor.fetchCurrentSymbols()

      if (this.lastKnownSymbols.size === 0) {
        log.info(
          { count: currentSymbols.size },
          'Initializing symbol baseline - no previous symbols stored',
        )
        this.lastKnownSymbols = currentSymbols
        return []
      }

      const events = this.monitor.detectChanges(
        currentSymbols,
        this.lastKnownSymbols,
      )

      if (events.length > 0) {
        log.info({ count: events.length }, 'Detected listing changes')
        await this.storeAlerts(events)
      }

      this.lastKnownSymbols = currentSymbols
      return events
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to check for new listings',
      )
      throw error
    }
  }

  private async storeAlerts(events: ListingEvent[]): Promise<void> {
    const log = this.logger.child({ operation: 'storeAlerts' })

    for (const event of events) {
      try {
        await this.db
          .insertInto('binance_listing_alerts')
          .values({
            event_type: event.eventType,
            symbol: event.symbol,
            title: event.title,
            description: event.description,
            announcement_url: event.announcementUrl,
            metadata: event.metadata,
          })
          .execute()

        log.info({ symbol: event.symbol, eventType: event.eventType }, 'Stored listing alert')
      } catch (error) {
        log.error(
          {
            error: error instanceof Error ? error.message : String(error),
            symbol: event.symbol,
          },
          'Failed to store alert',
        )
      }
    }
  }

  async listAlerts(filter: ListingAlertFilter = {}): Promise<ListingAlert[]> {
    let query = this.db
      .selectFrom('binance_listing_alerts')
      .selectAll()
      .orderBy('detected_at', 'desc')

    if (filter.eventType) {
      query = query.where('event_type', '=', filter.eventType)
    }

    if (filter.since) {
      query = query.where('detected_at', '>=', filter.since)
    }

    if (filter.limit) {
      query = query.limit(filter.limit)
    }

    if (filter.offset) {
      query = query.offset(filter.offset)
    }

    const alerts = await query.execute()
    return alerts.map((alert) => ({
      id: alert.id,
      event_type: alert.event_type,
      symbol: alert.symbol,
      title: alert.title,
      description: alert.description,
      announcement_url: alert.announcement_url,
      detected_at: alert.detected_at,
      metadata: alert.metadata,
    }))
  }

  async checkForAnnouncements(): Promise<AnnouncementEvent[]> {
    const log = this.logger.child({ operation: 'checkForAnnouncements' })

    try {
      const since = this.lastAnnouncementCheck || new Date(Date.now() - 24 * 60 * 60 * 1000)
      log.info('Fetching announcements from Binance RSS feed')
      const events = await this.announcementsParser.fetchAndParseAnnouncements(since)

      if (events.length > 0) {
        log.info({ count: events.length }, 'Detected announcement events')
        await this.storeAnnouncementAlerts(events)
      }

      this.lastAnnouncementCheck = new Date()
      return events
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to check for announcements',
      )
      throw error
    }
  }

  private async storeAnnouncementAlerts(events: AnnouncementEvent[]): Promise<void> {
    const log = this.logger.child({ operation: 'storeAnnouncementAlerts' })

    for (const event of events) {
      try {
        const existing = await this.db
          .selectFrom('binance_listing_alerts')
          .select('id')
          .where('announcement_url', '=', event.announcementUrl)
          .where('event_type', '=', event.eventType)
          .executeTakeFirst()

        if (existing) {
          log.debug(
            { url: event.announcementUrl, eventType: event.eventType },
            'Announcement already stored, skipping',
          )
          continue
        }

        await this.db
          .insertInto('binance_listing_alerts')
          .values({
            event_type: event.eventType,
            symbol: event.symbol,
            title: event.title,
            description: event.description,
            announcement_url: event.announcementUrl,
            metadata: event.metadata,
          })
          .execute()

        log.info(
          { symbol: event.symbol, eventType: event.eventType },
          'Stored announcement alert',
        )
      } catch (error) {
        log.error(
          {
            error: error instanceof Error ? error.message : String(error),
            symbol: event.symbol,
          },
          'Failed to store announcement alert',
        )
      }
    }
  }

  async getRecentAlerts(limit: number = 10): Promise<ListingAlert[]> {
    const since = new Date()
    since.setHours(since.getHours() - 24)

    return this.listAlerts({
      since,
      limit,
    })
  }
}

