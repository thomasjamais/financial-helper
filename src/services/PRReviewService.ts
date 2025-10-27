import { octokit } from '../config.js'
import type { RepoRef } from '../types.js'

export type PRReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

export type PRReviewRequest = {
  decision: PRReviewDecision
  body: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
}

export type PRFile = {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  patch?: string
}

export type PRDetails = {
  number: number
  title: string
  body: string
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
  labels: Array<{ name: string }>
  files: PRFile[]
}

export class PRReviewService {
  constructor(private repoRef: RepoRef) {}

  async getPRDetails(prNumber: number): Promise<PRDetails> {
    const { owner, repo } = this.repoRef
    const prResponse = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    })
    const filesResponse = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    })

    const pr = prResponse.data
    const files = filesResponse.data.map((f: any) => ({
      filename: f.filename,
      status: f.status as PRFile['status'],
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    }))

    return {
      number: pr.number,
      title: pr.title || '',
      body: pr.body || '',
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha,
      },
      base: {
        ref: pr.base.ref,
        sha: pr.base.sha,
      },
      labels: pr.labels?.map((l: any) => ({ name: l.name })) || [],
      files,
    }
  }

  async postReview(prNumber: number, review: PRReviewRequest) {
    const { owner, repo } = this.repoRef
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event: review.event,
      body: review.body,
    })
  }

  async addLabel(prNumber: number, label: string) {
    const { owner, repo } = this.repoRef
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [label],
    })
  }

  async removeLabel(prNumber: number, label: string) {
    const { owner, repo } = this.repoRef
    try {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: prNumber,
        name: label,
      })
    } catch (error) {
      // Label might not exist, ignore
    }
  }

  async comment(prNumber: number, body: string) {
    const { owner, repo } = this.repoRef
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    })
  }
}
