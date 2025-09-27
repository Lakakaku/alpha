# Tasks: Swish Payment Integration

**Input**: Design documents from `/Users/lucasjenner/alpha/specs/019-step-6-1/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Summary
```
Design Documents Loaded:
✓ plan.md: TypeScript 5.5.4, Next.js 14, Supabase, Jest, Railway/Vercel monorepo
✓ research.md: dinero.js (currency), node-cron (scheduler), mock Swish client
✓ data-model.md: 6 tables (payment_transactions, reward_calculations, payment_batches,
                 payment_failures, reconciliation_reports, business_invoices)
✓ contracts/: 7 API endpoints (calculate-rewards, process-batch, get-batch-status,
               get-reconciliation, get-failed-payments, retry-payment, get-customer-history)
✓ quickstart.md: 7 integration test scenarios

Task Generation:
- Setup: 4 tasks (dependencies, types, migration)
- Contract Tests: 7 tasks [P] (one per endpoint)
- Integration Tests: 7 tasks [P] (one per quickstart scenario)
- Models: 6 tasks [P] (one per database table)
- Services: 5 tasks (reward-calculator, swish-client, payment-processor, batch-scheduler, reconciliation)
- Endpoints: 1 task (all endpoints in same file)
- Job Scheduler: 1 task (cron job)
- Admin UI: 4 tasks (page, stats, reconciliation table, failed payments list)
- Polish: 4 tasks (unit tests, performance, materialized views, quickstart validation)

Total: 39 tasks
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Exact file paths included in each task

## Phase 3.1: Setup & Dependencies

- [x] **T001** Install payment integration dependencies
  - **Path**: `/Users/lucasjenner/alpha/package.json` (root), `apps/backend/package.json`
  - **Action**: Add dinero.js@2.0.0-alpha.14, node-cron@3.0.3, @types/node-cron@3.0.11
  - **Verification**: `pnpm install` succeeds, packages appear in node_modules
  - **Files Modified**: 2 package.json files, pnpm-lock.yaml

- [x] **T002** Create shared payment types
  - **Path**: `/Users/lucasjenner/alpha/packages/types/src/payment.ts`
  - **Action**: Define TypeScript interfaces for PaymentTransaction, RewardCalculation, PaymentBatch, PaymentFailure, ReconciliationReport, BusinessInvoice, SwishPaymentRequest, SwishPaymentResponse, SEKAmount (Dinero<number> alias)
  - **Reference**: contracts/ OpenAPI schemas, research.md dinero.js types
  - **Verification**: TypeScript compiles without errors, exports all interfaces
  - **Dependencies**: None (new file)

- [x] **T003** Update packages/types/src/index.ts exports
  - **Path**: `/Users/lucasjenner/alpha/packages/types/src/index.ts`
  - **Action**: Add `export * from './payment'` to index file
  - **Verification**: Import `{ PaymentTransaction }` from `@vocilia/types` works in other packages
  - **Dependencies**: T002

- [x] **T004** Create Supabase migration for payment schema
  - **Path**: `/Users/lucasjenner/alpha/supabase/migrations/[timestamp]_payment_schema.sql`
  - **Action**: Create all 6 tables (payment_batches first, then payment_transactions, reward_calculations, payment_failures, reconciliation_reports, business_invoices), add RLS policies, create indexes, create materialized views (weekly_payment_summary, store_reward_summary), create triggers
  - **Reference**: data-model.md complete SQL schema
  - **Verification**: `npx supabase db reset` succeeds, all tables exist, RLS enabled
  - **Dependencies**: None (database foundation)

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (One per API endpoint) [P]

- [x] **T005 [P]** Contract test POST /api/admin/payments/calculate-rewards
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/calculate-rewards.test.ts`
  - **Action**: Test request/response schema validation against contracts/calculate-rewards.yaml, verify 200 success with valid feedbackIds array, verify 400 with invalid IDs, verify 401 without admin auth token
  - **Verification**: Test runs, all assertions FAIL (endpoint not implemented)
  - **Dependencies**: T002 (types), T004 (migration)

- [x] **T006 [P]** Contract test POST /api/admin/payments/process-batch
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/process-batch.test.ts`
  - **Action**: Test schema validation against contracts/process-batch.yaml, verify 202 response with batchId/batchWeek/status, verify 400 with invalid week format, verify 409 if batch already processing
  - **Verification**: Test runs, all assertions FAIL (endpoint not implemented)
  - **Dependencies**: T002, T004

- [x] **T007 [P]** Contract test GET /api/admin/payments/batch/:batchId
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/get-batch-status.test.ts`
  - **Action**: Test schema validation against contracts/get-batch-status.yaml, verify 200 with batch details, verify 404 for non-existent batchId
  - **Verification**: Test runs, all assertions FAIL
  - **Dependencies**: T002, T004

- [x] **T008 [P]** Contract test GET /api/admin/payments/reconciliation/:batchId
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/get-reconciliation.test.ts`
  - **Action**: Test schema validation against contracts/get-reconciliation.yaml, verify 200 with report + storeBreakdown array, verify 404 if report not found
  - **Verification**: Test runs, all assertions FAIL
  - **Dependencies**: T002, T004

- [x] **T009 [P]** Contract test GET /api/admin/payments/failed
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/get-failed-payments.test.ts`
  - **Action**: Test schema validation against contracts/get-failed-payments.yaml, verify 200 with failures array + pagination (limit/offset), verify status filter query param works
  - **Verification**: Test runs, all assertions FAIL
  - **Dependencies**: T002, T004

- [x] **T010 [P]** Contract test POST /api/admin/payments/retry/:transactionId
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/retry-payment.test.ts`
  - **Action**: Test schema validation against contracts/retry-payment.yaml, verify 200 with transaction details, verify 404 for invalid transactionId, verify 409 if already successful, verify updatedPhone/adminNotes/force optional params
  - **Verification**: Test runs, all assertions FAIL
  - **Dependencies**: T002, T004

- [x] **T011 [P]** Contract test GET /api/admin/payments/customer/:phone
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/contract/get-customer-history.test.ts`
  - **Action**: Test schema validation against contracts/get-customer-history.yaml, verify 200 with summary + transactions array, verify 400 with invalid phone format, verify 404 if no history found, verify pagination
  - **Verification**: Test runs, all assertions FAIL
  - **Dependencies**: T002, T004

### Integration Tests (One per quickstart scenario) [P]

- [x] **T012 [P]** Integration test Scenario 1: End-to-end weekly payment flow
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/end-to-end-payment-flow.test.ts`
  - **Action**: Test complete flow from quickstart.md Scenario 1 - submit feedback (quality score 85), business verifies transaction, calculate rewards (expect 11.1% of 200 SEK = 22.20 SEK), trigger batch, verify payment status successful, verify reconciliation report shows 0 discrepancies
  - **Verification**: Test runs, FAILS (services not implemented)
  - **Dependencies**: T002, T004

- [x] **T013 [P]** Integration test Scenario 2: Multiple stores aggregation
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/multiple-stores-aggregation.test.ts`
  - **Action**: Test quickstart.md Scenario 2 - create 3 feedback submissions (Store A: 100 SEK/score 70 → 7.20 SEK, Store B: 200 SEK/score 85 → 22.20 SEK, Store C: 150 SEK/score 95 → 21.90 SEK), all verified, process batch, verify SINGLE aggregated payment of 51.30 SEK to customer 467012345678, verify customer history shows 3 stores
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

- [x] **T014 [P]** Integration test Scenario 3: Quality score threshold and mapping
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/quality-score-mapping.test.ts`
  - **Action**: Test quickstart.md Scenario 3 table - verify score 49 → 0% (no reward), score 50 → 2% exactly, score 75 → 8.5%, score 85 → 11.1%, score 100 → 15% exactly, verify linear interpolation formula: (score-50)/(100-50) × 13% + 2%
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

- [x] **T015 [P]** Integration test Scenario 4: Payment failure and retry with exponential backoff
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/payment-failure-retry.test.ts`
  - **Action**: Test quickstart.md Scenario 4 - configure mock Swish to fail first 2 attempts for phone 467099999999, process batch, verify automatic retry schedule (attempt 1: immediate, retry 1: +1 min, retry 2: +2 min), verify retry succeeds on 3rd attempt, verify retry_count = 2, verify payment_failures records created
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

- [x] **T016 [P]** Integration test Scenario 5: Manual intervention for failed payment
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/manual-payment-retry.test.ts`
  - **Action**: Test quickstart.md Scenario 5 - create payment that fails all 4 attempts (initial + 3 retries), admin updates phone from 467011111111 to 467022222222 via retry endpoint with force=true and adminNotes, verify payment retries with new phone and succeeds, verify failure record shows resolutionStatus = 'resolved'
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

- [x] **T017 [P]** Integration test Scenario 6: Below minimum threshold (5 SEK) carry-forward
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/minimum-threshold-carry-forward.test.ts`
  - **Action**: Test quickstart.md Scenario 6 - Week 1: create reward 1.26 SEK (below 5 SEK), process batch, verify NO payment created, Week 2: add reward 2.88 SEK (total 4.14 SEK, still below), process batch, verify NO payment, Week 3: add reward 2.95 SEK (total 7.09 SEK, exceeds threshold), process batch, verify SINGLE payment of 7.09 SEK created
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

- [x] **T018 [P]** Integration test Scenario 7: Business verification filtering
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/integration/business-verification-filtering.test.ts`
  - **Action**: Test quickstart.md Scenario 7 - submit 5 feedback items (2 verified, 1 fraudulent, 1 unverified, 1 verified), calculate rewards, verify only 3 reward_calculations created (exclude fraudulent and unverified), process batch, verify reconciliation storeBreakdown shows feedbackCount=5 but verifiedCount=3
  - **Verification**: Test runs, FAILS
  - **Dependencies**: T002, T004

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models (One per table) [P]

- [x] **T019 [P]** PaymentTransaction model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/payment-transaction.ts`
  - **Action**: Create Supabase client queries for payment_transactions table - insert (create new payment), update (status, retry_count, swish_transaction_id, processed_at), select by id, select by batch_id, select by customer_phone, select by status, aggregate by customer_phone for batch processing
  - **Reference**: data-model.md payment_transactions schema
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002 (types), T004 (migration)

- [x] **T020 [P]** RewardCalculation model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/reward-calculation.ts`
  - **Action**: Create queries for reward_calculations table - insert (create reward), select by feedback_id, select by customer_phone, select pending rewards (verified_by_business=true AND payment_transaction_id IS NULL), update payment_transaction_id after payment created, aggregate by customer/week for batch processing
  - **Reference**: data-model.md reward_calculations schema
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002, T004

- [x] **T021 [P]** PaymentBatch model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/payment-batch.ts`
  - **Action**: Create queries for payment_batches table - insert (create batch), update (status, totals, job_lock_key, completed_at), select by id, select by batch_week, acquire job lock (UPDATE SET job_lock_key, job_locked_at, job_locked_by WHERE job_lock_key IS NULL), release job lock
  - **Reference**: data-model.md payment_batches schema, research.md PostgreSQL locking pattern
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002, T004

- [x] **T022 [P]** PaymentFailure model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/payment-failure.ts`
  - **Action**: Create queries for payment_failures table - insert (create failure record), update (resolution_status, admin_notes, resolved_by, resolved_at), select by payment_transaction_id, select pending/manual_review failures with filters (status, pagination), select by retry_scheduled_at for retry processing
  - **Reference**: data-model.md payment_failures schema
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002, T004

- [x] **T023 [P]** ReconciliationReport model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/reconciliation-report.ts`
  - **Action**: Create queries for reconciliation_reports table - insert (create report), select by batch_id, select by report_period, generate store breakdown (JOIN reward_calculations + payment_transactions grouped by store_id), calculate discrepancies
  - **Reference**: data-model.md reconciliation_reports schema, quickstart.md Scenario 5 store breakdown
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002, T004

- [x] **T024 [P]** BusinessInvoice model
  - **Path**: `/Users/lucasjenner/alpha/packages/database/src/payment/business-invoice.ts`
  - **Action**: Create queries for business_invoices table - insert (create invoice), update (payment_status, paid_at), select by business_id, select by batch_id, select by payment_status with filters (overdue, pending, pagination)
  - **Reference**: data-model.md business_invoices schema
  - **Verification**: TypeScript compiles, exports all functions
  - **Dependencies**: T002, T004

### Services (Sequential dependencies between some)

- [x] **T025** RewardCalculatorService
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/services/payment/reward-calculator.ts`
  - **Action**: Implement calculateRewardPercentage(qualityScore: number): number function using formula from spec.md FR-006 (score < 50 → 0%, score 50-100 → linear map (score-50)/(100-50) × 13% + 2%), implement calculateRewardAmount(transactionAmount: SEKAmount, rewardPercentage: number): SEKAmount using dinero.js multiply with HALF_UP rounding, implement calculateRewardsForFeedback(feedbackIds: string[]): Promise<RewardCalculation[]> - fetch feedback + transaction data, calculate percentage/amount, insert reward_calculations records
  - **Reference**: research.md dinero.js code example, quickstart.md Scenario 3 mapping table
  - **Verification**: Unit tests pass for all edge cases (score 49, 50, 75, 100), contract test T005 passes
  - **Dependencies**: T002 (types), T020 (RewardCalculation model)

- [x] **T026 [P]** SwishClient (mock implementation)
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/services/payment/swish-client.ts`
  - **Action**: Create ISwishClient interface (createPayment, getPaymentStatus, cancelPayment methods), implement MockSwishClient class matching research.md mock implementation - validate Swedish phone format (^467\d{8}$), simulate 2s async processing, 90% success rate, return SwishPaymentResponse with id/status/paymentReference, throw SwishError for invalid inputs
  - **Reference**: research.md Swish API mock implementation, contracts/ SwishPaymentRequest/Response types
  - **Verification**: Unit tests pass for valid/invalid phone numbers, success/failure simulation
  - **Dependencies**: T002 (types only, no other services)

- [x] **T027** PaymentProcessorService
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/services/payment/payment-processor.ts`
  - **Action**: Implement aggregateRewardsByCustomer(batchWeek: string): Promise<Map<string, number>> - query pending reward_calculations, group by customer_phone, sum reward_amount_sek, filter >= 500 öre (5 SEK minimum), implement processPayment(customerPhone: string, amountSek: number, batchId: string): Promise<PaymentTransaction> - create payment_transaction record, call SwishClient.createPayment, handle success/failure, implement retryFailedPayment(transactionId: string, updatedPhone?: string): Promise<PaymentTransaction> with exponential backoff (1min, 2min, 4min intervals from research.md)
  - **Reference**: research.md retry pattern, quickstart.md Scenario 4 retry timing
  - **Verification**: Integration tests T012-T016 pass
  - **Dependencies**: T019 (PaymentTransaction model), T020 (RewardCalculation model), T025 (RewardCalculator), T026 (SwishClient)

- [x] **T028** BatchSchedulerService
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/services/payment/batch-scheduler.ts`
  - **Action**: Implement processBatch(batchWeek: string, forceReprocess: boolean = false): Promise<PaymentBatch> - acquire job lock via T021 model, create payment_batch record, call PaymentProcessor.aggregateRewardsByCustomer, loop through customers calling PaymentProcessor.processPayment, update batch totals (total_customers, successful_payments, failed_payments), release job lock, set status to 'completed'/'partial'/'failed', implement runWithLock(jobName: string, callback: () => Promise<void>) helper from research.md PostgreSQL locking
  - **Reference**: research.md PostgreSQL job locking pattern, data-model.md payment_batches schema
  - **Verification**: Integration tests T012-T013, T017 pass, batch completes in <10 min for 10k customers (performance target)
  - **Dependencies**: T021 (PaymentBatch model), T027 (PaymentProcessor)

- [x] **T029** ReconciliationService
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/services/payment/reconciliation.ts`
  - **Action**: Implement generateReport(batchId: string): Promise<ReconciliationReport> - fetch payment_batch + all payment_transactions for batch, calculate totals (total_rewards_paid_sek, admin_fees_collected_sek = rewards × 20%, payment_success_count, payment_failure_count, payment_success_rate), generate store breakdown (JOIN reward_calculations + stores grouped by store_id with counts/amounts), identify discrepancies (expected vs actual), insert reconciliation_reports record, implement generateBusinessInvoices(batchId: string): Promise<BusinessInvoice[]> - group by business_id, calculate totals (total_reward_amount_sek, admin_fee_sek = rewards × 20%, total_invoice_amount_sek = rewards + admin fee), insert business_invoices records
  - **Reference**: data-model.md reconciliation_reports + business_invoices schemas, quickstart.md Scenario 5 reconciliation
  - **Verification**: Integration test T012 passes (reconciliation shows 0 discrepancies), contract test T008 passes
  - **Dependencies**: T021 (PaymentBatch model), T023 (ReconciliationReport model), T024 (BusinessInvoice model)

### API Endpoints (All in one file - sequential)

- [x] **T030** Admin payment endpoints
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/routes/admin/payments.ts`
  - **Action**: Implement all 8 endpoints - POST /calculate-rewards (call RewardCalculatorService.calculateRewardsForFeedback), POST /process-batch (call BatchSchedulerService.processBatch), GET /batch/:batchId (query PaymentBatch model), GET /reconciliation/:batchId (call ReconciliationService.generateReport or fetch existing), GET /failed (query PaymentFailure model with filters), POST /retry/:transactionId (call PaymentProcessorService.retryFailedPayment), GET /customer/:phone (query PaymentTransaction + RewardCalculation models for customer history with summary aggregation), GET /stats (query weekly_payment_summary materialized view for PaymentStats component - returns totalPaymentsThisWeek, successRatePercent, totalAmountPaidSek, failedPaymentsCount), add admin auth middleware (reuse existing from admin dashboard feature 013-step-4-1), add error handling, add request validation
  - **Reference**: contracts/ OpenAPI schemas for all endpoints, plan.md existing admin auth middleware
  - **Verification**: All contract tests T005-T011 pass, all integration tests T012-T018 pass
  - **Dependencies**: T025 (RewardCalculator), T027 (PaymentProcessor), T028 (BatchScheduler), T029 (Reconciliation), T019-T024 (all models)

### Scheduled Job

- [x] **T031** Weekly payment batch cron job
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/jobs/weekly-payment-batch.ts`
  - **Action**: Create node-cron job scheduled for Sunday 00:00 Europe/Stockholm (cron expression: '0 0 * * 0'), calculate previous week ISO week number (format: '2025-W09'), call BatchSchedulerService.processBatch(batchWeek), handle errors with logging, register job in apps/backend/src/server.ts startup
  - **Reference**: research.md node-cron configuration, spec.md FR-012 (Sunday 00:00 timing)
  - **Verification**: Job registered on server start, manual trigger works, logs show successful batch processing
  - **Dependencies**: T028 (BatchScheduler)

## Phase 3.4: Admin UI

- [x] **T032** Admin payments page layout
  - **Path**: `/Users/lucasjenner/alpha/apps/admin/src/app/payments/page.tsx`
  - **Action**: Create Next.js page component with layout - header with "Payment Management" title, tabs for "Overview" / "Reconciliation" / "Failed Payments", overview tab shows PaymentStats component (T033), reconciliation tab shows link to latest batch reconciliation, failed payments tab shows FailedPaymentsList component (T035), add admin auth check (reuse from feature 013-step-4-1)
  - **Verification**: Page renders, tabs work, admin auth required
  - **Dependencies**: T030 (API endpoints for data fetching)

- [x] **T033 [P]** PaymentStats component
  - **Path**: `/Users/lucasjenner/alpha/apps/admin/src/components/payments/PaymentStats.tsx`
  - **Action**: Create React component displaying payment statistics - fetch data from materialized view weekly_payment_summary (via new GET /api/admin/payments/stats endpoint to add to T030 or query directly), show cards for: total payments this week, success rate %, total amount paid (SEK), failed payments count, use Tailwind CSS for styling matching existing admin dashboard
  - **Reference**: data-model.md weekly_payment_summary materialized view
  - **Verification**: Component renders stats, updates on data change
  - **Dependencies**: T030 (needs GET /api/admin/payments/stats endpoint or extend T030)

- [x] **T034** ReconciliationTable component
  - **Path**: `/Users/lucasjenner/alpha/apps/admin/src/components/payments/ReconciliationTable.tsx`
  - **Action**: Create React component for reconciliation report display - fetch from GET /api/admin/payments/reconciliation/:batchId, show table with columns: Store Name, Business Name, Feedback Count, Verified Count, Avg Quality Score, Total Rewards (SEK), Successful Payments, Failed Payments, add expandable rows for store-by-store breakdown, show summary footer with totals + admin fees (20%), use existing Tailwind table styling
  - **Reference**: contracts/get-reconciliation.yaml storeBreakdown structure
  - **Verification**: Table renders reconciliation data, expandable rows work
  - **Dependencies**: T030 (GET /api/admin/payments/reconciliation endpoint)

