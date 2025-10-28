# Plan for #35: Fetch account balances (spot and futures) with strict types

## Issue Summary
- Exchange adapter: add getSpotBalances and getFuturesBalances.
- Normalize result to shared-kernel types.
- Add caching with TTL to avoid API bursts.

Acceptance Criteria:
- [ ] Types in shared-kernel
- [ ] Unit + integration tests (paper)
- [ ] Cache layer with TTL

## Implementation Plan
- Implement API endpoint with proper validation using Zod
- Add comprehensive error handling and status codes
- Update API documentation if required
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Design feature architecture following domain-driven principles
- Implement feature with proper separation of concerns
- Add comprehensive documentation and examples

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/35-fetch-account-balances-spot-and-futures-with-strict-types`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue