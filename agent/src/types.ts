export type RepoRef = { owner: string; repo: string }

export type Policy = {
  mode: 'low' | 'moderate' | 'high'
  maxChangedFiles: number
  require_tests: boolean
  require_readme_update_on_api_change?: boolean
  allow: {
    paths: string[]
    languages?: string[]
    ci_changes_label?: string
  }
  deny?: {
    paths?: string[]
    patterns?: string[]
  }
  tests?: {
    unit_threshold?: number
    suites: Array<{ name: string; cmd: string; timeout: number }>
  }
  guards?: {
    forbid_live_trading?: boolean
    env_overrides?: Record<string, string>
    allowed_symbols?: string[]
  }
  edits?: Array<{
    glob: string
    strategy: 'append' | 'prepend' | 'replace' | 'regex-replace'
    search?: string
    replace?: string
    regexFlags?: string
    once?: boolean
  }>
}

export type TestResult = {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  suite: string
}

export type PlanContext = {
  issueNumber: number
  issueTitle: string
  issueBody: string
  branch: string
  iterationNumber?: number
}

export type AgentMode = 'new-issue' | 'fix-iteration'

export type AgentContext = {
  mode: AgentMode
  issueNumber?: number
  prNumber?: number
  branch?: string
  owner: string
  repo: string
  assignee: string
  policyPath: string
}
