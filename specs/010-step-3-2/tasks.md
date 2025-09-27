# Tasks: AI Call Integration Infrastructure

**Input**: Design documents from `/specs/010-step-3-2/` **Prerequisites**:
plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Tech stack: TypeScript, Node.js, Supabase, 46elks/Twilio, GPT-4o-mini
   → Structure: Monorepo with apps/backend/src/
2. Load design documents:
   → data-model.md: 6 entities (call_sessions, question_configurations, etc.)
   → contracts/: calls-api.yaml with 8 endpoints
   → research.md: 46elks primary, Twilio fallback, GPT-4o-mini integration
3. Generate tasks by category:
   → Setup: dependencies, database migrations
   → Tests: contract tests, integration tests (TDD)
   → Core: models, services, API endpoints
   → Integration: telephony, AI, webhooks
   → Polish: unit tests, monitoring, documentation
4. Apply task rules:
   → Different files = [P] for parallel execution
   → Tests before implementation (TDD approach)
5. Number tasks sequentially (T001-T030)
6. Generate dependency graph and parallel execution examples
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths included in task descriptions

## Phase 3.1: Setup & Dependencies

- [x] **T001** Install dependencies: add `fortysixelks-node`, `openai`, and
      call-related packages to apps/backend/package.json
- [x] **T002** [P] Configure TypeScript types: create
      packages/types/src/calls.ts with call session types
- [x] **T003** [P] Configure TypeScript types: create
      packages/types/src/telephony.ts with provider types
- [x] **T004** Database migration: create call_sessions table in
      supabase/migrations/
- [x] **T005** Database migration: create question_configurations table in
      supabase/migrations/
- [x] **T006** Database migration: create call_events table in
      supabase/migrations/
- [x] **T007** Database migration: create call_responses table in
      supabase/migrations/
- [x] **T008** Database migration: create question_selection_logs table in
      supabase/migrations/
- [x] **T009** Database migration: create telephony_provider_logs table in
      supabase/migrations/
- [x] **T010** Environment configuration: add call-related environment variables
      to .env.example

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests [P]

- [x] **T011** [P] Contract test POST /api/calls/initiate in
      apps/backend/tests/contract/calls/initiate-call.test.ts
- [x] **T012** [P] Contract test GET /api/calls/{sessionId}/status in
      apps/backend/tests/contract/calls/call-status.test.ts
- [x] **T013** [P] Contract test POST /api/calls/{sessionId}/complete in
      apps/backend/tests/contract/calls/complete-call.test.ts
- [x] **T014** [P] Contract test POST /api/questions/select in
      apps/backend/tests/contract/questions/question-selection.test.ts
- [x] **T015** [P] Contract test GET /api/questions/configurations in
      apps/backend/tests/contract/questions/question-configs.test.ts

### Integration Tests [P]

- [x] **T016** [P] Integration test: complete call flow from initiation to
      completion in apps/backend/tests/integration/calls/call-flow.test.ts
- [x] **T017** [P] Integration test: question selection algorithm in
      apps/backend/tests/integration/question-selection.test.ts
- [x] **T018** [P] Integration test: telephony webhook handling in
      apps/backend/tests/integration/telephony-webhooks.test.ts
- [x] **T019** [P] Integration test: AI voice integration flow in
      apps/backend/tests/integration/ai-integration.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models [P]

- [x] **T020** [P] Call Session model in apps/backend/src/models/CallSession.ts
- [x] **T021** [P] Question Configuration model in
      apps/backend/src/models/QuestionConfiguration.ts
- [x] **T022** [P] Call Event model in apps/backend/src/models/CallEvent.ts
- [x] **T023** [P] Call Response model in
      apps/backend/src/models/CallResponse.ts

### Core Services [P]

- [x] **T024** [P] Call orchestration service in
      apps/backend/src/services/calls/CallOrchestrator.ts
- [x] **T025** [P] Question selection service in
      apps/backend/src/services/calls/QuestionSelector.ts
- [x] **T026** [P] 46elks telephony service in
      apps/backend/src/services/telephony/FortyElksService.ts
- [x] **T027** [P] Twilio telephony service in
      apps/backend/src/services/telephony/TwilioService.ts
- [x] **T028** [P] GPT-4o-mini AI service in
      apps/backend/src/services/ai/OpenAIVoiceService.ts

### API Endpoints

- [x] **T029** POST /api/calls/initiate endpoint in
      apps/backend/src/routes/calls/initiate.ts
- [x] **T030** GET /api/calls/{sessionId}/status endpoint in
      apps/backend/src/routes/calls/status.ts
- [x] **T031** POST /api/calls/{sessionId}/complete endpoint in
      apps/backend/src/routes/calls/complete.ts
- [x] **T032** POST /api/questions/select endpoint in
      apps/backend/src/routes/questions/select.ts
- [x] **T033** GET /api/questions/configurations endpoint in
      apps/backend/src/routes/questions/configurations.ts

## Phase 3.4: Integration & Middleware

- [x] **T034** Call authentication middleware in
      apps/backend/src/middleware/call-auth.ts
- [x] **T035** Call duration monitoring middleware in
      apps/backend/src/middleware/call-duration.ts
- [x] **T036** Telephony webhook handlers in
      apps/backend/src/routes/webhooks/telephony.ts
- [x] **T037** AI webhook handlers in apps/backend/src/routes/webhooks/ai.ts
- [x] **T038** Background call processor job in
      apps/backend/src/jobs/call-processor/CallProcessor.ts
- [x] **T039** Call event logging service in
      apps/backend/src/services/calls/CallLogger.ts
