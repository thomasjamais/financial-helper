import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import { AuthService } from '../services/AuthService'
import { UsersService } from '../services/UsersService'

const UpdateUserSchema = z.object({
  name: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export function usersRouter(db: Kysely<DB>, logger: Logger): Router {
  const router = Router()
  const usersService = new UsersService(db, logger)

  const authService = new AuthService(
    db,
    logger,
    process.env.JWT_SECRET || 'dev',
    process.env.JWT_REFRESH_SECRET || 'dev',
  )
  router.use(authMiddleware(authService, logger))

  router.get('/v1/users', async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await usersService.list()
      res.json(users)
    } catch (err) {
      res.status(500).json({ error: 'Failed to list users' })
    }
  })

  router.get(
    '/v1/users/:id',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = await usersService.findById(req.params.id)
        if (!user) {
          res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
          return
        }
        res.json(user)
      } catch (err) {
        res.status(500).json({ error: 'Failed to load user' })
      }
    },
  )

  router.patch(
    '/v1/users/:id',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const validation = UpdateUserSchema.safeParse(req.body)
        if (!validation.success) {
          res.status(400).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.1',
            title: 'Bad Request',
            status: 400,
            detail: 'Validation failed',
            errors: validation.error.errors,
            instance: req.path,
            correlationId: req.correlationId,
          })
          return
        }

        const user = await usersService.findById(req.params.id)
        if (!user) {
          res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
          return
        }

        await usersService.update(
          req.params.id,
          validation.data,
          req.correlationId,
        )
        const updated = await usersService.findById(req.params.id)
        res.json(updated)
      } catch (err) {
        res.status(500).json({ error: 'Failed to update user' })
      }
    },
  )

  router.delete(
    '/v1/users/:id',
    async (req: Request, res: Response): Promise<void> => {
      try {
        const user = await usersService.findById(req.params.id)
        if (!user) {
          res.status(404).json({
            type: 'https://datatracker.ietf.org/doc/html/rfc7231#section-6.5.4',
            title: 'Not Found',
            status: 404,
            detail: 'User not found',
            instance: req.path,
            correlationId: req.correlationId,
          })
          return
        }

        await usersService.delete(req.params.id, req.correlationId)
        res.status(204).send()
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' })
      }
    },
  )

  return router
}
