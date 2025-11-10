import 'dotenv/config'
import { AuthService } from './services/AuthService'
import { TradeIdeaApiClient } from './services/TradeIdeaApiClient'
import { TechnicalAnalysisScheduler } from './services/TechnicalAnalysisScheduler'
import { MarketTickerService } from './services/MarketTickerService'
import { TradeMonitorScheduler } from './services/TradeMonitorScheduler'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080'
const AUTH_EMAIL = process.env.AUTH_EMAIL || ''
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || ''
const TECHNICAL_ANALYSIS_ENABLED =
  process.env.TECHNICAL_ANALYSIS_ENABLED !== 'false'
const TECHNICAL_ANALYSIS_SYMBOLS_COUNT = Number(
  process.env.TECHNICAL_ANALYSIS_SYMBOLS_COUNT || 50,
)
const MIN_CONFIDENCE_SCORE = Number(process.env.MIN_CONFIDENCE_SCORE || 0.6)
const TRADE_MONITOR_ENABLED = process.env.TRADE_MONITOR_ENABLED !== 'false'
const TRADE_MONITOR_INTERVAL_MS = Number(
  process.env.TRADE_MONITOR_INTERVAL_MS || 30000,
) // Default to 30 seconds

// Initialize services
const authService = new AuthService(API_BASE, AUTH_EMAIL, AUTH_PASSWORD)
const tradeIdeaApiClient = new TradeIdeaApiClient(API_BASE, authService)
const technicalAnalysisScheduler = new TechnicalAnalysisScheduler(
  authService,
  tradeIdeaApiClient,
  TECHNICAL_ANALYSIS_SYMBOLS_COUNT,
  MIN_CONFIDENCE_SCORE,
)
const marketTickerService = new MarketTickerService(
  API_BASE,
  authService,
  tradeIdeaApiClient,
)
const tradeMonitorScheduler = new TradeMonitorScheduler(API_BASE, authService)

async function tick() {
  try {
    // Run technical analysis if enabled
    if (TECHNICAL_ANALYSIS_ENABLED) {
      await technicalAnalysisScheduler.runAnalysis()
    }

    // Also run market ticker analysis (existing logic)
    await marketTickerService.runMarketTickerAnalysis()
  } catch (err) {
    console.error('Bot tick failed:', err)
  }
}

async function monitorTrades() {
  try {
    if (TRADE_MONITOR_ENABLED) {
      const result = await tradeMonitorScheduler.runMonitoring()
      console.log(
        `📊 Trade monitoring: checked ${result.checked}, actions ${result.actionsExecuted}, errors ${result.errors}`,
      )
    }
  } catch (err) {
    console.error('Trade monitoring failed:', err)
  }
}

async function main() {
  const intervalMs = Number(process.env.BOT_INTERVAL_MS || 5000) // Default to 5 seconds
  console.log(`🤖 Bot starting with ${intervalMs}ms interval`)
  console.log(
    `Technical analysis: ${TECHNICAL_ANALYSIS_ENABLED ? 'enabled' : 'disabled'}`,
  )
  console.log(`Symbols count: ${TECHNICAL_ANALYSIS_SYMBOLS_COUNT}`)
  console.log(`Min confidence: ${MIN_CONFIDENCE_SCORE}`)
  console.log(
    `Trade monitoring: ${TRADE_MONITOR_ENABLED ? 'enabled' : 'disabled'} (${TRADE_MONITOR_INTERVAL_MS}ms interval)`,
  )

  await tick()
  setInterval(tick, intervalMs)

  // Start trade monitoring loop
  if (TRADE_MONITOR_ENABLED) {
    await monitorTrades()
    setInterval(monitorTrades, TRADE_MONITOR_INTERVAL_MS)
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
