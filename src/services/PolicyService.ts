import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import micromatch from 'micromatch'
import type { Policy } from '../types.js'

export class PolicyService {
  private policyPath: string
  private policy: Policy

  constructor(
    policyPath = process.env.POLICY_PATH ||
      path.resolve(process.cwd(), 'policy.yaml'),
  ) {
    this.policyPath = policyPath
    this.policy = this.loadPolicy()
  }

  private loadPolicy(): Policy {
    const raw = fs.readFileSync(this.policyPath, 'utf8')
    const parsed = yaml.load(raw) as any
    return parsed.agent || parsed
  }

  getPolicy() {
    return this.policy
  }

  isPathAllowed(filePath: string, issueLabels: string[] = []) {
    const allowPaths = this.policy.allow?.paths || ['**/*']
    const denyPaths = this.policy.deny?.paths || []
    const matchesAllow = micromatch.isMatch(filePath, allowPaths)
    let matchesDeny = micromatch.isMatch(filePath, denyPaths)

    if (matchesDeny && filePath.startsWith('.github/workflows/')) {
      const label = this.policy.allow?.ci_changes_label
      if (
        label &&
        issueLabels.map((s) => s.toLowerCase()).includes(label.toLowerCase())
      ) {
        matchesDeny = false
      }
    }
    return matchesAllow && !matchesDeny
  }

  ciLabel() {
    return this.policy.allow?.ci_changes_label
  }

  hasDeniedPatternsInPatch(patch: string) {
    const patterns = this.policy.deny?.patterns || []
    for (const p of patterns) {
      const re = new RegExp(p, 'm')
      if (re.test(patch)) return true
    }
    return false
  }
}
