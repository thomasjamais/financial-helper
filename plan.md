# Plan for #33: Implement exchange adapter rate limiting and exponential backoff

## Issue Summary
- Centralize rate limiter with token bucket per endpoint/key.
- Respect Bitget per-route rate limits and global caps.
- Implement jittered exponential backoff and circuit breaker.

Acceptance Criteria:
- [ ] Exhaustive unit tests with virtual time
- [ ] Backoff + jitter + max retries
- [ ] Circuit opens and recovers

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

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/33-implement-exchange-adapter-rate-limiting-and-exponential-bac`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue