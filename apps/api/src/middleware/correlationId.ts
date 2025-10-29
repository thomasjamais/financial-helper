import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import type { Logger } from '../logger'

declare global {
  namespace Express {
    interface Request {
      correlationId?: string
      logger?: Logger
    }
  }
}

export function correlationIdMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID()
    req.correlationId = correlationId
    res.setHeader('x-correlation-id', correlationId)

    req.logger = logger.child({
      correlationId,
      method: req.method,
      path: req.path,
    })

    next()
  }
}
