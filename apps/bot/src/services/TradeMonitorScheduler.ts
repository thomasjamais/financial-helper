import axios from 'axios'
import type { AuthService } from './AuthService.js'

export class TradeMonitorScheduler {
  constructor(
    private apiBase: string,
    private authService: AuthService,
  ) {}

  async runMonitoring(): Promise<{
    checked: number
    actionsExecuted: number
    errors: number
  }> {
    try {
      await this.authService.ensureAuth()
      const accessToken = this.authService.getAccessToken()

      if (!accessToken) {
        throw new Error('Not authenticated')
      }

      const response = await axios.post(
        `${this.apiBase}/v1/trades/monitor`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      return response.data
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`✗ Trade monitoring failed: ${error}`)
      throw err
    }
  }
}

