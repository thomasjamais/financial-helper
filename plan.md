# Plan for #36: Enforce symbol whitelist and environment caps (MAX_* env)

## Issue Summary
- Read MAX_ORDER_USDT, MAX_POSITION_USDT, SYMBOL_WHITELIST from env.
- Validate before any order placement.
- CI must never place live orders (guards in adapters).

Acceptance Criteria:
- [ ] Guards in adapters
- [ ] Unit tests for caps
- [ ] CI safety checks

## Implementation Plan
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/36-enforce-symbol-whitelist-and-environment-caps-max-env`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue