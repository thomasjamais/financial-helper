import { Kysely, sql } from 'kysely'

export type InteractionDirection = 'user' | 'assistant' | 'system' | 'event'

export type CreateInteractionInput = {
  repoOwner: string
  repoName: string
  agentRole: string
  direction: InteractionDirection
  correlationId: string
  content: string
  issueNumber?: number
  prNumber?: number
  metadata?: Record<string, unknown>
  tags?: string[]
}

export type InteractionRecord = CreateInteractionInput & {
  id: string
  createdAt: Date
}

export async function createInteraction(
  db: Kysely<unknown>,
  input: CreateInteractionInput,
): Promise<InteractionRecord> {
  const row = await sql<{
    id: string
    created_at: Date
    repo_owner: string
    repo_name: string
    agent_role: string
    direction: string
    correlation_id: string
    issue_number: number | null
    pr_number: number | null
    content: string
    metadata: unknown
    tags: string[]
  }>`
    insert into ai_interactions (
      repo_owner, repo_name, agent_role, direction, correlation_id,
      issue_number, pr_number, content, metadata, tags
    ) values (
      ${input.repoOwner}, ${input.repoName}, ${input.agentRole}, ${input.direction}, ${input.correlationId},
      ${input.issueNumber ?? null}, ${input.prNumber ?? null}, ${input.content}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${sql.raw("array[" + (input.tags ?? []).map((t) => `'${t.replace(/'/g, "''")}'`).join(',') + "]::text[]")}
    )
    returning *
  `.execute(db)

  const r = row.rows[0]
  return {
    id: r.id,
    createdAt: r.created_at,
    repoOwner: r.repo_owner,
    repoName: r.repo_name,
    agentRole: r.agent_role,
    direction: r.direction as InteractionDirection,
    correlationId: r.correlation_id,
    issueNumber: r.issue_number ?? undefined,
    prNumber: r.pr_number ?? undefined,
    content: r.content,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    tags: r.tags ?? [],
  }
}

export async function listInteractionsByCorrelationId(
  db: Kysely<unknown>,
  correlationId: string,
  limit: number = 200,
): Promise<InteractionRecord[]> {
  const safeLimit = Math.max(1, Math.min(1000, limit))
  const rows = await sql<{
    id: string
    created_at: Date
    repo_owner: string
    repo_name: string
    agent_role: string
    direction: string
    correlation_id: string
    issue_number: number | null
    pr_number: number | null
    content: string
    metadata: unknown
    tags: string[]
  }>`
    select *
    from ai_interactions
    where correlation_id = ${correlationId}
    order by created_at desc
    limit ${safeLimit}
  `.execute(db)

  return rows.rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    repoOwner: r.repo_owner,
    repoName: r.repo_name,
    agentRole: r.agent_role,
    direction: r.direction as InteractionDirection,
    correlationId: r.correlation_id,
    issueNumber: r.issue_number ?? undefined,
    prNumber: r.pr_number ?? undefined,
    content: r.content,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    tags: r.tags ?? [],
  }))
}
