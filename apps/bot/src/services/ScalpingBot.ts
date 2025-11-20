import axios from 'axios'
import type { AuthService } from './AuthService'

export class ScalpingBot {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(
    private apiBase: string,
    private authService: AuthService,
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('ScalpingBot is already running')
      return
    }

    console.log('Starting ScalpingBot')
    this.isRunning = true

    await this.runCycle()

    this.intervalId = setInterval(() => {
      this.runCycle().catch((err) => {
        console.error('Error in ScalpingBot cycle:', err)
      })
    }, 15 * 60 * 1000)
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    console.log('Stopping ScalpingBot')
    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async runCycle(): Promise<void> {
    try {
      await this.authService.ensureAuth()
      const accessToken = this.authService.getAccessToken()

      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const response = await axios.post(
        `${this.apiBase}/v1/scalping/bot/run-cycle`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      const { processed, ordersPlaced, errors } = response.data

      console.log(
        `ScalpingBot cycle: ${processed} strategies processed, ${ordersPlaced} orders placed, ${errors} errors`,
      )
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`ScalpingBot cycle failed: ${error}`)
    }
  }
}

