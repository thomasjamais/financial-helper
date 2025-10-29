import type { RepoRef } from '../types.js'

export type InteractionDirection = 'user' | 'assistant' | 'system' | 'event'

export type InteractionLoggerOptions = {
  apiUrl?: string
  repoRef: RepoRef
  agentRole: string
  correlationId?: string
}

export class InteractionLogger {
  private apiUrl?: string
  private repoRef: RepoRef
  private agentRole: string
  private correlationId?: string

  constructor(opts: InteractionLoggerOptions) {
    this.apiUrl = opts.apiUrl
    this.repoRef = opts.repoRef
    this.agentRole = opts.agentRole
    this.correlationId = opts.correlationId
  }

  async log(params: {
    direction: InteractionDirection
    content: string
    issueNumber?: number
    prNumber?: number
    metadata?: Record<string, unknown>
    tags?: string[]
    correlationIdOverride?: string
  }): Promise<void> {
    if (!this.apiUrl) return

    const correlationId = params.correlationIdOverride || this.correlationId
    if (!correlationId) return

    try {
      await fetch(`${this.apiUrl.replace(/\/$/, '')}/v1/ai/interactions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId },
        body: JSON.stringify({
          repoOwner: this.repoRef.owner,
          repoName: this.repoRef.repo,
          agentRole: this.agentRole,
          direction: params.direction,
          content: params.content.slice(0, 5000),
          correlationId,
          issueNumber: params.issueNumber,
          prNumber: params.prNumber,
          metadata: params.metadata || {},
          tags: params.tags || [],
        }),
      })
    } catch {
      // Ignore logging failures
    }
  }
}
