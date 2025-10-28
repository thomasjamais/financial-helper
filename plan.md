# Plan for #34: Add Redis Streams event-bus with DLQ and idempotent workers

## Issue Summary
- Create packages/event-bus with Redis Streams.
- Standardize event envelopes with correlation_id and audit fields.
- Add DLQ and poison message handling; workers idempotent by event id.

Acceptance Criteria:
- [ ] Publish/consume helpers
- [ ] DLQ pipeline and visibility timeout
- [ ] Idempotency tests

## Implementation Plan
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Design feature architecture following domain-driven principles
- Implement feature with proper separation of concerns
- Add comprehensive documentation and examples

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/34-add-redis-streams-event-bus-with-dlq-and-idempotent-workers`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue