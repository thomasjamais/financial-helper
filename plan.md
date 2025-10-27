# Plan for #17: Initialize the bot microservice (V2)

## Issue Summary
## Goal
Set up a new Node/TypeScript service in apps/bot that will serve as the foundation for the trading bot (PNPM config, ESLint, tsconfig, scripts). Expose an HTTP endpoint /status returning { ok: true }.

## Acceptance Criteria (Given/When/Then)

Given a developer installs dependencies with pnpm install
When they run pnpm dev inside apps/bot
Then a server starts on localhost and a GET /status returns { ok: true }.

## Out of Scope

Implementing trading logic or Bitget integration.

Building any user interface.

 ### Open Questions

Should we use Express or another framework?

What default port should the service listen on?

### Observability

Metrics/Logs: log incoming requests and response time on /status.

## Test Plan

Unit: test a controller returning { ok: true }.

Integration: an HTTP test verifying /status returns 200 and { ok: true }.

E2E: start the service via pnpm dev and verify a real request.

## Implementation Plan
- Implement API endpoint with proper validation using Zod
- Add comprehensive error handling and status codes
- Update API documentation if required
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Implement UI components with proper TypeScript types
- Add responsive design considerations
- Include accessibility features where applicable
- Design feature architecture following domain-driven principles
- Implement feature with proper separation of concerns
- Add comprehensive documentation and examples

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/17-initialize-the-bot-microservice-v2`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue