import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createApp } from '../app'
import { createDb, type DB } from '@pkg/db'
import { createLogger } from '../logger'
import request from 'supertest'
import type { Express } from 'express'
import type { Kysely } from 'kysely'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
const TEST_JWT_SECRET = 'test-jwt-secret-for-integration-tests-at-least-32-chars'
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-for-integration-tests-at-least-32-chars'
const TEST_ENC_KEY = 'test-encryption-key-16'

describe('Auth Integration Tests', () => {
  let app: Express
  let db: Kysely<DB>
  const logger = createLogger('silent')

  beforeAll(async () => {
    if (!TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set')
    }

    db = createDb(TEST_DATABASE_URL)
    app = createApp(db, logger, TEST_ENC_KEY, TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET)

    await db.schema
      .createTable('users')
      .ifNotExists()
      .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
      .addColumn('email', 'text', (col) => col.notNull().unique())
      .addColumn('password_hash', 'text', (col) => col.notNull())
      .addColumn('name', 'text')
      .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
      .addColumn('email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('failed_login_attempts', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('locked_until', 'timestamptz')
      .addColumn('last_login_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
      .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
      .execute()

    await db.schema
      .createTable('refresh_tokens')
      .ifNotExists()
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
      .addColumn('token_hash', 'text', (col) => col.notNull().unique())
      .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
      .addColumn('revoked', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
      .addColumn('ip_address', 'text')
      .addColumn('user_agent', 'text')
      .execute()

    await db.schema
      .createTable('auth_audit_log')
      .ifNotExists()
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
      .addColumn('email', 'text', (col) => col.notNull())
      .addColumn('event_type', 'text', (col) => col.notNull())
      .addColumn('ip_address', 'text')
      .addColumn('user_agent', 'text')
      .addColumn('correlation_id', 'text')
      .addColumn('success', 'boolean', (col) => col.notNull())
      .addColumn('failure_reason', 'text')
      .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
      .execute()
  })

  afterAll(async () => {
    await db.schema.dropTable('auth_audit_log').ifExists().execute()
    await db.schema.dropTable('refresh_tokens').ifExists().execute()
    await db.schema.dropTable('users').ifExists().execute()
    await db.destroy()
  })

  beforeEach(async () => {
    await db.deleteFrom('auth_audit_log').execute()
    await db.deleteFrom('refresh_tokens').execute()
    await db.deleteFrom('users').execute()
  })

  describe('POST /v1/auth/signup', () => {
    it('should create a new user with valid input', async () => {
      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123',
          name: 'New User',
        })
        .expect(201)

      expect(response.body).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
        emailVerified: false,
      })
      expect(response.body.id).toBeDefined()
      expect(response.body.createdAt).toBeDefined()
    })

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123',
        })
        .expect(201)

      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPass123',
        })
        .expect(409)

      expect(response.body.detail).toContain('already registered')
    })

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123',
        })
        .expect(400)

      expect(response.body.detail).toBe('Validation failed')
    })

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak',
        })
        .expect(400)

      expect(response.body.detail).toBe('Validation failed')
    })

    it('should reject password without uppercase', async () => {
      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'lowercase123',
        })
        .expect(400)

      expect(response.body.detail).toContain('uppercase')
    })

    it('should reject password without number', async () => {
      const response = await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'NoNumbers',
        })
        .expect(400)

      expect(response.body.detail).toContain('number')
    })
  })

  describe('POST /v1/auth/signin', () => {
    beforeEach(async () => {
      await request(app)
        .post('/v1/auth/signup')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123',
          name: 'Test User',
        })
    })

    it('should sign in with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/auth/signin')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123',
        })
        .expect(200)

      expect(response.body).toMatchObject({
        user: {
          email: 'testuser@example.com',
          name: 'Test User',
          emailVerified: false,
        },
      })
      expect(response.body.accessToken).toBeDefined()
      expect(response.body.refreshToken).toBeDefined()
    })

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/v1/auth/signin')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword123',
        })
        .expect(401)

      expect(response.body.detail).toBe('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/v1/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
        })
        .expect(401)

      expect(response.body.detail).toBe('Invalid credentials')
    })

    it('should lock account after 5 failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/v1/auth/signin')
          .send({
            email: 'testuser@example.com',
            password: 'WrongPassword',
          })
          .expect(401)
      }

      const response = await request(app)
        .post('/v1/auth/signin')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123',
        })
        .expect(401)

      expect(response.body.detail).toContain('locked')
    })
  })

  describe('POST /v1/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      await request(app).post('/v1/auth/signup').send({
        email: 'refreshtest@example.com',
        password: 'TestPassword123',
      })

      const signinResponse = await request(app).post('/v1/auth/signin').send({
        email: 'refreshtest@example.com',
        password: 'TestPassword123',
      })

      refreshToken = signinResponse.body.refreshToken
    })

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(response.body.accessToken).toBeDefined()
      expect(response.body.refreshToken).toBeDefined()
      expect(response.body.refreshToken).not.toBe(refreshToken)
    })

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401)

      expect(response.body.detail).toContain('Invalid')
    })

    it('should reject reused refresh token', async () => {
      await request(app).post('/v1/auth/refresh').send({ refreshToken }).expect(200)

      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401)

      expect(response.body.detail).toContain('Invalid')
    })
  })

  describe('POST /v1/auth/signout', () => {
    let refreshToken: string

    beforeEach(async () => {
      await request(app).post('/v1/auth/signup').send({
        email: 'signouttest@example.com',
        password: 'TestPassword123',
      })

      const signinResponse = await request(app).post('/v1/auth/signin').send({
        email: 'signouttest@example.com',
        password: 'TestPassword123',
      })

      refreshToken = signinResponse.body.refreshToken
    })

    it('should sign out successfully', async () => {
      await request(app)
        .post('/v1/auth/signout')
        .send({ refreshToken })
        .expect(204)
    })

    it('should prevent using refresh token after signout', async () => {
      await request(app)
        .post('/v1/auth/signout')
        .send({ refreshToken })
        .expect(204)

      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401)

      expect(response.body.detail).toContain('revoked')
    })
  })

  describe('GET /v1/auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      await request(app).post('/v1/auth/signup').send({
        email: 'metest@example.com',
        password: 'TestPassword123',
        name: 'Me Test',
      })

      const signinResponse = await request(app).post('/v1/auth/signin').send({
        email: 'metest@example.com',
        password: 'TestPassword123',
      })

      accessToken = signinResponse.body.accessToken
    })

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toMatchObject({
        email: 'metest@example.com',
      })
      expect(response.body.userId).toBeDefined()
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .expect(401)

      expect(response.body.detail).toContain('Missing or invalid')
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)

      expect(response.body.detail).toContain('Invalid or expired')
    })
  })
})
