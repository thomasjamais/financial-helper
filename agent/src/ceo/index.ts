import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { IssueService } from '../services/IssueService.js'
import { GitService } from '../services/GitService.js'
import { PolicyService } from '../services/PolicyService.js'
import { PRService } from '../services/PRService.js'
import { defaultBranch } from '../config.js'
import { toSlug } from '../utils/slug.js'
import type { PlanContext, Policy, RepoRef } from '../types.js'
import { InteractionLogger } from '../services/InteractionLogger.js'

const run = async () => {
  const owner = process.env.GH_OWNER || ''
  const repo = process.env.GH_REPO || ''
  const issueNumber = process.env.ISSUE_NUMBER
    ? parseInt(process.env.ISSUE_NUMBER, 10)
    : NaN
  const policyPath = process.env.POLICY_PATH || path.resolve(process.cwd(), 'policy.yaml')

  if (!owner || !repo || Number.isNaN(issueNumber)) {
    throw new Error('Missing GH_OWNER, GH_REPO, ISSUE_NUMBER')
  }

  const repoRef: RepoRef = { owner, repo }
  const ilog = new InteractionLogger({
    apiUrl: process.env.AGENT_LOG_API_URL,
    repoRef,
    agentRole: 'ceo',
    correlationId: process.env.CORRELATION_ID || String(issueNumber),
  })

  await ilog.log({ direction: 'system', content: 'CEO agent start', issueNumber })

  const issues = new IssueService(repoRef)
  const git = new GitService()
  const policy: Policy = new PolicyService(policyPath).getPolicy()

  const issue = await issues.readIssue(issueNumber)
  await issues.claimIssue(issueNumber, process.env.ASSIGNEE || 'ai-bot', ['planning'])

  const slug = toSlug(issue.title || `issue-${issueNumber}`)
  const branch = `plan/${issueNumber}-${slug}`

  await git.createBranch(branch)

  const planPath = path.join(process.cwd(), 'plan.md')
  const planCtx: PlanContext = {
    issueNumber,
    issueTitle: issue.title || '',
    issueBody: issue.body || '',
    branch,
  }
  fs.writeFileSync(planPath, renderPlan(planCtx), 'utf8')

  const committed = await git.addAllAndCommit(
    `chore(ai): plan for #${issueNumber}`,
  )
  if (committed) await git.pushBranch(branch)

  const pr = new PRService(repoRef)
  const prUrl = await pr.openPlanPR({
    branch,
    base: defaultBranch,
    title: `📋 Plan: ${issue.title || `Issue #${issueNumber}`}`,
    issueNumber,
    planPath,
  })

  await issues.comment(
    issueNumber,
    [
      `📋 CEO: Plan PR opened at ${prUrl}.`,
      '',
      'Next steps:',
      '- Product agent will review the plan and set labels',
      '- After approval (`spec-approved`), Programmer agent will implement',
      '',
      'To auto-implement now, comment: `/ai:implement` (requires automation hooks)'
    ].join('\n')
  )

  await ilog.log({ direction: 'event', content: `Opened plan PR: ${prUrl}`, issueNumber })
  await ilog.log({ direction: 'system', content: 'CEO agent finished', issueNumber })
}

const renderPlan = (ctx: PlanContext) => {
  const lines = [
    `# Plan for #${ctx.issueNumber}: ${ctx.issueTitle}`,
    '',
    '## Issue Summary',
    ctx.issueBody || '(no description provided)',
    '',
    '## Implementation Plan',
    '- Validate inputs and constraints',
    '- Implement changes within allowed paths',
    '- Add tests and run policy suites',
    '',
    '## Technical Steps',
    `- Create branch \`${ctx.branch}\``,
    '- Apply constrained edits according to policy.yaml',
    '- Run all policy-defined test suites',
    '- Open PR linking this plan and attaching suite outputs',
  ]
  return lines.join('\n')
}

run().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
