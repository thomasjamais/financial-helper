# Plan for #39: Add scheduler (EventBridge/cron) to trigger periodic rebalance

## Issue Summary
- Create schedule (e.g., every 4h) that publishes RebalanceRequested event.
- Worker consumes and runs rebalance-engine.

Acceptance Criteria:
- [ ] Configurable interval
- [ ] One run at a time (lock)
- [ ] Observability logs

## Implementation Plan
- Design feature architecture following domain-driven principles
- Implement feature with proper separation of concerns
- Add comprehensive documentation and examples

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/39-add-scheduler-eventbridge-cron-to-trigger-periodic-rebalance`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue