# Tasks: Step 5.2: Advanced Question Logic

**Input**: Design documents from `/specs/017-step-5-2/` **Prerequisites**:
plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)

```
1. Load plan.md from feature directory ✓
   → Tech stack: TypeScript + Node.js 18+ + Next.js 14 + Supabase
   → Structure: Web app (extends existing monorepo)
2. Load design documents ✓
   → data-model.md: 8 entities + 2 extensions
   → contracts/: 12 API endpoints in question-combination-api.yaml
   → quickstart.md: 8 integration test scenarios
3. Generate tasks by category ✓
   → Setup: Supabase migrations, TypeScript types
   → Tests: 12 contract tests, 8 integration tests
   → Core: 8 entity models, question combination services
   → Integration: API endpoints, business UI
   → Polish: unit tests, performance validation
4. Task rules applied ✓
   → Different files = [P] for parallel
   → Database/models before services
   → Tests before implementation (TDD)
5. Tasks numbered T001-T045 ✓
6. Dependencies validated ✓
7. SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths included in descriptions

## Path Conventions (Web App - Vocilia Alpha Monorepo)

- **Backend**: `apps/backend/src/`
- **Business UI**: `apps/business/src/`
- **Admin UI**: `apps/admin/src/`
- **Shared Packages**: `packages/database/src/`, `packages/types/src/`
- **Tests**: `apps/backend/tests/`, `apps/business/tests/`

## Phase 3.1: Setup & Database Schema

### Database Migrations

- [x] T001 Create Supabase migration for question_combination_rules table in
      `supabase/migrations/20250924_001_question_combination_rules.sql`
- [x] T002 Create Supabase migration for dynamic_triggers table in
      `supabase/migrations/20250924_002_dynamic_triggers.sql`
- [x] T003 Create Supabase migration for question_groups table in
      `supabase/migrations/20250924_003_question_groups.sql`
- [x] T004 Create Supabase migration for trigger_conditions table in
      `supabase/migrations/20250924_004_trigger_conditions.sql`
- [x] T005 Create Supabase migration for frequency_harmonizers table in
      `supabase/migrations/20250924_005_frequency_harmonizers.sql`
- [x] T006 Create Supabase migration for trigger_activation_logs table in
      `supabase/migrations/20250924_006_trigger_activation_logs.sql`
- [x] T007 Create Supabase migration for priority_weights table in
      `supabase/migrations/20250924_007_priority_weights.sql`
- [x] T008 Create Supabase migration for time_constraint_optimizers table in
      `supabase/migrations/20250924_008_time_constraint_optimizers.sql`
- [x] T009 Create Supabase migration to extend context_questions table in
      `supabase/migrations/20250924_009_extend_context_questions.sql`
- [x] T010 Create Supabase migration to extend customer_verifications table in
      `supabase/migrations/20250924_010_extend_customer_verifications.sql`

### RLS Policies & Indexes

- [x] T011 Create RLS policies for question logic tables in
      `supabase/migrations/20250924_011_question_logic_rls_policies.sql`
- [x] T012 Create performance indexes for question logic tables in
      `supabase/migrations/20250924_012_question_logic_indexes.sql`

### TypeScript Types

- [x] T013 [P] Define QuestionCombinationRule types in
      `packages/types/src/questions/combination-rules.ts`
- [x] T014 [P] Define DynamicTrigger types in
      `packages/types/src/questions/dynamic-triggers.ts`
- [x] T015 [P] Define TriggerActivationLog types in
      `packages/types/src/questions/activation-logs.ts`
- [x] T016 [P] Define FrequencyHarmonizer types in
      `packages/types/src/questions/frequency-harmonizers.ts`
- [x] T017 [P] Export all question logic types in
      `packages/types/src/questions/index.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests - Question Combinations API

- [x] T018 [P] Contract test GET /api/questions/combinations/rules in
      `apps/backend/tests/contract/question-combination-rules-get.test.ts`
- [x] T019 [P] Contract test POST /api/questions/combinations/rules in
      `apps/backend/tests/contract/question-combination-rules-post.test.ts`
- [x] T020 [P] Contract test PUT /api/questions/combinations/rules/{ruleId} in
      `apps/backend/tests/contract/question-combination-rules-put.test.ts`
- [x] T021 [P] Contract test GET /api/questions/triggers in
      `apps/backend/tests/contract/dynamic-triggers-get.test.ts`
