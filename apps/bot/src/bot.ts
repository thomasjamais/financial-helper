import 'dotenv/config'
import axios from 'axios'
import {
  generateTechnicalTradeIdea,
  getTopCryptosByVolume,
  type TechnicalTradeIdea,
} from './technicalAnalysisService'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'
const AUTH_EMAIL = process.env.AUTH_EMAIL || ''
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || ''
const TECHNICAL_ANALYSIS_ENABLED =
  process.env.TECHNICAL_ANALYSIS_ENABLED !== 'false'
const TECHNICAL_ANALYSIS_SYMBOLS_COUNT = Number(
  process.env.TECHNICAL_ANALYSIS_SYMBOLS_COUNT || 15,
)
const MIN_CONFIDENCE_SCORE = Number(process.env.MIN_CONFIDENCE_SCORE || 0.6)

let accessToken: string | null = process.env.ACCESS_TOKEN || null
let refreshToken: string | null = process.env.REFRESH_TOKEN || null
let accessTokenExpiresAt = 0

async function ensureAuth(): Promise<void> {
  const now = Date.now()
  // Refresh if token expiring in <= 60s
  if (accessToken && now < accessTokenExpiresAt - 60_000) {
    console.log('✅ Using existing access token')
    return
  }

  if (refreshToken) {
    try {
      console.log('🔄 Refreshing access token...')
      const { data } = await axios.post(`${API_BASE}/v1/auth/refresh`, {
        refreshToken,
      })
      accessToken = data.accessToken
      refreshToken = data.refreshToken
      // access token lifetime ~15m; set expiry conservatively to now+14m
      accessTokenExpiresAt = now + 14 * 60_000
      console.log('✅ Token refreshed successfully')
      return
    } catch (err) {
      console.warn(
        '⚠️ Token refresh failed, will sign in:',
        axios.isAxiosError(err)
          ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
          : err,
      )
      refreshToken = null // Clear invalid refresh token
    }
  }

  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error(
      'Bot auth missing. Provide AUTH_EMAIL and AUTH_PASSWORD or REFRESH_TOKEN.',
    )
  }
  console.log(`🔑 Signing in with email: ${AUTH_EMAIL}`)
  const { data } = await axios.post(`${API_BASE}/v1/auth/signin`, {
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  })
  accessToken = data.accessToken
  refreshToken = data.refreshToken
  accessTokenExpiresAt = now + 14 * 60_000
  console.log('✅ Sign in successful')
}

async function postTradeIdea(idea: TechnicalTradeIdea, userId?: string) {
  try {
    const response = await axios.post(
      `${API_BASE}/v1/trade-ideas`,
      {
        exchange: 'binance',
        symbol: idea.symbol,
        side: idea.side,
        score: idea.score,
        reason: idea.reason,
        metadata: {
          ...idea.metadata,
          entryPrice: idea.entryPrice,
          takeProfitPct: idea.takeProfitPct,
          stopLossPct: idea.stopLossPct,
          exitStrategy: idea.exitStrategy,
          validatedIndicators: idea.validatedIndicators.map((ind) => ({
            name: ind.name,
            side: ind.side,
            score: ind.score,
            reason: ind.reason,
            details: ind.details,
          })),
          source: 'technical_analysis',
        },
      },
      {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      },
    )
    console.log(
      `✓ Trade idea posted successfully for ${idea.symbol}:`,
      response.data,
    )
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        `✗ Failed to post trade idea for ${idea.symbol}:`,
        `Status: ${err.response?.status}`,
        `Error: ${JSON.stringify(err.response?.data || err.message)}`,
      )
    } else {
      console.error(
        `✗ Failed to post trade idea for ${idea.symbol}:`,
        err instanceof Error ? err.message : String(err),
      )
    }
    // Don't throw, continue with other symbols
    return null
  }
}

