# Plan for #45: API endpoints: GET /healthz, GET /v1/balances, POST /v1/rebalance

## Issue Summary
- apps/api: implement endpoints with Zod validation.
- Map domain to DTOs; proper status codes and errors.

Acceptance Criteria:
- [ ] Unit + integration tests
- [ ] OpenAPI or .http examples
- [ ] Problem+json errors

## Implementation Plan
- Implement API endpoint with proper validation using Zod
- Add comprehensive error handling and status codes
- Update API documentation if required
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Identify root cause of the issue
- Implement targeted fix with minimal impact
- Add regression tests to prevent future occurrences

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/45-api-endpoints-get-healthz-get-v1-balances-post-v1-rebalance`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue