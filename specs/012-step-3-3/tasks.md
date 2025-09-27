# Tasks: Customer Interface Polish

**Input**: Design documents from `/specs/012-step-3-3/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Next.js 14, TypeScript, Supabase, Tailwind CSS
   → Structure: Web app (apps/customer, apps/backend, packages/*)
2. Load design documents ✓
   → data-model.md: 5 entities (enhanced + new tables)
   → contracts/: 3 API contracts + PWA manifest
   → research.md: PWA, offline, accessibility decisions
   → quickstart.md: 8 test scenarios
3. Generate tasks by category ✓
   → Setup: TypeScript configs, dependencies
   → Tests: Contract tests, integration tests
   → Core: Database migrations, UI components, services
   → Integration: PWA, offline sync, accessibility
   → Polish: Performance, documentation
4. Applied task rules ✓
   → [P] for different files/independent tasks
   → Sequential for shared files
   → Tests before implementation (TDD)
5. Tasks numbered T001-T035 ✓
6. Dependencies mapped ✓
7. Parallel examples created ✓
8. Validation complete ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Paths based on existing monorepo structure from plan.md

## Phase 3.1: Setup & Dependencies
- [x] T001 Update TypeScript configs for new PWA and offline types
- [x] T002 [P] Add PWA dependencies to apps/customer/package.json (workbox, idb)
- [x] T003 [P] Add accessibility testing dependencies to apps/customer/package.json (@testing-library/jest-dom, axe-core)
- [x] T004 Configure Jest for accessibility testing in apps/customer/jest.config.js

## Phase 3.2: Database Schema (TDD Setup)
- [x] T005 [P] Create migration for call_sessions enhancements in supabase/migrations/
- [x] T006 [P] Create migration for offline_submission_queue table in supabase/migrations/
- [x] T007 [P] Create migration for customer_support_requests table in supabase/migrations/
- [x] T008 [P] Create migration for pwa_installations table in supabase/migrations/
- [x] T009 [P] Create migration for customer_accessibility_preferences table in supabase/migrations/

## Phase 3.3: Contract Tests (MUST FAIL BEFORE IMPLEMENTATION)
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T010 [P] Contract test GET /api/calls/{sessionId}/status in apps/backend/tests/contract/call-status.test.ts
- [x] T011 [P] Contract test POST /api/calls/{sessionId}/confirm-completion in apps/backend/tests/contract/call-completion.test.ts
- [x] T012 [P] Contract test POST /api/offline/submit in apps/backend/tests/contract/offline-submit.test.ts
- [x] T013 [P] Contract test POST /api/offline/sync in apps/backend/tests/contract/offline-sync.test.ts
- [x] T014 [P] Contract test POST /api/support/request in apps/backend/tests/contract/customer-support.test.ts
- [x] T015 [P] Contract test GET /api/support/faq in apps/backend/tests/contract/support-faq.test.ts

## Phase 3.4: Integration Tests (User Stories)
- [x] T016 [P] Integration test mobile verification flow in apps/customer/tests/integration/mobile-verification.test.ts
- [x] T017 [P] Integration test PWA installation flow in apps/customer/tests/integration/pwa-installation.test.ts
- [x] T018 [P] Integration test offline submission and sync in apps/customer/tests/integration/offline-capability.test.ts
- [x] T019 [P] Integration test accessibility compliance in apps/customer/tests/integration/accessibility.test.ts
- [x] T020 [P] Integration test call completion confirmation in apps/customer/tests/integration/call-completion.test.ts
- [x] T021 [P] Integration test customer support submission in apps/customer/tests/integration/customer-support.test.ts

## Phase 3.5: Core Implementation - Types & Models
- [x] T022 [P] Enhanced call session types in packages/types/src/calls.ts
- [x] T023 [P] Offline submission types in packages/types/src/offline.ts
- [x] T024 [P] Customer support types in packages/types/src/support.ts
- [x] T025 [P] PWA and accessibility types in packages/types/src/pwa.ts
- [x] T026 [P] Database queries for offline queue in packages/database/src/offline/
- [x] T027 [P] Database queries for customer support in packages/database/src/support/

## Phase 3.6: Backend API Implementation
- [x] T028 Enhanced call status endpoints in apps/backend/src/routes/calls/status.ts
- [x] T029 Call completion confirmation endpoint in apps/backend/src/routes/calls/completion.ts
- [x] T030 Offline submission endpoints in apps/backend/src/routes/offline/
- [x] T031 Customer support endpoints in apps/backend/src/routes/support/
- [x] T032 Offline sync service in apps/backend/src/services/offline/sync.ts
- [x] T033 Customer support service in apps/backend/src/services/support/

## Phase 3.7: Frontend Components & Services
- [ ] T034 [P] Mobile-optimized verification form in apps/customer/src/components/verification/MobileVerificationForm.tsx
- [x] T035 [P] Call status tracking component in apps/customer/src/components/calls/CallStatusTracker.tsx
- [ ] T036 [P] Call completion confirmation component in apps/customer/src/components/calls/CallCompletionConfirmation.tsx
- [x] T037 [P] Reward timeline display component in apps/customer/src/components/rewards/RewardTimeline.tsx
- [x] T038 [P] Customer support widget in apps/customer/src/components/support/SupportWidget.tsx
- [x] T039 [P] PWA installation prompt in apps/customer/src/components/pwa/InstallPrompt.tsx
- [ ] T040 [P] Accessibility preferences in apps/customer/src/components/accessibility/AccessibilitySettings.tsx

## Phase 3.8: PWA & Offline Implementation
- [x] T041 PWA manifest configuration in apps/customer/public/manifest.json
- [x] T042 Service worker for caching in apps/customer/public/sw.js
- [x] T043 Offline queue service in apps/customer/src/services/offline/OfflineQueue.ts
- [x] T044 PWA installation manager in apps/customer/src/services/pwa/PWAManager.ts
- [x] T045 Background sync service in apps/customer/src/services/offline/BackgroundSync.ts

## Phase 3.9: Accessibility & Mobile Optimization
- [x] T046 [P] Accessibility hooks in apps/customer/src/hooks/useAccessibility.ts
- [x] T047 [P] Mobile touch optimization in apps/customer/src/hooks/useMobileOptimization.ts
- [ ] T048 [P] Screen reader support utilities in apps/customer/src/utils/accessibility.ts
- [x] T049 [P] Mobile responsive layouts in apps/customer/src/styles/mobile.css
- [x] T050 WCAG compliance validation in apps/customer/src/utils/wcag-validator.ts

## Phase 3.10: Integration & Middleware
- [x] T051 Enhanced call status middleware in apps/backend/src/middleware/call-status.ts
- [x] T052 Offline sync validation middleware in apps/backend/src/middleware/offline-validation.ts
- [x] T053 Customer support rate limiting in apps/backend/src/middleware/support-rate-limit.ts
- [x] T054 PWA security headers in apps/backend/src/middleware/pwa-security.ts

## Phase 3.11: Polish & Performance
- [x] T055 [P] Unit tests for offline queue in apps/customer/tests/unit/offline-queue.test.ts
- [x] T056 [P] Unit tests for PWA manager in apps/customer/tests/unit/pwa-manager.test.ts
- [ ] T057 [P] Unit tests for accessibility utils in apps/customer/tests/unit/accessibility.test.ts
- [x] T058 Performance optimization for mobile in apps/customer/src/utils/performance.ts
- [x] T059 Lighthouse PWA audit validation
- [x] T060 Execute quickstart.md validation scenarios

## Dependencies
- **Setup (T001-T004)** → All other phases
- **Database (T005-T009)** → Backend implementation (T028-T033)
- **Contract Tests (T010-T015)** → Backend implementation (T028-T033)
- **Integration Tests (T016-T021)** → Frontend implementation (T034-T040)
- **Types (T022-T025)** → All implementation tasks
- **Database Queries (T026-T027)** → Backend services (T032-T033)
- **Backend APIs (T028-T033)** → Frontend components (T034-T040)
- **Core Components (T034-T040)** → PWA implementation (T041-T045)
- **All Implementation** → Polish (T055-T060)

## Parallel Execution Examples

### Phase 3.3: Contract Tests (All Parallel)
```bash
# Launch T010-T015 together:
Task: "Contract test GET /api/calls/{sessionId}/status in apps/backend/tests/contract/call-status.test.ts"
Task: "Contract test POST /api/calls/{sessionId}/confirm-completion in apps/backend/tests/contract/call-completion.test.ts"
Task: "Contract test POST /api/offline/submit in apps/backend/tests/contract/offline-submit.test.ts"
Task: "Contract test POST /api/offline/sync in apps/backend/tests/contract/offline-sync.test.ts"
Task: "Contract test POST /api/support/request in apps/backend/tests/contract/customer-support.test.ts"
Task: "Contract test GET /api/support/faq in apps/backend/tests/contract/support-faq.test.ts"
```

### Phase 3.4: Integration Tests (All Parallel)
```bash
# Launch T016-T021 together:
Task: "Integration test mobile verification flow in apps/customer/tests/integration/mobile-verification.test.ts"
Task: "Integration test PWA installation flow in apps/customer/tests/integration/pwa-installation.test.ts"
Task: "Integration test offline submission and sync in apps/customer/tests/integration/offline-capability.test.ts"
Task: "Integration test accessibility compliance in apps/customer/tests/integration/accessibility.test.ts"
Task: "Integration test call completion confirmation in apps/customer/tests/integration/call-completion.test.ts"
Task: "Integration test customer support submission in apps/customer/tests/integration/customer-support.test.ts"
```

### Phase 3.7: Frontend Components (All Parallel)
```bash
# Launch T034-T040 together:
Task: "Mobile-optimized verification form in apps/customer/src/components/verification/MobileVerificationForm.tsx"
Task: "Call status tracking component in apps/customer/src/components/calls/CallStatusTracker.tsx"
Task: "Call completion confirmation component in apps/customer/src/components/calls/CallCompletionConfirmation.tsx"
Task: "Reward timeline display component in apps/customer/src/components/rewards/RewardTimeline.tsx"
Task: "Customer support widget in apps/customer/src/components/support/SupportWidget.tsx"
Task: "PWA installation prompt in apps/customer/src/components/pwa/InstallPrompt.tsx"
Task: "Accessibility preferences in apps/customer/src/components/accessibility/AccessibilitySettings.tsx"
```

## Notes
- All [P] tasks use different files with no dependencies
- Contract tests MUST fail before implementation begins
- PWA manifest and service worker require HTTPS context
- Accessibility testing requires screen reader simulation
- Mobile optimization requires responsive design validation
- Offline functionality requires IndexedDB and service worker support

## Validation Checklist

### Contract Coverage
- [x] Call status API → T010, T011
- [x] Offline sync API → T012, T013
- [x] Customer support API → T014, T015
- [x] All 6 main endpoints covered

### Entity Implementation
- [x] Enhanced call_sessions → T005, T022, T028
- [x] offline_submission_queue → T006, T023, T026, T030
- [x] customer_support_requests → T007, T024, T027, T031
- [x] pwa_installations → T008, T025, T044
- [x] customer_accessibility_preferences → T009, T025, T040

### Test Coverage
- [x] All contracts have tests (T010-T015)
- [x] All user stories have integration tests (T016-T021)
- [x] Tests before implementation ✓
- [x] Unit tests for core utilities (T055-T057)

### Parallel Task Independence
- [x] Contract tests: Different test files ✓
- [x] Integration tests: Different test files ✓
- [x] Components: Different component files ✓
- [x] Types/Models: Different type files ✓
- [x] No file conflicts in parallel groups ✓

### Implementation Completeness
- [x] Database migrations for all entities
- [x] API endpoints for all contracts
- [x] Frontend components for all user scenarios
- [x] PWA functionality (manifest, service worker, caching)
- [x] Accessibility compliance (WCAG 2.1 AA)
- [x] Mobile optimization (responsive, touch-friendly)
- [x] Offline capability (queue, sync, indicators)
- [x] Performance validation (Lighthouse, quickstart)

**Status**: PASS - All requirements covered, tasks ready for execution