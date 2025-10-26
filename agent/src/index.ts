import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { IssueService } from './services/IssueService.js'
import { GitService } from './services/GitService.js'
import { PolicyService } from './services/PolicyService.js'
import { EditService } from './services/EditService.js'
import { TestService } from './services/TestService.js'
import { PRService } from './services/PRService.js'
import { PRReviewService } from './services/PRReviewService.js'
import { defaultBranch, githubToken } from './config.js'
import { toSlug } from './utils/slug.js'
import type {
  RepoRef,
  PlanContext,
  Policy,
  AgentContext,
  AgentMode,
} from './types'

const run = async () => {
  if (!githubToken) throw new Error('Missing GITHUB_TOKEN')

  const context = parseAgentContext()
  const repoRef: RepoRef = { owner: context.owner, repo: context.repo }

  const issues = new IssueService(repoRef)
  const git = new GitService()
  const prReview = new PRReviewService(repoRef)
  await git.ensureConfig()

  const policy = new PolicyService(context.policyPath).getPolicy()

  if (context.mode === 'new-issue') {
    await runNewIssueMode(context, issues, git, policy, repoRef)
  } else {
    await runFixMode(context, issues, git, policy, repoRef, prReview)
  }
}

const parseAgentContext = (): AgentContext => {
  const owner = process.env.GH_OWNER || ''
  const repo = process.env.GH_REPO || ''
  const assignee = process.env.ASSIGNEE || 'ai-bot'
  const policyPath =
    process.env.POLICY_PATH || path.resolve(process.cwd(), 'policy.yaml')

  const issueNumber = process.env.ISSUE_NUMBER
    ? parseInt(process.env.ISSUE_NUMBER, 10)
    : undefined
  const prNumber = process.env.PR_NUMBER
    ? parseInt(process.env.PR_NUMBER, 10)
    : undefined
  const branch = process.env.BRANCH

  if (!owner || !repo) {
    throw new Error('Missing GH_OWNER, GH_REPO')
  }

  if (issueNumber && !Number.isNaN(issueNumber)) {
    return {
      mode: 'new-issue',
      issueNumber,
      owner,
      repo,
      assignee,
      policyPath,
    }
  } else if (prNumber && !Number.isNaN(prNumber) && branch) {
    return {
      mode: 'fix-iteration',
      prNumber,
      branch,
      owner,
      repo,
      assignee,
      policyPath,
    }
  } else {
    throw new Error(
      'Must provide either ISSUE_NUMBER or both PR_NUMBER and BRANCH',
    )
  }
}

const runNewIssueMode = async (
  context: AgentContext,
  issues: IssueService,
  git: GitService,
  policy: Policy,
  repoRef: RepoRef,
) => {
  const { issueNumber, assignee } = context

  const issue = await issues.readIssue(issueNumber!)
  const issueLabels = (issue.labels || []).map((l: any) =>
    typeof l === 'string' ? l : l.name,
  ) as string[]

  await issues.claimIssue(issueNumber!, assignee, ['in-progress'])

  const slug = toSlug(issue.title || `issue-${issueNumber}`)
  const branch = `ai/${issueNumber}-${slug}`
  await git.createBranch(branch)

  const planPath = path.join(process.cwd(), 'plan.md')
  const planCtx: PlanContext = {
    issueNumber: issueNumber!,
    issueTitle: issue.title || '',
    issueBody: issue.body || '',
    branch,
  }
  fs.writeFileSync(planPath, renderPlan(planCtx), 'utf8')

  const editor = new EditService(policy as any)
  const appliedEdits = editor.applyEditsInRepo(process.cwd())

  await preflightEnforce(policy, git, issueLabels)

  const committed = await git.addAllAndCommit(
    `chore(ai): plan and edits for #${issueNumber} (${appliedEdits} files)`,
  )
  if (committed) await git.pushBranch(branch)

  const testsSvc = new TestService(policy)
  const suiteResults = await testsSvc.runSuites()
  const overall = mergeResults(suiteResults)

  await enforcePostTest(policy, git)

  if (committed) await git.pushBranch(branch)

  const pr = new PRService(repoRef)
  const prUrl = await pr.openPR({
    branch,
    base: defaultBranch,
    title: `AI: ${issue.title || `Issue #${issueNumber}`}`,
    issueNumber: issueNumber!,
    testResult: overall,
    planPath,
  })

  await issues.comment(
    issueNumber!,
    `Plan and edits pushed to \`${branch}\`. PR opened: ${prUrl}`,
  )
}

