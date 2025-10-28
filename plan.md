# Plan for #48: Observability: structured logs and metrics (CloudWatch)

## Issue Summary
- Pino logs with fields: correlation_id, event, symbol, notional.
- Basic metrics: orders_placed, pnl, rebalance_count, errors.

Acceptance Criteria:
- [ ] Log fields standardized
- [ ] Metrics exported
- [ ] Dashboards documented

## Implementation Plan
- Identify root cause of the issue
- Implement targeted fix with minimal impact
- Add regression tests to prevent future occurrences

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/48-observability-structured-logs-and-metrics-cloudwatch`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue