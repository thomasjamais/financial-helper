import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { IssueService } from './services/IssueService.js'
import { GitService } from './services/GitService.js'
import { PolicyService } from './services/PolicyService.js'
import { EditService } from './services/EditService.js'
import { TaskGeneratorService } from './services/TaskGeneratorService.js'
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

  // Clone the repository first
  const repoUrl = `https://x-access-token:${githubToken}@github.com/${context.owner}/${context.repo}.git`
  await git.cloneRepository(repoUrl, defaultBranch)
  await git.ensureConfig()

  const policy = new PolicyService(context.policyPath).getPolicy()

  if (context.mode === 'new-issue') {
    await runNewIssueMode(context, issues, git, policy, repoRef)
  } else if (context.mode === 'plan-only') {
    await runPlanOnlyMode(context, issues, git, policy, repoRef)
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
    const mode =
      process.env.AGENT_MODE === 'plan-only' ? 'plan-only' : 'new-issue'
    return {
      mode,
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
  let branch = `ai/${issueNumber}-${slug}`

  // Check if a PR already exists for this issue
  const prService = new PRService(repoRef)
  const existingPRs = await prService.findPRsForIssue(issueNumber!)

  if (existingPRs.length > 0) {
    // Create V2 branch if PR already exists
    const version = existingPRs.length + 1
    branch = `ai/${issueNumber}-${slug}-v${version}`
    console.log(
      `PR already exists for issue #${issueNumber}, creating V${version} branch: ${branch}`,
    )
  }

  await git.createBranch(branch)

  const planPath = path.join(process.cwd(), 'plan.md')
  const planCtx: PlanContext = {
    issueNumber: issueNumber!,
    issueTitle: issue.title || '',
    issueBody: issue.body || '',
    branch,
    iterationNumber:
      existingPRs.length > 0 ? existingPRs.length + 1 : undefined,
  }
  fs.writeFileSync(planPath, renderPlan(planCtx), 'utf8')

  const editor = new EditService(policy as any)
  
  // Try free-edit mode first (generate tasks from spec)
  const taskGenerator = new TaskGeneratorService()
  const specContext = {
    issueTitle: issue.title || '',
    issueBody: issue.body || '',
    specContent: fs.readFileSync(planPath, 'utf8')
  }
  
  const tasks = taskGenerator.generateTasksFromSpec(specContext)
  console.log(`Generated ${tasks.length} tasks from spec`)
  
  let appliedEdits = 0
  if (tasks.length > 0) {
    // Free-edit mode: Apply tasks generated from spec
    appliedEdits = editor.applyTasks(tasks, process.cwd())
    console.log(`Applied ${appliedEdits} tasks in free-edit mode`)
  } else {
    // Fallback to legacy mode: Apply static edits from policy
    appliedEdits = editor.applyEditsInRepo(process.cwd())
    console.log(`Applied ${appliedEdits} edits in legacy mode`)
  }

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
    title: `AI: ${issue.title || `Issue #${issueNumber}`}${existingPRs.length > 0 ? ` (V${existingPRs.length + 1})` : ''}`,
    issueNumber: issueNumber!,
    testResult: overall,
    planPath,
  })

  await issues.comment(
    issueNumber!,
    `Plan and edits pushed to \`${branch}\`. PR opened: ${prUrl}`,
  )
}

const runPlanOnlyMode = async (
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

  await issues.claimIssue(issueNumber!, assignee, ['planning'])

  const slug = toSlug(issue.title || `issue-${issueNumber}`)
  const branch = `plan/${issueNumber}-${slug}`

  await git.createBranch(branch)

  const planPath = path.join(process.cwd(), 'plan.md')
  const planCtx: PlanContext = {
    issueNumber: issueNumber!,
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
    issueNumber: issueNumber!,
    planPath,
  })

  await issues.comment(
    issueNumber!,
    `📋 Plan created and pushed to \`${branch}\`. Plan PR opened: ${prUrl}\n\nPlease review the plan and approve to proceed with implementation.`,
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
  const versionSuffix = ctx.iterationNumber ? ` (V${ctx.iterationNumber})` : ''

  // Generate a proper plan based on the issue content
  const planSteps = generatePlanSteps(ctx.issueTitle, ctx.issueBody)

  const lines = [
    `# Plan for #${ctx.issueNumber}: ${ctx.issueTitle}${versionSuffix}`,
    '',
    '## Issue Summary',
    ctx.issueBody || '(no description provided)',
    '',
    '## Implementation Plan',
    ...planSteps.map((step) => `- ${step}`),
    '',
    '## Technical Steps',
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
    '- Implementation matches the requirements in the issue',
  ]
  return lines.join('\n')
}

const generatePlanSteps = (title: string, body: string): string[] => {
  const content = `${title}\n${body}`.toLowerCase()
  const steps: string[] = []

  // Analyze the issue content to generate relevant steps
  if (content.includes('api') || content.includes('endpoint')) {
    steps.push('Implement API endpoint with proper validation using Zod')
    steps.push('Add comprehensive error handling and status codes')
    steps.push('Update API documentation if required')
  }

  if (
    content.includes('database') ||
    content.includes('db') ||
    content.includes('migration')
  ) {
    steps.push('Create database migration if schema changes needed')
    steps.push('Update database models and types')
    steps.push('Add proper database error handling')
  }

  if (content.includes('test') || content.includes('testing')) {
    steps.push('Write unit tests for new functionality')
    steps.push('Add integration tests for API endpoints')
    steps.push('Ensure test coverage meets policy requirements')
  }

  if (
    content.includes('ui') ||
    content.includes('frontend') ||
    content.includes('component')
  ) {
    steps.push('Implement UI components with proper TypeScript types')
    steps.push('Add responsive design considerations')
    steps.push('Include accessibility features where applicable')
  }

  if (
    content.includes('security') ||
    content.includes('auth') ||
    content.includes('permission')
  ) {
    steps.push('Implement proper authentication and authorization')
    steps.push('Add input validation and sanitization')
    steps.push('Ensure secure data handling practices')
  }

  if (content.includes('performance') || content.includes('optimization')) {
    steps.push('Implement performance optimizations')
    steps.push('Add caching mechanisms where appropriate')
    steps.push('Monitor and measure performance improvements')
  }

  if (
    content.includes('bug') ||
    content.includes('fix') ||
    content.includes('error')
  ) {
    steps.push('Identify root cause of the issue')
    steps.push('Implement targeted fix with minimal impact')
    steps.push('Add regression tests to prevent future occurrences')
  }

  if (
    content.includes('feature') ||
    content.includes('new') ||
    content.includes('add')
  ) {
    steps.push('Design feature architecture following domain-driven principles')
    steps.push('Implement feature with proper separation of concerns')
    steps.push('Add comprehensive documentation and examples')
  }

  // Default steps if no specific patterns are detected
  if (steps.length === 0) {
    steps.push('Analyze requirements and design solution architecture')
    steps.push('Implement core functionality with proper error handling')
    steps.push('Add appropriate tests and documentation')
    steps.push('Ensure compliance with project policies and standards')
  }

  return steps
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
