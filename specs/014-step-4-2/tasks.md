# Tasks: Weekly Verification Workflow

**Input**: Design documents from `/specs/014-step-4-2/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extracted: TypeScript, Next.js 14, Supabase, Jest testing
2. Load optional design documents ✓:
   → data-model.md: 6 entities extracted
   → contracts/: Admin + Business APIs extracted  
   → quickstart.md: 4 test scenarios extracted
3. Generate tasks by category ✓
4. Apply task rules ✓:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
**Web app structure** (from plan.md):
- **Backend**: `apps/backend/src/` (admin API endpoints)
- **Business Frontend**: `apps/business/src/` (verification interface)
- **Shared Packages**: `packages/database/src/`, `packages/types/src/`
- **Tests**: `apps/backend/tests/`, `apps/business/tests/`

## Phase 3.1: Setup & Database Schema
- [x] T001 Create database migration for verification workflow schema in `supabase/migrations/`
- [x] T002 Add verification workflow types to `packages/types/src/verification.ts`
- [x] T003 [P] Install additional dependencies (csv-writer, xlsx) in `apps/backend/package.json`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Admin API)
- [x] T004 [P] Contract test GET /api/admin/verification/cycles in `apps/backend/tests/contract/admin-verification-cycles-get.test.ts`
- [x] T005 [P] Contract test POST /api/admin/verification/cycles in `apps/backend/tests/contract/admin-verification-cycles-post.test.ts`
- [x] T006 [P] Contract test POST /api/admin/verification/cycles/{id}/prepare in `apps/backend/tests/contract/admin-verification-prepare.test.ts`
- [x] T007 [P] Contract test GET /api/admin/verification/cycles/{id}/databases in `apps/backend/tests/contract/admin-verification-databases.test.ts`
- [x] T008 [P] Contract test PUT /api/admin/verification/invoices/{id}/payment in `apps/backend/tests/contract/admin-verification-payment.test.ts`

### Contract Tests (Business API)
- [x] T009 [P] Contract test GET /api/business/verification/databases in `apps/backend/tests/contract/business-verification-databases-get.test.ts`
- [x] T010 [P] Contract test GET /api/business/verification/databases/{id}/download/{format} in `apps/backend/tests/contract/business-verification-download.test.ts`
- [x] T011 [P] Contract test POST /api/business/verification/databases/{id}/submit in `apps/backend/tests/contract/business-verification-submit.test.ts`
- [x] T012 [P] Contract test PATCH /api/business/verification/databases/{id}/records in `apps/backend/tests/contract/business-verification-records.test.ts`

### Integration Tests
- [x] T013 [P] Integration test complete verification cycle in `apps/backend/tests/integration/verification-cycle-complete.test.ts`
- [x] T014 [P] Integration test database preparation workflow in `apps/backend/tests/integration/verification-database-preparation.test.ts`
- [x] T015 [P] Integration test business verification submission in `apps/backend/tests/integration/verification-business-submission.test.ts`
- [x] T016 [P] Integration test payment processing workflow in `apps/backend/tests/integration/verification-payment-processing.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Types
- [x] T017 [P] WeeklyVerificationCycle model in `packages/database/src/verification/weekly-verification-cycles.ts`
- [x] T018 [P] VerificationDatabase model in `packages/database/src/verification/verification-databases.ts`
- [x] T019 [P] VerificationRecord model in `packages/database/src/verification/verification-records.ts`
- [x] T020 [P] PaymentInvoice model in `packages/database/src/verification/payment-invoices.ts`
- [x] T021 [P] CustomerRewardBatch model in `packages/database/src/verification/customer-reward-batches.ts`

### Services Layer
- [x] T022 [P] VerificationCycleService in `apps/backend/src/services/verification/verificationCycleService.ts`
- [x] T023 [P] DatabasePreparationService in `apps/backend/src/services/verification/databasePreparationService.ts`
- [x] T024 [P] FileExportService in `apps/backend/src/services/verification/fileExportService.ts`
- [x] T025 [P] PaymentProcessingService in `apps/backend/src/services/verification/paymentProcessingService.ts`
- [x] T026 [P] NotificationService integration for verification in `apps/backend/src/services/verification/notificationService.ts`

