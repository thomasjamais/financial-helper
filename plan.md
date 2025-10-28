# Plan for #41: Implement order placement with idempotency and audit_log

## Issue Summary
- Wrap create/cancel order calls with idempotency keys.
- Persist audit_log entries with correlation_id on all mutations.

Acceptance Criteria:
- [ ] Idempotent retries
- [ ] audit_log write on success/failure
- [ ] Unit tests

## Implementation Plan
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/41-implement-order-placement-with-idempotency-and-audit-log`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue