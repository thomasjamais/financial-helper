import type { Kysely } from 'kysely'
import type { DB } from '@pkg/db'
import type { Logger } from '../logger'

export type UpdateUserInput = {
  name?: string | null
  is_active?: boolean
}

export class UsersService {
  constructor(
    private db: Kysely<DB>,
    private logger: Logger,
  ) {}

  async list(): Promise<Array<{
    id: string
    email: string
    name: string | null
    is_active: boolean
    email_verified: boolean
    created_at: Date
    updated_at: Date
  }>> {
    return await this.db
      .selectFrom('users')
      .select([
        'id',
        'email',
        'name',
        'is_active',
        'email_verified',
        'created_at',
        'updated_at',
      ])
      .orderBy('created_at', 'desc')
      .execute()
  }

  async findById(id: string): Promise<{
    id: string
    email: string
    name: string | null
    is_active: boolean
    email_verified: boolean
    created_at: Date
    updated_at: Date
  } | null> {
    return await this.db
      .selectFrom('users')
      .select([
        'id',
        'email',
        'name',
        'is_active',
        'email_verified',
        'created_at',
        'updated_at',
      ])
      .where('id', '=', id)
      .executeTakeFirst() || null
  }

  async update(
    id: string,
    input: UpdateUserInput,
    correlationId?: string,
  ): Promise<void> {
    const log = this.logger.child({ correlationId, userId: id })
    
    await this.db
      .updateTable('users')
      .set({
        name: input.name,
        is_active: input.is_active,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()

    log.info({ update: input }, 'User updated')
  }

  async delete(id: string, correlationId?: string): Promise<void> {
    const log = this.logger.child({ correlationId, userId: id })
    
    await this.db
      .deleteFrom('users')
      .where('id', '=', id)
      .execute()

    log.info('User deleted')
  }
}

