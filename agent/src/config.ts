import { Octokit } from '@octokit/rest'
import process from 'node:process'

export const githubToken = process.env.GITHUB_TOKEN || ''
export const defaultBranch = process.env.DEFAULT_BRANCH || 'main'
export const gitAuthorName = process.env.GIT_AUTHOR_NAME || 'ai-bot'
export const gitAuthorEmail =
  process.env.GIT_AUTHOR_EMAIL || 'ai-bot@users.noreply.github.com'

export const octokit = new Octokit({ auth: githubToken })
