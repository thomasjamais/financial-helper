export type AnnouncementEvent = {
  eventType: 'IPO' | 'Launchpool'
  symbol: string | null
  title: string
  description: string | null
  announcementUrl: string
  metadata: Record<string, unknown>
}

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export class BinanceAnnouncementsParser {
  private readonly announcementsUrl =
    'https://www.binance.com/en/support/announcement/c-48?navId=48'

  async fetchAndParseAnnouncements(
    since?: Date,
  ): Promise<AnnouncementEvent[]> {
    try {
      const rssUrl = 'https://www.binance.com/en/support/announcement/rss'
      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; BinanceListingMonitor/1.0; +https://github.com)',
        },
      } as any)

      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status}`)
      }

      const xmlText = await response.text()
      const items = this.parseRSS(xmlText)

      const events: AnnouncementEvent[] = []

      for (const item of items) {
        const pubDate = new Date(item.pubDate)
        if (since && pubDate < since) {
          continue
        }

        const event = this.parseAnnouncement(item)
        if (event) {
          events.push(event)
        }
      }

      return events
    } catch (error) {
      throw new Error(
        `Failed to fetch announcements: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private parseRSS(xmlText: string): RSSItem[] {
    const items: RSSItem[] = []

    try {
      const itemMatches = xmlText.matchAll(
        /<item>([\s\S]*?)<\/item>/gi,
      )

      for (const match of itemMatches) {
        const itemXml = match[1]
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i)
        const descriptionMatch = itemXml.match(
          /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i,
        )
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i)

        if (titleMatch && linkMatch) {
          items.push({
            title: titleMatch[1].trim(),
            link: linkMatch[1].trim(),
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
          })
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to parse RSS: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return items
  }

  private parseAnnouncement(item: RSSItem): AnnouncementEvent | null {
    const title = item.title.toLowerCase()
    const description = item.description.toLowerCase()

    let eventType: 'IPO' | 'Launchpool' | null = null
    let symbol: string | null = null

    if (title.includes('launchpool') || description.includes('launchpool')) {
      eventType = 'Launchpool'
    } else if (
      title.includes('ipo') ||
      title.includes('initial exchange offering') ||
      description.includes('ipo') ||
      description.includes('initial exchange offering')
    ) {
      eventType = 'IPO'
    }

    if (!eventType) {
      return null
    }

    const symbolMatch =
      item.title.match(/\b([A-Z]{2,10})\b/) ||
      item.description.match(/\b([A-Z]{2,10})\b/)
    if (symbolMatch) {
      symbol = symbolMatch[1]
    }

    return {
      eventType,
      symbol,
      title: item.title,
      description: this.cleanDescription(item.description),
      announcementUrl: item.link,
      metadata: {
        publishedAt: item.pubDate,
        source: 'binance_rss',
      },
    }
  }

  private cleanDescription(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
      .substring(0, 500)
  }
}

