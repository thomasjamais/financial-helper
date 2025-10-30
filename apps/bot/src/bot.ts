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
    throw new Error('Bot auth missing. Provide AUTH_EMAIL and AUTH_PASSWORD or REFRESH_TOKEN.')
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
    // Fetch live opportunities and pick a simple signal heuristic
    const { data: opps } = await axios.get(
      `${API_BASE}/v1/binance/earn/opportunities`,
      {
        params: { minScore: 0.35 },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      },
    )

    const top = (opps as Array<any>)
      .filter((o) => o.redeemable)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    for (const o of top) {
      await axios.post(
        `${API_BASE}/v1/signals`,
        {
          source: 'earn-opportunity-bot',
          asset: o.asset,
          action: 'BUY',
          confidence: Math.min(1, Math.max(0.5, o.score)),
          reason: `High score opportunity: ${o.name} APR ${(o.apr * 100).toFixed(2)}%`,
          metadata: { productId: o.id, apr: o.apr, score: o.score },
        },
        { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined },
      )
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Bot tick failed', err instanceof Error ? err.message : String(err))
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


