# Plan for #50: CI workflows: build, lint, unit, integration (no live)

## Issue Summary
- GitHub Actions: pnpm install, build all, lint, unit tests.
- Optional docker compose integration tests; never live.

Acceptance Criteria:
- [ ] Badges and required checks
- [ ] Caching for pnpm
- [ ] Example .http files

## Implementation Plan
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Implement UI components with proper TypeScript types
- Add responsive design considerations
- Include accessibility features where applicable

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/50-ci-workflows-build-lint-unit-integration-no-live`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue