import axios from 'axios'

export class AuthService {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private accessTokenExpiresAt = 0

  constructor(
    private apiBase: string,
    private authEmail: string,
    private authPassword: string,
  ) {
    this.accessToken = process.env.ACCESS_TOKEN || null
    this.refreshToken = process.env.REFRESH_TOKEN || null
  }

  async ensureAuth(): Promise<void> {
    const now = Date.now()
    // Refresh if token expiring in <= 60s
    if (this.accessToken && now < this.accessTokenExpiresAt - 60_000) {
      console.log('✅ Using existing access token')
      return
    }

    if (this.refreshToken) {
      try {
        console.log('🔄 Refreshing access token...')
        const { data } = await axios.post(`${this.apiBase}/v1/auth/refresh`, {
          refreshToken: this.refreshToken,
        })
        this.accessToken = data.accessToken
        this.refreshToken = data.refreshToken
        // access token lifetime ~15m; set expiry conservatively to now+14m
        this.accessTokenExpiresAt = now + 14 * 60_000
        console.log('✅ Token refreshed successfully')
        return
      } catch (err) {
        console.warn(
          '⚠️ Token refresh failed, will sign in:',
          axios.isAxiosError(err)
            ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
            : err,
        )
        this.refreshToken = null // Clear invalid refresh token
      }
    }

    if (!this.authEmail || !this.authPassword) {
      throw new Error(
        'Bot auth missing. Provide AUTH_EMAIL and AUTH_PASSWORD or REFRESH_TOKEN.',
      )
    }
    console.log(`🔑 Signing in with email: ${this.authEmail}`)
    const { data } = await axios.post(`${this.apiBase}/v1/auth/signin`, {
      email: this.authEmail,
      password: this.authPassword,
    })
    this.accessToken = data.accessToken
    this.refreshToken = data.refreshToken
    this.accessTokenExpiresAt = now + 14 * 60_000
    console.log('✅ Sign in successful')
  }

  getAccessToken(): string | null {
    return this.accessToken
  }
}

