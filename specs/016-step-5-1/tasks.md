# Tasks: Step 5.1 GPT-4o-mini Integration (Railway Backend)

**Input**: Design documents from `/specs/016-step-5-1/` **Prerequisites**:
plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)

```
1. Load plan.md from feature directory ✅
   → Tech stack: TypeScript, Express.js, OpenAI SDK, Supabase, Redis, 46elks
   → Structure: Monorepo web application (apps/backend primary target)
2. Load design documents: ✅
   → data-model.md: 7 entities → 7 model tasks
   → contracts/: 3 files, 16 endpoints → 3 contract tests + 16 implementation tasks
   → quickstart.md: 10 scenarios → 10 integration tests
3. Generate tasks by category: ✅
   → Setup: Dependencies, environment, database migrations
   → Tests: 3 contract tests + 10 integration tests (TDD first)
   → Core: 7 models + 16 API endpoints + 5 services
   → Integration: Middleware, webhooks, event handlers
   → Polish: Unit tests, performance validation, monitoring
4. Apply task rules: ✅
   → [P] for different files, sequential for same files
   → Tests before implementation (TDD)
5. Dependencies validated ✅
6. SUCCESS: 35 tasks ready for execution
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths use monorepo structure: `apps/backend/src/`, `apps/backend/tests/`

## Phase 3.1: Setup & Dependencies

- [x] T001 Install new dependencies: OpenAI SDK (gpt-4o-mini),
      fortysixelks-node, Redis client in apps/backend
- [x] T002 Configure environment variables for OpenAI API, 46elks, and Redis in
      apps/backend/.env.example
- [x] T003 [P] Setup TypeScript strict mode configuration for AI services in
      apps/backend/tsconfig.json
- [x] T004 Create database migrations for 7 new AI entities in
      supabase/migrations/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests (API Endpoint Validation)

- [x] T005 [P] Contract test AI Call Management API in
      apps/backend/tests/contract/ai-call-management.test.ts
- [x] T006 [P] Contract test Feedback Analysis API in
      apps/backend/tests/contract/feedback-analysis.test.ts
- [x] T007 [P] Contract test Business Analysis API in
      apps/backend/tests/contract/business-analysis.test.ts

### Integration Tests (User Journey Validation)

- [x] T008 [P] Integration test: Complete AI call flow in
      apps/backend/tests/integration/ai-call-flow.test.ts
- [x] T009 [P] Integration test: Feedback quality analysis in
      apps/backend/tests/integration/feedback-analysis.test.ts
- [x] T010 [P] Integration test: Weekly business report generation in
      apps/backend/tests/integration/business-reports.test.ts
- [x] T011 [P] Integration test: Call retry mechanism (3 attempts max) in
      apps/backend/tests/integration/call-retry.test.ts
- [x] T012 [P] Integration test: 90-day data cleanup process in
      apps/backend/tests/integration/data-cleanup.test.ts
- [x] T013 [P] Integration test: Swedish language conversation flow in
      apps/backend/tests/integration/swedish-conversation.test.ts
- [x] T014 [P] Integration test: Fraud detection and scoring in
      apps/backend/tests/integration/fraud-detection.test.ts
- [x] T015 [P] Integration test: Concurrent calls per store (unlimited) in
      apps/backend/tests/integration/concurrent-calls.test.ts
- [x] T016 [P] Integration test: AI analysis pipeline (quality 2-15%) in
      apps/backend/tests/integration/ai-analysis-pipeline.test.ts
- [x] T017 [P] Integration test: Phone system webhook processing in
      apps/backend/tests/integration/phone-webhooks.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models (7 entities from data-model.md)

- [x] T018 [P] FeedbackCallSession model in
      apps/backend/src/models/feedbackCallSession.ts
- [x] T019 [P] ConversationTranscript model in
      apps/backend/src/models/conversationTranscript.ts
- [x] T020 [P] QualityAssessment model in
      apps/backend/src/models/qualityAssessment.ts
- [x] T021 [P] BusinessContextProfile model in
      apps/backend/src/models/businessContextProfile.ts
- [x] T022 [P] WeeklyAnalysisReport model in
      apps/backend/src/models/weeklyAnalysisReport.ts
- [x] T023 [P] CallQualityMetrics model in
      apps/backend/src/models/callQualityMetrics.ts
- [x] T024 [P] FraudDetectionResult model in
      apps/backend/src/models/fraudDetectionResult.ts

### Core AI Services (Business Logic)

- [x] T025 [P] OpenAI service with GPT-4o-mini integration in
      apps/backend/src/services/ai/openaiService.ts
- [x] T026 [P] Phone service with 46elks integration in
      apps/backend/src/services/telephony/phoneService.ts
- [x] T027 [P] Call management service in
      apps/backend/src/services/calls/callManagerService.ts
- [x] T028 [P] Feedback analysis service (2-15% grading) in
      apps/backend/src/services/feedback-analysis/analysisService.ts
- [x] T029 [P] Business intelligence service in
      apps/backend/src/services/feedback-analysis/businessIntelligenceService.ts

### API Endpoints Implementation (16 endpoints from contracts)

- [x] T030 POST /api/ai/calls/initiate endpoint in
      apps/backend/src/routes/ai-assistant/calls.ts
- [x] T031 GET /api/ai/calls/{sessionId}/status endpoint in
      apps/backend/src/routes/ai-assistant/calls.ts
- [x] T032 POST /api/ai/calls/{sessionId}/transcript endpoint in
      apps/backend/src/routes/ai-assistant/calls.ts
- [x] T033 PUT /api/ai/calls/{sessionId}/retry endpoint in
      apps/backend/src/routes/ai-assistant/calls.ts
- [x] T034 DELETE /api/ai/calls/{sessionId} endpoint in
      apps/backend/src/routes/ai-assistant/calls.ts
- [x] T035 POST /api/ai/analysis/quality endpoint in
      apps/backend/src/routes/feedback-analysis/analysis.ts
- [x] T036 POST /api/ai/analysis/fraud-detection endpoint in
      apps/backend/src/routes/feedback-analysis/analysis.ts
- [x] T037 POST /api/ai/analysis/summarize endpoint in
      apps/backend/src/routes/feedback-analysis/analysis.ts
- [x] T038 DELETE /api/ai/analysis/cleanup-low-grade endpoint in
      apps/backend/src/routes/feedback-analysis/analysis.ts
- [x] T039 GET /api/ai/analysis/metrics endpoint in
      apps/backend/src/routes/feedback-analysis/analysis.ts
- [x] T040 POST /api/ai/business/reports/generate endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts
- [x] T041 GET /api/ai/business/reports/{reportId} endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts
- [x] T042 GET /api/ai/business/reports endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts
- [x] T043 GET /api/ai/business/search endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts
- [x] T044 GET /api/ai/business/trends endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts
- [x] T045 GET /api/ai/business/recommendations endpoint in
      apps/backend/src/routes/feedback-analysis/business.ts

## Phase 3.4: Integration & Infrastructure

- [x] T046 Authentication middleware for AI endpoints in
      apps/backend/src/middleware/ai-assistant-auth.ts
- [x] T047 Rate limiting middleware for AI services in
      apps/backend/src/middleware/ai-rate-limiter.ts
- [x] T048 46elks webhook handler for call events in
      apps/backend/src/routes/webhooks/phone-events.ts
- [x] T049 Redis session manager for conversation state in
      apps/backend/src/services/calls/sessionManager.ts
- [x] T050 Event handler for verification-to-call trigger in
      apps/backend/src/services/calls/verificationEventHandler.ts
- [x] T051 Background job for 90-day data cleanup in
      apps/backend/src/jobs/dataCleanupJob.ts
- [x] T052 Background job for weekly business reports in
      apps/backend/src/jobs/weeklyReportsJob.ts

## Phase 3.5: Polish & Validation

- [x] T053 [P] Unit tests for OpenAI service in
      apps/backend/tests/unit/openaiService.test.ts
- [x] T054 [P] Unit tests for session manager in
      apps/backend/tests/unit/sessionManager.test.ts
- [x] T055 [P] Unit tests for core services completed
- [x] T056 [P] Performance tests (<500ms API calls) in
      apps/backend/tests/performance/api-performance.test.ts
- [x] T057 [P] Performance tests (1-2 min call duration) in
      apps/backend/tests/performance/call-duration.test.ts
- [x] T058 [P] Swedish language validation tests in
      apps/backend/tests/unit/swedish-language.test.ts
- [x] T059 Error handling and logging for AI services in
      apps/backend/src/middleware/ai-error-handler.ts
- [x] T060 Monitoring integration for AI call metrics in
      apps/backend/src/middleware/ai-monitoring.ts
- [x] T061 Execute all quickstart.md validation scenarios
- [x] T062 Update packages/types with new AI-related TypeScript definitions

## Dependencies

**Critical Path:**

- Setup (T001-T004) before all other phases
- Tests (T005-T017) before implementation (T018-T045)
- Models (T018-T024) before services (T025-T029)
- Services (T025-T029) before endpoints (T030-T045)
- Core implementation before integration (T046-T052)
- All implementation before polish (T053-T062)

**Blocking Relationships:**

- T018-T024 (models) → T025-T029 (services) → T030-T045 (endpoints)
- T025 (OpenAI service) blocks T027, T028, T030-T034
- T026 (Phone service) blocks T030, T048, T050
- T027 (Call manager) blocks T030-T034, T049
- T046-T047 (middleware) before T030-T045 (endpoints)

## Parallel Execution Examples

### Phase 3.2: Launch all contract tests together

```bash
# All contract tests can run in parallel (different files)
Task: "Contract test AI Call Management API in apps/backend/tests/contract/ai-call-management.test.ts"
Task: "Contract test Feedback Analysis API in apps/backend/tests/contract/feedback-analysis.test.ts"
Task: "Contract test Business Analysis API in apps/backend/tests/contract/business-analysis.test.ts"
```

### Phase 3.3: Launch all model creation together

```bash
# All models can be created in parallel (different files)
Task: "FeedbackCallSession model in apps/backend/src/models/feedbackCallSession.ts"
Task: "ConversationTranscript model in apps/backend/src/models/conversationTranscript.ts"
Task: "QualityAssessment model in apps/backend/src/models/qualityAssessment.ts"
Task: "BusinessContextProfile model in apps/backend/src/models/businessContextProfile.ts"
Task: "WeeklyAnalysisReport model in apps/backend/src/models/weeklyAnalysisReport.ts"
Task: "CallQualityMetrics model in apps/backend/src/models/callQualityMetrics.ts"
Task: "FraudDetectionResult model in apps/backend/src/models/fraudDetectionResult.ts"
```

### Phase 3.3: Launch all core services together

```bash
# Core services can be created in parallel (different files)
Task: "OpenAI service with GPT-4o-mini integration in apps/backend/src/services/ai/openaiService.ts"
Task: "Phone service with 46elks integration in apps/backend/src/services/telephony/phoneService.ts"
Task: "Call management service in apps/backend/src/services/calls/callManagerService.ts"
Task: "Feedback analysis service (2-15% grading) in apps/backend/src/services/feedback-analysis/analysisService.ts"
Task: "Business intelligence service in apps/backend/src/services/feedback-analysis/businessIntelligenceService.ts"
```

## Notes

- [P] tasks = different files, can run simultaneously
- Verify tests fail before implementing (TDD requirement)
- All AI services must use TypeScript strict mode
- 90-day data retention enforced via expires_at fields
- Swedish language only for voice conversations
- Unlimited concurrent calls per store (no rate limiting by store)
- Maximum 3 call attempts per customer (2 retries)
- Quality scores must be 2-15% range for cashback rewards
- Full automation - no manual review required

## Task Generation Rules Applied

_Completed during execution_

1. **From Contracts**: ✅
   - 3 contract files → 3 contract test tasks [P] (T005-T007)
   - 16 endpoints → 16 implementation tasks (T030-T045)
2. **From Data Model**: ✅
   - 7 entities → 7 model creation tasks [P] (T018-T024)
   - Relationships → 5 service layer tasks (T025-T029)
3. **From User Stories**: ✅
   - 10 quickstart scenarios → 10 integration tests [P] (T008-T017)
   - Validation → quickstart execution task (T061)

4. **Ordering**: ✅
   - Setup → Tests → Models → Services → Endpoints → Integration → Polish
   - Dependencies properly mapped and validated

## Validation Checklist

_GATE: Checked before task completion_

- [x] All contracts have corresponding tests (T005-T007 ↔ 3 contract files)
- [x] All entities have model tasks (T018-T024 ↔ 7 entities)
- [x] All tests come before implementation (T005-T017 before T018-T045)
- [x] Parallel tasks truly independent (verified file paths)
- [x] Each task specifies exact file path (monorepo structure)
- [x] No task modifies same file as another [P] task (validated)
- [x] TDD requirement enforced (tests must fail before implementation)
- [x] Constitutional compliance maintained (production-ready, secure, typed)

---

**Total Tasks**: 62 (35 core + 27 supporting) **Estimated Completion**: 15-20
development days with parallel execution **Ready for Phase 4 Implementation**:
✅
