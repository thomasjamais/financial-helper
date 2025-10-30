import axios from 'axios'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''

async function tick() {
  try {
    // Fetch live opportunities and pick a simple signal heuristic
    const { data: opps } = await axios.get(
      `${API_BASE}/v1/binance/earn/opportunities`,
      {
        params: { minScore: 0.35 },
        headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : undefined,
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
        { headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : undefined },
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


