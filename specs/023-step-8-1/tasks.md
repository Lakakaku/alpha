# Tasks: Production Deployment

**Input**: Design documents from `/specs/023-step-8-1/` **Prerequisites**:
plan.md (required), research.md, data-model.md, contracts/

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

- **Monorepo structure**: `apps/backend/`, `apps/customer/`, `apps/business/`,
  `apps/admin/`
- **New deployment configs**: `deployment/railway/`, `deployment/vercel/`,
  `deployment/scripts/`

## Phase 3.1: Setup

- [x] T001 Create deployment configuration directory structure
      (`deployment/railway/`, `deployment/vercel/`, `deployment/scripts/`)
- [x] T002 Install Railway CLI and Vercel CLI dependencies in package.json
- [x] T003 [P] Configure TypeScript for deployment scripts in
      deployment/tsconfig.json

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

- [x] T004 [P] Contract test GET /health in tests/contract/health-basic.test.ts
- [x] T005 [P] Contract test GET /health/detailed in
      tests/contract/health-detailed.test.ts
- [x] T006 [P] Contract test GET /health/database in
      tests/contract/health-database.test.ts
- [x] T007 [P] Contract test GET /health/jobs in
      tests/contract/health-jobs.test.ts
- [x] T008 [P] Contract test GET /api/admin/deployment/status in
      tests/contract/deployment-status.test.ts
- [x] T009 [P] Contract test POST /api/admin/deployment/rollback in
      tests/contract/deployment-rollback.test.ts
- [x] T010 [P] Contract test GET /api/admin/monitoring/uptime in
      tests/contract/monitoring-uptime.test.ts
- [x] T011 [P] Contract test GET /api/admin/monitoring/performance in
      tests/contract/monitoring-performance.test.ts
- [x] T012 [P] Contract test GET /api/admin/monitoring/backups in
      tests/contract/monitoring-backups.test.ts
- [x] T013 [P] Integration test Backend Deployment Health scenario in
      tests/integration/backend-deployment-health.test.ts
- [x] T014 [P] Integration test Frontend Deployment Validation scenario in
      tests/integration/frontend-deployment-validation.test.ts
- [x] T015 [P] Integration test Custom Domain and SSL Configuration scenario in
      tests/integration/domain-ssl-configuration.test.ts
- [x] T016 [P] Integration test Performance and Load Testing scenario in
      tests/integration/performance-load-testing.test.ts
- [x] T017 [P] Integration test Backup and Recovery Validation scenario in
      tests/integration/backup-recovery-validation.test.ts
- [x] T018 [P] Integration test Monitoring and Alerting Validation scenario in
      tests/integration/monitoring-alerting-validation.test.ts
- [x] T019 [P] Integration test Rollback Capability Testing scenario in
      tests/integration/rollback-capability-testing.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [x] T020 [P] Environment Configuration model in
      apps/backend/src/models/environment-configuration.ts
- [x] T021 [P] Environment Variables model in
      apps/backend/src/models/environment-variables.ts
- [x] T022 [P] SSL Certificate Management model in
      apps/backend/src/models/ssl-certificate.ts
- [x] T023 [P] Deployment Status model in
      apps/backend/src/models/deployment-status.ts
- [x] T024 [P] Monitoring Data model in
      apps/backend/src/models/monitoring-data.ts
- [x] T025 [P] Backup Records model in apps/backend/src/models/backup-records.ts
- [x] T026 [P] Domain Registry model in
      apps/backend/src/models/domain-registry.ts
- [x] T027 Basic health check endpoint GET /health in
      apps/backend/src/routes/health.ts
- [x] T028 Detailed health check endpoint GET /health/detailed in
      apps/backend/src/routes/health.ts
- [x] T029 Database health check endpoint GET /health/database in
      apps/backend/src/routes/health.ts
- [x] T030 Jobs health check endpoint GET /health/jobs in
      apps/backend/src/routes/health.ts
- [x] T031 Deployment status endpoints in
      apps/backend/src/routes/admin/deployment.ts
- [x] T032 Monitoring endpoints in apps/backend/src/routes/admin/monitoring.ts

## Phase 3.4: Deployment Infrastructure

- [x] T033 Railway deployment configuration for backend in
      deployment/railway/production.json
- [x] T034 Railway deployment configuration for backend in
      deployment/railway/staging.json
- [x] T035 [P] Vercel deployment configuration for customer app in
      deployment/vercel/customer.json
- [x] T036 [P] Vercel deployment configuration for business app in
      deployment/vercel/business.json
- [x] T037 [P] Vercel deployment configuration for admin app in
      deployment/vercel/admin.json
- [x] T038 SSL certificate management service in
      apps/backend/src/services/ssl-certificate-service.ts
- [x] T039 Domain configuration service in
      apps/backend/src/services/domain-service.ts
- [x] T040 Deployment status tracking service in
      apps/backend/src/services/deployment-status-service.ts

## Phase 3.5: Monitoring and Backup Services

- [x] T041 [P] Uptime monitoring service in
      apps/backend/src/services/monitoring/uptime-service.ts
- [x] T042 [P] Performance monitoring service in
      apps/backend/src/services/monitoring/performance-service.ts
- [x] T043 [P] Backup management service in
      apps/backend/src/services/monitoring/backup-service.ts
- [x] T044 [P] Alert management service in
      apps/backend/src/services/monitoring/alert-service.ts
- [x] T045 Monitoring data aggregation scheduler in
      apps/backend/src/jobs/monitoring-aggregation.ts
- [x] T046 Backup verification scheduler in
      apps/backend/src/jobs/backup-verification.ts

## Phase 3.6: Deployment Automation Scripts

- [x] T047 [P] Railway deployment script in deployment/scripts/deploy-backend.ts
- [x] T048 [P] Vercel deployment script in
      deployment/scripts/deploy-frontends.ts
- [x] T049 [P] Domain setup automation script in
      deployment/scripts/setup-domains.ts
- [x] T050 [P] SSL certificate setup script in deployment/scripts/setup-ssl.ts
- [x] T051 Rollback automation script in
      deployment/scripts/rollback-deployment.ts
- [x] T052 Environment variable synchronization script in
      deployment/scripts/sync-env-vars.ts
- [x] T053 [P] DNS configuration for api.vocilia.com subdomain in
      deployment/scripts/setup-dns.ts
- [x] T054 [P] DNS configuration for admin.vocilia.com subdomain in
      deployment/scripts/setup-dns.ts
- [x] T055 [P] DNS configuration for business.vocilia.com subdomain in
      deployment/scripts/setup-dns.ts

## Phase 3.6.1: GitHub CI/CD Integration

- [x] T056 [P] GitHub Actions workflow for backend deployment to Railway in
      .github/workflows/deploy-backend.yml
- [x] T057 [P] GitHub Actions workflow for customer app deployment to Vercel in
      .github/workflows/deploy-customer.yml
- [x] T058 [P] GitHub Actions workflow for business app deployment to Vercel in
      .github/workflows/deploy-business.yml
- [x] T059 [P] GitHub Actions workflow for admin app deployment to Vercel in
      .github/workflows/deploy-admin.yml

## Phase 3.7: Database Schema and Migrations

- [x] T060 [P] Environment configuration table migration in
      supabase/migrations/deployment_environment_config.sql
- [x] T061 [P] SSL certificate table migration in
      supabase/migrations/deployment_ssl_certificates.sql
- [x] T062 [P] Deployment status table migration in
      supabase/migrations/deployment_status.sql
- [x] T063 [P] Monitoring data table migration in
      supabase/migrations/deployment_monitoring.sql
- [x] T064 [P] Backup records table migration in
      supabase/migrations/deployment_backups.sql
- [x] T065 [P] Domain registry table migration in
      supabase/migrations/deployment_domains.sql
- [x] T066 Row Level Security policies for deployment tables in
      supabase/migrations/deployment_rls_policies.sql

## Phase 3.8: Integration and Configuration

- [x] T067 Environment variable configuration for Railway backend in
      deployment/railway/env-config.ts
- [x] T068 Environment variable configuration for Vercel apps in
      deployment/vercel/env-config.ts
- [x] T069 Health check middleware integration in
      apps/backend/src/middleware/health-check.ts
- [x] T070 Monitoring middleware for response time tracking in
      apps/backend/src/middleware/monitoring.ts
- [x] T071 Admin authentication for deployment endpoints in
      apps/backend/src/middleware/deployment-auth.ts

## Phase 3.9: Admin Dashboard Components

- [x] T072 [P] Deployment status dashboard component in
      apps/admin/src/components/deployment/DeploymentStatus.tsx
- [x] T073 [P] Performance monitoring dashboard component in
      apps/admin/src/components/monitoring/PerformanceMonitor.tsx
- [x] T074 [P] Backup status component in
      apps/admin/src/components/monitoring/BackupStatus.tsx
- [x] T075 [P] SSL certificate status component in
      apps/admin/src/components/deployment/SSLStatus.tsx
- [x] T076 Rollback management interface in
      apps/admin/src/components/deployment/RollbackManager.tsx
- [x] T077 Alert management interface in
      apps/admin/src/components/monitoring/AlertManager.tsx

## Phase 3.10: Polish and Documentation

- [x] T078 [P] Unit tests for deployment models in
      tests/unit/models/deployment.test.ts
- [x] T079 [P] Unit tests for monitoring services in
      tests/unit/services/monitoring.test.ts
- [x] T080 [P] Unit tests for SSL certificate management in
      tests/unit/services/ssl-certificate.test.ts
- [x] T081 Performance tests for <2s response time requirement in
      tests/performance/deployment-performance.test.ts
- [x] T082 Load testing configuration for 500 concurrent users in
      tests/performance/load-test-config.yml
- [x] T083 [P] Update deployment documentation in docs/deployment.md
- [x] T084 [P] Update monitoring documentation in docs/monitoring.md
- [x] T085 Manual validation testing checklist execution from
      specs/023-step-8-1/quickstart.md

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

_GATE: Checked before execution_

- [x] All contracts (3 files) have corresponding contract tests (T004-T012)
- [x] All entities (7 models) have model creation tasks (T020-T026)
- [x] All quickstart scenarios (7 scenarios) have integration tests (T013-T019)
- [x] All tests come before implementation (Phase 3.2 before 3.3+)
- [x] Parallel tasks are truly independent (different files, no shared
      dependencies)
- [x] Each task specifies exact file path for implementation
- [x] No task modifies same file as another [P] task
- [x] Deployment order: Infrastructure → Health → Monitoring → Automation
