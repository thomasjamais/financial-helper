import 'dotenv/config'
import 'dotenv/config'
import axios from 'axios'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'
const AUTH_EMAIL = process.env.AUTH_EMAIL || ''
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || ''
let accessToken: string | null = process.env.ACCESS_TOKEN || null
let refreshToken: string | null = process.env.REFRESH_TOKEN || null
let accessTokenExpiresAt = 0

async function ensureAuth(): Promise<void> {
  const now = Date.now()
  // Refresh if token expiring in <= 60s
  if (accessToken && now < accessTokenExpiresAt - 60_000) return

  if (refreshToken) {
    try {
      const { data } = await axios.post(`${API_BASE}/v1/auth/refresh`, {
        refreshToken,
      })
      accessToken = data.accessToken
      refreshToken = data.refreshToken
      // access token lifetime ~15m; set expiry conservatively to now+14m
      accessTokenExpiresAt = now + 14 * 60_000
      return
    } catch {}
  }

  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error(
      'Bot auth missing. Provide AUTH_EMAIL and AUTH_PASSWORD or REFRESH_TOKEN.',
    )
  }
  const { data } = await axios.post(`${API_BASE}/v1/auth/signin`, {
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  })
  accessToken = data.accessToken
  refreshToken = data.refreshToken
  accessTokenExpiresAt = now + 14 * 60_000
}

async function tick() {
  try {
    await ensureAuth()
    // Fetch market tickers and derive trade ideas (market-wide)
    const { data: tickers } = await axios.get(
      'https://api.binance.com/api/v3/ticker/24hr',
      { timeout: 10000 },
    )

    const symbols = (Array.isArray(tickers) ? tickers : []).filter(
      (t: any) => t.symbol?.endsWith('USDT'),
    )
    const sorted = symbols
      .map((t: any) => ({ symbol: t.symbol as string, change: Number(t.priceChangePercent) }))
      .filter((t: any) => isFinite(t.change))
      .sort((a: any, b: any) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 10)

    for (const s of sorted) {
      const side = s.change >= 0 ? 'BUY' : 'SELL'
      const score = Math.min(1, Math.abs(s.change) / 25)
      await axios.post(
        `${API_BASE}/v1/trade-ideas`,
        {
          exchange: 'binance',
          symbol: s.symbol,
          side,
          score,
          reason: `24h change ${s.change.toFixed(2)}%`,
          metadata: { changePct: s.change },
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
        'Bot tick failed',
        err.response?.status,
        err.response?.data || err.message,
      )
    } else {
      console.error(
        'Bot tick failed',
        err instanceof Error ? err.message : String(err),
      )
    }
  }
}

async function main() {
  const intervalMs = Number(process.env.BOT_INTERVAL_MS || 60000)
  await tick()
  setInterval(tick, intervalMs)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
