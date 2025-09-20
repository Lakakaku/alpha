# Tasks: Database Foundation for Customer Feedback System

**Input**: Design documents from `/Users/lucasjenner/alpha/specs/001-step-1-2/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript 5.0+, Supabase, Next.js 14, PostgreSQL RLS
   → Structure: Monorepo with packages/database/ shared package
2. Load design documents ✓:
   → data-model.md: 7 entities (Business, UserAccount, Store, ContextWindow, Transaction, FeedbackSession, VerificationRecord)
   → contracts/: schema.sql, types.ts
   → research.md: RLS patterns, tolerance matching, real-time subscriptions
3. Generate tasks by category ✓:
   → Setup: database package, dependencies, TypeScript config
   → Tests: contract tests, RLS tests, integration tests
   → Core: entity models, client setup, utilities
   → Integration: auth, real-time, migration tools
   → Polish: unit tests, performance validation, docs
4. Task rules applied ✓:
   → Different files = [P] for parallel execution
   → Tests before implementation (TDD)
   → Dependencies properly ordered
5. Tasks numbered T001-T025 ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute for repository root context

## Phase 3.1: Project Setup

- [x] **T001** Create database package structure at `packages/database/` with src/client/, src/types/, src/queries/, src/migrations/, tests/ directories
- [x] **T002** Initialize database package.json with Supabase dependencies (@supabase/supabase-js ^2.39.0, TypeScript ^5.0.0, Jest ^29.0.0)
- [x] **T003** [P] Configure TypeScript strict mode in `packages/database/tsconfig.json` with declaration output and proper module resolution
- [x] **T004** [P] Set up ESLint and Prettier configuration in `packages/database/.eslintrc.js` and `.prettierrc.js`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Database Schema)
- [x] **T005** [P] Contract test for schema.sql deployment in `packages/database/tests/contract/schema-deployment.test.ts` - verify all 7 tables, indexes, and functions exist
- [x] **T006** [P] Contract test for TypeScript types compatibility in `packages/database/tests/contract/types-validation.test.ts` - validate types match schema constraints
- [x] **T007** [P] Contract test for RLS policies in `packages/database/tests/contract/rls-policies.test.ts` - verify all tables have RLS enabled and policies exist

### Integration Tests (Core Functionality)
- [x] **T008** [P] Integration test for business data isolation in `packages/database/tests/integration/business-isolation.test.ts` - verify businesses cannot access each other's data
- [x] **T009** [P] Integration test for multi-store setup in `packages/database/tests/integration/multi-store.test.ts` - verify single business can manage multiple stores
- [x] **T010** [P] Integration test for transaction verification in `packages/database/tests/integration/transaction-verification.test.ts` - verify tolerance matching (±2 min, ±2 SEK)
- [x] **T011** [P] Integration test for real-time subscriptions in `packages/database/tests/integration/realtime-subscriptions.test.ts` - verify business-filtered real-time updates
- [x] **T012** [P] Integration test for weekly verification workflow in `packages/database/tests/integration/weekly-verification.test.ts` - verify complete verification cycle

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Client and Configuration
- [x] **T013** [P] Supabase client configuration in `packages/database/src/client/supabase.ts` with environment validation and auth settings
- [x] **T014** [P] Database types export in `packages/database/src/types/index.ts` - copy and organize types from contracts/types.ts
- [x] **T015** [P] Database client utilities in `packages/database/src/client/utils.ts` for connection testing and error handling

### Entity Models and Queries
- [x] **T016** [P] Business entity queries in `packages/database/src/queries/business.ts` with RLS-compliant CRUD operations
- [x] **T017** [P] Store entity queries in `packages/database/src/queries/store.ts` with QR code lookup and business filtering
- [x] **T018** [P] User account queries in `packages/database/src/queries/user-account.ts` with role-based access and business association
- [x] **T019** [P] Context window queries in `packages/database/src/queries/context-window.ts` with store profile management and completeness scoring
- [x] **T020** [P] Transaction queries in `packages/database/src/queries/transaction.ts` with tolerance range creation and verification matching
- [x] **T021** [P] Feedback session queries in `packages/database/src/queries/feedback-session.ts` with privacy protection and grading logic
- [x] **T022** [P] Verification record queries in `packages/database/src/queries/verification-record.ts` with weekly cycle management

## Phase 3.4: Integration and Advanced Features

- [x] **T023** Authentication integration in `packages/database/src/auth/auth-helper.ts` - implement JWT claim extraction and RLS context setup
- [x] **T024** Real-time subscription manager in `packages/database/src/realtime/subscription-manager.ts` - business-filtered channels and event handling
- [x] **T025** Migration utilities in `packages/database/src/migrations/migration-runner.ts` - schema deployment and rollback capabilities

## Phase 3.5: Polish and Validation

- [x] **T026** [P] Unit tests for tolerance matching in `packages/database/tests/unit/tolerance-matching.test.ts` - test time and amount range functions
- [x] **T027** [P] Unit tests for context scoring in `packages/database/tests/unit/context-scoring.test.ts` - test completeness calculation algorithm
- [x] **T028** [P] Performance tests for RLS queries in `packages/database/tests/performance/rls-performance.test.ts` - verify sub-200ms response times
- [x] **T029** [P] Update package index in `packages/database/src/index.ts` to export all public APIs with proper TypeScript declarations
- [x] **T030** Manual validation using quickstart.md scenarios - execute full 30-45 minute setup and verify all validation checkpoints

## Dependencies

### Critical Path
- **Setup** (T001-T004) → **Tests** (T005-T012) → **Implementation** (T013-T025) → **Polish** (T026-T030)
- **Contract tests** (T005-T007) must fail before any implementation begins
- **Integration tests** (T008-T012) must fail before core implementation

### Specific Dependencies
- T014 (types) requires contracts/types.ts to be available
- T016-T022 (entity queries) require T013 (client) and T014 (types)
- T023 (auth) requires T013 (client) and T018 (user accounts)
- T024 (realtime) requires T013 (client) and all entity queries (T016-T022)
- T025 (migrations) requires schema.sql from contracts/
- T028 (performance) requires all entity queries (T016-T022)

## Parallel Execution Examples

### Setup Phase (can run concurrently)
```typescript
// Launch T003-T004 together:
Task: "Configure TypeScript strict mode in packages/database/tsconfig.json"
Task: "Set up ESLint and Prettier in packages/database/.eslintrc.js"
```

### Contract Tests Phase (all parallel)
```typescript
// Launch T005-T007 together:
Task: "Contract test schema deployment in packages/database/tests/contract/schema-deployment.test.ts"
Task: "Contract test TypeScript types in packages/database/tests/contract/types-validation.test.ts"
Task: "Contract test RLS policies in packages/database/tests/contract/rls-policies.test.ts"
```

### Integration Tests Phase (all parallel)
```typescript
// Launch T008-T012 together:
Task: "Integration test business isolation in packages/database/tests/integration/business-isolation.test.ts"
Task: "Integration test multi-store setup in packages/database/tests/integration/multi-store.test.ts"
Task: "Integration test transaction verification in packages/database/tests/integration/transaction-verification.test.ts"
Task: "Integration test real-time subscriptions in packages/database/tests/integration/realtime-subscriptions.test.ts"
Task: "Integration test weekly verification in packages/database/tests/integration/weekly-verification.test.ts"
```

### Core Implementation Phase (models can be parallel)
```typescript
// Launch T016-T022 together (after T013-T015 complete):
Task: "Business entity queries in packages/database/src/queries/business.ts"
Task: "Store entity queries in packages/database/src/queries/store.ts"
Task: "User account queries in packages/database/src/queries/user-account.ts"
Task: "Context window queries in packages/database/src/queries/context-window.ts"
Task: "Transaction queries in packages/database/src/queries/transaction.ts"
Task: "Feedback session queries in packages/database/src/queries/feedback-session.ts"
Task: "Verification record queries in packages/database/src/queries/verification-record.ts"
```

### Polish Phase (tests can be parallel)
```typescript
// Launch T026-T029 together:
Task: "Unit tests tolerance matching in packages/database/tests/unit/tolerance-matching.test.ts"
Task: "Unit tests context scoring in packages/database/tests/unit/context-scoring.test.ts"
Task: "Performance tests RLS queries in packages/database/tests/performance/rls-performance.test.ts"
Task: "Update package index in packages/database/src/index.ts"
```

## Notes
- **[P] tasks** = different files, no dependencies between them
- **All tests must fail** before writing any implementation code (TDD)
- **Commit after each task** for clean rollback capability
- **RLS policies** are critical - test thoroughly in T007-T009
- **Real-time subscriptions** must respect business isolation (T011, T024)
- **Performance targets**: Sub-200ms API responses (T028)

## Validation Checklist
*GATE: All must pass before considering feature complete*

- [x] All contracts have corresponding tests (T005-T007 cover schema.sql and types.ts)
- [x] All entities have model tasks (T016-T022 cover all 7 entities from data-model.md)
- [x] All tests come before implementation (T005-T012 before T013-T025)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path (absolute paths provided)
- [x] No task modifies same file as another [P] task (verified file isolation)
- [x] Production-ready implementation (uses real Supabase project wtdckfgdcryjvbllcajq)
- [x] Constitutional compliance (TypeScript strict mode, RLS enforcement, real data only)