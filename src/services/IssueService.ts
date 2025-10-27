import { octokit } from '../config.js'
import type { RepoRef } from '../types.js'

export class IssueService {
  constructor(private repoRef: RepoRef) {}

  async readIssue(issueNumber: number) {
    const { owner, repo } = this.repoRef
    const r = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    })
    return r.data
  }

  async claimIssue(
    issueNumber: number,
    assignee: string,
    labelsToAdd: string[] = ['in-progress'],
  ) {
    const { owner, repo } = this.repoRef

    // Try to assign the issue, but don't fail if assignee doesn't exist
    try {
      await octokit.issues.addAssignees({
        owner,
        repo,
        issue_number: issueNumber,
        assignees: [assignee],
      })
    } catch (error: any) {
      console.log(`Could not assign issue to ${assignee}: ${error.message}`)
      // Continue without failing - assignment is optional
    }

    if (labelsToAdd.length > 0) {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: labelsToAdd,
      })
    }
  }

  async comment(issueNumber: number, body: string) {
    const { owner, repo } = this.repoRef
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    })
  }
}
