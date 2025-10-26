import { octokit } from '../config'
import type { RepoRef, TestResult } from '../types'
import fs from 'node:fs'

export class PRService {
  constructor(private repoRef: RepoRef) {}

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
}
