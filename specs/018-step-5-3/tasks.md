# Tasks: Fraud Detection & Security

**Input**: Design documents from `/specs/018-step-5-3/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Path Conventions
Based on plan.md: **Web app** with existing monorepo structure
- **Backend**: `apps/backend/src/`
- **Admin Frontend**: `apps/admin/src/`
- **Shared Types**: `packages/types/src/`
- **Database**: `packages/database/src/`
- **Tests**: `apps/backend/tests/`

## Phase 3.1: Setup
- [x] T001 Create fraud detection project structure in apps/backend/src/services/fraud/
- [x] T002 Create security hardening project structure in apps/backend/src/services/security/
- [x] T003 [P] Install fraud detection dependencies (OpenAI SDK for GPT-4o-mini context analysis)

## Phase 3.2: Database Foundation
**CRITICAL: Database migrations MUST be created and applied before any implementation**
- [x] T004 [P] Create fraud_scores table migration in supabase/migrations/
- [x] T005 [P] Create context_analyses table migration in supabase/migrations/
- [x] T006 [P] Create behavioral_patterns table migration in supabase/migrations/
- [x] T007 [P] Create red_flag_keywords table migration in supabase/migrations/
- [x] T008 [P] Create audit_logs table migration in supabase/migrations/
- [x] T009 [P] Create rls_policies table migration in supabase/migrations/
- [x] T010 [P] Create intrusion_events table migration in supabase/migrations/
- [x] T011 [P] Create encryption_keys table migration in supabase/migrations/
- [x] T012 Create comprehensive RLS policies migration for all fraud/security tables

## Phase 3.3: Contract Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Fraud Detection Contract Tests
- [x] T013 [P] Contract test POST /api/fraud/analyze in apps/backend/tests/contract/fraud-analyze.test.ts
- [x] T014 [P] Contract test GET /api/fraud/patterns/{phone_hash} in apps/backend/tests/contract/fraud-patterns.test.ts
- [x] T015 [P] Contract test GET /api/fraud/keywords in apps/backend/tests/contract/fraud-keywords-get.test.ts
- [x] T016 [P] Contract test POST /api/fraud/keywords in apps/backend/tests/contract/fraud-keywords-post.test.ts

### Security Contract Tests
- [x] T017 [P] Contract test GET /api/security/audit-logs in apps/backend/tests/contract/security-audit-logs-get.test.ts
- [x] T018 [P] Contract test POST /api/security/audit-logs in apps/backend/tests/contract/security-audit-logs-post.test.ts
- [x] T019 [P] Contract test GET /api/security/intrusion-events in apps/backend/tests/contract/security-intrusion-get.test.ts
- [x] T020 [P] Contract test POST /api/security/intrusion-events in apps/backend/tests/contract/security-intrusion-post.test.ts
- [x] T021 [P] Contract test PATCH /api/security/intrusion-events/{event_id} in apps/backend/tests/contract/security-intrusion-patch.test.ts
- [x] T022 [P] Contract test GET /api/security/monitoring/alerts in apps/backend/tests/contract/security-alerts.test.ts

### Integration Tests
- [x] T023 [P] Integration test: Context-based legitimacy analysis in apps/backend/tests/integration/fraud-context-analysis.test.ts
- [x] T024 [P] Integration test: Red flag keyword detection in apps/backend/tests/integration/fraud-keyword-detection.test.ts
- [x] T025 [P] Integration test: Behavioral pattern detection in apps/backend/tests/integration/fraud-behavioral-patterns.test.ts
- [x] T026 [P] Integration test: RLS policy enforcement in apps/backend/tests/integration/security-rls-policies.test.ts
- [x] T027 [P] Integration test: Audit logging system in apps/backend/tests/integration/security-audit-logging.test.ts
- [x] T028 [P] Integration test: Intrusion detection workflow in apps/backend/tests/integration/security-intrusion-detection.test.ts

## Phase 3.4: Shared Types (ONLY after tests are failing)
- [x] T029 [P] Fraud detection types in packages/types/src/fraud.ts
- [x] T030 [P] Security types in packages/types/src/security.ts

## Phase 3.5: Database Models
- [x] T031 [P] FraudScore model in packages/database/src/fraud/fraud-score.ts
- [x] T032 [P] ContextAnalysis model in packages/database/src/fraud/context-analysis.ts
- [x] T033 [P] BehavioralPattern model in packages/database/src/fraud/behavioral-pattern.ts
- [x] T034 [P] RedFlagKeyword model in packages/database/src/fraud/red-flag-keyword.ts
- [x] T035 [P] AuditLog model in packages/database/src/security/audit-log.ts
- [x] T036 [P] IntrusionEvent model in packages/database/src/security/intrusion-event.ts
- [x] T037 [P] RLSPolicy model in packages/database/src/security/rls-policy.ts
- [x] T038 [P] EncryptionKey model in packages/database/src/security/encryption-key.ts

## Phase 3.6: Core Fraud Detection Services
- [x] T039 [P] Context analysis service using GPT-4o-mini in apps/backend/src/services/fraud/contextAnalysisService.ts
- [x] T040 [P] Keyword detection service in apps/backend/src/services/fraud/keywordDetectionService.ts
- [x] T041 [P] Behavioral pattern analysis service in apps/backend/src/services/fraud/behavioralPatternService.ts
- [x] T042 Composite fraud scoring service in apps/backend/src/services/fraud/fraudScoringService.ts
- [x] T043 Fraud detection orchestrator service in apps/backend/src/services/fraud/fraudDetectionService.ts

## Phase 3.7: Security Hardening Services
- [x] T044 [P] Audit logging service in apps/backend/src/services/security/auditLoggingService.ts
- [x] T045 [P] Intrusion detection service in apps/backend/src/services/security/intrusionDetectionService.ts
- [x] T046 [P] RLS policy enforcement service in apps/backend/src/services/security/rlsPolicyService.ts
- [x] T047 [P] Data encryption service in apps/backend/src/services/security/encryptionService.ts
- [x] T048 Security monitoring service in apps/backend/src/services/security/securityMonitoringService.ts

## Phase 3.8: API Route Implementations
### Fraud Detection Routes
- [x] T049 POST /api/fraud/analyze endpoint in apps/backend/src/routes/fraud/analyze.ts
- [x] T050 GET /api/fraud/patterns/{phone_hash} endpoint in apps/backend/src/routes/fraud/patterns.ts
- [x] T051 GET /api/fraud/keywords endpoint in apps/backend/src/routes/fraud/keywords.ts
- [x] T052 POST /api/fraud/keywords endpoint (same file as T051)

### Security Routes
- [x] T053 GET /api/security/audit-logs endpoint in apps/backend/src/routes/security/audit-logs.ts
- [x] T054 POST /api/security/audit-logs endpoint (same file as T053)
- [x] T055 GET /api/security/intrusion-events endpoint in apps/backend/src/routes/security/intrusion-events.ts
- [x] T056 POST /api/security/intrusion-events endpoint (same file as T055)
- [x] T057 PATCH /api/security/intrusion-events/{event_id} endpoint (same file as T055)
- [x] T058 GET /api/security/monitoring/alerts endpoint in apps/backend/src/routes/security/monitoring.ts

## Phase 3.9: Middleware & Integration
- [x] T059 Fraud detection middleware in apps/backend/src/middleware/fraud/fraudDetectionMiddleware.ts
- [x] T060 Security audit middleware in apps/backend/src/middleware/security/auditMiddleware.ts
- [x] T061 Intrusion detection middleware in apps/backend/src/middleware/security/intrusionMiddleware.ts
- [x] T062 Rate limiting enhancements in apps/backend/src/middleware/rateLimiter.ts (existing file)
- [x] T063 Enhanced error handling for fraud/security in apps/backend/src/middleware/errorHandler.ts (existing file)

## Phase 3.10: Admin Dashboard UI Components
- [x] T064 [P] Fraud score monitoring component in apps/admin/src/components/fraud/FraudScoreMonitor.tsx
- [x] T065 [P] Behavioral pattern dashboard in apps/admin/src/components/fraud/BehavioralPatternDashboard.tsx
- [x] T066 [P] Red flag keyword management in apps/admin/src/components/fraud/KeywordManagement.tsx
- [x] T067 [P] Audit log viewer in apps/admin/src/components/security/AuditLogViewer.tsx
- [x] T068 [P] Intrusion event dashboard in apps/admin/src/components/security/IntrusionEventDashboard.tsx
- [x] T069 [P] Security alerts monitor in apps/admin/src/components/security/SecurityAlertsMonitor.tsx
- [x] T070 Admin routing updates in apps/admin/src/app/admin/fraud/page.tsx
- [x] T071 Admin routing updates in apps/admin/src/app/admin/security/page.tsx

## Phase 3.11: Performance & Polish
- [x] T072 [P] Unit tests for fraud scoring algorithm in apps/backend/tests/unit/fraud-scoring.test.ts
- [x] T073 [P] Unit tests for context analysis in apps/backend/tests/unit/context-analysis.test.ts
- [x] T074 [P] Unit tests for behavioral patterns in apps/backend/tests/unit/behavioral-patterns.test.ts
- [x] T075 [P] Unit tests for audit logging in apps/backend/tests/unit/audit-logging.test.ts
- [x] T076 Performance tests: fraud detection <500ms in apps/backend/tests/performance/fraud-performance.test.ts
- [x] T077 Performance tests: security monitoring <100ms in apps/backend/tests/performance/security-performance.test.ts
- [x] T078 Load testing for fraud detection endpoints
- [x] T079 Security penetration testing for RLS policies
- [x] T080 Run quickstart.md validation scenarios

## Dependencies
- **Database Foundation** (T004-T012) blocks all implementation tasks
- **Contract Tests** (T013-T028) must complete and FAIL before implementation
- **Types** (T029-T030) block service implementation
- **Models** (T031-T038) block service implementation
- **Services** (T039-T048) block API routes
- **API Routes** (T049-T058) block UI components
- **Core Implementation** before performance/polish (T072-T080)

## Parallel Execution Examples

### Database Migrations (can run together)
```bash
# Launch T004-T011 together:
Task: "Create fraud_scores table migration in supabase/migrations/"
Task: "Create context_analyses table migration in supabase/migrations/"
Task: "Create behavioral_patterns table migration in supabase/migrations/"
Task: "Create red_flag_keywords table migration in supabase/migrations/"
```

### Contract Tests (can run together)
```bash
# Launch T013-T022 together:
Task: "Contract test POST /api/fraud/analyze in apps/backend/tests/contract/fraud-analyze.test.ts"
Task: "Contract test GET /api/fraud/patterns/{phone_hash} in apps/backend/tests/contract/fraud-patterns.test.ts"
Task: "Contract test GET /api/security/audit-logs in apps/backend/tests/contract/security-audit-logs-get.test.ts"
Task: "Contract test POST /api/security/intrusion-events in apps/backend/tests/contract/security-intrusion-post.test.ts"
```

### Models (can run together)
```bash
# Launch T031-T038 together:
Task: "FraudScore model in packages/database/src/fraud/fraud-score.ts"
Task: "ContextAnalysis model in packages/database/src/fraud/context-analysis.ts"
Task: "AuditLog model in packages/database/src/security/audit-log.ts"
Task: "IntrusionEvent model in packages/database/src/security/intrusion-event.ts"
```

### Core Services (can run together)
```bash
# Launch T039-T041, T044-T047 together:
Task: "Context analysis service using GPT-4o-mini in apps/backend/src/services/fraud/contextAnalysisService.ts"
Task: "Behavioral pattern analysis service in apps/backend/src/services/fraud/behavioralPatternService.ts"
Task: "Audit logging service in apps/backend/src/services/security/auditLoggingService.ts"
Task: "Data encryption service in apps/backend/src/services/security/encryptionService.ts"
```

### UI Components (can run together)
```bash
# Launch T064-T069 together:
Task: "Fraud score monitoring component in apps/admin/src/components/fraud/FraudScoreMonitor.tsx"
Task: "Audit log viewer in apps/admin/src/components/security/AuditLogViewer.tsx"
Task: "Security alerts monitor in apps/admin/src/components/security/SecurityAlertsMonitor.tsx"
```

## Constitutional Compliance Notes
- **Production from Day One**: All tasks implement real fraud detection and security hardening
- **Security First**: RLS policies, audit logging, and intrusion detection are mandatory
- **TypeScript Strict**: All tasks must use strict TypeScript typing
- **Real Data**: Integration with existing Supabase database and customer feedback system
- **TDD**: Tests must be written first and must fail before implementation

## Validation Checklist
✅ All contracts have corresponding tests (T013-T022 cover all endpoints)
✅ All entities have model tasks (T031-T038 cover all 8 entities)
✅ All tests come before implementation (Phase 3.3 before 3.4-3.10)
✅ Parallel tasks are truly independent (different files marked [P])
✅ Each task specifies exact file path
✅ No [P] task modifies same file as another [P] task
✅ Dependencies properly documented and ordered

**TOTAL TASKS**: 80 numbered tasks
**ESTIMATED DURATION**: 4-6 weeks with parallel execution
**CRITICAL PATH**: Database migrations → Contract tests → Models → Services → APIs → UI