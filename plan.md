# Plan for #49: Security hardening: secret handling and no-secrets-in-logs

## Issue Summary
- KMS or SSM Parameter Store for secrets; redact logs.
- Secrets never included in PR diffs.

Acceptance Criteria:
- [ ] Secrets tooling wired
- [ ] Lint rule preventing secret logging
- [ ] Semgrep policy (can be disabled in CI initially)

## Implementation Plan
- Implement proper authentication and authorization
- Add input validation and sanitization
- Ensure secure data handling practices

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/49-security-hardening-secret-handling-and-no-secrets-in-logs`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue