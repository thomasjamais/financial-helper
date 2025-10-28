# Plan for #46: Bot service: status and manual trigger endpoints

## Issue Summary
- apps/bot: GET /status, POST /trigger/rebalance, POST /trigger/strategy.
- Auth via token env; rate-limited.

Acceptance Criteria:
- [ ] Unit tests
- [ ] Logging with correlation_id
- [ ] 429 handling

## Implementation Plan
- Implement API endpoint with proper validation using Zod
- Add comprehensive error handling and status codes
- Update API documentation if required
- Write unit tests for new functionality
- Add integration tests for API endpoints
- Ensure test coverage meets policy requirements
- Implement proper authentication and authorization
- Add input validation and sanitization
- Ensure secure data handling practices

## Technical Steps
- Claim the issue and set status to in-progress
- Create branch `ai/46-bot-service-status-and-manual-trigger-endpoints`
- Apply constrained edits according to policy.yaml
- Run all policy-defined test suites
- Open PR linking this plan and attaching suite outputs

## Acceptance Criteria
- All edits are within allowed paths and deny rules
- All policy test suites are successful
- PR links back to the issue and includes outputs
- Implementation matches the requirements in the issue