# Tasks: Custom Questions Configuration Panel

**Input**: Design documents from `/Users/lucasjenner/alpha/specs/006-step-2-4/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Next.js 14, React 18, Supabase, TypeScript 5.5+, Railway
2. Load design documents:
   → data-model.md: 5 entities (custom_questions, question_categories, etc.)
   → contracts/: 7 API endpoints for question management
   → quickstart.md: 6 user scenarios for integration tests
3. Generate tasks by category:
   → Setup: database migrations, package dependencies
   → Tests: contract tests, integration tests (TDD)
   → Core: models, services, API endpoints
   → Integration: RLS policies, frontend components
   → Polish: unit tests, performance validation
4. Applied task rules:
   → Different files = [P] for parallel execution
   → Database migrations before models
   → Tests before implementation (TDD)
5. Tasks numbered T001-T040
6. Dependency validation complete
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `apps/backend/src/`, `apps/business/src/`
- **Shared packages**: `packages/types/src/`, `packages/database/src/`
- Database migrations: `supabase/migrations/`

## Phase 3.1: Setup & Dependencies

- [x] **T001** Create Supabase migration for custom questions schema in `supabase/migrations/20250921000001_custom_questions_schema.sql`
- [x] **T002** [P] Add question type definitions to `packages/types/src/questions/index.ts`
- [x] **T003** [P] Create question database utilities in `packages/database/src/questions/index.ts`
- [x] **T004** [P] Add React Query dependency to apps/business package.json
- [x] **T005** Apply migration and generate TypeScript types: `npx supabase db push && npx supabase gen types`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [x] **T006** [P] Contract test GET /api/questions in `apps/backend/tests/contract/questions-list.test.ts`
- [x] **T007** [P] Contract test POST /api/questions in `apps/backend/tests/contract/questions-create.test.ts`
- [x] **T008** [P] Contract test GET /api/questions/{id} in `apps/backend/tests/contract/questions-get.test.ts`
- [x] **T009** [P] Contract test PUT /api/questions/{id} in `apps/backend/tests/contract/questions-update.test.ts`
- [x] **T010** [P] Contract test DELETE /api/questions/{id} in `apps/backend/tests/contract/questions-delete.test.ts`
- [x] **T011** [P] Contract test POST /api/questions/{id}/preview in `apps/backend/tests/contract/questions-preview.test.ts`
- [x] **T012** [P] Contract test POST /api/questions/{id}/activate in `apps/backend/tests/contract/questions-activate.test.ts`
- [x] **T013** [P] Contract test GET /api/questions/categories in `apps/backend/tests/contract/categories-list.test.ts`
- [x] **T014** [P] Contract test POST /api/questions/{id}/triggers in `apps/backend/tests/contract/triggers-create.test.ts`

### Integration Tests (User Scenarios)
- [x] **T015** [P] Integration test: Create new question scenario in `apps/backend/tests/integration/question-creation.test.ts`
- [x] **T016** [P] Integration test: Question category management in `apps/backend/tests/integration/category-management.test.ts`
- [x] **T017** [P] Integration test: Question preview functionality in `apps/backend/tests/integration/question-preview.test.ts`
- [x] **T018** [P] Integration test: Question activation/deactivation in `apps/backend/tests/integration/question-lifecycle.test.ts`
- [x] **T019** [P] Integration test: Trigger configuration in `apps/backend/tests/integration/trigger-configuration.test.ts`
- [x] **T020** [P] Integration test: Frequency management in `apps/backend/tests/integration/frequency-management.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Services
- [x] **T021** [P] Custom Question model in `packages/database/src/questions/models/CustomQuestion.ts`
- [x] **T022** [P] Question Category model in `packages/database/src/questions/models/QuestionCategory.ts`
- [x] **T023** [P] Question Trigger model in `packages/database/src/questions/models/QuestionTrigger.ts`
- [x] **T024** [P] Question Response model in `packages/database/src/questions/models/QuestionResponse.ts`
- [x] **T025** Question service layer in `apps/backend/src/services/questions/QuestionService.ts`
- [x] **T026** Question trigger service in `apps/backend/src/services/questions/TriggerService.ts`
- [x] **T027** Question frequency service in `apps/backend/src/services/questions/FrequencyService.ts`