- [x] T022 [P] Contract test POST /api/questions/triggers in
      `apps/backend/tests/contract/dynamic-triggers-post.test.ts`
- [x] T023 [P] Contract test PUT /api/questions/triggers/{triggerId} in
      `apps/backend/tests/contract/dynamic-triggers-put.test.ts`
- [x] T024 [P] Contract test POST /api/questions/combinations/evaluate in
      `apps/backend/tests/contract/question-evaluation-post.test.ts`
- [x] T025 [P] Contract test GET /api/questions/harmonizers/{ruleId} in
      `apps/backend/tests/contract/frequency-harmonizers-get.test.ts`
- [x] T026 [P] Contract test POST /api/questions/harmonizers/{ruleId} in
      `apps/backend/tests/contract/frequency-harmonizers-post.test.ts`
- [x] T027 [P] Contract test GET /api/admin/triggers/effectiveness in
      `apps/backend/tests/contract/admin-triggers-analytics-get.test.ts`

### Integration Tests - User Stories from Quickstart

- [x] T028 [P] Integration test: Question combination engine time optimization
      in `apps/backend/tests/integration/question-combination-engine.test.ts`
- [x] T029 [P] Integration test: Purchase-based trigger activation in
      `apps/backend/tests/integration/purchase-based-triggers.test.ts`
- [x] T030 [P] Integration test: Time-based question activation in
      `apps/backend/tests/integration/time-based-triggers.test.ts`
- [x] T031 [P] Integration test: Amount-based conditional logic in
      `apps/backend/tests/integration/amount-based-triggers.test.ts`
- [x] T032 [P] Integration test: Complex trigger combinations with priority
      hierarchy in
      `apps/backend/tests/integration/complex-trigger-combinations.test.ts`
- [x] T033 [P] Integration test: Frequency harmonization conflict resolution in
      `apps/backend/tests/integration/frequency-harmonization.test.ts`
- [x] T034 [P] Integration test: Real-time processing performance (<500ms) in
      `apps/backend/tests/integration/performance-requirements.test.ts`
- [x] T035 [P] Integration test: Business configuration UI integration in
      `apps/business/tests/integration/question-logic-configuration.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Queries

- [x] T036 [P] QuestionCombinationRule model and queries in
      `packages/database/src/questions/combination-rules.ts`
- [x] T037 [P] DynamicTrigger model and queries in
      `packages/database/src/questions/dynamic-triggers.ts`
- [x] T038 [P] QuestionGroup model and queries in
      `packages/database/src/questions/question-groups.ts`
- [x] T039 [P] TriggerCondition model and queries in
      `packages/database/src/questions/trigger-conditions.ts`
- [x] T040 [P] FrequencyHarmonizer model and queries in
      `packages/database/src/questions/frequency-harmonizers.ts`
- [x] T041 [P] TriggerActivationLog model and queries in
      `packages/database/src/questions/activation-logs.ts`
- [x] T042 [P] PriorityWeight model and queries in
      `packages/database/src/questions/priority-weights.ts`
- [x] T043 [P] TimeConstraintOptimizer model and queries in
      `packages/database/src/questions/time-optimizers.ts`

### Core Services

- [x] T044 QuestionCombinationEngine service in
      `apps/backend/src/services/questions/combination-engine.ts`
- [x] T045 DynamicTriggerEngine service in
      `apps/backend/src/services/questions/trigger-engine.ts`
- [x] T046 TopicGroupingService in
      `apps/backend/src/services/questions/topic-grouping.ts`
- [x] T047 PriorityBalancingService in
      `apps/backend/src/services/questions/priority-balancing.ts`
- [x] T048 FrequencyHarmonizerService in
      `apps/backend/src/services/questions/frequency-harmonizer.ts`
- [x] T049 TimeConstraintOptimizer service in
      `apps/backend/src/services/questions/time-optimizer.ts`
- [x] T050 QuestionEvaluationService (main orchestrator) in
      `apps/backend/src/services/questions/evaluation-service.ts`

### API Endpoints

- [x] T051 GET/POST /api/questions/combinations/rules endpoints in
      `apps/backend/src/routes/questions/combination-rules.ts`
- [x] T052 PUT/DELETE /api/questions/combinations/rules/{ruleId} endpoints in
      `apps/backend/src/routes/questions/combination-rules.ts`
- [x] T053 GET/POST /api/questions/triggers endpoints in
      `apps/backend/src/routes/questions/dynamic-triggers.ts`
- [x] T054 PUT/DELETE /api/questions/triggers/{triggerId} endpoints in
      `apps/backend/src/routes/questions/dynamic-triggers.ts`
- [x] T055 POST /api/questions/combinations/evaluate endpoint in
      `apps/backend/src/routes/questions/evaluation.ts`
- [x] T056 GET/POST /api/questions/harmonizers/{ruleId} endpoints in
      `apps/backend/src/routes/questions/frequency-harmonizers.ts`
- [x] T057 GET /api/admin/triggers/effectiveness endpoint in
      `apps/backend/src/routes/admin/trigger-analytics.ts`

### Authentication & Middleware

- [x] T058 Question logic authorization middleware in
      `apps/backend/src/middleware/question-logic-auth.ts`
- [x] T059 Request validation middleware for question APIs in
      `apps/backend/src/middleware/question-validation.ts`
- [x] T060 Performance monitoring middleware for <500ms requirement in
      `apps/backend/src/middleware/question-performance.ts`

## Phase 3.4: Business Interface Integration

### Business Dashboard Extensions

- [x] T061 Question combination rules configuration page in
      `apps/business/src/app/questions/combination-rules/page.tsx`
- [x] T062 Dynamic triggers configuration page in
      `apps/business/src/app/questions/triggers/page.tsx`
- [x] T063 Frequency harmonization settings page in
      `apps/business/src/app/questions/harmonization/page.tsx`
- [x] T064 Question logic preview/testing component in
      `apps/business/src/components/questions/LogicPreview.tsx`

### UI Components

- [x] T065 [P] CombinationRuleForm component in
      `apps/business/src/components/questions/CombinationRuleForm.tsx`
- [x] T066 [P] DynamicTriggerForm component in
      `apps/business/src/components/questions/DynamicTriggerForm.tsx`
- [x] T067 [P] FrequencyHarmonizerConfig component in
      `apps/business/src/components/questions/FrequencyHarmonizerConfig.tsx`
- [x] T068 [P] QuestionLogicDashboard component in
      `apps/business/src/components/questions/QuestionLogicDashboard.tsx`

### Admin Interface Extensions

- [x] T069 Trigger effectiveness analytics page in
      `apps/admin/src/app/admin/analytics/trigger-effectiveness/page.tsx`
- [x] T070 Question logic system monitoring in
      `apps/admin/src/components/monitoring/QuestionLogicMonitoring.tsx`

## Phase 3.5: Integration & Caching

### Performance Optimization

- [x] T071 Redis caching for trigger evaluation in
      `apps/backend/src/services/cache/trigger-cache.ts`
- [x] T072 Background rule compilation service in
      `apps/backend/src/services/questions/rule-compiler.ts`
- [x] T073 Question combination optimization cache in
      `apps/backend/src/services/cache/combination-cache.ts`

### Real-time Processing

- [x] T074 Customer verification flow integration in
      `apps/backend/src/services/verification/question-integration.ts`
- [x] T075 AI call preparation service integration in
      `apps/backend/src/services/ai/call-preparation.ts`

## Phase 3.6: Polish & Validation

### Unit Tests

- [ ] T076 [P] Unit tests for QuestionCombinationEngine in
      `apps/backend/tests/unit/services/combination-engine.test.ts`
- [ ] T077 [P] Unit tests for DynamicTriggerEngine in
      `apps/backend/tests/unit/services/trigger-engine.test.ts`
- [x] T078 [P] Unit tests for TopicGroupingService in
      `apps/backend/tests/unit/services/topic-grouping.test.ts`
- [ ] T079 [P] Unit tests for FrequencyHarmonizerService in
      `apps/backend/tests/unit/services/frequency-harmonizer.test.ts`
- [x] T080 [P] Unit tests for TimeConstraintOptimizer in
      `apps/backend/tests/unit/services/time-optimizer.test.ts`
- [x] T081 [P] Unit tests for business UI components in
      `apps/business/tests/unit/components/question-logic.test.ts`

### Performance & Load Testing

- [x] T082 Performance testing for <500ms evaluation requirement in
      `apps/backend/tests/performance/question-evaluation.test.ts`
- [x] T083 Load testing for concurrent trigger processing in
      `apps/backend/tests/performance/trigger-load.test.ts`
- [x] T084 Database query optimization validation in
      `apps/backend/tests/performance/database-queries.test.ts`

### Documentation & Finalization

- [x] T085 [P] Update API documentation with new endpoints in
      `docs/api/question-logic.md`
- [x] T086 [P] Business user guide for advanced question logic in
      `docs/user-guides/advanced-question-logic.md`
- [x] T087 [P] Admin monitoring guide for question logic in
      `docs/admin/question-logic-monitoring.md`

### Final Validation

- [x] T088 Execute complete quickstart testing scenarios from
      `specs/017-step-5-2/quickstart.md`
- [x] T089 Performance benchmark validation (<500ms, >90% cache hit rate)
- [x] T090 Constitutional compliance validation (RLS, TypeScript strict,
      production-ready)

## Dependencies

### Critical Path Dependencies

- **Database Setup**: T001-T012 must complete before all other phases
- **Types**: T013-T017 must complete before contract tests and implementation
- **Tests Before Implementation**: T018-T035 must complete and FAIL before
  T036-T075
- **Models Before Services**: T036-T043 must complete before T044-T050
- **Services Before APIs**: T044-T050 must complete before T051-T057
- **Core Before UI**: T036-T060 must complete before T061-T070
- **Implementation Before Polish**: T036-T075 must complete before T076-T090

### Specific Dependencies

- T044 (CombinationEngine) blocks T051-T052, T055
- T045 (TriggerEngine) blocks T053-T054, T055
- T047 (FrequencyHarmonizer) blocks T056
- T050 (EvaluationService) blocks T055, T074-T075
- T058-T060 (Middleware) blocks all API endpoints T051-T057
- T061-T068 (Business UI) blocks T088 (quickstart testing)

## Parallel Execution Examples

### Phase 3.1: Database & Types (can run together)

```
Task: "Create Supabase migration for question_combination_rules table"
Task: "Create Supabase migration for dynamic_triggers table"
Task: "Create Supabase migration for question_groups table"
Task: "Define QuestionCombinationRule types"
Task: "Define DynamicTrigger types"
```

### Phase 3.2: Contract Tests (all parallel - different files)

```
Task: "Contract test GET /api/questions/combinations/rules"
Task: "Contract test POST /api/questions/combinations/rules"
Task: "Contract test GET /api/questions/triggers"
Task: "Contract test POST /api/questions/combinations/evaluate"
Task: "Integration test: Question combination engine time optimization"
```

### Phase 3.3: Models (all parallel - different files)

```
Task: "QuestionCombinationRule model and queries"
Task: "DynamicTrigger model and queries"
Task: "QuestionGroup model and queries"
Task: "TriggerCondition model and queries"
```

### Phase 3.4: UI Components (parallel - different files)

```
Task: "CombinationRuleForm component"
Task: "DynamicTriggerForm component"
Task: "FrequencyHarmonizerConfig component"
Task: "QuestionLogicDashboard component"
```

## Validation Checklist

_GATE: All items must be checked before task execution_

- [x] All 12 API endpoints from contracts have corresponding tests (T018-T027)
- [x] All 8 entities from data-model have model tasks (T036-T043)
- [x] All tests come before implementation (T018-T035 before T036-T090)
- [x] Parallel tasks are truly independent (different files, no shared
      dependencies)
- [x] Each task specifies exact file path in monorepo structure
- [x] No task modifies same file as another [P] task
- [x] TDD flow enforced: failing tests required before implementation
- [x] Performance requirements addressed (<500ms evaluation, caching)
- [x] Constitutional requirements covered (RLS, TypeScript strict,
      production-ready)
- [x] Business value delivered through UI integration and real-time processing

## Success Metrics

### Technical Completion

- 90 tasks completed successfully
- All tests passing (contract + integration + unit)
- Performance benchmarks met (<500ms, >90% cache hit)
- Zero TypeScript compilation errors

### Business Value

- Business dashboard includes advanced question logic configuration
- Customer verification flow uses intelligent question selection
- Question relevance increased by 20-30% (measured via business feedback)
- System maintains 1-2 minute call duration constraint

### Production Readiness

- All RLS policies enforced
- Audit logging for configuration changes
- Monitoring and alerting for performance degradation
- Rollback procedures tested and documented

## Notes

- [P] tasks can run in parallel - different files, no dependencies
- Verify all tests fail before implementing (TDD requirement)
- Commit after each task completion
- Monitor performance continuously during implementation
- Each task should take 30-60 minutes to complete
