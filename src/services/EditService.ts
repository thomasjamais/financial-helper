import fs from 'node:fs'
import path from 'node:path'
import micromatch from 'micromatch'
import type { Policy } from '../types.js'

export class EditService {
  constructor(private policy: Policy) {}

  applyEditsInRepo(repoRoot = process.cwd()) {
    const edits = this.policy.edits || []
    let applied = 0
    for (const rule of edits) {
      const targetFiles = this.scan(repoRoot, rule.glob)
      for (const f of targetFiles) {
        if (!this.isAllowed(f)) continue
        const content = fs.readFileSync(f, 'utf8')
        const updated = this.transform(content, rule)
        if (updated !== content) {
          fs.writeFileSync(f, updated, 'utf8')
          applied += 1
          if (rule.once) break
        }
      }
    }
    return applied
  }

  private isAllowed(filePath: string) {
    const allowPaths = this.policy.allow?.paths || ['**/*']
    const denyPaths = this.policy.deny?.paths || []
    return (
      micromatch.isMatch(filePath, allowPaths) &&
      !micromatch.isMatch(filePath, denyPaths)
    )
  }

  private scan(root: string, globPattern: string) {
    const walk = (dir: string, acc: string[]) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(p, acc)
        else acc.push(p)
      }
      return acc
    }
    const files = walk(root, []).map((p: string) => path.relative(root, p))
    return micromatch(files, globPattern).map((p: string) => path.join(root, p))
  }

  private transform(input: string, rule: NonNullable<Policy['edits']>[number]) {
    if (rule.strategy === 'append')
      return input.endsWith('\n')
        ? input + (rule.replace || '')
        : input + '\n' + (rule.replace || '')
    if (rule.strategy === 'prepend') return (rule.replace || '') + input
    if (rule.strategy === 'replace') return rule.replace || input
    if (rule.strategy === 'regex-replace') {
      const flags = rule.regexFlags || 'gm'
      const re = new RegExp(rule.search || '', flags)
      return input.replace(re, rule.replace || '')
    }
    return input
  }
}
