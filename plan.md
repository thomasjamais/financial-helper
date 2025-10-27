# Plan for #6: Test Plan Workflow

## Context
Testing the new plan-first workflow to ensure it creates proper implementation plans instead of copy-pasting the issue description.

## Steps
- Claim the issue and set status to in-progress
- Create branch `ai/6-test-plan-workflow`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs