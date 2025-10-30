import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService, type User, type SignupInput, type SigninInput } from './AuthService'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => mockLogger),
} as any

const mockDb = {
  insertInto: vi.fn(),
  selectFrom: vi.fn(),
  updateTable: vi.fn(),
  deleteFrom: vi.fn(),
} as unknown as Kysely<DB>

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long'

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    authService = new AuthService(mockDb, mockLogger, TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET)
  })

  describe('signup', () => {
    it('should create a new user with valid input', async () => {
      const input: SignupInput = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      }

      const mockUser: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue(mockUser),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }

      const mockAuditInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockImplementation((table) => {
        if (table === 'users') return mockSelectChain as any
        if (table === 'auth_audit_log') return mockAuditInsertChain as any
        return mockSelectChain as any
      })

      vi.spyOn(mockDb, 'insertInto').mockImplementation((table) => {
        if (table === 'users') return mockInsertChain as any
        if (table === 'auth_audit_log') return mockAuditInsertChain as any
        return mockInsertChain as any
      })

      const result = await authService.signup(input)

      expect(result.email).toBe('test@example.com')
      expect(result.name).toBe('Test User')
      expect(result.is_active).toBe(true)
      expect(result.email_verified).toBe(true)
    })

    it('should reject invalid email format', async () => {
      const input: SignupInput = {
        email: 'invalid-email',
        password: 'Password123',
      }

      await expect(authService.signup(input)).rejects.toThrow('Invalid email format')
    })

    it('should reject weak password (too short)', async () => {
      const input: SignupInput = {
        email: 'test@example.com',
        password: 'Pass1',
      }

      await expect(authService.signup(input)).rejects.toThrow('Password must be at least 8 characters long')
    })

    it('should reject password without uppercase letter', async () => {
      const input: SignupInput = {
        email: 'test@example.com',
        password: 'password123',
      }

      await expect(authService.signup(input)).rejects.toThrow('Password must contain at least one uppercase letter')
    })

    it('should reject password without lowercase letter', async () => {
      const input: SignupInput = {
        email: 'test@example.com',
        password: 'PASSWORD123',
      }

      await expect(authService.signup(input)).rejects.toThrow('Password must contain at least one lowercase letter')
    })

    it('should reject password without number', async () => {
      const input: SignupInput = {
        email: 'test@example.com',
        password: 'PasswordOnly',
      }

      await expect(authService.signup(input)).rejects.toThrow('Password must contain at least one number')
    })

    it('should reject duplicate email', async () => {
      const input: SignupInput = {
        email: 'existing@example.com',
        password: 'Password123',
      }

      const existingUser: User = {
        id: '123',
        email: 'existing@example.com',
        password_hash: 'hash',
        name: null,
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(existingUser),
      }

      const mockAuditInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockImplementation((table) => {
        if (table === 'users') return mockSelectChain as any
        if (table === 'auth_audit_log') return mockAuditInsertChain as any
        return mockSelectChain as any
      })

      vi.spyOn(mockDb, 'insertInto').mockImplementation(() => mockAuditInsertChain as any)

      await expect(authService.signup(input)).rejects.toThrow('Email already registered')
    })
  })

  describe('signin', () => {
    it('should authenticate user with valid credentials', async () => {
      const input: SigninInput = {
        email: 'test@example.com',
        password: 'Password123',
      }

      const passwordHash = await bcrypt.hash('Password123', 12)

      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        password_hash: passwordHash,
        name: 'Test User',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
      }

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'updateTable').mockReturnValue(mockUpdateChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      const result = await authService.signin(input)

      expect(result.user.email).toBe('test@example.com')
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it('should reject signin with invalid credentials', async () => {
      const input: SigninInput = {
        email: 'test@example.com',
        password: 'WrongPassword123',
      }

      const passwordHash = await bcrypt.hash('CorrectPassword123', 12)

      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        password_hash: passwordHash,
        name: 'Test User',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
      }

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'updateTable').mockReturnValue(mockUpdateChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      await expect(authService.signin(input)).rejects.toThrow('Invalid credentials')
    })

    it('should reject signin for inactive user', async () => {
      const input: SigninInput = {
        email: 'test@example.com',
        password: 'Password123',
      }

      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        password_hash: 'hash',
        name: 'Test User',
        is_active: false,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      await expect(authService.signin(input)).rejects.toThrow('Account is inactive')
    })

    it('should reject signin for locked account', async () => {
      const input: SigninInput = {
        email: 'test@example.com',
        password: 'Password123',
      }

      const lockedUntil = new Date()
      lockedUntil.setHours(lockedUntil.getHours() + 1)

      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        password_hash: 'hash',
        name: 'Test User',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 5,
        locked_until: lockedUntil,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockUser),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      await expect(authService.signin(input)).rejects.toThrow(/Account is locked until/)
    })

    it('should reject signin for non-existent user', async () => {
      const input: SigninInput = {
        email: 'nonexistent@example.com',
        password: 'Password123',
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      await expect(authService.signin(input)).rejects.toThrow('Invalid credentials')
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const payload = { userId: '123', email: 'test@example.com' }
      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '15m' })

      const result = await authService.verifyAccessToken(token)

      expect(result.userId).toBe('123')
      expect(result.email).toBe('test@example.com')
    })

    it('should reject invalid access token', async () => {
      const invalidToken = 'invalid.token.here'

      await expect(authService.verifyAccessToken(invalidToken)).rejects.toThrow('Invalid or expired access token')
    })

    it('should reject expired access token', async () => {
      const payload = { userId: '123', email: 'test@example.com' }
      const expiredToken = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '0s' })

      await new Promise((resolve) => setTimeout(resolve, 1000))

      await expect(authService.verifyAccessToken(expiredToken)).rejects.toThrow('Invalid or expired access token')
    })
  })

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const passwordHash = await bcrypt.hash('Password123', 12)

      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        password_hash: passwordHash,
        name: 'Test User',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const payload = { userId: '123', email: 'test@example.com' }
      const refreshToken = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, { expiresIn: '7d' })

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const mockStoredToken = {
        id: 1,
        user_id: '123',
        token_hash: 'hash',
        expires_at: expiresAt,
        revoked: false,
        revoked_at: null,
        created_at: new Date(),
        ip_address: null,
        user_agent: null,
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn()
          .mockResolvedValueOnce(mockStoredToken)
          .mockResolvedValueOnce(mockUser),
      }

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'updateTable').mockReturnValue(mockUpdateChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      const result = await authService.refreshAccessToken(refreshToken)

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should reject revoked refresh token', async () => {
      const payload = { userId: '123', email: 'test@example.com' }
      const refreshToken = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, { expiresIn: '7d' })

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const mockStoredToken = {
        id: 1,
        user_id: '123',
        token_hash: 'hash',
        expires_at: expiresAt,
        revoked: true,
        revoked_at: new Date(),
        created_at: new Date(),
        ip_address: null,
        user_agent: null,
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockStoredToken),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow('Refresh token has been revoked')
    })

    it('should reject non-existent refresh token', async () => {
      const payload = { userId: '123', email: 'test@example.com' }
      const refreshToken = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, { expiresIn: '7d' })

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)

      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('signout', () => {
    it('should revoke refresh token on signout', async () => {
      const payload = { userId: '123', email: 'test@example.com' }
      const refreshToken = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, { expiresIn: '7d' })

      const mockStoredToken = {
        id: 1,
        user_id: '123',
        token_hash: 'hash',
        expires_at: new Date(),
        revoked: false,
        revoked_at: null,
        created_at: new Date(),
        ip_address: null,
        user_agent: null,
      }

      const mockSelectChain = {
        selectAll: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        executeTakeFirst: vi.fn().mockResolvedValue(mockStoredToken),
      }

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(undefined),
      }

      vi.spyOn(mockDb, 'selectFrom').mockReturnValue(mockSelectChain as any)
      vi.spyOn(mockDb, 'updateTable').mockReturnValue(mockUpdateChain as any)
      vi.spyOn(mockDb, 'insertInto').mockReturnValue(mockInsertChain as any)

      await authService.signout(refreshToken)

      expect(mockUpdateChain.set).toHaveBeenCalledWith({
        revoked: true,
        revoked_at: expect.any(Date),
      })
    })
  })
})
