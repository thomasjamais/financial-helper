import { octokit } from '../config'
import type { RepoRef } from '../types'

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
    await octokit.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [assignee],
    })
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
