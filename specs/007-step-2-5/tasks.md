# Tasks: AI Assistant Interface (Context Builder)

**Input**: Design documents from `/Users/lucasjenner/alpha/specs/007-step-2-5/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/,
quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   ✓ Extracted: TypeScript 5.5+, Next.js 14, Supabase, GPT-4o-mini, web app structure
2. Load optional design documents:
   ✓ data-model.md: 5 entities → model tasks
   ✓ contracts/: 10 endpoints → contract test tasks
   ✓ research.md: AI integration patterns → setup tasks
   ✓ quickstart.md: 3 user scenarios → integration tests
3. Generate tasks by category:
   ✓ Setup: database migrations, dependencies, OpenAI config
   ✓ Tests: contract tests, integration tests
   ✓ Core: models, services, API endpoints
   ✓ Integration: AI service, real-time features
   ✓ Polish: unit tests, performance validation
4. Apply task rules:
   ✓ Different files = marked [P] for parallel
   ✓ Same file = sequential (no [P])
   ✓ Tests before implementation (TDD)
5. Number tasks sequentially (T001-T042)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness: ✓ All contracts tested, entities modeled, endpoints implemented
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths use existing monorepo structure: `apps/backend/`, `apps/business/`,
  `packages/`

## Path Conventions

- **Backend API**: `apps/backend/src/` (Node.js, Railway deployment)
- **Business Frontend**: `apps/business/src/` (Next.js 14, Vercel deployment)
- **Shared Types**: `packages/types/src/`
- **Database**: `supabase/migrations/`
- **Tests**: `apps/backend/tests/`, `apps/business/tests/`

## Phase 3.1: Setup & Database

- [x] **T001** Apply AI assistant database migration in
      `supabase/migrations/20250921000001_ai_assistant.sql`
- [x] **T002** [P] Add OpenAI SDK dependency to backend:
      `cd apps/backend && pnpm add openai`
- [x] **T003** [P] Add streaming response dependencies to backend:
      `cd apps/backend && pnpm add eventsource-parser`
- [x] **T004** [P] Generate TypeScript database types:
      `npx supabase gen types > packages/types/src/database.d.ts`
- [x] **T005** [P] Create AI assistant types in
      `packages/types/src/ai-assistant.ts`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests (API Endpoints)

- [x] **T006** [P] Contract test GET /ai-assistant/conversations in
      `apps/backend/tests/contract/ai-conversations-list.test.ts`
- [x] **T007** [P] Contract test POST /ai-assistant/conversations in
      `apps/backend/tests/contract/ai-conversations-create.test.ts`
- [x] **T008** [P] Contract test GET /ai-assistant/conversations/{id} in
      `apps/backend/tests/contract/ai-conversations-get.test.ts`
- [x] **T009** [P] Contract test PATCH /ai-assistant/conversations/{id} in
      `apps/backend/tests/contract/ai-conversations-update.test.ts`
- [x] **T010** [P] Contract test POST /ai-assistant/conversations/{id}/messages
      in `apps/backend/tests/contract/ai-messages-send.test.ts`
- [x] **T011** [P] Contract test GET /ai-assistant/context/entries in
      `apps/backend/tests/contract/ai-context-list.test.ts`
- [x] **T012** [P] Contract test POST /ai-assistant/context/entries in
      `apps/backend/tests/contract/ai-context-create.test.ts`
- [x] **T013** [P] Contract test GET /ai-assistant/suggestions in
      `apps/backend/tests/contract/ai-suggestions-list.test.ts`
- [x] **T014** [P] Contract test POST /ai-assistant/suggestions/{id}/accept in
      `apps/backend/tests/contract/ai-suggestions-accept.test.ts`
- [x] **T015** [P] Contract test GET /ai-assistant/validation/score in
      `apps/backend/tests/contract/ai-validation-score.test.ts`

### Integration Tests (User Scenarios)

- [x] **T016** [P] Integration test: New business manager first use in
      `apps/backend/tests/integration/ai-assistant-onboarding.test.ts`
- [x] **T017** [P] Integration test: Returning user context enhancement in
      `apps/backend/tests/integration/ai-assistant-enhancement.test.ts`
- [x] **T018** [P] Integration test: Multi-store business context in
      `apps/backend/tests/integration/ai-assistant-multistore.test.ts`

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models & Services

- [x] **T019** [P] Conversation model in
      `apps/backend/src/models/ai-conversation.ts`
- [x] **T020** [P] Message model in `apps/backend/src/models/ai-message.ts`
- [x] **T021** [P] Context entry model in
      `apps/backend/src/models/context-entry.ts`
- [x] **T022** [P] Suggestion model in
      `apps/backend/src/models/ai-suggestion.ts`
- [x] **T023** [P] Validation result model in
      `apps/backend/src/models/validation-result.ts`

### AI & Core Services

- [x] **T024** [P] OpenAI service for GPT-4o-mini integration in
      `apps/backend/src/services/openai.ts`
- [x] **T025** [P] Context extraction service in
      `apps/backend/src/services/context-extraction.ts`
- [x] **T026** [P] Validation scoring service in
      `apps/backend/src/services/validation-scoring.ts`
- [x] **T027** [P] Suggestion generation service in
      `apps/backend/src/services/suggestion-generation.ts`

### API Route Implementations

- [x] **T028** Conversation management routes in
      `apps/backend/src/routes/ai-assistant/conversations.ts`
- [x] **T029** Message handling with streaming in
      `apps/backend/src/routes/ai-assistant/messages.ts`
- [x] **T030** Context management routes in
      `apps/backend/src/routes/ai-assistant/context.ts`
- [x] **T031** Suggestion management routes in
      `apps/backend/src/routes/ai-assistant/suggestions.ts`
- [x] **T032** Validation scoring routes in
      `apps/backend/src/routes/ai-assistant/validation.ts`

### Frontend Components

- [x] **T033** [P] Chat interface component in
      `apps/business/src/components/ai-assistant/chat-interface.tsx`
- [x] **T034** [P] Context sidebar component in
      `apps/business/src/components/ai-assistant/context-sidebar.tsx`
- [x] **T035** [P] Suggestions panel component in
      `apps/business/src/components/ai-assistant/suggestions-panel.tsx`
- [x] **T036** [P] Validation score display in
      `apps/business/src/components/ai-assistant/validation-score.tsx`

## Phase 3.4: Integration & Features

- [x] **T037** AI assistant main page in
      `apps/business/src/app/context/ai-assistant/page.tsx`
- [x] **T038** Real-time conversation sync using Supabase subscriptions in
      `apps/business/src/hooks/useConversationSync.ts`
- [x] **T039** Auto-save functionality for context updates in
      `apps/business/src/hooks/useAutoSave.ts`
- [x] **T040** Authentication middleware for AI assistant routes in
      `apps/backend/src/middleware/ai-assistant-auth.ts`

## Phase 3.5: Polish & Validation

- [x] **T041** [P] Unit tests for validation scoring algorithm in
      `apps/backend/tests/unit/validation-scoring.test.ts`
- [x] **T042** [P] Performance tests: <3s AI response, <2s validation in
      `apps/backend/tests/performance/ai-assistant-performance.test.ts`

## Dependencies

```
Setup (T001-T005) blocks everything
Tests (T006-T018) before implementation (T019-T042)
Models (T019-T023) before services (T024-T027)
Services (T024-T027) before routes (T028-T032)
Routes (T028-T032) before frontend (T033-T037)
Core features (T028-T037) before integration (T038-T040)
Implementation before polish (T041-T042)
```

## Parallel Execution Examples

### Phase 3.2: All Contract Tests (After T005)

```bash
# Launch T006-T015 together (different test files):
Task: "Contract test GET /ai-assistant/conversations in apps/backend/tests/contract/ai-conversations-list.test.ts"
Task: "Contract test POST /ai-assistant/conversations in apps/backend/tests/contract/ai-conversations-create.test.ts"
Task: "Contract test GET /ai-assistant/conversations/{id} in apps/backend/tests/contract/ai-conversations-get.test.ts"
Task: "Contract test PATCH /ai-assistant/conversations/{id} in apps/backend/tests/contract/ai-conversations-update.test.ts"
Task: "Contract test POST /ai-assistant/conversations/{id}/messages in apps/backend/tests/contract/ai-messages-send.test.ts"
Task: "Contract test GET /ai-assistant/context/entries in apps/backend/tests/contract/ai-context-list.test.ts"
Task: "Contract test POST /ai-assistant/context/entries in apps/backend/tests/contract/ai-context-create.test.ts"
Task: "Contract test GET /ai-assistant/suggestions in apps/backend/tests/contract/ai-suggestions-list.test.ts"
Task: "Contract test POST /ai-assistant/suggestions/{id}/accept in apps/backend/tests/contract/ai-suggestions-accept.test.ts"
Task: "Contract test GET /ai-assistant/validation/score in apps/backend/tests/contract/ai-validation-score.test.ts"
```

### Phase 3.2: All Integration Tests (After T015)

```bash
# Launch T016-T018 together (different test files):
Task: "Integration test: New business manager first use in apps/backend/tests/integration/ai-assistant-onboarding.test.ts"
Task: "Integration test: Returning user context enhancement in apps/backend/tests/integration/ai-assistant-enhancement.test.ts"
Task: "Integration test: Multi-store business context in apps/backend/tests/integration/ai-assistant-multistore.test.ts"
```

### Phase 3.3: All Models (After T018)

```bash
# Launch T019-T023 together (different model files):
Task: "Conversation model in apps/backend/src/models/ai-conversation.ts"
Task: "Message model in apps/backend/src/models/ai-message.ts"
Task: "Context entry model in apps/backend/src/models/context-entry.ts"
Task: "Suggestion model in apps/backend/src/models/ai-suggestion.ts"
Task: "Validation result model in apps/backend/src/models/validation-result.ts"
```

### Phase 3.3: All Services (After T023)

```bash
# Launch T024-T027 together (different service files):
Task: "OpenAI service for GPT-4o-mini integration in apps/backend/src/services/openai.ts"
Task: "Context extraction service in apps/backend/src/services/context-extraction.ts"
Task: "Validation scoring service in apps/backend/src/services/validation-scoring.ts"
Task: "Suggestion generation service in apps/backend/src/services/suggestion-generation.ts"
```

### Phase 3.3: All Frontend Components (After T032)

```bash
# Launch T033-T036 together (different component files):
Task: "Chat interface component in apps/business/src/components/ai-assistant/chat-interface.tsx"
Task: "Context sidebar component in apps/business/src/components/ai-assistant/context-sidebar.tsx"
Task: "Suggestions panel component in apps/business/src/components/ai-assistant/suggestions-panel.tsx"
Task: "Validation score display in apps/business/src/components/ai-assistant/validation-score.tsx"
```

## Notes

- **[P] tasks** = different files, no dependencies between them
- **Verify tests fail** before implementing corresponding functionality
- **Commit after each task** for granular progress tracking
- **Avoid**: vague descriptions, tasks that modify the same file simultaneously

## Task Generation Rules Applied

1. **From Contracts**: 10 endpoints → 10 contract test tasks [P] + 5 route
   implementation tasks
2. **From Data Model**: 5 entities → 5 model creation tasks [P] + related
   service tasks
3. **From User Stories**: 3 scenarios → 3 integration test tasks [P]
4. **Ordering**: Setup → Tests → Models → Services → Routes → Frontend →
   Integration → Polish

## Validation Checklist

✅ All 10 API endpoints have corresponding contract tests ✅ All 5 database
entities have model creation tasks ✅ All tests (T006-T018) come before
implementation (T019-T042) ✅ Parallel tasks ([P]) are truly independent
(different files) ✅ Each task specifies exact file path in monorepo structure
✅ No task modifies same file as another [P] task ✅ Dependencies properly block
parallel execution ✅ TDD approach: failing tests before implementation

## Success Criteria

- All contract tests pass with implemented API endpoints
- All integration tests validate complete user journeys
- AI responses <3 seconds, validation <2 seconds
- Real-time auto-save functionality working
- Multi-tenant data isolation with RLS policies
- TypeScript strict mode compliance
- Streaming AI responses functional
- Context completeness scoring accurate (0-100%)
- Suggestion system providing relevant recommendations
- Fraud detection configuration working
