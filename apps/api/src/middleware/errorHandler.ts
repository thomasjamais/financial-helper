import { Request, Response, NextFunction } from 'express'
import type { Logger } from '../logger'

export function errorHandler(logger: Logger) {
  return (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const correlationId = req.correlationId || 'unknown'
    const log = logger.child({ correlationId })

    log.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          name: err.name,
        },
        method: req.method,
        path: req.path,
      },
      'Request error',
    )

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        correlationId,
      })
    }
  }
}
