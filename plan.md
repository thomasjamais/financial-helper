# Plan for #38: Implement rebalance-engine for spot USDT across BTC/ETH/BNB

## Issue Summary
- Target allocation: BTC/ETH/BNB split via env (default 33/33/34).
- Compute diffs and place market orders within slippage tolerance.
- Idempotent and auditable.

Acceptance Criteria:
- [ ] Deterministic plan calculation
- [ ] Dry-run mode
- [ ] Audit log entries

## Implementation Plan
- Analyze requirements and design solution architecture
- Implement core functionality with proper error handling
- Add appropriate tests and documentation
- Ensure compliance with project policies and standards

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/38-implement-rebalance-engine-for-spot-usdt-across-btc-eth-bnb`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue