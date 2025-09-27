# Tasks: Feedback Analysis Dashboard

**Input**: Design documents from `/specs/008-step-2-6/` **Prerequisites**:
plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 5.5+, Next.js 14, React 18, Supabase, GPT-4o-mini
   → Structure: Web app monorepo (apps/business, apps/backend)
2. Load design documents:
   → data-model.md: 5 entities → model tasks
   → contracts/: 8 API endpoints → contract test tasks
   → quickstart.md: 8 validation scenarios → integration tests
3. Generate tasks by category:
   → Setup: database migrations, dependencies, type generation
   → Tests: contract tests, integration tests (TDD approach)
   → Core: models, services, API endpoints, frontend components
   → Integration: AI services, real-time features, authentication
   → Polish: unit tests, performance optimization, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel execution
   → Database/API layer before frontend components
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T029)
6. SUCCESS: 29 tasks ready for execution
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Includes exact file paths and specific implementation requirements

## Path Conventions

- **Backend**: `apps/backend/src/` (API endpoints, services, middleware)
- **Frontend**: `apps/business/src/` (dashboard components, pages)
- **Shared**: `packages/types/src/` (TypeScript definitions)
- **Database**: `supabase/migrations/` (schema changes)
- **Tests**: `apps/backend/tests/` and `apps/business/tests/`

## Phase 3.1: Setup & Database

- [x] **T001** Create database migration for feedback analysis tables in
      `supabase/migrations/20250921000001_feedback_analysis_schema.sql`
- [x] **T002** [P] Add new TypeScript enums and types in
      `packages/types/src/feedback-analysis.ts`
- [x] **T003** [P] Update database types generation in
      `packages/types/src/database.ts`
- [x] **T004** [P] Configure OpenAI service integration in
      `apps/backend/src/config/openai.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests (API Endpoints)

- [x] **T005** [P] Contract test GET
      `/feedback-analysis/reports/{storeId}/current` in
      `apps/backend/tests/contract/feedback-analysis-reports-current.test.ts`
- [x] **T006** [P] Contract test GET
      `/feedback-analysis/reports/{storeId}/historical` in
      `apps/backend/tests/contract/feedback-analysis-reports-historical.test.ts`
- [x] **T007** [P] Contract test POST `/feedback-analysis/search/{storeId}` in
      `apps/backend/tests/contract/feedback-analysis-search.test.ts`
- [x] **T008** [P] Contract test GET `/feedback-analysis/temporal/{storeId}` in
      `apps/backend/tests/contract/feedback-analysis-temporal.test.ts`
- [x] **T009** [P] Contract test GET `/feedback-analysis/insights/{storeId}` in
      `apps/backend/tests/contract/feedback-analysis-insights.test.ts`
- [x] **T010** [P] Contract test PATCH
      `/feedback-analysis/insights/{insightId}/status` in
      `apps/backend/tests/contract/feedback-analysis-insights-status.test.ts`
- [x] **T011** [P] Contract test POST
      `/feedback-analysis/reports/{storeId}/generate` in
      `apps/backend/tests/contract/feedback-analysis-reports-generate.test.ts`
- [x] **T012** [P] Contract test GET `/feedback-analysis/status/{jobId}` in
      `apps/backend/tests/contract/feedback-analysis-status.test.ts`

### Integration Tests (User Scenarios)

- [x] **T013** [P] Integration test dashboard access and categorization in
      `apps/business/tests/integration/dashboard-access.test.ts`
- [x] **T014** [P] Integration test new critiques identification in
      `apps/business/tests/integration/new-critiques.test.ts`
- [x] **T015** [P] Integration test department-specific search in
      `apps/business/tests/integration/department-search.test.ts`
- [x] **T016** [P] Integration test natural language queries in
      `apps/business/tests/integration/natural-language-queries.test.ts`
- [x] **T017** [P] Integration test weekly report generation in
      `apps/backend/tests/integration/weekly-report-generation.test.ts`
- [x] **T018** [P] Integration test temporal comparison in
      `apps/business/tests/integration/temporal-comparison.test.ts`
- [x] **T019** [P] Integration test multi-store filtering in
      `apps/business/tests/integration/multi-store-filtering.test.ts`
- [x] **T020** [P] Integration test performance validation in
      `apps/backend/tests/integration/performance-validation.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Services

- [x] **T021** [P] AnalysisReport model with validation in
      `packages/database/src/feedback-analysis/analysis-reports.ts`
- [x] **T022** [P] SearchQuery model with AI processing in
      `packages/database/src/feedback-analysis/search-queries.ts`
- [x] **T023** [P] FeedbackInsight model with status management in
      `packages/database/src/feedback-analysis/feedback-insights.ts`
- [x] **T024** [P] TemporalComparison service for trend analysis in
      `apps/backend/src/services/feedback-analysis/temporal-comparison.ts`
- [x] **T025** [P] AI sentiment analysis service with GPT-4o-mini in
      `apps/backend/src/services/feedback-analysis/sentiment-analysis.ts`

### API Endpoints Implementation

- [x] **T026** Feedback analysis reports API routes in
      `apps/backend/src/routes/feedback-analysis/reports.ts`
- [x] **T027** Feedback search API with natural language processing in
      `apps/backend/src/routes/feedback-analysis/search.ts`
- [x] **T028** Insights management API with status updates in
      `apps/backend/src/routes/feedback-analysis/insights.ts`

### Frontend Dashboard Components

- [x] **T029** Main feedback analysis dashboard page in
      `apps/business/src/app/dashboard/feedback-analysis/page.tsx`
- [x] **T030** Feedback categorization display component in
      `apps/business/src/components/feedback-analysis/categorization-display.tsx`
- [x] **T031** [P] Search interface with natural language support in
      `apps/business/src/components/feedback-analysis/search-interface.tsx`
- [x] **T032** [P] Temporal comparison charts component in
      `apps/business/src/components/feedback-analysis/temporal-comparison.tsx`
- [x] **T033** [P] Actionable insights panel component in
      `apps/business/src/components/feedback-analysis/insights-panel.tsx`

## Phase 3.4: Integration & Real-time Features

- [x] **T034** Background job processing for weekly reports in
      `apps/backend/src/jobs/weekly-report-generation.ts`
- [x] **T035** Real-time updates integration with Supabase subscriptions in
      `apps/business/src/hooks/useRealtimeFeedbackAnalysis.ts`
- [x] **T036** Authentication middleware for feedback analysis routes in
      `apps/backend/src/middleware/feedback-analysis-auth.ts`
- [x] **T037** Row Level Security policies for new tables in
      `supabase/migrations/20250921000002_feedback_analysis_rls.sql`

## Phase 3.5: Polish & Performance

- [x] **T038** [P] Unit tests for sentiment analysis accuracy in
      `apps/backend/tests/unit/sentiment-analysis.test.ts`
- [x] **T039** [P] Unit tests for search query parsing in
      `apps/backend/tests/unit/search-query-parser.test.ts`
- [x] **T040** [P] Unit tests for temporal comparison logic in
      `apps/backend/tests/unit/temporal-comparison.test.ts`
- [x] **T041** Performance optimization for large feedback datasets in
      `apps/backend/src/services/feedback-analysis/performance-optimization.ts`
- [x] **T042** Error boundaries and loading states in
      `apps/business/src/components/feedback-analysis/error-boundary.tsx`
- [x] **T043** [P] Caching strategy for AI responses in
      `apps/backend/src/middleware/ai-response-cache.ts`
- [x] **T044** Execute all quickstart validation scenarios per
      `specs/008-step-2-6/quickstart.md`

## Dependencies

### Critical Path

1. **Setup** (T001-T004) → **Tests** (T005-T020) → **Core** (T021-T033) →
   **Integration** (T034-T037) → **Polish** (T038-T044)

### Specific Dependencies

- T001 (database migration) blocks T021, T022, T023 (models)
- T002, T003 (types) block all TypeScript implementation tasks
- T004 (OpenAI config) blocks T025 (sentiment analysis), T027 (search API)
- T021-T025 (models/services) block T026-T028 (API endpoints)
- T026-T028 (API endpoints) block T029-T033 (frontend components)
- T034 (background jobs) requires T021 (AnalysisReport model)
- T035 (real-time) requires T029 (dashboard page)
- All tests (T005-T020) must fail before implementation (T021-T033)

### Parallel Execution Opportunities

- **Setup Phase**: T002, T003, T004 can run in parallel after T001
- **Contract Tests**: T005-T012 can all run in parallel (different test files)
- **Integration Tests**: T013-T020 can all run in parallel (different test
  files)
- **Models**: T021, T022, T023 can run in parallel (different entity files)
- **Services**: T024, T025 can run in parallel (different service files)
- **Frontend Components**: T031, T032, T033 can run in parallel (different
  component files)
- **Unit Tests**: T038, T039, T040 can run in parallel (different test files)
- **Polish Tasks**: T042, T043 can run in parallel (different implementation
  areas)

## Parallel Example

```bash
# Launch contract tests together (T005-T012):
Task: "Contract test GET /feedback-analysis/reports/{storeId}/current in apps/backend/tests/contract/feedback-analysis-reports-current.test.ts"
Task: "Contract test GET /feedback-analysis/reports/{storeId}/historical in apps/backend/tests/contract/feedback-analysis-reports-historical.test.ts"
Task: "Contract test POST /feedback-analysis/search/{storeId} in apps/backend/tests/contract/feedback-analysis-search.test.ts"
# ... (continue with all T005-T012)

# Launch model creation together (T021-T023):
Task: "AnalysisReport model with validation in packages/database/src/feedback-analysis/analysis-reports.ts"
Task: "SearchQuery model with AI processing in packages/database/src/feedback-analysis/search-queries.ts"
Task: "FeedbackInsight model with status management in packages/database/src/feedback-analysis/feedback-insights.ts"
```

## Task Validation Checklist

✅ **All contracts have corresponding tests**: T005-T012 cover all 8 API
endpoints ✅ **All entities have model tasks**: T021-T023 cover AnalysisReport,
SearchQuery, FeedbackInsight ✅ **All tests come before implementation**: Phase
3.2 (T005-T020) before Phase 3.3 (T021-T033) ✅ **Parallel tasks truly
independent**: [P] tasks operate on different files with no shared dependencies
✅ **Each task specifies exact file path**: All tasks include specific file
locations ✅ **No task modifies same file as another [P] task**: Verified no
file path conflicts

## Implementation Notes

- **TDD Approach**: All tests must be written and failing before implementation
  starts
- **Performance Requirements**: <3s AI response time, <2s categorization, <200ms
  DB queries
- **Constitutional Compliance**: TypeScript strict mode, RLS policies,
  production-ready implementation
- **Monorepo Structure**: Extends existing apps/business and apps/backend, uses
  shared packages
- **Real Data Integration**: Uses production Supabase instance with actual
  feedback data
- **AI Integration**: GPT-4o-mini for sentiment analysis, search processing, and
  report generation

## Success Criteria

- All 44 tasks completed successfully
- All integration tests passing (T013-T020)
- Performance benchmarks met per quickstart validation
- Constitutional requirements satisfied
- Feature ready for production deployment

---

**Total Tasks**: 44 (Setup: 4, Tests: 16, Core: 13, Integration: 4, Polish: 7)
**Parallel Opportunities**: 26 tasks marked [P] for concurrent execution
**Estimated Completion**: 2-3 development cycles following TDD methodology
