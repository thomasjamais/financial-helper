import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { PolicyService } from '../services/PolicyService.js'
import { TestService } from '../services/TestService.js'
import { PRReviewService } from '../services/PRReviewService.js'
import { GitService } from '../services/GitService.js'
import type { Policy, RepoRef, TestResult } from '../types.js'

const run = async () => {
  const owner = process.env.GH_OWNER || ''
  const repo = process.env.GH_REPO || ''
  const prNumber = parseInt(process.env.PR_NUMBER || '', 10)
  const policyPath =
    process.env.POLICY_PATH || path.resolve(process.cwd(), 'policy.yaml')

  if (!owner || !repo || Number.isNaN(prNumber)) {
    throw new Error('Missing GH_OWNER, GH_REPO, PR_NUMBER')
  }

  const repoRef: RepoRef = { owner, repo }
  const policy = new PolicyService(policyPath).getPolicy()
  const prReview = new PRReviewService(repoRef)
  const git = new GitService()
  const testService = new TestService(policy)

  await git.ensureConfig()

  const prDetails = await prReview.getPRDetails(prNumber)
  const prLabels = prDetails.labels.map((l) => l.name)

  const validationResults = await validatePR(policy, prDetails, prLabels)
  const testResults = await testService.runSuites()
  const overallTestResult = mergeTestResults(testResults)

  const coverageResult = await validateCoverageThreshold(
    policy,
    overallTestResult,
  )

  const allPassed =
    validationResults.every((r) => r.passed) &&
    overallTestResult.success &&
    coverageResult.passed

  const reviewBody = buildReviewBody(
    validationResults,
    testResults,
    coverageResult,
  )

  if (allPassed) {
    await prReview.postReview(prNumber, {
      decision: 'APPROVE',
      body: reviewBody,
      event: 'APPROVE',
    })
    await prReview.removeLabel(prNumber, 'needs-fixes')
  } else {
    await prReview.postReview(prNumber, {
      decision: 'REQUEST_CHANGES',
      body: reviewBody,
      event: 'REQUEST_CHANGES',
    })
    await prReview.addLabel(prNumber, 'needs-fixes')
  }
}

type ValidationResult = {
  rule: string
  passed: boolean
  reason: string
}

const validatePR = async (
  policy: Policy,
  prDetails: any,
  prLabels: string[],
): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = []
  const policyService = new PolicyService()

  // Validate maxChangedFiles
  const fileCount = prDetails.files.length
  const maxFiles = policy.maxChangedFiles
  results.push({
    rule: 'Maximum changed files',
    passed: !maxFiles || fileCount <= maxFiles,
    reason: maxFiles
      ? `${fileCount}/${maxFiles} files changed`
      : 'No limit set',
  })

  // Validate allowed/denied paths
  const pathViolations: string[] = []
  for (const file of prDetails.files) {
    if (!policyService.isPathAllowed(file.filename, prLabels)) {
      pathViolations.push(file.filename)
    }
  }
  results.push({
    rule: 'Path restrictions',
    passed: pathViolations.length === 0,
    reason:
      pathViolations.length === 0
        ? 'All paths allowed'
        : `Denied paths: ${pathViolations.join(', ')}`,
  })

  // Validate denied patterns
  const patternViolations: string[] = []
  for (const file of prDetails.files) {
    if (file.patch && policyService.hasDeniedPatternsInPatch(file.patch)) {
      patternViolations.push(file.filename)
    }
  }
  results.push({
    rule: 'Pattern restrictions',
    passed: patternViolations.length === 0,
    reason:
      patternViolations.length === 0
        ? 'No forbidden patterns detected'
        : `Pattern violations: ${patternViolations.join(', ')}`,
  })

  // Validate README update requirement
  if (policy.require_readme_update_on_api_change) {
    const apiFiles = prDetails.files.filter((f: any) =>
      f.filename.startsWith('apps/api/'),
    )
    const readmeFiles = prDetails.files.filter((f: any) =>
      /(^|\/)README\.md$/i.test(f.filename),
    )

    results.push({
      rule: 'README update on API changes',
      passed: apiFiles.length === 0 || readmeFiles.length > 0,
      reason:
        apiFiles.length === 0
          ? 'No API changes detected'
          : readmeFiles.length > 0
            ? 'README updated with API changes'
            : 'API changed but no README update found',
    })
  }

  return results
}

const validateCoverageThreshold = async (
  policy: Policy,
  testResult: TestResult,
): Promise<ValidationResult> => {
  const threshold = policy.tests?.unit_threshold
  if (!threshold) {
    return {
      rule: 'Coverage threshold',
      passed: true,
      reason: 'No threshold configured',
    }
  }

  const coveragePath = path.join(
    process.cwd(),
    'coverage',
    'coverage-summary.json',
  )
  if (!fs.existsSync(coveragePath)) {
    return {
      rule: 'Coverage threshold',
      passed: false,
      reason: `Coverage file not found at ${coveragePath}`,
    }
  }

  try {
    const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
    const totalCoverage =
      coverageData.total?.lines?.pct || coverageData.total?.statements?.pct || 0

    return {
      rule: 'Coverage threshold',
      passed: totalCoverage >= threshold * 100,
      reason: `${totalCoverage.toFixed(1)}% coverage (threshold: ${(threshold * 100).toFixed(1)}%)`,
    }
  } catch (error) {
    return {
      rule: 'Coverage threshold',
      passed: false,
      reason: `Failed to parse coverage file: ${error}`,
    }
  }
}

const mergeTestResults = (results: TestResult[]): TestResult => {
  const anyFail = results.some((r) => !r.success)
  const exitCode = anyFail ? 1 : 0
  const stdout = results.map((r) => `## ${r.suite}\n${r.stdout}`).join('\n\n')
  const stderr = results.map((r) => `## ${r.suite}\n${r.stderr}`).join('\n\n')
  return { success: !anyFail, exitCode, stdout, stderr, suite: 'all' }
}

const buildReviewBody = (
  validationResults: ValidationResult[],
  testResults: TestResult[],
  coverageResult: ValidationResult,
): string => {
  const statusIcon = (passed: boolean) => (passed ? '✅' : '❌')

  const validationSection = [
    '## Policy Validation',
    '',
    ...validationResults.map(
      (r) => `${statusIcon(r.passed)} **${r.rule}**: ${r.reason}`,
    ),
    '',
    `${statusIcon(coverageResult.passed)} **${coverageResult.rule}**: ${coverageResult.reason}`,
  ].join('\n')

  const testSection = [
    '## Test Results',
    '',
    ...testResults.map(
      (r) =>
        `${statusIcon(r.success)} **${r.suite}**: ${r.exitCode === 0 ? 'PASSED' : 'FAILED'}`,
    ),
  ].join('\n')

  const allPassed =
    validationResults.every((r) => r.passed) &&
    testResults.every((r) => r.success) &&
    coverageResult.passed

  const actionSection = allPassed
    ? '## ✅ All checks passed! This PR is ready for merge.'
    : [
        '## ❌ Some checks failed. Please address the issues above.',
        '',
        'Comment `/ai:fix` to trigger an automated iteration.',
      ].join('\n')

  const testOutputSection =
    testResults.length > 0
      ? [
          '',
          '## Test Output',
          '',
          ...testResults.map((r) =>
            [
              `### ${r.suite}`,
              '```',
              (r.stdout || '').slice(0, 2000),
              '```',
              '',
            ].join('\n'),
          ),
        ].join('\n')
      : ''

  return [
    validationSection,
    '',
    testSection,
    '',
    actionSection,
    testOutputSection,
  ].join('\n')
}

run().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
