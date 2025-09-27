# Implementation Plan: Swish Payment Integration

**Branch**: `019-step-6-1` | **Date**: 2025-09-25 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/Users/lucasjenner/alpha/specs/019-step-6-1/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path → DONE
2. Fill Technical Context → IN PROGRESS
3. Fill Constitution Check section → PENDING
4. Evaluate Constitution Check section → PENDING
5. Execute Phase 0 → research.md → PENDING
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md → PENDING
7. Re-evaluate Constitution Check → PENDING
8. Plan Phase 2 → Describe task generation approach → PENDING
9. STOP - Ready for /tasks command → PENDING
```

## Summary

Implement Swish payment integration for the Vocilia customer feedback reward
system, enabling weekly automated cashback payments (2-15% of transaction value)
to customers based on AI-evaluated feedback quality scores. System calculates
rewards using threshold-based scoring (score 50-100 maps to 2-15%), aggregates
payments per customer per week, processes batches on Sunday 00:00, handles
failures with 3 automatic retries, enforces 5 SEK minimum threshold, and
provides comprehensive admin reconciliation reporting.

## Technical Context

**Language/Version**: TypeScript 5.5.4 with Node.js 18+  
**Primary Dependencies**: Next.js 14, Supabase client 2.39.3, GPT-4o-mini API
(existing), Swish Payment API (mock integration until merchant account
available)  
**Storage**: Supabase PostgreSQL with Row Level Security (RLS) policies  
**Testing**: Jest 30.1.3 with ts-jest 29.4.4 for contract/integration/unit
tests  
**Target Platform**: Railway (backend services), Vercel (admin dashboard),
Supabase (database)  
**Project Type**: Web (monorepo with backend + admin frontend)  
**Performance Goals**:

- Reward calculation: <500ms per feedback submission
- Weekly batch processing: <10 minutes for 10,000 customers
- Payment API calls: <2s per Swish transaction
- Admin dashboard load: <2s for reconciliation reports

**Constraints**:

- Swish merchant account not yet available (prepare mock integration structure)
- Must integrate with existing feedback submission and business verification
  workflows
- Weekly payment cycle fixed to Sunday 00:00
- 5 SEK minimum payout threshold
- 3 automatic retry limit with exponential backoff
- All monetary calculations rounded to 0.01 SEK (öre) using standard rounding

**Scale/Scope**:

- Initial: 50-100 stores, ~500 customers/week
- Target: 500+ stores, ~5,000 customers/week
- Payment volume: 200-500 SEK average weekly payout
- Data retention: Indefinite payment history for accounting

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**POST-PHASE 1 RE-EVALUATION**: ✅ PASS - All constitutional principles upheld
in design

### I. Production from Day One

- [x] **Payment system with real data structures**: YES - data-model.md defines
      6 production tables with proper foreign keys to existing
      feedback_sessions, transactions, stores
- [x] **Mock Swish integration acceptable**: YES - ISwishClient interface
      designed for production swap, mock implementation matches Swish API v2
      specifications
- [x] **Real payment tracking and reconciliation**: YES - payment_transactions,
      payment_failures, reconciliation_reports tables designed with complete
      audit trail
- [x] **No test/dummy data**: YES - integrates with actual feedback quality
      scores, verified business transactions, real customer phone numbers

### II. Security & Privacy First

- [x] **RLS policies for payment data**: IMPLEMENTED - data-model.md defines
      comprehensive RLS for all 6 tables (admin read/write, business read for
      invoices only, service_role full access)
- [x] **Phone number privacy**: PROTECTED - RLS policies prevent businesses from
      accessing payment_transactions customer_phone field, only admin and
      service_role access
- [x] **Swish credential security**: PLANNED - Railway environment variables
      (SWISH_MERCHANT_NUMBER, SWISH_CERTIFICATE_PATH), mock values for
      development
- [x] **Admin authentication required**: YES - all payment API contracts require
      AdminAuth bearer token, integrates with existing admin_sessions

### III. TypeScript Strict Mode

- [x] **All payment services strict typed**: YES - research.md defines strict
      TypeScript for all services, dinero.js provides Dinero<number> type for
      currency
- [x] **No `any` types in payment logic**: YES - contracts/ define explicit
      interfaces (SwishPaymentRequest, SwishPaymentResponse, PaymentTransaction,
      RewardCalculation)
- [x] **Strict currency types**: YES - SEKAmount type alias for Dinero<number>,
      database uses INTEGER for öre precision (1 SEK = 100 öre)

### IV. Real Data Only

- [x] **Integrate with existing feedback submissions**: YES - data-model.md
      shows reward_calculations.feedback_id foreign key to feedback_sessions
      table
- [x] **Integrate with business verification workflow**: YES -
      reward_calculations.verified_by_business boolean, batch processor only
      includes verified=true
- [x] **Real customer phone numbers**: YES - payment_transactions.customer_phone
      with Swedish mobile format validation, aggregates per actual customer
- [x] **Real transaction amounts**: YES -
      reward_calculations.transaction_amount_sek references actual transactions
      table amounts

### V. Monorepo Architecture

- [x] **Backend payment services**: `apps/backend/src/services/payment/`
      (reward-calculator.ts, payment-processor.ts, swish-client.ts,
      batch-scheduler.ts, reconciliation.ts)
- [x] **Admin dashboard for reconciliation**: `apps/admin/src/app/payments/`
      (reconciliation/, failed-payments/ directories)
- [x] **Shared payment types**: `packages/types/src/payment.ts`
      (PaymentTransaction, RewardCalculation, SwishPaymentRequest/Response
      interfaces)
- [x] **Shared database models**: `packages/database/src/payment/` (6 model
      files for all payment tables)

**Final Assessment**: ✅ PASS - All constitutional principles validated in Phase
1 design

**Key Validations**:

- All 6 database tables have comprehensive RLS policies defined in data-model.md
- All 7 API endpoints follow existing AdminAuth pattern from admin dashboard
  feature 013-step-4-1
- Mock Swish integration acceptable per FR-036, FR-040 with ISwishClient
  interface for production swap
- Currency precision correctly handled with öre integers in DB, dinero.js
  HALF_UP rounding for calculations
- No constitutional violations introduced during design phase

## Project Structure

### Documentation (this feature)

```
specs/019-step-6-1/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Web application structure (backend + admin frontend)
apps/backend/
├── src/
│   ├── services/
│   │   └── payment/                    # NEW
│   │       ├── reward-calculator.ts
│   │       ├── payment-processor.ts
│   │       ├── swish-client.ts
│   │       ├── batch-scheduler.ts
│   │       └── reconciliation.ts
│   ├── routes/
│   │   └── admin/
│   │       └── payments.ts             # NEW
│   ├── jobs/
│   │   └── weekly-payment-batch.ts     # NEW
│   └── middleware/
│       └── payment-auth.ts             # NEW (if needed)
└── tests/
    ├── contract/
    │   └── payment-api.test.ts         # NEW
    ├── integration/
    │   └── payment-workflow.test.ts    # NEW
    └── unit/
        └── reward-calculator.test.ts   # NEW

