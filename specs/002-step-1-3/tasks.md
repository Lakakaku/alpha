# Tasks: Shared Infrastructure

**Input**: Design documents from `/specs/002-step-1-3/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `packages/`, `apps/` at repository root
- **Shared packages**: `packages/auth/`, `packages/database/`, `packages/ui/`, `packages/shared/`, `packages/types/`
- **Backend**: `apps/backend/src/`
- **Tests**: `tests/` at repository root

## Phase 3.1: Setup

- [x] T001 Create shared package structure for auth, types, and enhanced packages
- [x] T002 Initialize TypeScript project configuration for all shared packages with strict mode
- [x] T003 [P] Configure ESLint and Prettier for TypeScript strict mode compliance
- [x] T004 [P] Set up Jest/Vitest testing configuration in tests/
- [x] T005 Create backend application structure in apps/backend/
- [x] T006 [P] Install and configure Supabase dependencies (@supabase/ssr, @supabase/supabase-js)
- [x] T007 [P] Install and configure Express.js dependencies (express, helmet, cors, winston)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [x] T008 [P] Contract test POST /auth/login in tests/contract/auth/test_login_post.ts
- [x] T009 [P] Contract test POST /auth/logout in tests/contract/auth/test_logout_post.ts
- [x] T010 [P] Contract test POST /auth/refresh in tests/contract/auth/test_refresh_post.ts
- [x] T011 [P] Contract test GET /auth/profile in tests/contract/auth/test_profile_get.ts
- [x] T012 [P] Contract test PATCH /auth/profile in tests/contract/auth/test_profile_patch.ts
- [x] T013 [P] Contract test GET /auth/permissions in tests/contract/auth/test_permissions_get.ts
- [x] T014 [P] Contract test GET /health in tests/contract/shared/test_health_get.ts
- [x] T015 [P] Contract test GET /health/detailed in tests/contract/shared/test_health_detailed_get.ts
- [x] T016 [P] Contract test GET /businesses in tests/contract/shared/test_businesses_get.ts
- [x] T017 [P] Contract test POST /businesses in tests/contract/shared/test_businesses_post.ts
- [x] T018 [P] Contract test GET /businesses/{businessId} in tests/contract/shared/test_business_get.ts
- [x] T019 [P] Contract test PATCH /businesses/{businessId} in tests/contract/shared/test_business_patch.ts
- [x] T020 [P] Contract test GET /businesses/{businessId}/stores in tests/contract/shared/test_business_stores_get.ts
- [x] T021 [P] Contract test POST /businesses/{businessId}/stores in tests/contract/shared/test_business_stores_post.ts
- [x] T022 [P] Contract test GET /stores/{storeId} in tests/contract/shared/test_store_get.ts
- [x] T023 [P] Contract test PATCH /stores/{storeId} in tests/contract/shared/test_store_patch.ts
- [x] T024 [P] Contract test GET /permissions in tests/contract/shared/test_permissions_get.ts

### Integration Tests
- [x] T025 [P] Integration test shared database client usage in tests/integration/test_database_client.ts
- [x] T026 [P] Integration test authentication flow across apps in tests/integration/test_auth_flow.ts
- [x] T027 [P] Integration test UI components consistency in tests/integration/test_ui_components.ts
- [x] T028 [P] Integration test backend API with CORS in tests/integration/test_backend_api.ts
- [x] T029 [P] Integration test shared utilities and types in tests/integration/test_shared_utilities.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Shared Package Development
- [x] T030 [P] Create TypeScript type definitions in packages/types/src/index.ts
- [x] T031 [P] Enhance database client with typed queries in packages/database/src/client.ts
- [x] T032 [P] Create Supabase auth utilities in packages/auth/src/clients.ts
- [x] T033 [P] Create auth hooks and providers in packages/auth/src/hooks.ts
- [x] T034 [P] Create auth guards and middleware in packages/auth/src/guards.tsx
- [x] T035 [P] Create permission utilities in packages/auth/src/permissions.ts
- [x] T036 [P] Enhance shared utilities package in packages/shared/src/utils.ts
- [x] T037 [P] Enhance UI component library in packages/ui/src/components/

### Database Models and Migrations
- [x] T038 [P] Create user_profiles table migration in supabase/migrations/001_user_profiles.sql
- [x] T039 [P] Create businesses table migration in supabase/migrations/002_businesses.sql
- [x] T040 [P] Create stores table migration in supabase/migrations/003_stores.sql
- [x] T041 [P] Create permissions table migration in supabase/migrations/004_permissions.sql
- [x] T042 [P] Create user_permissions table migration in supabase/migrations/005_user_permissions.sql
- [x] T043 [P] Create api_keys table migration in supabase/migrations/006_api_keys.sql
- [x] T044 [P] Create RLS policies migration in supabase/migrations/007_rls_policies.sql

### Backend API Implementation
- [x] T045 Create Express app configuration in apps/backend/src/app.ts
- [x] T046 Set up health check endpoints in apps/backend/src/routes/health.ts
- [x] T047 Implement authentication routes in apps/backend/src/routes/auth.ts
- [x] T048 Implement business management routes in apps/backend/src/routes/businesses.ts
- [x] T049 Implement store management routes in apps/backend/src/routes/stores.ts
- [x] T050 Implement permissions routes in apps/backend/src/routes/permissions.ts
- [x] T051 Create authentication middleware in apps/backend/src/middleware/auth.ts
- [x] T052 Create CORS middleware configuration in apps/backend/src/middleware/cors.ts
- [x] T053 Create rate limiting middleware in apps/backend/src/middleware/rateLimiter.ts
- [x] T054 Create error handling middleware in apps/backend/src/middleware/errorHandler.ts

### Service Layer Implementation
- [x] T055 [P] Create user profile service in apps/backend/src/services/userService.ts
- [x] T056 [P] Create business service in apps/backend/src/services/businessService.ts
- [x] T057 [P] Create store service in apps/backend/src/services/storeService.ts
- [x] T058 [P] Create permission service in apps/backend/src/services/permissionService.ts
- [x] T059 [P] Create logging service in apps/backend/src/services/loggingService.ts

## Phase 3.4: Integration

- [x] T060 Connect authentication service to Supabase Auth in apps/backend/src/services/authService.ts
- [x] T061 Configure database connection pooling in apps/backend/src/config/database.ts
- [x] T062 Set up environment configuration in apps/backend/src/config/index.ts
- [x] T063 Implement request logging middleware in apps/backend/src/middleware/logging.ts
- [x] T064 Configure production security headers in apps/backend/src/middleware/security.ts
- [x] T065 Set up graceful shutdown handling in apps/backend/src/server.ts
- [x] T066 Configure Railway deployment in apps/backend/railway.json
- [x] T067 Set up health checks for Railway in apps/backend/src/health/checks.ts

## Phase 3.5: Polish

### Unit Tests
- [x] T068 [P] Unit tests for auth utilities in tests/unit/auth/test_auth_utils.ts
- [x] T069 [P] Unit tests for database client in tests/unit/database/test_database_client.ts
- [x] T070 [P] Unit tests for shared utilities in tests/unit/shared/test_utils.ts
- [x] T071 [P] Unit tests for UI components in tests/unit/ui/test_components.ts
- [x] T072 [P] Unit tests for type definitions in tests/unit/types/test_types.ts

### Performance and Security Tests
- [x] T073 Performance tests for API endpoints (<200ms response time) in tests/performance/test_api_performance.ts
- [x] T074 Security tests for RLS policies in tests/security/test_rls_policies.ts
- [x] T075 Security tests for authentication flow in tests/security/test_auth_security.ts
- [x] T076 Load tests for concurrent user sessions in tests/performance/test_load.ts

### Documentation and Final Polish
- [x] T077 [P] Generate and update TypeScript types from Supabase schema
- [x] T078 [P] Update package.json files with correct dependencies and scripts
- [x] T079 [P] Create API documentation from OpenAPI contracts
- [x] T080 [P] Update README files for each shared package
- [x] T081 Validate all quickstart scenarios from quickstart.md
- [x] T082 Run full test suite and ensure 100% pass rate
- [x] T083 Verify constitutional compliance (TypeScript strict, RLS, production-ready)

## Dependencies

### Critical Path Dependencies
- Setup (T001-T007) before all other phases
- Contract tests (T008-T024) before any implementation (T030+)
- Integration tests (T025-T029) before implementation starts
- Database migrations (T038-T044) before backend services (T045+)
- Shared packages (T030-T037) before backend implementation (T045+)
- Core implementation (T045-T059) before integration (T060-T067)
- Implementation complete before polish (T068-T083)

### Specific Dependencies
- T038-T044 (migrations) block T060-T061 (database connection)
- T030-T037 (shared packages) block T045+ (backend implementation)
- T045 (app config) blocks T046-T050 (route implementations)
- T051-T054 (middleware) blocks T060-T067 (integration)
- T077 (type generation) requires T038-T044 (migrations) complete

## Parallel Execution Examples

### Phase 3.2: Contract Tests (Launch Together)
```bash
# All contract tests can run in parallel since they're in different files
Task: "Contract test POST /auth/login in tests/contract/auth/test_login_post.ts"
Task: "Contract test GET /health in tests/contract/shared/test_health_get.ts"
Task: "Contract test GET /businesses in tests/contract/shared/test_businesses_get.ts"
# ... (all T008-T024 can run together)
```

### Phase 3.3: Shared Packages (Launch Together)
```bash
# Shared package development can run in parallel
Task: "Create TypeScript type definitions in packages/types/src/index.ts"
Task: "Enhance database client with typed queries in packages/database/src/client.ts"
Task: "Create Supabase auth utilities in packages/auth/src/clients.ts"
Task: "Enhance shared utilities package in packages/shared/src/utils.ts"
# ... (T030-T037 can run together)
```

### Phase 3.3: Database Migrations (Launch Together)
```bash
# Database migrations can run in parallel since they're separate files
Task: "Create user_profiles table migration in supabase/migrations/001_user_profiles.sql"
Task: "Create businesses table migration in supabase/migrations/002_businesses.sql"
Task: "Create stores table migration in supabase/migrations/003_stores.sql"
# ... (T038-T044 can run together)
```

### Phase 3.5: Unit Tests (Launch Together)
```bash
# Unit tests can run in parallel since they test different packages
Task: "Unit tests for auth utilities in tests/unit/auth/test_auth_utils.ts"
Task: "Unit tests for database client in tests/unit/database/test_database_client.ts"
Task: "Unit tests for shared utilities in tests/unit/shared/test_utils.ts"
# ... (T068-T072 can run together)
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify contract and integration tests fail before implementing any functionality
- All shared packages must pass TypeScript strict mode compilation
- Database migrations must be applied and RLS policies tested before backend development
- CORS configuration must allow all three frontend applications (customer, business, admin)
- Authentication tokens must work consistently across all applications
- All API endpoints must enforce proper authentication and authorization

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - auth-api.yaml → 6 contract test tasks (T008-T013)
   - shared-api.yaml → 11 contract test tasks (T014-T024)
   - Each endpoint → corresponding implementation task

2. **From Data Model**:
   - 6 entities → 6 migration tasks (T038-T043)
   - RLS policies → 1 policy migration task (T044)
   - Each entity → corresponding service task (T055-T058)

3. **From Quickstart Scenarios**:
   - 5 scenarios → 5 integration test tasks (T025-T029)
   - Each scenario → validation task in polish phase (T081)

4. **From Research Decisions**:
   - Supabase Auth v2 → auth package tasks (T032-T035)
   - Monorepo structure → shared package tasks (T030-T037)
   - Railway backend → backend API tasks (T045-T067)

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T008-T024)
- [x] All entities have migration and service tasks (T038-T058)
- [x] All tests come before implementation (T008-T029 before T030+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Constitutional compliance tasks included (TypeScript strict, RLS, production-ready)
- [x] Integration with existing projects (Supabase, Railway, Vercel) addressed
- [x] All quickstart scenarios covered by integration tests and validation tasks