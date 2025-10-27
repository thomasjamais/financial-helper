import fs from 'node:fs'
import path from 'node:path'
import micromatch from 'micromatch'
import type { Policy } from '../types.js'

export class EditService {
  constructor(private policy: Policy) {}

  applyEditsInRepo(repoRoot = process.cwd()) {
    const edits = this.policy.edits || []
    console.log(`EditService: Found ${edits.length} edit rules`)
    console.log(`EditService: Working directory: ${repoRoot}`)
    let applied = 0
    for (const rule of edits) {
      console.log(
        `EditService: Processing rule for ${rule.glob} with strategy ${rule.strategy}`,
      )
      // For replace strategy, create the file if it doesn't exist
      if (rule.strategy === 'replace') {
        const targetFile = path.join(repoRoot, rule.glob)
        if (!this.isAllowed(targetFile)) continue

        // Ensure directory exists
        const dir = path.dirname(targetFile)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        // Create the file with the replacement content
        console.log(`EditService: Writing file ${targetFile}`)
        fs.writeFileSync(targetFile, rule.replace || '', 'utf8')
        console.log(`EditService: Successfully wrote file ${targetFile}`)
        applied += 1
        if (rule.once) break
        continue
      }

      // For other strategies, scan existing files
      const targetFiles = this.scan(repoRoot, rule.glob)
      for (const f of targetFiles) {
        if (!this.isAllowed(f)) continue

        const content = fs.readFileSync(f, 'utf8')
        const updated = this.transform(content, rule)
        if (updated !== content) {
          console.log(`EditService: Updating file ${f}`)
          fs.writeFileSync(f, updated, 'utf8')
          console.log(`EditService: Successfully updated file ${f}`)
          applied += 1
          if (rule.once) break
        } else {
          console.log(`EditService: No changes needed for file ${f}`)
        }
      }
    }
    return applied
  }

  private isAllowed(filePath: string) {
    const allowPaths = this.policy.allow?.paths || ['**/*']
    const denyPaths = this.policy.deny?.paths || []

    // Convert absolute path to relative path for matching
    const relativePath = path.relative(process.cwd(), filePath)

    const isAllowed = micromatch.isMatch(relativePath, allowPaths)
    const isDenied = micromatch.isMatch(relativePath, denyPaths)

    console.log(`EditService: Checking ${filePath} -> ${relativePath}`)
    console.log(`EditService: Allowed: ${isAllowed}, Denied: ${isDenied}`)

    return isAllowed && !isDenied
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