- [x] **T040** Cost tracking service in
      apps/backend/src/services/calls/CostTracker.ts

## Phase 3.5: Business Dashboard Integration

- [x] **T041** [P] Call management components in
      apps/business/src/components/calls/CallSessionCard.tsx
- [x] **T042** [P] Call status dashboard in
      apps/business/src/app/dashboard/calls/page.tsx
- [x] **T043** [P] Call analytics service in
      apps/business/src/services/calls/CallAnalyticsService.ts

## Phase 3.6: Polish & Monitoring

- [x] **T044** [P] Unit tests for CallOrchestrator in
      apps/backend/tests/unit/services/CallOrchestrator.test.ts
- [x] **T045** [P] Unit tests for QuestionSelector in
      apps/backend/tests/unit/services/QuestionSelector.test.ts
- [x] **T046** [P] Unit tests for telephony services in
      apps/backend/tests/unit/services/TelephonyServices.test.ts
- [x] **T047** Performance tests: call initiation <5 seconds in
      apps/backend/tests/performance/call-performance.test.ts
- [x] **T048** Error handling and retry mechanisms in
      apps/backend/src/utils/ErrorHandler.ts
- [x] **T049** Call monitoring and alerting in
      apps/backend/src/services/monitoring/CallMonitor.ts
- [x] **T050** Execute quickstart validation scenarios from
      specs/010-step-3-2/quickstart.md

## Dependencies

### Critical Path

1. **Setup** (T001-T010) → **Tests** (T011-T019) → **Implementation**
   (T020-T043) → **Polish** (T044-T050)
2. **Database migrations** (T004-T009) must complete before any model tasks
   (T020-T023)
3. **Models** (T020-T023) must complete before services (T024-T028)
4. **Services** (T024-T028) must complete before endpoints (T029-T033)
5. **Core endpoints** (T029-T033) must complete before webhooks (T036-T037)

### Blocking Dependencies

- T020-T023 (models) block T024-T028 (services)
- T024-T028 (services) block T029-T033 (endpoints)
- T029-T033 (endpoints) block T036-T037 (webhooks)
- T024 (CallOrchestrator) blocks T038 (CallProcessor)

## Parallel Execution Examples

### Phase 3.2: All Contract Tests (T011-T015)

```bash
# Run all contract tests in parallel
pnpm --filter @vocilia/backend test --passWithNoTests apps/backend/tests/contract/calls/initiate-call.test.ts &
pnpm --filter @vocilia/backend test --passWithNoTests apps/backend/tests/contract/calls/call-status.test.ts &
pnpm --filter @vocilia/backend test --passWithNoTests apps/backend/tests/contract/calls/complete-call.test.ts &
pnpm --filter @vocilia/backend test --passWithNoTests apps/backend/tests/contract/questions/question-selection.test.ts &
pnpm --filter @vocilia/backend test --passWithNoTests apps/backend/tests/contract/questions/question-configs.test.ts &
wait
```

### Phase 3.3: Models (T020-T023)

```bash
# Create all models in parallel - different files
Task: "Create Call Session model in apps/backend/src/models/CallSession.ts"
Task: "Create Question Configuration model in apps/backend/src/models/QuestionConfiguration.ts"
Task: "Create Call Event model in apps/backend/src/models/CallEvent.ts"
Task: "Create Call Response model in apps/backend/src/models/CallResponse.ts"
```

### Phase 3.3: Services (T024-T028)

```bash
# Create all services in parallel - different files
Task: "Create call orchestration service in apps/backend/src/services/calls/CallOrchestrator.ts"
Task: "Create question selection service in apps/backend/src/services/calls/QuestionSelector.ts"
Task: "Create 46elks telephony service in apps/backend/src/services/telephony/FortyElksService.ts"
Task: "Create Twilio telephony service in apps/backend/src/services/telephony/TwilioService.ts"
Task: "Create GPT-4o-mini AI service in apps/backend/src/services/ai/OpenAIVoiceService.ts"
```

## Constitutional Compliance

### Production from Day One

- ✅ T001: Real 46elks and OpenAI dependencies
- ✅ T004-T009: Production Supabase database tables
- ✅ T026-T028: Actual telephony and AI service integrations

### TypeScript Strict Mode

- ✅ T002-T003: Strict TypeScript types for all entities
- ✅ T020-T023: Strongly typed models
- ✅ T024-T028: Type-safe service implementations

### Security & Privacy

- ✅ T034: Authentication middleware for call endpoints
- ✅ T004: Encrypted customer phone numbers in database
- ✅ T039: Comprehensive call event logging

### Real Data Only

- ✅ T016-T019: Integration tests with actual API calls
- ✅ T050: Quickstart validation with real scenarios
- ✅ All services use production APIs, no mocks

## Validation Checklist

_GATE: Checked before task execution_

- [x] All contracts (calls-api.yaml) have corresponding tests (T011-T015)
- [x] All entities (6 from data-model.md) have model tasks (T020-T023)
- [x] All tests (T011-T019) come before implementation (T020+)
- [x] Parallel tasks [P] operate on different files
- [x] Each task specifies exact file path
- [x] TDD approach: tests must fail before implementation
- [x] Dependencies clearly defined and non-circular

## Success Criteria

1. **All tests pass**: Contract and integration tests validate API contracts
2. **Performance met**: Call initiation <5 seconds, AI response <2 seconds
3. **Cost targets**: <$0.25 per call including telephony and AI costs
4. **Quickstart validates**: Complete customer call flow works end-to-end
5. **Constitutional compliance**: Production-ready, type-safe, secure
   implementation

---

**Ready for execution. Start with T001 and follow dependencies.**