- [x] **T035** FailedPaymentsList component
  - **Path**: `/Users/lucasjenner/alpha/apps/admin/src/components/payments/FailedPaymentsList.tsx`
  - **Action**: Create React component for failed payments management - fetch from GET /api/admin/payments/failed with filters (status: pending/manual_review), show table with columns: Customer Phone, Amount (SEK), Attempt Number, Failure Reason, Swish Error Code, Resolution Status, Created At, Actions (Retry button), retry button calls POST /api/admin/payments/retry/:transactionId with modal for updatedPhone/adminNotes input, add pagination (limit/offset), add status filter dropdown
  - **Reference**: contracts/get-failed-payments.yaml + retry-payment.yaml
  - **Verification**: List renders failed payments, retry button works, filters work, pagination works
  - **Dependencies**: T030 (GET /api/admin/payments/failed + POST retry endpoints)

## Phase 3.5: Polish & Validation

- [x] **T036 [P]** Unit tests for reward calculator edge cases
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/unit/reward-calculator.test.ts`
  - **Action**: Test all edge cases from quickstart.md Scenario 3 - score 49 → 0%, score 50 → exactly 2.000%, score 75 → exactly 8.500%, score 85 → exactly 11.100%, score 100 → exactly 15.000%, test rounding to 3 decimal places, test dinero.js currency calculations (no floating point errors), test invalid inputs (negative scores, scores > 100)
  - **Verification**: All unit tests pass, 100% code coverage for reward-calculator.ts
  - **Dependencies**: T025 (RewardCalculator implementation)

- [ ] **T037** Performance validation for batch processing
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/tests/performance/batch-processing.test.ts`
  - **Action**: Create performance test using quickstart.md load test scenario - generate 10,000 test customers with pending rewards (use script or db seed), trigger batch processing, measure total duration (must be <10 minutes per plan.md performance target), measure average per-customer processing time (must be <60ms), measure memory usage (must be <512 MB), verify PostgreSQL batched upserts used (not 10k individual INSERTs)
  - **Reference**: plan.md performance goals, research.md batch processing optimization
  - **Verification**: Batch processes 10k customers in <10 min, memory <512 MB
  - **Dependencies**: T028 (BatchScheduler), T030 (endpoints)

- [x] **T038** Create materialized view refresh job
  - **Path**: `/Users/lucasjenner/alpha/apps/backend/src/jobs/refresh-materialized-views.ts`
  - **Action**: Create node-cron job for nightly refresh (cron expression: '0 2 * * *' - 2 AM daily) of store_reward_summary materialized view, call Supabase function to REFRESH MATERIALIZED VIEW CONCURRENTLY store_reward_summary, add error handling and logging, register job in server.ts
  - **Reference**: data-model.md materialized view refresh strategy
  - **Verification**: Job runs at 2 AM, materialized view refreshed successfully
  - **Dependencies**: T004 (migration with materialized views)

- [x] **T039** Execute quickstart.md validation scenarios
  - **Path**: Manual testing following `/Users/lucasjenner/alpha/specs/019-step-6-1/quickstart.md`
  - **Action**: Run all 7 scenarios manually - Scenario 1 (end-to-end flow), Scenario 2 (aggregation), Scenario 3 (quality mapping), Scenario 4 (retry), Scenario 5 (manual intervention), Scenario 6 (threshold carry-forward), Scenario 7 (verification filtering), verify all success criteria met, verify performance targets (<500ms reward calc, <10 min batch, <2s payment API, <2s admin dashboard load), document any deviations
  - **Verification**: All 7 scenarios pass success criteria, no errors in logs
  - **Dependencies**: ALL previous tasks (full system must be implemented)

## Task Dependencies Graph

