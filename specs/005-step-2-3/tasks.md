# Tasks: Business Context Window (Core Feature)

**Input**: Design documents from `/Users/lucasjenner/alpha/specs/005-step-2-3/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Summary
Based on implementation plan analysis:
- **Tech Stack**: Next.js 14, Express, Supabase, TypeScript 5.5+
- **Project Structure**: Web application (apps/business + apps/backend)
- **Entities**: 9 database entities with RLS policies
- **API Endpoints**: 8 context management endpoints
- **Test Scenarios**: 5 integration test scenarios from quickstart

## Task Categories Generated
- **Setup**: 4 tasks - Dependencies, migrations, types
- **Tests**: 13 tasks - Contract tests [P] and integration tests [P]
- **Database**: 9 tasks - Entity models and migrations [P]
- **Backend**: 8 tasks - API endpoints and services
- **Frontend**: 12 tasks - Context UI components and pages
- **Integration**: 6 tasks - Auth, validation, real-time updates
- **Polish**: 4 tasks - Performance, documentation, validation

**Total**: 56 implementation tasks

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Paths relative to monorepo root: `/Users/lucasjenner/alpha/`

## Phase 3.1: Setup & Dependencies

- [x] **T001** Initialize context feature branch and workspace structure
- [x] **T002** Add context-specific dependencies to apps/business and apps/backend package.json
- [x] **T003** [P] Configure ESLint and TypeScript for context modules
- [x] **T004** [P] Update Tailwind config for context UI components

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [x] **T005** [P] Contract test GET /business/stores/{storeId}/context in `apps/backend/tests/contract/context-get.test.ts`
- [x] **T006** [P] Contract test PUT /business/stores/{storeId}/context in `apps/backend/tests/contract/context-put.test.ts`
- [x] **T007** [P] Contract test POST /business/stores/{storeId}/context/profile in `apps/backend/tests/contract/context-profile.test.ts`
- [x] **T008** [P] Contract test POST /business/stores/{storeId}/context/personnel in `apps/backend/tests/contract/context-personnel.test.ts`
- [x] **T009** [P] Contract test POST /business/stores/{storeId}/context/layout in `apps/backend/tests/contract/context-layout.test.ts`
- [x] **T010** [P] Contract test POST /business/stores/{storeId}/context/inventory in `apps/backend/tests/contract/context-inventory.test.ts`
- [x] **T011** [P] Contract test GET /business/stores/{storeId}/context/completeness in `apps/backend/tests/contract/context-completeness.test.ts`
- [x] **T012** [P] Contract test GET /business/stores/{storeId}/context/export in `apps/backend/tests/contract/context-export.test.ts`

### Integration Tests (User Scenarios)
- [x] **T013** [P] Integration test store profile configuration in `apps/business/tests/integration/store-profile.test.tsx`
- [x] **T014** [P] Integration test personnel management in `apps/business/tests/integration/personnel-management.test.tsx`
- [x] **T015** [P] Integration test layout builder in `apps/business/tests/integration/layout-builder.test.tsx`
- [x] **T016** [P] Integration test inventory configuration in `apps/business/tests/integration/inventory-config.test.tsx`
- [x] **T017** [P] Integration test context versioning and AI export in `apps/business/tests/integration/context-versioning.test.tsx`

## Phase 3.3: Database Schema & Types (ONLY after tests are failing)

### Type Definitions
- [x] **T018** [P] Store context profile types in `packages/types/src/context/profile.ts`
- [x] **T019** [P] Personnel context types in `packages/types/src/context/personnel.ts`
- [x] **T020** [P] Layout context types in `packages/types/src/context/layout.ts`
- [x] **T021** [P] Inventory context types in `packages/types/src/context/inventory.ts`
- [x] **T022** [P] Context versioning types in `packages/types/src/context/versions.ts`

### Database Migrations
- [x] **T023** [P] Create store_context_profiles table migration in `supabase/migrations/`
- [x] **T024** [P] Create store_operating_hours table migration in `supabase/migrations/`
- [x] **T025** [P] Create store_context_personnel table migration in `supabase/migrations/`
- [x] **T026** [P] Create store_context_layouts table migration in `supabase/migrations/`
- [x] **T027** [P] Create store_context_inventory table migration in `supabase/migrations/`
- [x] **T028** [P] Create store_context_versions table migration in `supabase/migrations/`
- [x] **T029** [P] Create RLS policies for all context tables in `supabase/migrations/`

## Phase 3.4: Backend API Implementation

### Database Services
- [x] **T030** [P] Context profile database service in `packages/database/src/context/profiles.ts`
- [x] **T031** [P] Personnel context database service in `packages/database/src/context/personnel.ts`
- [x] **T032** [P] Layout context database service in `packages/database/src/context/layouts.ts`
- [x] **T033** [P] Inventory context database service in `packages/database/src/context/inventory.ts`
- [x] **T034** [P] Context versioning database service in `packages/database/src/context/versions.ts`

### API Routes & Services
- [x] **T035** Context validation service in `apps/backend/src/services/context/validation.ts`
- [x] **T036** Context completeness calculator in `apps/backend/src/services/context/completeness.ts`
- [x] **T037** AI context export service in `apps/backend/src/services/context/ai-export.ts`
- [x] **T038** GET /business/stores/{storeId}/context endpoint in `apps/backend/src/routes/context/get-context.ts`
- [x] **T039** PUT /business/stores/{storeId}/context endpoint in `apps/backend/src/routes/context/put-context.ts`
- [x] **T040** POST context profile endpoint in `apps/backend/src/routes/context/profile.ts`
- [x] **T041** POST context personnel endpoint in `apps/backend/src/routes/context/personnel.ts`
- [x] **T042** POST context layout endpoint in `apps/backend/src/routes/context/layout.ts`
- [x] **T043** POST context inventory endpoint in `apps/backend/src/routes/context/inventory.ts`
- [x] **T044** Context completeness and export endpoints in `apps/backend/src/routes/context/utils.ts`

## Phase 3.5: Frontend Implementation

### Context Management Components
- [x] **T045** [P] Store profile form component in `apps/business/src/components/context/StoreProfileForm.tsx`
- [x] **T046** [P] Operating hours selector component in `apps/business/src/components/context/OperatingHours.tsx`
- [x] **T047** [P] Personnel management form in `apps/business/src/components/context/PersonnelForm.tsx`
- [x] **T048** [P] Shift configuration component in `apps/business/src/components/context/ShiftConfig.tsx`
- [x] **T049** [P] Layout builder component in `apps/business/src/components/context/LayoutBuilder.tsx`
- [x] **T050** [P] Department positioning component in `apps/business/src/components/context/DepartmentMap.tsx`
- [x] **T051** [P] Inventory categories form in `apps/business/src/components/context/InventoryForm.tsx`
- [x] **T052** [P] Context completeness indicator in `apps/business/src/components/context/CompletenessScore.tsx`

### Pages & Navigation
- [x] **T053** Context route layout in `apps/business/src/app/context/layout.tsx`
- [x] **T054** Context overview page in `apps/business/src/app/context/page.tsx`
- [x] **T055** Context section navigation tabs in `apps/business/src/components/context/ContextTabs.tsx`
- [x] **T056** Context version history page in `apps/business/src/app/context/versions/page.tsx`

## Phase 3.6: Integration & Real-time Features

- [x] **T057** Context API integration service in `apps/business/src/services/context-api.ts`
- [x] **T058** Context permission validation in `packages/auth/src/context/permissions.ts`
- [x] **T059** Real-time context updates with Supabase Realtime in `apps/business/src/hooks/useContextRealtime.ts`
- [x] **T060** Context change tracking and audit logging in `apps/backend/src/services/context/audit.ts`
- [x] **T061** File upload service for layout images in `apps/backend/src/services/context/file-upload.ts`
- [x] **T062** Context data validation middleware in `apps/backend/src/middleware/context-validation.ts`

## Phase 3.7: Polish & Optimization

- [x] **T063** [P] Context form performance optimization with React.memo in modified components
- [x] **T064** [P] Context API response caching and optimization
- [x] **T065** [P] Update business dashboard navigation with context links
- [x] **T066** Comprehensive context system validation and error handling

## Dependencies

### Critical Path
1. **Setup** (T001-T004) → **Tests** (T005-T017) → **Implementation** (T018+)
2. **Types** (T018-T022) → **Database** (T023-T029) → **Services** (T030-T044)
3. **Services** → **API Routes** → **Frontend Integration**

### Parallel Execution Blocks
```
Block 1 - Contract Tests (T005-T012):
Task: "Contract test GET /business/stores/{storeId}/context"
Task: "Contract test PUT /business/stores/{storeId}/context" 
Task: "Contract test POST context/profile"
Task: "Contract test POST context/personnel"
Task: "Contract test POST context/layout"
Task: "Contract test POST context/inventory"
Task: "Contract test GET context/completeness"
Task: "Contract test GET context/export"

Block 2 - Integration Tests (T013-T017):
Task: "Integration test store profile configuration"
Task: "Integration test personnel management"
Task: "Integration test layout builder"
Task: "Integration test inventory configuration"
Task: "Integration test context versioning and AI export"

Block 3 - Type Definitions (T018-T022):
Task: "Store context profile types"
Task: "Personnel context types"
Task: "Layout context types"
Task: "Inventory context types"
Task: "Context versioning types"

Block 4 - Database Migrations (T023-T029):
Task: "Create store_context_profiles table migration"
Task: "Create store_operating_hours table migration"
Task: "Create store_context_personnel table migration"
Task: "Create store_context_layouts table migration"
Task: "Create store_context_inventory table migration"
Task: "Create store_context_versions table migration"
Task: "Create RLS policies for all context tables"

Block 5 - Database Services (T030-T034):
Task: "Context profile database service"
Task: "Personnel context database service"
Task: "Layout context database service" 
Task: "Inventory context database service"
Task: "Context versioning database service"

Block 6 - UI Components (T045-T052):
Task: "Store profile form component"
Task: "Operating hours selector component"
Task: "Personnel management form"
Task: "Shift configuration component"
Task: "Layout builder component"
Task: "Department positioning component"
Task: "Inventory categories form"
Task: "Context completeness indicator"
```

### Sequential Dependencies
- T035-T037 (validation services) must complete before T038-T044 (API routes)
- T030-T034 (database services) must complete before T035-T037
- T053-T056 (pages) require T045-T052 (components)
- T057-T062 (integration) requires completed backend and frontend

## Validation Checklist
*GATE: All items must be checked before marking phase complete*

### Test Coverage
- [x] All 8 API endpoints have contract tests
- [x] All 5 quickstart scenarios have integration tests
- [x] All contract tests written to fail initially (TDD)

### Entity Coverage
- [x] All 9 database entities have type definitions
- [x] All 9 database entities have migrations
- [x] All 9 database entities have database services

### File Independence
- [x] All [P] tasks target different files
- [x] No [P] task modifies same file as another [P] task
- [x] Component tasks are independent (different .tsx files)

### Implementation Path
- [x] Tests before implementation enforced
- [x] Types before database enforced
- [x] Database before API services enforced
- [x] Services before endpoints enforced

## Notes
- **Performance Target**: <200ms for context form saves
- **Real-time Requirement**: Context changes must propagate to AI immediately
- **Multi-tenant Security**: All database operations must respect RLS policies
- **Monorepo Integration**: Extends existing packages without breaking changes
- **Constitutional Compliance**: Uses real Supabase "alpha" instance throughout

---
*56 tasks generated - Ready for implementation execution*