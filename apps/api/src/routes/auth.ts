import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { AuthService } from '../services/AuthService'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'

const SignupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
})

const SigninSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export function authRouter(
  db: Kysely<DB>,
  logger: Logger,
  jwtSecret: string,
  jwtRefreshSecret: string,
): Router {
  const router = Router()
  const authService = new AuthService(db, logger, jwtSecret, jwtRefreshSecret)

  router.post('/v1/auth/signup', async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = SignupSchema.safeParse(req.body)
      
      if (!validation.success) {
        res.status(400).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: validation.error.errors,
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const { email, password, name } = validation.data

      const user = await authService.signup(
        { email, password, name },
        req.correlationId,
      )

      res.status(201).json({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
      })
    } catch (error) {
      logger.error(
        { error, correlationId: req.correlationId },
        'Error during signup',
      )

      const message = error instanceof Error ? error.message : 'Unknown error'
      const status = message.includes('already registered') ? 409 : 400

      res.status(status).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: status === 409 ? 'Conflict' : 'Bad Request',
        status,
        detail: message,
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  })

  router.post('/v1/auth/signin', async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = SigninSchema.safeParse(req.body)
      
      if (!validation.success) {
        res.status(400).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: validation.error.errors,
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const { email, password } = validation.data
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      const result = await authService.signin(
        { email, password, ipAddress, userAgent },
        req.correlationId,
      )

      res.status(200).json({
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.email_verified,
        },
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      })
    } catch (error) {
      logger.error(
        { error, correlationId: req.correlationId },
        'Error during signin',
      )

      const message = error instanceof Error ? error.message : 'Unknown error'
      const status = message.includes('Invalid credentials') || message.includes('inactive') || message.includes('locked') ? 401 : 400

      res.status(status).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: status === 401 ? 'Unauthorized' : 'Bad Request',
        status,
        detail: message,
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  })

  router.post('/v1/auth/signout', async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = RefreshTokenSchema.safeParse(req.body)
      
      if (!validation.success) {
        res.status(400).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: validation.error.errors,
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const { refreshToken } = validation.data

      await authService.signout(refreshToken, req.correlationId)

      res.status(204).send()
    } catch (error) {
      logger.error(
        { error, correlationId: req.correlationId },
        'Error during signout',
      )

      res.status(500).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An error occurred during signout',
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  })

  router.post('/v1/auth/refresh', async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = RefreshTokenSchema.safeParse(req.body)
      
      if (!validation.success) {
        res.status(400).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: validation.error.errors,
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const { refreshToken } = validation.data
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      const tokens = await authService.refreshAccessToken(
        refreshToken,
        ipAddress,
        userAgent,
        req.correlationId,
      )

      res.status(200).json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })
    } catch (error) {
      logger.error(
        { error, correlationId: req.correlationId },
        'Error refreshing token',
      )

      const message = error instanceof Error ? error.message : 'Unknown error'

      res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'Unauthorized',
        status: 401,
        detail: message,
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  })

  router.get('/v1/auth/me', async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid authorization header',
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const token = authHeader.split(' ')[1]
      const payload = await authService.verifyAccessToken(token)

      res.status(200).json({
        userId: payload.userId,
        email: payload.email,
      })
    } catch (error) {
      logger.error(
        { error, correlationId: req.correlationId },
        'Error getting current user',
      )

      res.status(401).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired access token',
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  })

  return router
}
