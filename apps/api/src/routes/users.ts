import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'
import { authMiddleware } from '../middleware/auth'
import { AuthService } from '../services/AuthService'

const UpdateUserSchema = z.object({
  name: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export function usersRouter(db: Kysely<DB>, logger: Logger): Router {
  const router = Router()

  const authService = new AuthService(db, logger, process.env.JWT_SECRET || 'dev', process.env.JWT_REFRESH_SECRET || 'dev')
  router.use(authMiddleware(authService, logger))

  router.get('/v1/users', async (req: Request, res: Response): Promise<void> => {
    const users = await db.selectFrom('users')
      .select(['id', 'email', 'name', 'is_active', 'email_verified', 'created_at', 'updated_at'])
      .orderBy('created_at', 'desc')
      .execute()
    res.json(users)
  })

  router.get('/v1/users/:id', async (req: Request, res: Response): Promise<void> => {
    const user = await db.selectFrom('users')
      .select(['id', 'email', 'name', 'is_active', 'email_verified', 'created_at', 'updated_at'])
      .where('id', '=', req.params.id)
      .executeTakeFirst()
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
  })

  router.patch('/v1/users/:id', async (req: Request, res: Response): Promise<void> => {
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
    const { name, is_active } = validation.data
    const updated = await db.updateTable('users')
      .set({ name: name ?? null, is_active })
      .where('id', '=', req.params.id)
      .returning(['id', 'email', 'name', 'is_active', 'email_verified', 'created_at', 'updated_at'])
      .executeTakeFirst()
    if (!updated) {
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
    res.json(updated)
  })

  router.delete('/v1/users/:id', async (req: Request, res: Response): Promise<void> => {
    await db.deleteFrom('users').where('id', '=', req.params.id).execute()
    res.status(204).send()
  })

  return router
}


