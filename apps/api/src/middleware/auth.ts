import type { Request, Response, NextFunction } from 'express'
import type { AuthService, JwtPayload } from '../services/AuthService'
import type { Logger } from '../logger'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      correlationId?: string
    }
  }
}

export function authMiddleware(authService: AuthService, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader) {
        res.status(401).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing authorization header',
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const parts = authHeader.split(' ')
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid authorization header format. Expected: Bearer <token>',
          instance: req.path,
          correlationId: req.correlationId,
        })
        return
      }

      const token = parts[1]
      
      try {
        const payload = await authService.verifyAccessToken(token)
        req.user = payload
        next()
      } catch (error) {
        logger.warn(
          { error, correlationId: req.correlationId },
          'Invalid or expired access token',
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
    } catch (error) {
      logger.error({ error, correlationId: req.correlationId }, 'Error in auth middleware')
      res.status(500).json({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An error occurred during authentication',
        instance: req.path,
        correlationId: req.correlationId,
      })
    }
  }
}

export function optionalAuthMiddleware(authService: AuthService, logger: Logger) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader) {
        next()
        return
      }

      const parts = authHeader.split(' ')
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        next()
        return
      }

      const token = parts[1]
      
      try {
        const payload = await authService.verifyAccessToken(token)
        req.user = payload
      } catch (error) {
        logger.debug({ error, correlationId: req.correlationId }, 'Invalid token in optional auth')
      }
      
      next()
    } catch (error) {
      logger.error({ error, correlationId: req.correlationId }, 'Error in optional auth middleware')
      next()
    }
  }
}
