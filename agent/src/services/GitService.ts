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
    await this.git.checkout(`origin/${defaultBranch}`)
    await this.git.checkoutLocalBranch(branch)
  }

  async addAllAndCommit(message: string) {
    await this.git.add(['.'])
    const status = await this.git.status()
    if (status.files.length === 0) return false
    await this.git.commit(message)
    return true
  }

  async pushBranch(branch: string) {
    await this.git.push('origin', branch, ['-u'])
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
