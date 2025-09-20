# Tasks: Business Authentication & Account Management

**Input**: Design documents from `/specs/003-step-2-1/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   ✓ COMPLETE: Tech stack extracted (Next.js 14, Supabase Auth, TypeScript)
2. Load optional design documents:
   ✓ data-model.md: Extracted entities → Business Account, Store, Business Stores, Sessions
   ✓ contracts/: business-auth-api.yaml → 7 endpoint contracts
   ✓ research.md: Extracted decisions → Supabase Auth extension approach
3. Generate tasks by category:
   ✓ Setup: Database migrations, package extensions
   ✓ Tests: 7 contract tests, 6 integration tests
   ✓ Core: Authentication pages, API endpoints, admin interface
   ✓ Integration: RLS policies, middleware, notifications
   ✓ Polish: Performance validation, documentation
4. Apply task rules:
   ✓ Different files marked [P] for parallel execution
   ✓ Sequential tasks for shared files
   ✓ Tests before implementation (TDD)
5. Number tasks sequentially (T001-T035)
6. Generate dependency graph and parallel execution examples
7. Validate task completeness: All requirements covered
8. Return: SUCCESS (35 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Paths based on existing monorepo structure from plan.md

## Phase 3.1: Setup & Database
- [x] T001 Create Supabase migration for business authentication schema in `supabase/migrations/20250920000001_business_auth_schema.sql`
- [x] T002 [P] Create RLS policies migration in `supabase/migrations/20250920000002_business_auth_rls.sql`
- [x] T003 [P] Add business authentication types to `packages/types/src/business-auth.ts`
- [x] T004 Apply database migrations and verify schema integrity

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Parallel)
- [x] T005 [P] Contract test POST /auth/business/register in `tests/contract/business-register.test.ts`
- [x] T006 [P] Contract test POST /auth/business/login in `tests/contract/business-login.test.ts`
- [x] T007 [P] Contract test POST /auth/business/logout in `tests/contract/business-logout.test.ts`
- [x] T008 [P] Contract test POST /auth/business/reset-password in `tests/contract/business-reset.test.ts`
- [x] T009 [P] Contract test GET /business/stores in `tests/contract/business-stores.test.ts`
- [x] T010 [P] Contract test PUT /business/current-store in `tests/contract/store-context.test.ts`
- [x] T011 [P] Contract test POST /admin/business/approve in `tests/contract/admin-approval.test.ts`

### Integration Tests (Parallel)
- [x] T012 [P] Integration test business registration flow in `tests/integration/registration-flow.test.ts`
- [x] T013 [P] Integration test admin approval workflow in `tests/integration/admin-approval.test.ts`
- [x] T014 [P] Integration test login and dashboard access in `tests/integration/login-flow.test.ts`
- [x] T015 [P] Integration test multi-store switching in `tests/integration/store-switching.test.ts`
- [x] T016 [P] Integration test password reset flow in `tests/integration/password-reset.test.ts`
- [x] T017 [P] Integration test security isolation in `tests/integration/security-isolation.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Package Extensions
- [x] T018 [P] Extend business authentication hooks in `packages/auth/src/business/use-business-auth.ts`
- [x] T019 [P] Create business registration utilities in `packages/auth/src/business/registration.ts`
- [x] T020 [P] Create multi-store context management in `packages/auth/src/business/store-context.ts`
- [x] T021 [P] Add admin verification utilities in `packages/auth/src/admin/verification.ts`

### Database Layer
- [x] T022 [P] Create business account service in `packages/database/src/business-accounts.ts`
- [x] T023 [P] Create store management service in `packages/database/src/stores.ts`
- [x] T024 [P] Create business-store permissions service in `packages/database/src/business-stores.ts`

### Business Application Pages
- [x] T025 Business registration page in `apps/business/src/app/register/page.tsx`
- [x] T026 Business login page in `apps/business/src/app/login/page.tsx`
- [x] T027 Password reset page in `apps/business/src/app/reset-password/page.tsx`
- [x] T028 Dashboard layout with navigation in `apps/business/src/app/dashboard/layout.tsx`
- [x] T029 Pending approval page in `apps/business/src/app/pending-approval/page.tsx`

### API Endpoints (Sequential - shared route structure)
- [x] T030 POST /auth/business/register endpoint in `apps/business/src/app/api/auth/business/register/route.ts`
- [x] T031 POST /auth/business/login endpoint in `apps/business/src/app/api/auth/business/login/route.ts`
- [x] T032 POST /auth/business/logout endpoint in `apps/business/src/app/api/auth/business/logout/route.ts`
- [x] T033 POST /auth/business/reset-password endpoint in `apps/business/src/app/api/auth/business/reset-password/route.ts`

## Phase 3.4: Admin Interface & Integration
- [x] T034 Admin business approval interface in `apps/admin/src/app/business-approvals/page.tsx`
- [x] T035 POST /admin/business/approve endpoint in `apps/admin/src/app/api/business/approve/route.ts`
- [x] T036 Store management endpoints in `apps/business/src/app/api/business/stores/route.ts`
- [x] T037 Store context switching endpoint in `apps/business/src/app/api/business/current-store/route.ts`
- [x] T038 Authentication middleware for protected routes in `apps/business/src/middleware.ts`
- [x] T039 Admin notification service for approval workflow in `apps/backend/src/services/admin-notifications.ts`

## Phase 3.5: Polish & Validation
- [x] T040 [P] Unit tests for business validation in `packages/auth/src/business/__tests__/validation.test.ts`
- [x] T041 [P] Unit tests for store permissions in `packages/database/src/__tests__/business-stores.test.ts`
- [x] T042 Performance optimization: authentication response <200ms
- [x] T043 Performance optimization: dashboard load <100ms
- [x] T044 Security audit: RLS policy verification
- [x] T045 [P] Update CLAUDE.md with implementation details
- [x] T046 Execute quickstart.md validation scenarios
- [x] T047 Load testing with 10 concurrent business users

## Dependencies
- Database setup (T001-T004) before all other tasks
- Contract tests (T005-T011) before corresponding implementations
- Integration tests (T012-T017) before implementation phases
- Package extensions (T018-T021) before application implementation
- Database services (T022-T024) before API endpoints
- Pages (T025-T029) before middleware (T038)
- API endpoints (T030-T033, T035-T037) before admin notifications (T039)
- Core implementation complete before polish (T040-T047)

## Parallel Execution Examples

### Setup Phase (After T004)
```bash
# Launch package extensions in parallel:
Task: "Extend business authentication hooks in packages/auth/src/business/use-business-auth.ts"
Task: "Create business registration utilities in packages/auth/src/business/registration.ts"
Task: "Create multi-store context management in packages/auth/src/business/store-context.ts"
Task: "Add admin verification utilities in packages/auth/src/admin/verification.ts"
```

### Contract Tests Phase
```bash
# Launch all contract tests together:
Task: "Contract test POST /auth/business/register in tests/contract/business-register.test.ts"
Task: "Contract test POST /auth/business/login in tests/contract/business-login.test.ts"
Task: "Contract test POST /auth/business/logout in tests/contract/business-logout.test.ts"
Task: "Contract test POST /auth/business/reset-password in tests/contract/business-reset.test.ts"
Task: "Contract test GET /business/stores in tests/contract/business-stores.test.ts"
Task: "Contract test PUT /business/current-store in tests/contract/store-context.test.ts"
Task: "Contract test POST /admin/business/approve in tests/contract/admin-approval.test.ts"
```

### Integration Tests Phase
```bash
# Launch integration tests in parallel:
Task: "Integration test business registration flow in tests/integration/registration-flow.test.ts"
Task: "Integration test admin approval workflow in tests/integration/admin-approval.test.ts"
Task: "Integration test login and dashboard access in tests/integration/login-flow.test.ts"
Task: "Integration test multi-store switching in tests/integration/store-switching.test.ts"
Task: "Integration test password reset flow in tests/integration/password-reset.test.ts"
Task: "Integration test security isolation in tests/integration/security-isolation.test.ts"
```

### Database Services Phase
```bash
# Launch database services in parallel:
Task: "Create business account service in packages/database/src/business-accounts.ts"
Task: "Create store management service in packages/database/src/stores.ts"
Task: "Create business-store permissions service in packages/database/src/business-stores.ts"
```

## Notes
- [P] tasks target different files with no dependencies
- Verify all tests fail before implementing corresponding features
- Commit after each completed task for clear progress tracking
- RLS policies are critical - test thoroughly before deployment
- Admin approval workflow must be functional for business onboarding

## Task Generation Rules
*Applied during execution*

1. **From Contracts**: 7 endpoints → 7 contract tests + implementations
2. **From Data Model**: 4 entities → database services + auth utilities
3. **From User Stories**: 6 scenarios → 6 integration tests
4. **From Architecture**: Monorepo structure → package extensions before apps

## Validation Checklist
*GATE: Checked before execution*

- [x] All 7 contracts have corresponding tests (T005-T011)
- [x] All 4 entities have service implementations (T022-T024)
- [x] All tests come before implementation (TDD enforced)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task conflicts with another [P] task
- [x] Constitutional requirements addressed (RLS, TypeScript strict, production-ready)

**Total Tasks**: 47 tasks organized across 5 phases with clear dependencies and parallel execution opportunities.