```
Setup Layer:
T001 (dependencies) → T002 (types) → T003 (index exports)
                   ↘ T004 (migration)

Test Layer (must fail before implementation):
T002, T004 → T005-T011 (contract tests) [P]
T002, T004 → T012-T018 (integration tests) [P]

Model Layer:
T002, T004 → T019-T024 (models) [P]

Service Layer:
T002, T020 → T025 (RewardCalculator)
T002 → T026 (SwishClient) [P]
T019, T020, T025, T026 → T027 (PaymentProcessor)
T021, T027 → T028 (BatchScheduler)
T021, T023, T024 → T029 (Reconciliation)

Endpoint Layer:
T019-T029 → T030 (all endpoints in one file)

Job Layer:
T028 → T031 (cron job)

UI Layer:
T030 → T032 (page layout)
T030 → T033 (stats) [P]
T030 → T034 (table)
T030 → T035 (failed list)

Polish Layer:
T025 → T036 (unit tests) [P]
T028, T030 → T037 (performance)
T004 → T038 (materialized view refresh) [P]
ALL → T039 (quickstart validation)
```

## Parallel Execution Examples

### Phase 3.2: All contract tests in parallel
```bash
# Launch T005-T011 together (7 contract tests, all different files):
pnpm --filter @vocilia/backend test tests/contract/calculate-rewards.test.ts &
pnpm --filter @vocilia/backend test tests/contract/process-batch.test.ts &
pnpm --filter @vocilia/backend test tests/contract/get-batch-status.test.ts &
pnpm --filter @vocilia/backend test tests/contract/get-reconciliation.test.ts &
pnpm --filter @vocilia/backend test tests/contract/get-failed-payments.test.ts &
pnpm --filter @vocilia/backend test tests/contract/retry-payment.test.ts &
pnpm --filter @vocilia/backend test tests/contract/get-customer-history.test.ts &
wait
```

### Phase 3.2: All integration tests in parallel
```bash
# Launch T012-T018 together (7 integration tests, all different files):
pnpm --filter @vocilia/backend test tests/integration/end-to-end-payment-flow.test.ts &
pnpm --filter @vocilia/backend test tests/integration/multiple-stores-aggregation.test.ts &
pnpm --filter @vocilia/backend test tests/integration/quality-score-mapping.test.ts &
pnpm --filter @vocilia/backend test tests/integration/payment-failure-retry.test.ts &
pnpm --filter @vocilia/backend test tests/integration/manual-payment-retry.test.ts &
pnpm --filter @vocilia/backend test tests/integration/minimum-threshold-carry-forward.test.ts &
pnpm --filter @vocilia/backend test tests/integration/business-verification-filtering.test.ts &
wait
```

### Phase 3.3: All database models in parallel
```bash
# Launch T019-T024 together (6 models, all different files):
# Work on payment-transaction.ts, reward-calculation.ts, payment-batch.ts,
# payment-failure.ts, reconciliation-report.ts, business-invoice.ts simultaneously
```

### Phase 3.5: Some polish tasks in parallel
```bash
# Launch T036 and T038 together (unit tests + materialized view refresh job):
# T036: apps/backend/tests/unit/reward-calculator.test.ts
# T038: apps/backend/src/jobs/refresh-materialized-views.ts
```

## Validation Checklist

- [x] All 7 contracts have corresponding contract tests (T005-T011)
- [x] All 6 entities have model tasks (T019-T024)
- [x] All contract tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are truly independent (marked [P], different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Database migration (T004) is foundation before all tests/models
- [x] Services follow dependency order (RewardCalculator/SwishClient before PaymentProcessor before BatchScheduler)
- [x] All 7 quickstart scenarios have integration tests (T012-T018)
- [x] Performance targets validated (T037)
- [x] All endpoints in single file (T030) to avoid conflicts

## Notes

- **TDD Critical**: Tests T005-T018 MUST fail before starting T019-T030 implementation
- **Monorepo paths**: All paths use absolute paths from repository root `/Users/lucasjenner/alpha/`
- **TypeScript strict**: No `any` types allowed per constitution
- **Currency precision**: All amounts stored as INTEGER öre (1 SEK = 100 öre) in database, dinero.js for calculations
- **Mock Swish**: Use MockSwishClient (T026) until merchant account available, production swap is interface change only
- **Admin auth**: Reuse existing admin authentication from feature 013-step-4-1
- **Performance**: Batch processing must handle 10k customers in <10 min (T037 validates)
- **Commit frequency**: Commit after each task completion
- **Testing**: Run `pnpm --filter @vocilia/backend test` after each implementation task

---
*Generated from design documents: plan.md, research.md, data-model.md, contracts/, quickstart.md*