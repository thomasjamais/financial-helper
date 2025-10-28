# Plan for #44: DB schema and migrations for audit_log and positions

## Issue Summary
- packages/db with migrations: audit_log, positions, orders, executions.
- Add SQL and type-safe queries.

Acceptance Criteria:
- [ ] 0002_audit_positions.sql
- [ ] Repo README updated with migration steps
- [ ] Integration tests (sqlite or dockerized)

## Implementation Plan
- Create database migration if schema changes needed
- Update database models and types
- Add proper database error handling
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Design feature architecture following domain-driven principles
- Implement feature with proper separation of concerns
- Add comprehensive documentation and examples

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/44-db-schema-and-migrations-for-audit-log-and-positions`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue