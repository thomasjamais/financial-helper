import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Kysely } from 'kysely'
import type { DB, User, RefreshToken } from '@pkg/db'
import type { Logger } from '../logger'
import crypto from 'crypto'

export type { User, RefreshToken }

export interface JwtPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface SignupInput {
  email: string
  password: string
  name?: string
}

export interface SigninInput {
  email: string
  password: string
  ipAddress?: string
  userAgent?: string
}

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_DAYS = 7
const MAX_FAILED_ATTEMPTS = 5
const ACCOUNT_LOCK_DURATION_MINUTES = 30

export class AuthService {
  constructor(
    private readonly db: Kysely<DB>,
    private readonly logger: Logger,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}

  async signup(input: SignupInput, correlationId?: string): Promise<User> {
    const { email, password, name } = input

    this.validateEmail(email)
    this.validatePassword(password)

    const existingUser = await this.findUserByEmail(email)
    if (existingUser) {
      await this.logAuthEvent({
        email,
        eventType: 'signup',
        success: false,
        failureReason: 'Email already exists',
        correlationId,
      })
      throw new Error('Email already registered')
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = await this.db
      .insertInto('users')
      .values({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name ?? null,
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
      })
      .returning([
        'id',
        'email',
        'password_hash',
        'name',
        'is_active',
        'email_verified',
        'failed_login_attempts',
        'locked_until',
        'last_login_at',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirstOrThrow() as User

    await this.logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'signup',
      success: true,
      correlationId,
    })

    this.logger.info({ userId: user.id, email: user.email, correlationId }, 'User signed up successfully')

    return user
  }

  async signin(input: SigninInput, correlationId?: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { email, password, ipAddress, userAgent } = input

    const user = await this.findUserByEmail(email.toLowerCase())
    if (!user) {
      await this.logAuthEvent({
        email,
        eventType: 'signin',
        success: false,
        failureReason: 'User not found',
        ipAddress,
        userAgent,
        correlationId,
      })
      throw new Error('Invalid credentials')
    }

    if (!user.is_active) {
      await this.logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'signin',
        success: false,
        failureReason: 'Account inactive',
        ipAddress,
        userAgent,
        correlationId,
      })
      throw new Error('Account is inactive')
    }

    if (user.locked_until && new Date() < user.locked_until) {
      await this.logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'signin',
        success: false,
        failureReason: 'Account locked',
        ipAddress,
        userAgent,
        correlationId,
      })
      throw new Error(`Account is locked until ${user.locked_until.toISOString()}`)
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      await this.handleFailedLogin(user, ipAddress, userAgent, correlationId)
      throw new Error('Invalid credentials')
    }

    await this.resetFailedLoginAttempts(user.id)

    await this.db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('id', '=', user.id)
      .execute()

    const tokens = await this.generateAuthTokens(user, ipAddress, userAgent)

    await this.logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'signin',
      success: true,
      ipAddress,
      userAgent,
      correlationId,
    })

    this.logger.info({ userId: user.id, email: user.email, correlationId }, 'User signed in successfully')

    return { user: { ...user, last_login_at: new Date() }, tokens }
  }

  async signout(refreshToken: string, correlationId?: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken)
      const token = await this.db
        .selectFrom('refresh_tokens')
        .selectAll()
        .where('token_hash', '=', tokenHash)
        .executeTakeFirst() as RefreshToken | undefined

      if (token) {
        await this.revokeRefreshToken(tokenHash)
        
        await this.logAuthEvent({
          userId: token.user_id,
          email: '',
          eventType: 'signout',
          success: true,
          correlationId,
        })

        this.logger.info({ userId: token.user_id, correlationId }, 'User signed out successfully')
      }
    } catch (error) {
      this.logger.error({ error, correlationId }, 'Error during signout')
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken)

    const storedToken = await this.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst() as RefreshToken | undefined

    if (!storedToken) {
      throw new Error('Invalid refresh token')
    }

    if (storedToken.revoked) {
      this.logger.warn({ tokenId: storedToken.id, correlationId }, 'Attempted to use revoked refresh token')
      throw new Error('Refresh token has been revoked')
    }

    if (new Date() > storedToken.expires_at) {
      throw new Error('Refresh token has expired')
    }

    let payload: JwtPayload
    try {
      payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as JwtPayload
    } catch (error) {
      throw new Error('Invalid refresh token')
    }

    const user = await this.findUserById(payload.userId)
    if (!user || !user.is_active) {
      throw new Error('User not found or inactive')
    }

    await this.revokeRefreshToken(tokenHash)

    const newTokens = await this.generateAuthTokens(user, ipAddress, userAgent)

    await this.logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'refresh',
      success: true,
      ipAddress,
      userAgent,
      correlationId,
    })

    this.logger.info({ userId: user.id, correlationId }, 'Access token refreshed successfully')

    return newTokens
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload
      return payload
    } catch (error) {
      throw new Error('Invalid or expired access token')
    }
  }

  private async generateAuthTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
    }

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY })
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
    })

    const tokenHash = this.hashToken(refreshToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

    await this.db
      .insertInto('refresh_tokens')
      .values({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked: false,
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null,
      })
      .execute()

    return { accessToken, refreshToken }
  }

  private async handleFailedLogin(
    user: User,
    ipAddress?: string,
    userAgent?: string,
    correlationId?: string,
  ): Promise<void> {
    const failedAttempts = user.failed_login_attempts + 1

    const updateValues: Record<string, unknown> = {
      failed_login_attempts: failedAttempts,
    }

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date()
      lockUntil.setMinutes(lockUntil.getMinutes() + ACCOUNT_LOCK_DURATION_MINUTES)
      updateValues.locked_until = lockUntil

      await this.logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'account_locked',
        success: true,
        ipAddress,
        userAgent,
        correlationId,
      })

      this.logger.warn(
        { userId: user.id, email: user.email, lockUntil, correlationId },
        'Account locked due to too many failed login attempts',
      )
    }

    await this.db
      .updateTable('users')
      .set(updateValues)
      .where('id', '=', user.id)
      .execute()

    await this.logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: 'failed_login',
      success: false,
      failureReason: 'Invalid password',
      ipAddress,
      userAgent,
      correlationId,
    })
  }

  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({
        failed_login_attempts: 0,
        locked_until: null,
      })
      .where('id', '=', userId)
      .execute()
  }

  private async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db
      .updateTable('refresh_tokens')
      .set({
        revoked: true,
        revoked_at: new Date(),
      })
      .where('token_hash', '=', tokenHash)
      .execute()
  }

  private async findUserByEmail(email: string): Promise<User | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst() as Promise<User | undefined>
  }

  private async findUserById(userId: string): Promise<User | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst() as Promise<User | undefined>
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format')
    }
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter')
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter')
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number')
    }
  }

  private async logAuthEvent(data: {
    userId?: string
    email: string
    eventType: 'signup' | 'signin' | 'signout' | 'refresh' | 'failed_login' | 'password_reset' | 'account_locked'
    success: boolean
    failureReason?: string
    ipAddress?: string
    userAgent?: string
    correlationId?: string
  }): Promise<void> {
    try {
      await this.db
        .insertInto('auth_audit_log')
        .values({
          user_id: data.userId ?? null,
          email: data.email,
          event_type: data.eventType,
          success: data.success,
          failure_reason: data.failureReason ?? null,
          ip_address: data.ipAddress ?? null,
          user_agent: data.userAgent ?? null,
          correlation_id: data.correlationId ?? null,
        })
        .execute()
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to log auth event')
    }
  }
}
