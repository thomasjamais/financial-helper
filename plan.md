# Plan for #1: Add GET /v1/ping + unit test

## Context
## Goal

Create Express route `/v1/ping` returning `{ ok: true }`.
Add supertest spec under apps/api/tests/ping.spec.ts.
Update README endpoints list.

## Acceptance Criteria (Given/When/Then)

When I try GET /v1/ping
Then I should have a 200 with { ok: true }

## Out of Scope

## Open Questions

## Observability
- Metrics/Logs:

## Test Plan
- Unit: pnpm test:unit
- Integration:
- E2E:


## Steps
- Claim the issue and set status to in-progress
- Create branch `ai/1-add-get-v1-ping-unit-test`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs