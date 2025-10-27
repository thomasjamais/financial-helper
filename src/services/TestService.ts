import { execa } from 'execa'
import type { Policy, TestResult } from '../types.js'

const runWithTimeout = async (
  cmd: string,
  env: Record<string, string>,
  timeoutSec: number,
) => {
  const p = execa(cmd, { shell: true, env, stdio: 'pipe' })
  const t = setTimeout(() => p.kill('SIGTERM'), timeoutSec * 1000)
  try {
    const { stdout, stderr, exitCode } = await p
    return { stdout, stderr, exitCode }
  } finally {
    clearTimeout(t)
  }
}

export class TestService {
  constructor(private policy: Policy) {}

  async runSuites(): Promise<TestResult[]> {
    const suites = this.policy.tests?.suites || []
    const envOverrides = this.policy.guards?.env_overrides || {}
    const env = { ...process.env, ...envOverrides } as Record<string, string>
    const results: TestResult[] = []
    for (const s of suites) {
      const r = await runWithTimeout(s.cmd, env, s.timeout || 300)
      results.push({
        success: r.exitCode === 0,
        exitCode: r.exitCode || 0,
        stdout: r.stdout,
        stderr: r.stderr,
        suite: s.name,
      })
    }
    return results
  }
}
