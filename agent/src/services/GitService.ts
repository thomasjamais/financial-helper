import simpleGit, { SimpleGit } from 'simple-git'
import { defaultBranch, gitAuthorEmail, gitAuthorName } from '../config.js'
import { execa } from 'execa'
import path from 'node:path'
import fs from 'node:fs'

export class GitService {
  private git: SimpleGit

  constructor(private workdir: string = process.cwd()) {
    this.git = simpleGit({ baseDir: this.workdir })
  }

  async ensureConfig() {
    await this.git.addConfig('user.name', gitAuthorName)
    await this.git.addConfig('user.email', gitAuthorEmail)

    // Configure git to use token authentication
    await this.git.addConfig('credential.helper', 'store')
    await this.git.addConfig(
      'credential.https://github.com.username',
      'x-access-token',
    )
  }

  async cloneRepository(repoUrl: string, branch: string = defaultBranch) {
    // Clone the repository if it doesn't exist
    if (!fs.existsSync(path.join(this.workdir, '.git'))) {
      // If workspace is not empty, clone to a subdirectory and move files
      const tempDir = path.join(this.workdir, 'repo-temp')
      await this.git.clone(repoUrl, tempDir, [
        '--branch',
        branch,
        '--single-branch',
      ])

      // Move all files from temp directory to workspace
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        if (file !== '.git') {
          const srcPath = path.join(tempDir, file)
          const destPath = path.join(this.workdir, file)
          if (fs.statSync(srcPath).isDirectory()) {
            if (fs.existsSync(destPath)) {
              fs.rmSync(destPath, { recursive: true, force: true })
            }
            fs.renameSync(srcPath, destPath)
          } else {
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      // Move .git directory
      const gitSrc = path.join(tempDir, '.git')
      const gitDest = path.join(this.workdir, '.git')
      if (fs.existsSync(gitSrc)) {
        fs.renameSync(gitSrc, gitDest)
      }

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  async fetchDefault() {
    await this.git.fetch(['origin', defaultBranch])
  }

  async createBranch(branch: string) {
    await this.fetchDefault()

    // Check if branch already exists on remote
    try {
      await this.git.fetch(['origin', branch])
      // Branch exists on remote, checkout and update it
      await this.git.checkout(`origin/${branch}`)
      await this.git.checkoutLocalBranch(branch)
    } catch {
      // Branch doesn't exist on remote, create new one
      await this.git.checkout(`origin/${defaultBranch}`)
      await this.git.checkoutLocalBranch(branch)
    }
  }

  async addAllAndCommit(message: string) {
    // Only add files that are part of the repository, not agent source code
    const status = await this.git.status()
    const filesToAdd = status.files
      .map(f => f.path)
      .filter(path => 
        // Exclude agent source files
        !path.startsWith('src/') &&
        !path.startsWith('dist/') &&
        !path.startsWith('node_modules/') &&
        !path.startsWith('package.json') &&
        !path.startsWith('package-lock.json') &&
        !path.startsWith('tsconfig.json') &&
        // Include plan.md and other generated files
        (path === 'plan.md' || 
         path.startsWith('apps/') ||
         path.startsWith('packages/') ||
         path.startsWith('infra/') ||
         path.startsWith('.github/') ||
         path === 'README.md' ||
         path === 'policy.yaml')
      )
    
    if (filesToAdd.length === 0) return false
    
    await this.git.add(filesToAdd)
    await this.git.commit(message)
    return true
  }

  async pushBranch(branch: string) {
    try {
      await this.git.push('origin', branch, ['-u'])
    } catch (error) {
      // If push fails due to conflicts, force push
      console.log(`Push failed, attempting force push for branch: ${branch}`)
      await this.git.push('origin', branch, ['-u', '--force'])
    }
  }

  async diffStatsAgainstBase(base = `origin/${defaultBranch}`) {
    const r = await this.git.raw(['diff', '--shortstat', base])
    return r.trim()
  }

  async getChangedFilesAgainstBase(base = `origin/${defaultBranch}`) {
    const r = await this.git.raw(['diff', '--name-only', base])
    return r.split('\n').filter(Boolean)
  }

  async run(cmd: string, args: string[]) {
    const subprocess = execa(cmd, args, { cwd: this.workdir })
    const { stdout, stderr, exitCode } = await subprocess
    return { stdout, stderr, exitCode }
  }

  async getChangedFilesWithStatus(base = `origin/${defaultBranch}`) {
    const r = await this.git.raw(['diff', '--name-status', base])
    return r
      .split('\n')
      .filter(Boolean)
      .map((l: string) => {
        const [status, ...rest] = l.trim().split(/\s+/)
        return { status, file: rest.pop() as string }
      })
  }

  async getPatchForFile(file: string, base = `origin/${defaultBranch}`) {
    const r = await this.git.raw(['diff', base, '--', file])
    return r
  }

  async checkoutBranch(branch: string) {
    await this.git.checkout(branch)
  }

  async isBranchUpToDate(branch: string, base = `origin/${defaultBranch}`) {
    await this.git.fetch(['origin', branch])
    const diff = await this.git.raw(['diff', '--shortstat', base, branch])
    return diff.trim() === ''
  }
}
