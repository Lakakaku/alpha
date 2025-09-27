# Tasks: Production Deployment

**Input**: Design documents from `/specs/023-step-8-1/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Railway/Vercel deployment, TypeScript, Node.js 18+, monorepo structure
2. Load design documents:
   → data-model.md: Environment config, SSL certs, deployment status, monitoring entities
   → contracts/: deployment-status.yaml, health-checks.yaml, monitoring.yaml → contract tests
   → quickstart.md: 7 test scenarios → integration tests
3. Generate tasks by category:
   → Setup: deployment configs, domain setup, SSL configuration
   → Tests: contract tests for APIs, integration tests for deployment scenarios
   → Core: deployment automation, monitoring services, health check endpoints
   → Integration: Railway/Vercel deployment, domain/SSL setup, backup automation
   → Polish: performance tests, documentation, manual validation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same deployment platform = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Dependencies: Infrastructure → Health Checks → Monitoring → Deployment Automation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `apps/backend/`, `apps/customer/`, `apps/business/`, `apps/admin/`
- **New deployment configs**: `deployment/railway/`, `deployment/vercel/`, `deployment/scripts/`

## Phase 3.1: Setup
- [X] T001 Create deployment configuration directory structure (`deployment/railway/`, `deployment/vercel/`, `deployment/scripts/`)
- [X] T002 Install Railway CLI and Vercel CLI dependencies in package.json
- [X] T003 [P] Configure TypeScript for deployment scripts in deployment/tsconfig.json

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [X] T004 [P] Contract test GET /health in tests/contract/health-basic.test.ts
- [X] T005 [P] Contract test GET /health/detailed in tests/contract/health-detailed.test.ts
- [X] T006 [P] Contract test GET /health/database in tests/contract/health-database.test.ts
- [X] T007 [P] Contract test GET /health/jobs in tests/contract/health-jobs.test.ts
- [X] T008 [P] Contract test GET /api/admin/deployment/status in tests/contract/deployment-status.test.ts
- [X] T009 [P] Contract test POST /api/admin/deployment/rollback in tests/contract/deployment-rollback.test.ts
- [X] T010 [P] Contract test GET /api/admin/monitoring/uptime in tests/contract/monitoring-uptime.test.ts
- [X] T011 [P] Contract test GET /api/admin/monitoring/performance in tests/contract/monitoring-performance.test.ts
- [X] T012 [P] Contract test GET /api/admin/monitoring/backups in tests/contract/monitoring-backups.test.ts
- [X] T013 [P] Integration test Backend Deployment Health scenario in tests/integration/backend-deployment-health.test.ts
- [X] T014 [P] Integration test Frontend Deployment Validation scenario in tests/integration/frontend-deployment-validation.test.ts
- [X] T015 [P] Integration test Custom Domain and SSL Configuration scenario in tests/integration/domain-ssl-configuration.test.ts
- [X] T016 [P] Integration test Performance and Load Testing scenario in tests/integration/performance-load-testing.test.ts
- [X] T017 [P] Integration test Backup and Recovery Validation scenario in tests/integration/backup-recovery-validation.test.ts
- [X] T018 [P] Integration test Monitoring and Alerting Validation scenario in tests/integration/monitoring-alerting-validation.test.ts
- [X] T019 [P] Integration test Rollback Capability Testing scenario in tests/integration/rollback-capability-testing.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [X] T020 [P] Environment Configuration model in apps/backend/src/models/environment-configuration.ts
- [X] T021 [P] Environment Variables model in apps/backend/src/models/environment-variables.ts
- [X] T022 [P] SSL Certificate Management model in apps/backend/src/models/ssl-certificate.ts
- [X] T023 [P] Deployment Status model in apps/backend/src/models/deployment-status.ts
- [X] T024 [P] Monitoring Data model in apps/backend/src/models/monitoring-data.ts
- [X] T025 [P] Backup Records model in apps/backend/src/models/backup-records.ts
- [X] T026 [P] Domain Registry model in apps/backend/src/models/domain-registry.ts
- [X] T027 Basic health check endpoint GET /health in apps/backend/src/routes/health.ts
- [X] T028 Detailed health check endpoint GET /health/detailed in apps/backend/src/routes/health.ts
- [X] T029 Database health check endpoint GET /health/database in apps/backend/src/routes/health.ts
- [X] T030 Jobs health check endpoint GET /health/jobs in apps/backend/src/routes/health.ts
- [X] T031 Deployment status endpoints in apps/backend/src/routes/admin/deployment.ts
- [X] T032 Monitoring endpoints in apps/backend/src/routes/admin/monitoring.ts

## Phase 3.4: Deployment Infrastructure
- [X] T033 Railway deployment configuration for backend in deployment/railway/production.json
- [X] T034 Railway deployment configuration for backend in deployment/railway/staging.json
- [X] T035 [P] Vercel deployment configuration for customer app in deployment/vercel/customer.json
- [X] T036 [P] Vercel deployment configuration for business app in deployment/vercel/business.json
- [X] T037 [P] Vercel deployment configuration for admin app in deployment/vercel/admin.json
- [X] T038 SSL certificate management service in apps/backend/src/services/ssl-certificate-service.ts
- [X] T039 Domain configuration service in apps/backend/src/services/domain-service.ts
- [X] T040 Deployment status tracking service in apps/backend/src/services/deployment-status-service.ts

## Phase 3.5: Monitoring and Backup Services
- [X] T041 [P] Uptime monitoring service in apps/backend/src/services/monitoring/uptime-service.ts
- [X] T042 [P] Performance monitoring service in apps/backend/src/services/monitoring/performance-service.ts
- [X] T043 [P] Backup management service in apps/backend/src/services/monitoring/backup-service.ts
- [X] T044 [P] Alert management service in apps/backend/src/services/monitoring/alert-service.ts
- [X] T045 Monitoring data aggregation scheduler in apps/backend/src/jobs/monitoring-aggregation.ts
- [X] T046 Backup verification scheduler in apps/backend/src/jobs/backup-verification.ts

## Phase 3.6: Deployment Automation Scripts
- [X] T047 [P] Railway deployment script in deployment/scripts/deploy-backend.ts
- [X] T048 [P] Vercel deployment script in deployment/scripts/deploy-frontends.ts
- [X] T049 [P] Domain setup automation script in deployment/scripts/setup-domains.ts
- [X] T050 [P] SSL certificate setup script in deployment/scripts/setup-ssl.ts
- [X] T051 Rollback automation script in deployment/scripts/rollback-deployment.ts
- [X] T052 Environment variable synchronization script in deployment/scripts/sync-env-vars.ts
- [X] T053 [P] DNS configuration for api.vocilia.com subdomain in deployment/scripts/setup-dns.ts
- [X] T054 [P] DNS configuration for admin.vocilia.com subdomain in deployment/scripts/setup-dns.ts
- [X] T055 [P] DNS configuration for business.vocilia.com subdomain in deployment/scripts/setup-dns.ts

## Phase 3.6.1: GitHub CI/CD Integration
- [X] T056 [P] GitHub Actions workflow for backend deployment to Railway in .github/workflows/deploy-backend.yml
- [X] T057 [P] GitHub Actions workflow for customer app deployment to Vercel in .github/workflows/deploy-customer.yml
- [X] T058 [P] GitHub Actions workflow for business app deployment to Vercel in .github/workflows/deploy-business.yml
- [X] T059 [P] GitHub Actions workflow for admin app deployment to Vercel in .github/workflows/deploy-admin.yml

## Phase 3.7: Database Schema and Migrations
- [X] T060 [P] Environment configuration table migration in supabase/migrations/deployment_environment_config.sql
- [X] T061 [P] SSL certificate table migration in supabase/migrations/deployment_ssl_certificates.sql
- [X] T062 [P] Deployment status table migration in supabase/migrations/deployment_status.sql
- [X] T063 [P] Monitoring data table migration in supabase/migrations/deployment_monitoring.sql
- [X] T064 [P] Backup records table migration in supabase/migrations/deployment_backups.sql
- [X] T065 [P] Domain registry table migration in supabase/migrations/deployment_domains.sql
- [X] T066 Row Level Security policies for deployment tables in supabase/migrations/deployment_rls_policies.sql

## Phase 3.8: Integration and Configuration
- [X] T067 Environment variable configuration for Railway backend in deployment/railway/env-config.ts
- [X] T068 Environment variable configuration for Vercel apps in deployment/vercel/env-config.ts
- [X] T069 Health check middleware integration in apps/backend/src/middleware/health-check.ts
- [X] T070 Monitoring middleware for response time tracking in apps/backend/src/middleware/monitoring.ts
- [X] T071 Admin authentication for deployment endpoints in apps/backend/src/middleware/deployment-auth.ts

## Phase 3.9: Admin Dashboard Components
- [X] T072 [P] Deployment status dashboard component in apps/admin/src/components/deployment/DeploymentStatus.tsx
- [X] T073 [P] Performance monitoring dashboard component in apps/admin/src/components/monitoring/PerformanceMonitor.tsx
- [X] T074 [P] Backup status component in apps/admin/src/components/monitoring/BackupStatus.tsx
- [X] T075 [P] SSL certificate status component in apps/admin/src/components/deployment/SSLStatus.tsx
- [X] T076 Rollback management interface in apps/admin/src/components/deployment/RollbackManager.tsx
- [X] T077 Alert management interface in apps/admin/src/components/monitoring/AlertManager.tsx

## Phase 3.10: Polish and Documentation
- [X] T078 [P] Unit tests for deployment models in tests/unit/models/deployment.test.ts
- [X] T079 [P] Unit tests for monitoring services in tests/unit/services/monitoring.test.ts
- [X] T080 [P] Unit tests for SSL certificate management in tests/unit/services/ssl-certificate.test.ts
- [X] T081 Performance tests for <2s response time requirement in tests/performance/deployment-performance.test.ts
- [X] T082 Load testing configuration for 500 concurrent users in tests/performance/load-test-config.yml
- [X] T083 [P] Update deployment documentation in docs/deployment.md
- [X] T084 [P] Update monitoring documentation in docs/monitoring.md
- [X] T085 Manual validation testing checklist execution from specs/023-step-8-1/quickstart.md

## Dependencies
- Setup (T001-T003) before all other tasks
- Tests (T004-T019) before implementation (T020-T085)
- Models (T020-T026) before services (T038-T046)
- Infrastructure (T033-T037) before automation scripts (T047-T055)
- DNS configuration (T053-T055) before domain services (T038-T039)
- GitHub CI/CD workflows (T056-T059) before automated deployments
- Database migrations (T060-T066) before integration (T067-T071)
- Backend services before admin dashboard (T072-T077)
- Implementation before polish (T078-T085)

## Parallel Execution Examples
```
# Phase 3.2 - Launch all contract tests together:
Task: "Contract test GET /health in tests/contract/health-basic.test.ts"
Task: "Contract test GET /health/detailed in tests/contract/health-detailed.test.ts"
Task: "Contract test GET /health/database in tests/contract/health-database.test.ts"
Task: "Contract test GET /health/jobs in tests/contract/health-jobs.test.ts"

# Phase 3.3 - Launch all model creation together:
Task: "Environment Configuration model in apps/backend/src/models/environment-configuration.ts"
Task: "Environment Variables model in apps/backend/src/models/environment-variables.ts"
Task: "SSL Certificate Management model in apps/backend/src/models/ssl-certificate.ts"

# Phase 3.4 - Launch Vercel configurations together:
Task: "Vercel deployment configuration for customer app in deployment/vercel/customer.json"
Task: "Vercel deployment configuration for business app in deployment/vercel/business.json"
Task: "Vercel deployment configuration for admin app in deployment/vercel/admin.json"
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify all tests fail before implementing (TDD requirement)
- Commit after each task completion
- Railway and Vercel configurations are platform-specific
- SSL and domain setup requires external DNS configuration
- Backup and monitoring require Supabase integration
- Performance targets: <2s response time, 99.5% uptime, 500 concurrent users

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts (3 files) have corresponding contract tests (T004-T012)
- [x] All entities (7 models) have model creation tasks (T020-T026)
- [x] All quickstart scenarios (7 scenarios) have integration tests (T013-T019)
- [x] All tests come before implementation (Phase 3.2 before 3.3+)
- [x] Parallel tasks are truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path for implementation
- [x] No task modifies same file as another [P] task
- [x] Deployment order: Infrastructure → Health → Monitoring → Automation