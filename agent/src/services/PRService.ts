import { octokit } from '../config.js'
import type { RepoRef, TestResult } from '../types.js'
import fs from 'node:fs'

export class PRService {
  constructor(private repoRef: RepoRef) {}

  async findPRsForIssue(issueNumber: number) {
    const { owner, repo } = this.repoRef
    const response = await octokit.pulls.list({
      owner,
      repo,
      state: 'all', // Include open, closed, and merged PRs
    })

    // Filter PRs that reference this issue
    return response.data.filter((pr) => {
      const body = pr.body || ''
      return (
        body.includes(`Closes #${issueNumber}`) ||
        body.includes(`Fixes #${issueNumber}`) ||
        body.includes(`Resolves #${issueNumber}`)
      )
    })
  }

  async openPR(params: {
    branch: string
    base: string
    title: string
    issueNumber: number
    testResult: TestResult
    planPath: string
  }) {
    const { owner, repo } = this.repoRef
    const plan = fs.readFileSync(params.planPath, 'utf8')
    const body = this.buildBody(
      params.title,
      params.issueNumber,
      params.testResult,
      plan,
    )
    const r = await octokit.pulls.create({
      owner,
      repo,
      head: params.branch,
      base: params.base,
      title: params.title,
      body,
      draft: false,
    })
    const pr = r.data
    await octokit.issues.update({
      owner,
      repo,
      issue_number: params.issueNumber,
      state: 'open',
    })
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: params.issueNumber,
      body: `Opened PR #${pr.number}.`,
    })
    return pr.html_url
  }

  async openPlanPR(params: {
    branch: string
    base: string
    title: string
    issueNumber: number
    planPath: string
  }) {
    const { owner, repo } = this.repoRef
    const plan = fs.readFileSync(params.planPath, 'utf8')
    const body = this.buildPlanBody(params.title, params.issueNumber, plan)

    const r = await octokit.pulls.create({
      owner,
      repo,
      head: params.branch,
      base: params.base,
      title: params.title,
      body,
      draft: false,
    })
    const pr = r.data

    // Add spec-review label (keep legacy plan-review for backward compatibility)
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: ['spec-review', 'plan-review'],
    })

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: params.issueNumber,
      body: `📋 Technical Spec PR #${pr.number} opened for review.`,
    })

    return pr.html_url
  }

  private buildBody(
    title: string,
    issueNumber: number,
    testResult: TestResult,
    plan: string,
  ) {
    const status = testResult.success ? '✅ Tests passed' : '❌ Tests failed'
    const fenced = (s: string) => '```\n' + (s || '').slice(0, 4000) + '\n```'
    return [
      `Closes #${issueNumber}`,
      '',
      `## Status`,
      status,
      '',
      `## Plan`,
      plan,
      '',
      `## Test Output`,
      `Exit: ${testResult.exitCode}`,
      '',
      `### Stdout`,
      fenced(testResult.stdout),
      '',
      `### Stderr`,
      fenced(testResult.stderr),
    ].join('\n')
  }

  private buildPlanBody(title: string, issueNumber: number, plan: string) {
    return [
      `Closes #${issueNumber}`,
      '',
      `## 📋 Technical Specification`,
      '',
      'This PR contains the technical specification derived from the issue. Please review and approve to proceed to implementation.',
      '',
      plan,
      '',
      `## ✅ Next Steps`,
      '',
      '1. **Review the spec** - Ensure the implementation approach is correct',
      '2. **Approve the spec** - Add `spec-approved` (legacy: `plan-approved`) to proceed',
      '3. **Implementation** - The programmer agent will create the implementation PR',
      '',
      `## 🏷️ Labels`,
      '',
      '- `spec-review` (legacy: `plan-review`) - Spec review only',
      '- `spec-approved` (legacy: `plan-approved`) - Spec approved and ready for implementation',
    ].join('\n')
  }
}