apps/admin/
├── src/
│   ├── app/
│   │   └── payments/                   # NEW
│   │       ├── page.tsx
│   │       ├── reconciliation/
│   │       └── failed-payments/
│   └── components/
│       └── payments/                   # NEW
│           ├── PaymentStats.tsx
│           ├── ReconciliationTable.tsx
│           └── FailedPaymentsList.tsx
└── tests/
    └── payments/                       # NEW

packages/database/src/
└── payment/                            # NEW
    ├── payment-transaction.ts
    ├── reward-calculation.ts
    ├── payment-batch.ts
    ├── payment-failure.ts
    └── reconciliation-report.ts

packages/types/src/
└── payment.ts                          # NEW

supabase/migrations/
└── [timestamp]_payment_schema.sql      # NEW
```

**Structure Decision**: Web application (Option 2) - backend payment services +
admin frontend for reconciliation

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context**:
   - ✅ Swish Payment API specifications (FR-037, FR-038) - NEEDS RESEARCH
   - ✅ Swish API authentication patterns (FR-040) - NEEDS RESEARCH
   - ✅ Swish payment request/response formats - NEEDS RESEARCH
   - ✅ Swish error codes and failure scenarios - NEEDS RESEARCH
   - ✅ Best practices for scheduled batch jobs in Node.js/Railway - NEEDS
     RESEARCH
   - ✅ Exponential backoff retry patterns (FR-025) - NEEDS RESEARCH
   - ✅ Currency precision handling in TypeScript - NEEDS RESEARCH
   - ✅ Weekly batch processing at scale (10k+ customers) - NEEDS RESEARCH

2. **Generate and dispatch research agents**:
   - Research Swish Payment API documentation and integration patterns
   - Research Node.js job scheduling libraries (node-cron, bull, agenda) for
     Railway deployment
   - Research currency handling libraries for Swedish Kronor (dinero.js,
     currency.js, decimal.js)
   - Research batch processing optimization techniques for PostgreSQL
   - Research retry patterns with exponential backoff in TypeScript
   - Research secure credential management for Railway environment

3. **Consolidate findings** in `research.md`

**Output**: research.md with all technical unknowns resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - `payment_transactions` table (customer phone, amount, status, Swish ref,
     retry count)
   - `reward_calculations` table (feedback ID, quality score, reward %, amount,
     verified status)
   - `payment_batches` table (batch ID, week period, totals, status)
   - `payment_failures` table (transaction ID, failure reason, retry attempts,
     resolution)
   - `reconciliation_reports` table (batch ID, totals, discrepancies)
   - `business_invoices` table (business ID, stores, reward total, admin fee,
     status)
   - Relationships and foreign keys
   - RLS policies for each table
   - Indexes for performance (phone number, batch ID, status queries)

2. **Generate API contracts** from functional requirements:
   - `POST /api/admin/payments/calculate-rewards` - Calculate rewards for
     verified feedback
   - `POST /api/admin/payments/process-batch` - Trigger weekly payment batch
   - `GET /api/admin/payments/batch/:batchId` - Get batch processing status
   - `GET /api/admin/payments/reconciliation/:batchId` - Get reconciliation
     report
   - `GET /api/admin/payments/failed` - List failed payments requiring manual
     intervention
   - `POST /api/admin/payments/retry/:transactionId` - Manually retry failed
     payment
   - `GET /api/admin/payments/customer/:phone` - Get customer payment history
   - Output OpenAPI schemas to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint in `apps/backend/tests/contract/`
   - Assert request/response schemas match OpenAPI
   - Tests must fail initially (no implementation)

4. **Extract test scenarios** from user stories:
   - Scenario 1: Customer receives aggregated weekly payment (44 SEK from 3
     stores)
   - Scenario 2: Quality score 85 → 11.1% reward calculation
   - Scenario 3: Business verification filters out 3 fraudulent of 20
     submissions
   - Scenario 4: Failed payment triggers retry with exponential backoff
   - Scenario 5: Admin views reconciliation with store-by-store breakdown
   - Scenario 6: Below 5 SEK threshold carries forward to next week
   - Each scenario → integration test in `apps/backend/tests/integration/`

5. **Update CLAUDE.md incrementally**:
   - Run update script to add payment integration context
   - Add new API endpoints, database entities, performance targets
   - Keep recent changes section updated
   - Preserve manual additions

**Output**: data-model.md, /contracts/\*, failing contract tests, failing
integration tests, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- Database migration task first (payment tables, RLS, indexes)
- Contract test tasks for each endpoint [P]
- Model creation tasks for each entity [P]
- Service implementation tasks (reward calculator, batch processor, Swish
  client) [P]
- Job scheduler setup task (Sunday 00:00 cron)
- Integration test tasks from user scenarios
- Admin UI tasks for reconciliation dashboard
- Implementation tasks to make all tests pass

**Ordering Strategy**:

- TDD order: Database schema → Models → Contract tests → Services → Integration
  tests → UI
- Dependency order:
  1. Migration (foundation)
  2. Models [P] (parallel, independent)
  3. Contract tests [P] (parallel, one per endpoint)
  4. Core services [P] (reward calculator, Swish client can be parallel)
  5. Batch processor (depends on core services)
  6. Job scheduler (depends on batch processor)
  7. Integration tests (depends on services)
  8. Admin UI (depends on API endpoints)
- Mark [P] for parallel execution where files are independent

**Estimated Output**: 35-40 numbered, dependency-ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional
principles, TDD approach)  
**Phase 5**: Validation (run all tests, execute quickstart.md scenarios,
performance validation against targets)

## Complexity Tracking

_No constitutional violations detected - all requirements align with existing
principles_

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

**Justification for mock Swish integration**: FR-036 and FR-040 explicitly
acknowledge Swish merchant account is not yet available. Mock integration
prepares data structures and interfaces for production while allowing
development to proceed. Real Swish integration is a simple configuration swap
once credentials obtained.

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) - research.md created with 6
      technical decisions
- [x] Phase 1: Design complete (/plan command) - data-model.md, 7 API contracts,
      quickstart.md created
- [x] Phase 2: Task planning approach described (/plan command) - See Phase 2
      section above
- [ ] Phase 3: Tasks generated (/tasks command) - NOT YET EXECUTED
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS - All 5 principles validated
- [x] All NEEDS CLARIFICATION resolved: YES - 5 clarifications answered in
      spec.md
- [x] Complexity deviations documented: N/A - No violations

**Deliverables Status**:

- [x] research.md: 6 research areas, technical decisions with rationale
- [x] data-model.md: 6 tables, RLS policies, indexes, materialized views
- [x] contracts/: 7 OpenAPI 3.0 contracts for payment endpoints
- [x] quickstart.md: 7 test scenarios with success criteria
- [x] CLAUDE.md: Updated with payment integration context
- [ ] tasks.md: Awaiting /tasks command execution

**Ready for /tasks command**: ✅ YES - Phase 0-1 complete, all gates passed

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
