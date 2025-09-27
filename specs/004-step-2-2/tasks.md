# Tasks: QR Code Management System

**Input**: Design documents from `/specs/004-step-2-2/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.5+, Next.js 14, Node.js 18+, Supabase, qrcode, jspdf
   → Structure: Web app with apps/business frontend and apps/backend services
2. Load design documents:
   → data-model.md: QR entities (stores enhancement, scan events, analytics, history, templates)
   → contracts/: 7 API endpoints + template management
   → research.md: QR generation, PDF creation, analytics decisions
3. Generate tasks by category:
   → Setup: dependencies, database schema, TypeScript types
   → Tests: 7 contract tests + 6 integration scenarios  
   → Core: QR services, analytics, PDF generation, frontend components
   → Integration: database connections, real-time updates, bulk operations
   → Polish: performance optimization, error handling, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel execution
   → Database and types before services
   → Tests before implementation (TDD approach)
5. Number tasks sequentially (T001-T034)
6. Dependencies: Setup → Tests → Models → Services → Frontend → Integration → Polish
7. Parallel execution for independent file creation
8. SUCCESS: 34 tasks ready for QR Code Management System implementation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `apps/backend/src/` for services and API routes
- **Frontend**: `apps/business/src/` for components and pages  
- **Packages**: `packages/types/src/qr/`, `packages/database/src/qr/`
- **Tests**: `apps/backend/tests/` and `apps/business/tests/`

## Phase 3.1: Setup & Dependencies
- [x] **T001** Install QR code dependencies (qrcode, react-qr-code, jspdf, canvas) in backend and frontend
- [x] **T002** [P] Create QR TypeScript types in `packages/types/src/qr/index.ts`
- [x] **T003** [P] Create database migration for QR analytics tables in `supabase/migrations/20250920000001_qr_management.sql`
- [x] **T004** [P] Create QR database utilities in `packages/database/src/qr/index.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] **T005** [P] Contract test GET /qr/stores/{storeId} in `apps/backend/tests/contract/qr-store-get.test.ts`
- [x] **T006** [P] Contract test POST /qr/stores/{storeId}/regenerate in `apps/backend/tests/contract/qr-regenerate.test.ts`
- [x] **T007** [P] Contract test GET /qr/stores/{storeId}/download in `apps/backend/tests/contract/qr-download.test.ts`
- [x] **T008** [P] Contract test GET /qr/analytics/{storeId} in `apps/backend/tests/contract/qr-analytics.test.ts`
- [x] **T009** [P] Contract test POST /qr/bulk/regenerate in `apps/backend/tests/contract/qr-bulk.test.ts`
- [x] **T010** [P] Contract test POST /qr/scan in `apps/backend/tests/contract/qr-scan.test.ts`
- [x] **T011** [P] Contract test QR templates CRUD in `apps/backend/tests/contract/qr-templates.test.ts`
- [x] **T012** [P] Integration test QR regeneration workflow in `apps/business/tests/integration/qr-regeneration.test.ts`
- [x] **T013** [P] Integration test QR analytics tracking in `apps/business/tests/integration/qr-analytics.test.ts`
- [x] **T014** [P] Integration test bulk QR operations in `apps/business/tests/integration/qr-bulk-operations.test.ts`
- [x] **T015** [P] Integration test PDF template system in `apps/business/tests/integration/qr-templates.test.ts`
- [x] **T016** [P] Integration test QR scan tracking in `apps/business/tests/integration/qr-scan-tracking.test.ts`
- [x] **T017** [P] Integration test QR transition periods in `apps/business/tests/integration/qr-transitions.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
### Database & Services Layer
- [x] **T018** [P] QR generation service in `apps/backend/src/services/qr/qr-generator.service.ts`
- [x] **T019** [P] PDF template service in `apps/backend/src/services/qr/pdf-template.service.ts`
- [x] **T020** [P] QR analytics service in `apps/backend/src/services/qr/qr-analytics.service.ts`
- [x] **T021** [P] QR scan tracking service in `apps/backend/src/services/qr/scan-tracker.service.ts`
- [x] **T022** QR management service coordinator in `apps/backend/src/services/qr/qr-management.service.ts`

### API Endpoints
- [x] **T023** GET /qr/stores/{storeId} route in `apps/backend/src/routes/qr/store-qr.route.ts`
- [x] **T024** POST /qr/stores/{storeId}/regenerate route in `apps/backend/src/routes/qr/regenerate-qr.route.ts`
- [x] **T025** GET /qr/stores/{storeId}/download route in `apps/backend/src/routes/qr/download-qr.route.ts`
- [x] **T026** GET /qr/analytics/{storeId} route in `apps/backend/src/routes/qr/analytics.route.ts`
- [x] **T027** POST /qr/bulk/regenerate route in `apps/backend/src/routes/qr/bulk-operations.route.ts`
- [x] **T028** POST /qr/scan route in `apps/backend/src/routes/qr/scan-tracking.route.ts`
- [x] **T029** QR templates CRUD routes in `apps/backend/src/routes/qr/templates.route.ts`

## Phase 3.4: Frontend Implementation
- [x] **T030** [P] QR display component in `apps/business/src/components/qr/QRCodeDisplay.tsx`
- [x] **T031** [P] QR management dashboard in `apps/business/src/components/qr/QRManagementDashboard.tsx`
- [x] **T032** [P] QR analytics charts in `apps/business/src/components/qr/QRAnalyticsCharts.tsx`
- [x] **T033** [P] Bulk QR operations component in `apps/business/src/components/qr/BulkQROperations.tsx`
- [x] **T034** [P] Template management interface in `apps/business/src/components/qr/TemplateManager.tsx`
- [x] **T035** QR management pages in `apps/business/src/pages/qr/`
- [x] **T036** Frontend QR service layer in `apps/business/src/services/qr/qr-client.service.ts`

## Phase 3.5: Integration & Real-time Features
- [x] **T037** Database connection setup for QR services in `apps/backend/src/config/qr-database.ts`
- [x] **T038** Real-time scan tracking with WebSocket in `apps/backend/src/services/qr/real-time-scanner.service.ts`
- [x] **T039** QR analytics aggregation cron jobs in `apps/backend/src/jobs/qr-analytics-aggregator.job.ts`
- [x] **T040** Row Level Security policies for QR tables in `supabase/migrations/20250921000003_qr_rls_policies_update.sql`
- [x] **T041** QR route middleware and authentication in `apps/backend/src/middleware/qr-auth.middleware.ts`

## Phase 3.6: Polish & Performance
- [x] **T042** [P] Unit tests for QR generation logic in `apps/backend/tests/unit/qr-generation.test.ts`
- [x] **T043** [P] Unit tests for PDF template rendering in `apps/backend/tests/unit/pdf-templates.test.ts`
- [x] **T044** [P] Unit tests for analytics aggregation in `apps/backend/tests/unit/analytics-aggregation.test.ts`
- [x] **T045** Performance optimization for QR generation (<200ms) in existing QR services
- [x] **T046** PDF size optimization (<2MB) in PDF template service
- [x] **T047** Error handling and logging throughout QR system
- [x] **T048** QR system documentation in `docs/qr-management.md`
- [x] **T049** Execute quickstart validation workflows from `specs/004-step-2-2/quickstart.md`

## Dependencies
```
Setup Dependencies:
T001 → T002, T003, T004 (dependencies before types/migrations)