const runFixMode = async (
  context: AgentContext,
  issues: IssueService,
  git: GitService,
  policy: Policy,
  repoRef: RepoRef,
  prReview: PRReviewService,
) => {
  const { prNumber, branch } = context

  const prDetails = await prReview.getPRDetails(prNumber!)
  const prLabels = prDetails.labels.map((l) => l.name)

  await git.checkoutBranch(branch!)

  const planPath = path.join(process.cwd(), 'plan.md')
  const iterationNumber = await getNextIterationNumber(planPath)

  const planCtx: PlanContext = {
    issueNumber: extractIssueNumberFromPR(prDetails),
    issueTitle: prDetails.title,
    issueBody: prDetails.body,
    branch: branch!,
    iterationNumber,
  }

  const iterationPlan = renderFixIterationPlan(planCtx)
  appendToPlan(planPath, iterationPlan)

  const editor = new EditService(policy as any)
  const appliedEdits = editor.applyEditsInRepo(process.cwd())

  await preflightEnforce(policy, git, prLabels)

  const committed = await git.addAllAndCommit(
    `chore(ai): fix iteration ${iterationNumber} for PR #${prNumber} (${appliedEdits} files)`,
  )
  if (committed) await git.pushBranch(branch!)

  const testsSvc = new TestService(policy)
  const suiteResults = await testsSvc.runSuites()
  const overall = mergeResults(suiteResults)

  await enforcePostTest(policy, git)

  if (committed) await git.pushBranch(branch!)

  const testStatus = overall.success ? '✅ Tests passed' : '❌ Tests failed'
  const testOutput = formatTestOutput(overall)

  await prReview.comment(
    prNumber!,
    `## Fix Iteration ${iterationNumber}\n\n${testStatus}\n\n${testOutput}\n\nComment \`/ai:fix\` to trigger another iteration.`,
  )

  if (overall.success) {
    await prReview.removeLabel(prNumber!, 'needs-fixes')
  } else {
    await prReview.addLabel(prNumber!, 'needs-fixes')
  }
}

const getNextIterationNumber = async (planPath: string): Promise<number> => {
  if (!fs.existsSync(planPath)) return 1

  const content = fs.readFileSync(planPath, 'utf8')
  const matches = content.match(/## Fix iteration (\d+)/gi)
  return matches ? matches.length + 1 : 1
}

const extractIssueNumberFromPR = (prDetails: any): number => {
  const body = prDetails.body || ''
  const match = body.match(/Closes #(\d+)/)
  return match ? parseInt(match[1], 10) : prDetails.number
}

const appendToPlan = (planPath: string, content: string) => {
  const existing = fs.existsSync(planPath)
    ? fs.readFileSync(planPath, 'utf8')
    : ''
  fs.writeFileSync(planPath, existing + '\n\n' + content, 'utf8')
}

const formatTestOutput = (result: any): string => {
  const fenced = (s: string) => '```\n' + (s || '').slice(0, 2000) + '\n```'
  return [
    `Exit: ${result.exitCode}`,
    '',
    `### Stdout`,
    fenced(result.stdout),
    '',
    `### Stderr`,
    fenced(result.stderr),
  ].join('\n')
}

const preflightEnforce = async (
  policy: Policy,
  git: GitService,
  issueLabels: string[],
) => {
  const changed = await git.getChangedFilesAgainstBase()
  if (policy.maxChangedFiles && changed.length > policy.maxChangedFiles) {
    throw new Error(
      `Changed files ${changed.length} exceed policy limit ${policy.maxChangedFiles}`,
    )
  }
  const psvc = new PolicyService()
  for (const f of changed) {
    if (!psvc.isPathAllowed(f, issueLabels))
      throw new Error(`Path not allowed by policy: ${f}`)
    const patch = await git.getPatchForFile(f)
    if (psvc.hasDeniedPatternsInPatch(patch))
      throw new Error(`Denied pattern detected in: ${f}`)
  }
}

const enforcePostTest = async (policy: Policy, git: GitService) => {
  if (!policy.require_readme_update_on_api_change) return
  const files = await git.getChangedFilesWithStatus()
  const apiTouched = files.some((x: any) => x.file.startsWith('apps/api/'))
  if (apiTouched) {
    const readmeChanged = files.some((x: any) =>
      /(^|\/)README\.md$/i.test(x.file),
    )
    if (!readmeChanged)
      throw new Error('API changed but no README.md updated, per policy')
  }
}

const mergeResults = (
  results: import('./types').TestResult[],
): import('./types').TestResult => {
  const anyFail = results.some((r) => !r.success)
  const exitCode = anyFail ? 1 : 0
  const stdout = results.map((r) => `## ${r.suite}\n${r.stdout}`).join('\n\n')
  const stderr = results.map((r) => `## ${r.suite}\n${r.stderr}`).join('\n\n')
  return { success: !anyFail, exitCode, stdout, stderr, suite: 'all' }
}

const renderPlan = (ctx: PlanContext) => {
  const lines = [
    `# Plan for #${ctx.issueNumber}: ${ctx.issueTitle}`,
    '',
    '## Context',
    ctx.issueBody || '(no body)',
    '',
    '## Steps',
    '- Claim the issue and set status to in-progress',
    `- Create branch \`${ctx.branch}\``,
    '- Apply constrained edits according to policy.yaml',
    '- Run all policy-defined test suites',
    '- Open PR linking this plan and attaching suite outputs',
    '',
    '## Acceptance Criteria',
    '- All edits are within allowed paths and deny rules',
    '- All policy test suites are successful',
    '- PR links back to the issue and includes outputs',
  ]
  return lines.join('\n')
}

const renderFixIterationPlan = (ctx: PlanContext) => {
  const lines = [
    `## Fix iteration ${ctx.iterationNumber}`,
    '',
    '### Changes',
    '- Apply additional constrained edits according to policy.yaml',
    '- Run all policy-defined test suites',
    '- Push changes to existing branch',
    '',
    '### Validation',
    '- All edits are within allowed paths and deny rules',
    '- All policy test suites are successful',
    '- Changes address previous review feedback',
  ]
  return lines.join('\n')
}

run().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