async function technicalAnalysisTick() {
  try {
    await ensureAuth()
    console.log('🔐 Authentication successful')

    // Get top cryptos to analyze
    const symbols = await getTopCryptosByVolume(
      TECHNICAL_ANALYSIS_SYMBOLS_COUNT,
    )

    console.log(`🔍 Running technical analysis on ${symbols.length} symbols...`)

    const results: Array<{
      symbol: string
      idea: TechnicalTradeIdea | null
      error?: string
    }> = []

    // Analyze each symbol
    for (const symbol of symbols) {
      try {
        const idea = await generateTechnicalTradeIdea(
          symbol,
          MIN_CONFIDENCE_SCORE, // minScore
        )

        if (idea && idea.validatedIndicators.length > 0) {
          const indicatorsList = idea.validatedIndicators
            .map((ind) => ind.name)
            .join(', ')
          console.log(
            `📊 ${symbol}: ${idea.side} signal (score: ${(idea.score * 100).toFixed(1)}%, indicators: ${indicatorsList}, TP: ${(idea.takeProfitPct * 100).toFixed(2)}%, SL: ${(idea.stopLossPct * 100).toFixed(2)}%)`,
          )
          const posted = await postTradeIdea(idea)
          if (posted) {
            results.push({ symbol, idea })
            console.log(`✅ ${symbol}: Trade idea saved successfully`)
          } else {
            results.push({ symbol, idea: null, error: 'Failed to post' })
          }
        } else {
          results.push({ symbol, idea: null })
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        results.push({ symbol, idea: null, error })
        console.error(`✗ ${symbol}: ${error}`)
      }
    }

    const successful = results.filter((r) => r.idea !== null).length
    console.log(
      `Technical analysis complete: ${successful}/${symbols.length} signals generated`,
    )
  } catch (err) {
    console.error('Technical analysis tick failed:', err)
    throw err
  }
}

async function marketTickerTick() {
  try {
    await ensureAuth()
    // Fetch market tickers and derive trade ideas (market-wide)
    const { data: tickers } = await axios.get(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeout: 10000 },
    )

    const symbols = (Array.isArray(tickers) ? tickers : []).filter((t: any) =>
      t.symbol?.endsWith('USDT'),
    )
    const sorted = symbols
      .map((t: any) => ({
        symbol: t.symbol as string,
        change: Number(t.priceChangePercent),
      }))
      .filter((t: any) => isFinite(t.change))
      .sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change))

    for (const s of sorted) {
      const side = s.change >= 0 ? 'BUY' : 'SELL'
      const score = Math.min(1, Math.abs(s.change) / 25)

      if (score < 0.6) continue

      await axios.post(
        `${API_BASE}/v1/trade-ideas`,
        {
          exchange: 'binance',
          symbol: s.symbol,
          side,
          score,
          reason: `24h change ${s.change.toFixed(2)}%`,
          metadata: { changePct: s.change, source: 'market_ticker' },
        },
        {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      )
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    if (axios.isAxiosError(err)) {
      console.error(
        'Market ticker tick failed',
        err.response?.status,
        err.response?.data || err.message,
      )
    } else {
      console.error(
        'Market ticker tick failed',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

async function tick() {
  try {
    // Run technical analysis if enabled
    if (TECHNICAL_ANALYSIS_ENABLED) {
      await technicalAnalysisTick()
    }

    // Also run market ticker analysis (existing logic)
    await marketTickerTick()
  } catch (err) {
    console.error('Bot tick failed:', err)
  }
}

async function main() {
  const intervalMs = Number(process.env.BOT_INTERVAL_MS || 30000) // Default to 30 seconds
  console.log(`Bot starting with ${intervalMs}ms interval`)
  console.log(
    `Technical analysis: ${TECHNICAL_ANALYSIS_ENABLED ? 'enabled' : 'disabled'}`,
  )
  console.log(`Symbols count: ${TECHNICAL_ANALYSIS_SYMBOLS_COUNT}`)
  console.log(`Min confidence: ${MIN_CONFIDENCE_SCORE}`)

  await tick()
  setInterval(tick, intervalMs)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
