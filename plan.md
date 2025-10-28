# Plan for #32: Set up Bitget API client and credentials (paper mode by default)

## Issue Summary
- Add Bitget REST and WebSocket clients in packages/exchange-adapters.
- Load API keys from env; encrypt at rest; never log secrets.
- Support paper trading by default; live only with LIVE_TRADING_ENABLED=true and TEST_LIVE_CONFIRMATION set.
- Add rate-limiting and exponential backoff to all requests.
- Provide Zod-validated config schema.

Acceptance Criteria:
- [ ] Encrypted secret storage
- [ ] Paper mode default, live gated by envs
- [ ] Typed client with retries/backoff
- [ ] Zod config validation

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
- Create branch `ai/32-set-up-bitget-api-client-and-credentials-paper-mode-by-defau`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue