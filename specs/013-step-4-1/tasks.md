# Tasks: Admin Dashboard Foundation

**Input**: Design documents from `/specs/013-step-4-1/` **Prerequisites**:
plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Tech stack: TypeScript, Next.js 14, Supabase, Tailwind CSS
   → Structure: Monorepo with apps/admin, apps/backend enhancement
2. Load design documents:
   → data-model.md: 6 entities (admin_accounts, admin_sessions, stores enhanced, store_status_metrics, audit_logs)
   → contracts/: 3 files with 12 endpoints total
   → research.md: Authentication patterns, UI approach, session management, RLS policies
   → quickstart.md: 7 test scenarios
3. Generate tasks by category:
   → Setup: Admin app creation, dependencies, database migrations
   → Tests: 3 contract test files, 7 integration tests
   → Core: Database models, API routes, UI components
   → Integration: Middleware, RLS policies, monitoring
   → Polish: Unit tests, performance validation, documentation
4. Apply task rules:
   → Contract tests [P], model tasks [P], UI components [P]
   → Sequential for shared files (same route files, middleware)
   → Tests before implementation (TDD)
5. Tasks T001-T035 generated
6. Dependencies mapped
7. Parallel execution examples provided
8. Validation complete: All contracts tested, all entities modeled
9. Return: SUCCESS (35 tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure** (from plan.md):
  - `apps/backend/src/` - Enhanced backend with admin routes
  - `apps/admin/src/` - New admin dashboard application
  - `packages/database/src/` - Enhanced database package
  - `packages/types/src/` - Enhanced type definitions

## Phase 3.1: Setup

- [x] T001 Create admin dashboard app structure at `apps/admin/`
- [x] T002 Initialize Next.js 14 admin app with TypeScript and Tailwind CSS
- [x] T003 [P] Configure ESLint and Prettier for admin dashboard
- [x] T004 Create database migration for admin schema in `supabase/migrations/`
- [x] T005 [P] Add admin-specific types to `packages/types/src/admin.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests (Parallel - Different Files)

- [x] T006 [P] Contract test admin authentication endpoints in
      `apps/backend/tests/contract/admin-auth.test.ts`
- [x] T007 [P] Contract test store management endpoints in
      `apps/backend/tests/contract/store-management.test.ts`
- [x] T008 [P] Contract test audit monitoring endpoints in
      `apps/backend/tests/contract/audit-monitoring.test.ts`

### Integration Tests (Parallel - Different Files)

- [x] T009 [P] Integration test admin authentication flow in
      `apps/backend/tests/integration/admin-auth-flow.test.ts`
- [x] T010 [P] Integration test store listing and details in
      `apps/backend/tests/integration/store-listing-details.test.ts`
- [x] T011 [P] Integration test store creation workflow in
      `apps/backend/tests/integration/store-creation-workflow.test.ts`
- [x] T012 [P] Integration test database upload process in
      `apps/backend/tests/integration/database-upload-process.test.ts`
- [x] T013 [P] Integration test session management in
      `apps/backend/tests/integration/session-management.test.ts`
- [x] T014 [P] Integration test audit logging in
      `apps/backend/tests/integration/audit-logging.test.ts`
- [x] T015 [P] Integration test monitoring dashboard in
      `apps/backend/tests/integration/monitoring-dashboard.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models (Parallel - Different Files)

- [x] T016 [P] Admin account model in
      `packages/database/src/admin/admin-account.ts`
- [x] T017 [P] Admin session model in
      `packages/database/src/admin/admin-session.ts`
- [x] T018 [P] Store status metrics model in
      `packages/database/src/store/store-metrics.ts` (separate table with
      foreign key to stores)
- [x] T019 [P] Audit log model in `packages/database/src/admin/audit-log.ts`
- [x] T020 Enhance stores model with monitoring fields in
      `packages/database/src/store/store.ts` (add status fields for quick
      queries)

### Backend Services (Parallel - Different Files)

- [x] T021 [P] Admin authentication service in
      `apps/backend/src/services/admin/auth.ts`
- [x] T022 [P] Admin session service in
      `apps/backend/src/services/admin/session.ts`
- [x] T023 [P] Store monitoring service in
      `apps/backend/src/services/admin/store-monitoring.ts`
- [x] T024 [P] Audit logging service in
      `apps/backend/src/services/admin/audit.ts`

### API Routes (Sequential - Shared Route Structure)

- [x] T025 Admin authentication routes in
      `apps/backend/src/routes/admin/auth.ts`
- [x] T026 Store management routes in `apps/backend/src/routes/admin/stores.ts`
- [x] T027 Audit and monitoring routes in
      `apps/backend/src/routes/admin/monitoring.ts`

### Admin UI Components (Parallel - Different Files)

- [x] T028 [P] Login component in `apps/admin/src/components/auth/LoginForm.tsx`
- [x] T029 [P] Store listing component in
      `apps/admin/src/components/stores/StoreList.tsx`
- [x] T030 [P] Store details component in
      `apps/admin/src/components/stores/StoreDetails.tsx`
- [x] T031 [P] Store creation form in
      `apps/admin/src/components/stores/CreateStoreForm.tsx`
- [x] T032 [P] Monitoring dashboard in
      `apps/admin/src/components/monitoring/Dashboard.tsx`

## Phase 3.4: Integration

- [x] T033 Admin authentication middleware in
      `apps/backend/src/middleware/admin-auth.ts`
- [x] T034 RLS policies for admin access in database migration
- [x] T035 Admin dashboard pages and routing in `apps/admin/src/app/`
- [x] T035a Audit logging implementation in
      `apps/backend/src/services/admin/audit-implementation.ts`

## Phase 3.5: Polish

- [x] T036 [P] Unit tests for admin services in
      `apps/backend/tests/unit/admin-services.test.ts`
- [x] T037 [P] Unit tests for admin UI components in
      `apps/admin/tests/unit/components.test.ts`
- [x] T038 Performance validation (<2s page loads, <500ms operations)
- [x] T039 [P] Update `CLAUDE.md` with admin dashboard context
- [x] T040 Execute quickstart.md test scenarios for validation

## Dependencies

- Setup (T001-T005) before all other phases
- Tests (T006-T015) before implementation (T016-T035)
- Models (T016-T020) before services (T021-T024)
- Services before routes (T025-T027)
- Backend routes before UI components (T028-T032)
- Core implementation before integration (T033-T035)
- Integration before polish (T036-T040)

## Parallel Execution Examples

### Phase 3.2: Launch all contract tests together

```bash
# These can run simultaneously (different test files):
Task: "Contract test admin authentication endpoints in apps/backend/tests/contract/admin-auth.test.ts"
Task: "Contract test store management endpoints in apps/backend/tests/contract/store-management.test.ts"
Task: "Contract test audit monitoring endpoints in apps/backend/tests/contract/audit-monitoring.test.ts"
```

### Phase 3.2: Launch all integration tests together

```bash
# These can run simultaneously (different test files):
Task: "Integration test admin authentication flow in apps/backend/tests/integration/admin-auth-flow.test.ts"
Task: "Integration test store listing and details in apps/backend/tests/integration/store-listing.test.ts"
Task: "Integration test store creation workflow in apps/backend/tests/integration/store-creation.test.ts"
Task: "Integration test database upload process in apps/backend/tests/integration/database-upload.test.ts"
Task: "Integration test session management in apps/backend/tests/integration/session-management.test.ts"
Task: "Integration test audit logging in apps/backend/tests/integration/audit-logging.test.ts"
Task: "Integration test monitoring dashboard in apps/backend/tests/integration/monitoring-dashboard.test.ts"
```

### Phase 3.3: Launch all model tasks together

```bash
# These can run simultaneously (different model files):
Task: "Admin account model in packages/database/src/admin/admin-account.ts"
Task: "Admin session model in packages/database/src/admin/admin-session.ts"
Task: "Store status metrics model in packages/database/src/store/store-metrics.ts"
Task: "Audit log model in packages/database/src/admin/audit-log.ts"
```

### Phase 3.3: Launch UI component tasks together

```bash
# These can run simultaneously (different component files):
Task: "Login component in apps/admin/src/components/auth/LoginForm.tsx"
Task: "Store listing component in apps/admin/src/components/stores/StoreList.tsx"
Task: "Store details component in apps/admin/src/components/stores/StoreDetails.tsx"
Task: "Store creation form in apps/admin/src/components/stores/CreateStoreForm.tsx"
Task: "Monitoring dashboard in apps/admin/src/components/monitoring/Dashboard.tsx"
```

## Notes

- [P] tasks = different files, no dependencies, can run simultaneously
- Verify all tests fail before implementing (TDD requirement)
- Commit after each task completion
- All tasks use existing project infrastructure (Supabase, Next.js, TypeScript)
- Admin dashboard follows existing patterns from customer/business apps

## Task Generation Summary

_Generated from design documents_

### From Contracts (3 files → 3 contract tests + 12 endpoints):

- admin-auth.yaml → T006 + authentication routes in T025
- store-management.yaml → T007 + store routes in T026
- audit-monitoring.yaml → T008 + monitoring routes in T027

### From Data Model (6 entities → 5 model tasks):

- admin_accounts → T016
- admin_sessions → T017
- stores (enhanced) → T020
- store_status_metrics → T018
- audit_logs → T019

### From Quickstart (7 scenarios → 7 integration tests):

- Admin Authentication → T009
- Store Listing → T010
- Store Details → T010 (combined)
- Store Creation → T011
- Database Upload → T012
- Session Management → T013
- Audit Logging → T014
- Monitoring Dashboard → T015

### From Technical Stack:

- Next.js admin app → T001, T002, T035
- Supabase integration → T004, T034
- TypeScript types → T005
- Testing setup → T003, T036-T037

## Validation Checklist

_GATE: Checked before task execution_

- [x] All contracts have corresponding tests (T006-T008 cover 3 contract files)
- [x] All entities have model tasks (T016-T020 cover 6 entities)
- [x] All tests come before implementation (T006-T015 before T016-T035)
- [x] Parallel tasks truly independent (different files confirmed)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Constitutional compliance maintained (production-ready, TypeScript strict)
- [x] Existing monorepo structure respected
- [x] All quickstart scenarios have corresponding tests