### Admin API Endpoints
- [x] T027 GET /api/admin/verification/cycles in `apps/backend/src/routes/admin/verification/cycles.ts`
- [x] T028 POST /api/admin/verification/cycles in `apps/backend/src/routes/admin/verification/cycles.ts`
- [x] T029 POST /api/admin/verification/cycles/{id}/prepare in `apps/backend/src/routes/admin/verification/prepare.ts`
- [x] T030 GET /api/admin/verification/cycles/{id}/databases in `apps/backend/src/routes/admin/verification/databases.ts`
- [x] T031 POST /api/admin/verification/cycles/{id}/invoices in `apps/backend/src/routes/admin/verification/invoices.ts`
- [x] T032 PUT /api/admin/verification/invoices/{id}/payment in `apps/backend/src/routes/admin/verification/payment.ts`

### Business API Endpoints  
- [X] T033 GET /api/business/verification/databases in `apps/backend/src/routes/business/verification/databases.ts`
- [X] T034 GET /api/business/verification/databases/{id} in `apps/backend/src/routes/business/verification/databases.ts`
- [X] T035 GET /api/business/verification/databases/{id}/download/{format} in `apps/backend/src/routes/business/verification/download.ts`
- [X] T036 POST /api/business/verification/databases/{id}/submit in `apps/backend/src/routes/business/verification/submit.ts`
- [X] T037 PATCH /api/business/verification/databases/{id}/records in `apps/backend/src/routes/business/verification/records.ts`

### Middleware & Validation
- [X] T038 Verification workflow authentication middleware in `apps/backend/src/middleware/verification-auth.ts`
- [X] T039 File upload validation middleware in `apps/backend/src/middleware/file-upload-validation.ts`
- [X] T040 Request validation schemas in `apps/backend/src/middleware/verification-schemas.ts`

## Phase 3.4: Frontend Components

### Admin Dashboard UI
- [x] T041 [P] VerificationCyclesList component in `apps/admin/src/components/verification/VerificationCyclesList.tsx`
- [x] T042 [P] VerificationDatabasesTable component in `apps/admin/src/components/verification/VerificationDatabasesTable.tsx`
- [x] T043 [P] PaymentInvoicesManager component in `apps/admin/src/components/verification/PaymentInvoicesManager.tsx`
- [x] T044 Admin verification pages in `apps/admin/src/app/admin/verification/`

### Business Portal UI
- [x] T045 [P] VerificationDashboard component in `apps/business/src/components/verification/VerificationDashboard.tsx`
- [x] T046 [P] VerificationFileDownload component in `apps/business/src/components/verification/VerificationFileDownload.tsx`
- [x] T047 [P] VerificationSubmission component in `apps/business/src/components/verification/VerificationSubmission.tsx`
- [x] T048 [P] VerificationRecordsTable component in `apps/business/src/components/verification/VerificationRecordsTable.tsx`
- [x] T049 Business verification pages in `apps/business/src/app/verification/`

## Phase 3.5: Background Jobs & Automation
- [x] T050 [P] Database preparation job in `apps/backend/src/jobs/database-preparation.ts`
- [x] T051 [P] Notification reminder job in `apps/backend/src/jobs/notification-reminders.ts`
- [x] T052 [P] Payment processing job in `apps/backend/src/jobs/payment-processing.ts`
- [x] T053 [P] File cleanup job in `apps/backend/src/jobs/file-cleanup.ts`
- [x] T054 Job scheduler integration in `apps/backend/src/services/job-scheduler.ts`

## Phase 3.6: Integration & Error Handling
- [x] T055 Supabase Storage integration for file exports in `apps/backend/src/services/storage/verification-storage.ts`
- [x] T056 Swish payment API integration in `apps/backend/src/services/payment/swish-provider.ts`
- [x] T057 Email template service for verification notifications in `apps/backend/src/services/email/verification-templates.ts`
- [x] T058 Error handling and logging for verification workflow in `apps/backend/src/middleware/verification-error-handler.ts`
- [x] T059 Complete audit trail for database preparation operations (FR-004) in `apps/backend/src/services/audit/verification-audit.ts`

## Phase 3.7: Polish & Performance
- [x] T060 [P] Unit tests for VerificationCycleService in `apps/backend/tests/unit/verification-cycle-service.test.ts`
- [x] T061 [P] Unit tests for FileExportService in `apps/backend/tests/unit/file-export-service.test.ts`
- [x] T062 [P] Unit tests for PaymentProcessingService in `apps/backend/tests/unit/payment-processing-service.test.ts`
- [x] T063 [P] Performance tests for database preparation (<2 hours) in `apps/backend/tests/performance/database-preparation.test.ts`
- [x] T064 [P] Performance tests for file export (<15 minutes) in `apps/backend/tests/performance/file-export.test.ts`
- [x] T065 [P] Security tests for RLS policies in `apps/backend/tests/security/verification-rls.test.ts`
- [x] T066 [P] Frontend component tests in `apps/business/tests/components/verification/`
- [x] T067 Update API documentation in `docs/api/verification-api.md`
- [x] T068 Run complete quickstart validation scenarios

## Dependencies
```
Setup (T001-T003) → Tests (T004-T016) → Core (T017-T040) → Frontend (T041-T049) → Jobs (T050-T054) → Integration (T055-T059) → Polish (T060-T068)

Key Blocking Dependencies:
- T001 (schema) blocks T017-T021 (models)
- T017-T021 (models) block T022-T026 (services)
- T022-T026 (services) block T027-T037 (endpoints)
- T027-T037 (endpoints) block T041-T049 (frontend)
- All implementation blocks T060-T068 (polish)
```

## Parallel Execution Examples

### Contract Tests (Can run simultaneously)
```bash
# Launch T004-T012 together (different test files):
pnpm --filter @vocilia/backend test apps/backend/tests/contract/admin-verification-cycles-get.test.ts &
pnpm --filter @vocilia/backend test apps/backend/tests/contract/admin-verification-cycles-post.test.ts &
pnpm --filter @vocilia/backend test apps/backend/tests/contract/business-verification-databases-get.test.ts &
pnpm --filter @vocilia/backend test apps/backend/tests/contract/business-verification-download.test.ts &
wait
```

### Models (Can run simultaneously)
```bash
# Launch T017-T021 together (different model files):
# Task: "WeeklyVerificationCycle model in packages/database/src/verification/weekly-verification-cycles.ts"
# Task: "VerificationDatabase model in packages/database/src/verification/verification-databases.ts"  
# Task: "VerificationRecord model in packages/database/src/verification/verification-records.ts"
# Task: "PaymentInvoice model in packages/database/src/verification/payment-invoices.ts"
# Task: "CustomerRewardBatch model in packages/database/src/verification/customer-reward-batches.ts"
```

### Services (Can run simultaneously)
```bash
# Launch T022-T026 together (different service files):
# Task: "VerificationCycleService in apps/backend/src/services/verification/verificationCycleService.ts"
# Task: "DatabasePreparationService in apps/backend/src/services/verification/databasePreparationService.ts"
# Task: "FileExportService in apps/backend/src/services/verification/fileExportService.ts"
# Task: "PaymentProcessingService in apps/backend/src/services/verification/paymentProcessingService.ts"
# Task: "NotificationService integration in apps/backend/src/services/verification/notificationService.ts"
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify all tests fail before implementing (TDD requirement)
- Commit after each task completion
- Admin endpoints go in apps/backend/src/routes/admin/verification/
- Business endpoints go in apps/backend/src/routes/business/verification/
- All verification models go in packages/database/src/verification/
- Frontend components use existing admin/business app structure

## Task Generation Rules Applied

1. **From Contracts**:
   - admin-verification-api.yaml → T004-T008 (contract tests) + T027-T032 (endpoints)
   - business-verification-api.yaml → T009-T012 (contract tests) + T033-T037 (endpoints)
   
2. **From Data Model**:
   - 6 entities → T017-T021 (model creation tasks) [P]
   - Relationships → T022-T026 (service layer tasks) [P]
   
3. **From User Stories (quickstart.md)**:
   - 4 scenarios → T013-T016 (integration tests) [P]
   - Validation steps → T068 (quickstart validation)

4. **Ordering Applied**:
   - Setup (T001-T003) → Tests (T004-T016) → Models (T017-T021) → Services (T022-T026) → Endpoints (T027-T037) → Frontend (T041-T049) → Jobs (T050-T054) → Integration (T055-T059) → Polish (T060-T068)

## Validation Checklist ✓

- [x] All contracts have corresponding tests (T004-T012)
- [x] All entities have model tasks (T017-T021) 
- [x] All tests come before implementation (T004-T016 before T017+)
- [x] Parallel tasks truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD order enforced (tests must fail before implementation)
- [x] Constitutional compliance (TypeScript strict, real data, monorepo structure)

---

**Total Tasks**: 68  
**Estimated Duration**: 4-6 weeks (assuming 2-3 tasks per day)  
**Critical Path**: Setup → Contract Tests → Models → Services → Endpoints → Frontend  
**Parallel Opportunities**: 39 tasks marked [P] for concurrent execution