Test Dependencies:
T002, T003, T004 → T005-T017 (types/schema before tests)

Implementation Dependencies:
T005-T017 → T018-T029 (tests before implementation)
T002 → T018-T022 (types before services)
T018-T022 → T023-T029 (services before routes)
T018-T022 → T030-T036 (services before frontend)

Integration Dependencies:
T003 → T037, T040 (schema before DB setup and RLS)
T021 → T038 (scan service before real-time)
T020 → T039 (analytics service before aggregation)

Polish Dependencies:
T018-T029 → T042-T044 (implementation before unit tests)
T023-T029 → T045-T047 (routes before optimization)
All implementation → T048, T049 (everything before docs/validation)
```

## Parallel Execution Examples

### Phase 3.1 (Setup) - Run T002-T004 in parallel:
```bash
# These can run simultaneously as they create different files
Task: "Create QR TypeScript types in packages/types/src/qr/index.ts"
Task: "Create database migration for QR analytics tables in supabase/migrations/20250920000001_qr_management.sql"  
Task: "Create QR database utilities in packages/database/src/qr/index.ts"
```

### Phase 3.2 (Contract Tests) - Run T005-T011 in parallel:
```bash
# All contract tests can run simultaneously (different test files)
Task: "Contract test GET /qr/stores/{storeId} in apps/backend/tests/contract/qr-store-get.test.ts"
Task: "Contract test POST /qr/stores/{storeId}/regenerate in apps/backend/tests/contract/qr-regenerate.test.ts"
Task: "Contract test GET /qr/stores/{storeId}/download in apps/backend/tests/contract/qr-download.test.ts"
Task: "Contract test GET /qr/analytics/{storeId} in apps/backend/tests/contract/qr-analytics.test.ts"
Task: "Contract test POST /qr/bulk/regenerate in apps/backend/tests/contract/qr-bulk.test.ts"
Task: "Contract test POST /qr/scan in apps/backend/tests/contract/qr-scan.test.ts"
Task: "Contract test QR templates CRUD in apps/backend/tests/contract/qr-templates.test.ts"
```

### Phase 3.2 (Integration Tests) - Run T012-T017 in parallel:
```bash
# All integration tests can run simultaneously (different test files)
Task: "Integration test QR regeneration workflow in apps/business/tests/integration/qr-regeneration.test.ts"
Task: "Integration test QR analytics tracking in apps/business/tests/integration/qr-analytics.test.ts"
Task: "Integration test bulk QR operations in apps/business/tests/integration/qr-bulk-operations.test.ts"
Task: "Integration test PDF template system in apps/business/tests/integration/qr-templates.test.ts"
Task: "Integration test QR scan tracking in apps/business/tests/integration/qr-scan-tracking.test.ts"
Task: "Integration test QR transition periods in apps/business/tests/integration/qr-transitions.test.ts"
```

### Phase 3.3 (Core Services) - Run T018-T021 in parallel:
```bash
# Core services can be built simultaneously (different service files)
Task: "QR generation service in apps/backend/src/services/qr/qr-generator.service.ts"
Task: "PDF template service in apps/backend/src/services/qr/pdf-template.service.ts"
Task: "QR analytics service in apps/backend/src/services/qr/qr-analytics.service.ts"
Task: "QR scan tracking service in apps/backend/src/services/qr/scan-tracker.service.ts"
```

### Phase 3.4 (Frontend Components) - Run T030-T034 in parallel:
```bash
# Frontend components can be built simultaneously (different component files)
Task: "QR display component in apps/business/src/components/qr/QRCodeDisplay.tsx"
Task: "QR management dashboard in apps/business/src/components/qr/QRManagementDashboard.tsx"
Task: "QR analytics charts in apps/business/src/components/qr/QRAnalyticsCharts.tsx"
Task: "Bulk QR operations component in apps/business/src/components/qr/BulkQROperations.tsx"
Task: "Template management interface in apps/business/src/components/qr/TemplateManager.tsx"
```

### Phase 3.6 (Unit Tests) - Run T042-T044 in parallel:
```bash
# Unit tests can run simultaneously (different test files)
Task: "Unit tests for QR generation logic in apps/backend/tests/unit/qr-generation.test.ts"
Task: "Unit tests for PDF template rendering in apps/backend/tests/unit/pdf-templates.test.ts"
Task: "Unit tests for analytics aggregation in apps/backend/tests/unit/analytics-aggregation.test.ts"
```

## Implementation Notes

### TDD Approach
- **CRITICAL**: All tests (T005-T017) must be written and failing before any implementation
- Contract tests validate API specifications exactly match OpenAPI schema
- Integration tests validate complete user workflows from quickstart.md
- Implementation tasks (T018+) should make tests pass one by one

### Technology Integration
- **QR Generation**: Use `qrcode` library with TypeScript bindings
- **PDF Creation**: `jspdf` + `canvas` for customizable templates
- **Real-time Updates**: Supabase real-time subscriptions for scan tracking
- **Analytics**: 5-minute batch aggregation with WebSocket for live updates
- **Performance**: <200ms QR generation, <2MB PDF files, 5-minute analytics refresh

### Database Schema
- Extend existing `stores` table with QR fields (T003)
- New tables: `qr_scan_events`, `qr_analytics_*`, `qr_code_history`, `qr_print_templates`
- RLS policies for multi-tenant access (T040)
- Indexes for analytics query performance

### File Organization
- Backend services in `apps/backend/src/services/qr/`
- API routes in `apps/backend/src/routes/qr/`
- Frontend components in `apps/business/src/components/qr/`
- Shared types in `packages/types/src/qr/`
- Database utilities in `packages/database/src/qr/`

## Validation Checklist
*GATE: Verified before task execution*

- [x] All 7 API endpoints have contract tests (T005-T011)
- [x] All 5 entities have implementation tasks (stores enhancement, scan events, analytics, history, templates)
- [x] All tests come before implementation (T005-T017 → T018+)
- [x] Parallel tasks use different files ([P] markers validated)
- [x] Each task specifies exact file path
- [x] Dependencies properly sequenced (setup → tests → implementation → polish)
- [x] Performance requirements addressed (T045-T046)
- [x] Constitutional compliance maintained (RLS, TypeScript strict, real data)

---

**Total Tasks**: 49  
**Parallel Opportunities**: 23 tasks marked [P]  
**Estimated Duration**: 8-10 development days with parallel execution  
**Ready for Implementation**: Yes - all design documents complete