### API Endpoints Implementation
- [x] **T028** GET /api/questions endpoint in `apps/backend/src/routes/questions/list.ts`
- [x] **T029** POST /api/questions endpoint in `apps/backend/src/routes/questions/create.ts`
- [x] **T030** GET /api/questions/{id} endpoint in `apps/backend/src/routes/questions/get.ts`
- [x] **T031** PUT /api/questions/{id} endpoint in `apps/backend/src/routes/questions/update.ts`
- [x] **T032** DELETE /api/questions/{id} endpoint in `apps/backend/src/routes/questions/delete.ts`
- [x] **T033** POST /api/questions/{id}/preview endpoint in `apps/backend/src/routes/questions/preview.ts`
- [x] **T034** POST /api/questions/{id}/activate endpoint in `apps/backend/src/routes/questions/activate.ts`
- [x] **T035** GET /api/questions/categories endpoint in `apps/backend/src/routes/questions/categories.ts`

## Phase 3.4: Frontend Integration

### Business App Components
- [x] **T036** Questions list page in `apps/business/src/app/questions/page.tsx`
- [x] **T037** Question creation form in `apps/business/src/components/questions/QuestionForm.tsx`
- [x] **T038** Question preview component in `apps/business/src/components/questions/QuestionPreview.tsx`
- [x] **T039** Category management component in `apps/business/src/components/questions/CategoryManager.tsx`
- [x] **T040** Question trigger configuration in `apps/business/src/components/questions/TriggerConfig.tsx`

### API Integration & Hooks
- [x] **T041** Questions API client in `apps/business/src/services/questionsApi.ts`
- [x] **T042** [P] React Query hooks in `apps/business/src/hooks/useQuestions.ts`
- [x] **T043** [P] Question form validation in `apps/business/src/utils/questionValidation.ts`

## Phase 3.5: Security & Middleware

### RLS Policies
- [x] **T044** Custom questions RLS policies in `supabase/migrations/20250921000002_questions_rls.sql`
- [x] **T045** Question categories RLS policies in existing migration file
- [x] **T046** Question triggers RLS policies in existing migration file

### Middleware & Validation
- [x] **T047** Question validation middleware in `apps/backend/src/middleware/questionValidation.ts`
- [x] **T048** Question context middleware in `apps/backend/src/middleware/questionContext.ts`
- [x] **T049** Request/response logging for questions API in existing logging middleware

## Phase 3.6: Polish & Performance

### Unit Tests
- [x] **T050** [P] Question service unit tests in `apps/backend/tests/unit/QuestionService.test.ts`
- [x] **T051** [P] Trigger service unit tests in `apps/backend/tests/unit/TriggerService.test.ts`
- [x] **T052** [P] Frequency service unit tests in `apps/backend/tests/unit/FrequencyService.test.ts`
- [x] **T053** [P] Frontend component unit tests in `apps/business/tests/components/QuestionForm.test.tsx`

### Performance & Optimization
- [x] **T054** Database indexing optimization for questions queries
- [x] **T055** Question list pagination and filtering optimization
- [x] **T056** Preview generation performance optimization (<100ms target)
- [x] **T057** Trigger evaluation performance optimization (<50ms target)

### Documentation & Validation
- [x] **T058** [P] Update business app navigation to include questions section
- [x] **T059** [P] Add questions management to business dashboard layout
- [x] **T060** Run quickstart validation scenarios from `specs/006-step-2-4/quickstart.md`

## Dependencies

### Critical Blocking Dependencies
- **Database**: T001 → T005 → T021-T024 → T025-T027 → T028-T035
- **Types**: T002 → T006-T020 (contract tests need types)
- **Tests**: T006-T020 → T021-T035 (TDD: tests before implementation)
- **Services**: T025-T027 → T028-T035 (endpoints need services)
- **API**: T028-T035 → T041-T043 (frontend needs working API)
- **Frontend**: T036-T040 → T058-T059 (navigation after components)

### Service Layer Dependencies
- T021-T024 (models) → T025 (QuestionService)
- T025 (QuestionService) → T026, T027 (specialized services)
- T044-T046 (RLS) → T047-T048 (middleware relies on RLS)

### Frontend Dependencies
- T041 (API client) → T042 (React Query hooks)
- T037-T040 (components) → T036 (main page that uses them)
- T042-T043 (hooks/validation) → T037-T040 (components use hooks)

## Parallel Execution Examples

### Phase 3.2 - Launch all contract tests together:
```bash
# Launch T006-T014 in parallel (different test files):
Task: "Contract test GET /api/questions in apps/backend/tests/contract/questions-list.test.ts"
Task: "Contract test POST /api/questions in apps/backend/tests/contract/questions-create.test.ts"
Task: "Contract test GET /api/questions/{id} in apps/backend/tests/contract/questions-get.test.ts"
# ... continue for T007-T014
```

### Phase 3.2 - Launch all integration tests together:
```bash
# Launch T015-T020 in parallel (different test files):
Task: "Integration test: Create new question scenario in apps/backend/tests/integration/question-creation.test.ts"
Task: "Integration test: Question category management in apps/backend/tests/integration/category-management.test.ts"
# ... continue for T016-T020
```

### Phase 3.3 - Launch model creation in parallel:
```bash
# Launch T021-T024 in parallel (different model files):
Task: "Custom Question model in packages/database/src/questions/models/CustomQuestion.ts"
Task: "Question Category model in packages/database/src/questions/models/QuestionCategory.ts"
Task: "Question Trigger model in packages/database/src/questions/models/QuestionTrigger.ts"
Task: "Question Response model in packages/database/src/questions/models/QuestionResponse.ts"
```

### Phase 3.6 - Launch unit tests in parallel:
```bash
# Launch T050-T053 in parallel (different test files):
Task: "Question service unit tests in apps/backend/tests/unit/QuestionService.test.ts"
Task: "Trigger service unit tests in apps/backend/tests/unit/TriggerService.test.ts"
Task: "Frequency service unit tests in apps/backend/tests/unit/FrequencyService.test.ts"
Task: "Frontend component unit tests in apps/business/tests/components/QuestionForm.test.tsx"
```

## Notes

### Implementation Guidelines
- **[P] tasks**: Different files, no dependencies - safe for parallel execution
- **Sequential tasks**: Modify same files or have logical dependencies
- **Verify tests fail**: Before implementing T021+, ensure T006-T020 tests are failing
- **TypeScript strict mode**: All code must pass strict compilation
- **RLS compliance**: All database operations must respect Row Level Security

### File Organization
- Backend API routes follow existing pattern: `apps/backend/src/routes/{feature}/{action}.ts`
- Frontend components use Next.js 14 App Router: `apps/business/src/app/{feature}/`
- Shared components in: `apps/business/src/components/{feature}/`
- Database models in packages: `packages/database/src/{feature}/models/`
- Type definitions in packages: `packages/types/src/{feature}/`

### Performance Targets
- Question configuration updates: <200ms
- Preview generation: <100ms
- Trigger evaluation: <50ms
- Question list loading: <200ms
- Frequency counter updates: <10ms

## Task Generation Rules
*Applied during execution*

1. **From Contracts**: 9 endpoints → 9 contract tests [P] + 8 implementation tasks
2. **From Data Model**: 5 entities → 4 model tasks [P] + 3 service tasks
3. **From User Stories**: 6 scenarios → 6 integration tests [P]
4. **Ordering**: Setup → Tests → Models → Services → Endpoints → Frontend → Polish
5. **Dependencies**: Strict blocking prevents parallel conflicts

## Validation Checklist
*GATE: Checked before task execution*

- [x] All 9 API endpoints have corresponding contract tests (T006-T014)
- [x] All 4 entities have model creation tasks (T021-T024)
- [x] All tests come before implementation (T006-T020 before T021+)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Database migrations before models (T001 → T021-T024)
- [x] RLS policies before middleware (T044-T046 → T047-T048)

---
**Tasks Complete**: Ready for implementation execution using Test-Driven Development