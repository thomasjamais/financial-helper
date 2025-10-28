# Plan for #42: Baseline futures strategy (trend-following) in ai-engine

## Issue Summary
- Simple moving average crossover with risk controls.
- Signals publish TradeSignal events; executor places orders.

Acceptance Criteria:
- [ ] SMA crossover pure functions
- [ ] Backtestable interfaces
- [ ] Integration path to executor

## Implementation Plan
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/42-baseline-futures-strategy-trend-following-in-ai-engine`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue