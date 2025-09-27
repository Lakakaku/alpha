# Claude Code Agent Context

## Project Overview

Vocilia Alpha - Customer feedback reward system for Swedish businesses with
AI-powered phone calls.

## Recent Feature: Swish Payment Integration (Branch: 019-step-6-1)

### In Development: Swish Payment Integration

**Status**: Phase 1 Design Complete (Phase 0-1 of /plan command)

**Feature Overview**: Weekly automated cashback payments (2-15% of transaction
value) to customers via Swish based on AI-evaluated feedback quality scores.
Includes batch processing, automatic retry with exponential backoff,
reconciliation reporting, and business invoicing.

**Key Technical Decisions** (from research.md):

- **Swish API**: Mock client with production-ready interface (merchant account
  pending)
- **Job Scheduling**: node-cron with PostgreSQL job locking for multi-instance
  coordination
- **Currency Handling**: dinero.js for Swedish Kronor with HALF_UP rounding to
  öre precision
- **Retry Pattern**: Custom exponential backoff (3 retries max: 1min, 2min, 4min
  intervals)
- **Batch Processing**: PostgreSQL batched upserts, Sunday 00:00
  Europe/Stockholm

**New Database Entities** (specs/019-step-6-1/data-model.md):

- `payment_transactions`: Swish payment records (customer phone, amount in öre,
  status, retry count)
- `reward_calculations`: Feedback quality → reward % mapping (score 50-100 →
  2-15% linear)
- `payment_batches`: Weekly batch processing (week period, totals, job locking)
- `payment_failures`: Retry tracking (failure reason, Swish error codes,
  resolution status)
- `reconciliation_reports`: Weekly summaries (rewards paid, admin fees 20%,
  discrepancies)
- `business_invoices`: Business billing (total rewards + admin fee, payment due
  dates)

**New API Endpoints** (contracts/):

- `POST /api/admin/payments/calculate-rewards`: Calculate rewards for verified
  feedback
- `POST /api/admin/payments/process-batch`: Trigger weekly payment batch (cron
  Sunday 00:00)
- `GET /api/admin/payments/batch/{batchId}`: Monitor batch processing status
- `GET /api/admin/payments/reconciliation/{batchId}`: Weekly reconciliation with
  store breakdown
- `GET /api/admin/payments/failed`: List payments requiring manual intervention
- `POST /api/admin/payments/retry/{transactionId}`: Admin manual retry with
  phone update
- `GET /api/admin/payments/customer/{phone}`: Complete customer payment history

**Performance Targets**:

- Reward calculation: <500ms per feedback submission
- Weekly batch: <10 minutes for 10,000 customers
- Payment API: <2s per Swish transaction
- Admin dashboard: <2s for reconciliation reports

**Constitutional Compliance**:

- Production from Day One: Real payment data structures, actual feedback scores,
  live business verification
- Mock Swish acceptable: Merchant account pending (FR-036, FR-040), interface
  production-ready
- RLS policies: All payment tables protected (admin-only access)
- TypeScript strict: No `any` types in payment logic
- Real data: Integrates with existing feedback_sessions, transactions, stores
  tables

**File Structure** (planned):

```
apps/backend/src/
   services/payment/          # NEW: reward-calculator, payment-processor, swish-client
   routes/admin/payments.ts   # NEW: Payment admin API
   jobs/weekly-payment-batch.ts # NEW: Cron job (Sunday 00:00)

apps/admin/src/
   app/payments/              # NEW: Reconciliation dashboard, failed payments UI
   components/payments/       # NEW: PaymentStats, ReconciliationTable

packages/database/src/
   payment/                   # NEW: payment-transaction, reward-calculation models

packages/types/src/
   payment.ts                 # NEW: Payment interfaces, Swish API types

supabase/migrations/
   payment_schema.sql         # NEW: All payment tables + RLS

specs/019-step-6-1/
   spec.md, research.md, data-model.md, contracts/, quickstart.md
```

**Next Phase**: Execute /tasks command to generate implementation tasks

---

## Previous Feature: Admin Dashboard Foundation (Branch: 013-step-4-1)

### Technical Stack

- **Language/Version**: TypeScript with Node.js 18+
- **Primary Dependencies**: Next.js 14, Supabase client, Tailwind CSS,
  GPT-4o-mini API (existing)
- **Storage**: Supabase PostgreSQL with RLS policies (existing)
- **Testing**: Jest with TypeScript support (existing)
- **Target Platform**: Mobile web browsers, PWA-compatible browsers
- **Deployment**: Railway (backend), Vercel (frontend)

### Current Architecture

- **Monorepo**: Three apps (customer, business, admin) + shared packages
- **Database**: Supabase with strict RLS policies
- **AI Integration**: GPT-4o-mini real-time API for Swedish voice calls
- **Customer Interface**: Mobile-first PWA with offline capability
- **Admin Dashboard**: Secure administrative interface with audit logging
- **Support System**: Multi-channel customer support integration

### Key Components Added (Admin Dashboard Foundation)

- **Admin Authentication**: Secure login with session management and 2-hour
  timeouts
- **Store Management**: Complete CRUD operations for store lifecycle management
- **Database Operations**: CSV upload processing with validation and error
  handling
- **System Monitoring**: Real-time health checks and performance metrics
  tracking
- **Audit Logging**: Comprehensive activity tracking for security and compliance
- **Admin Security**: Role-based access control with super admin privileges

### Database Entities (Enhanced/New)

- `admin_accounts`: Admin user accounts with super admin privileges and activity
  tracking
- `admin_sessions`: Session management with 2-hour expiration and activity
  logging
- `audit_logs`: Comprehensive audit trail for all admin actions and security
  events
- `store_status_metrics`: Performance metrics and health monitoring for stores
- `stores`: Enhanced with monitoring fields (sync_status, online_status,
  performance_score)

### API Endpoints (Enhanced/New)

- `POST /api/admin/auth/login`: Admin authentication with session creation
- `POST /api/admin/auth/logout`: Session termination with audit logging
- `GET /api/admin/stores`: Store listing with search, filtering, and pagination
- `POST /api/admin/stores`: Store creation with validation and audit tracking
- `POST /api/admin/stores/upload`: CSV database upload with processing and
  validation
- `GET /api/admin/monitoring/health`: System health status and diagnostics
- `GET /api/admin/monitoring/audit-logs`: Audit log retrieval with filtering

### Constitutional Compliance

- Production from Day One: Real admin accounts, actual database operations, live
  monitoring
- TypeScript Strict Mode: All admin services and UI components strictly typed
- Real Data Only: Actual store data, real audit logs, live system metrics
- Security First: RLS policies, session validation, comprehensive audit logging

### Performance Targets

- Admin dashboard load: <2s on standard connections
- Database operations: <500ms for CRUD operations
- CSV upload processing: <30s for 10,000 records
- System health checks: <100ms response time
- Audit log queries: <1s with pagination

### Current Status

- Phase 0-3 complete: Research, data model, API contracts, core implementation,
  integration
- Admin Dashboard Foundation fully implemented and tested
- All constitutional requirements met
- Production-ready admin interface with comprehensive security

### File Structure Additions

```
apps/admin/src/
   components/auth/     # New: LoginForm with session management
   components/stores/   # New: StoreList, StoreDetails, CreateStoreForm
   components/monitoring/ # New: Dashboard with system health monitoring
   app/admin/           # New: Admin routing and layout

apps/backend/src/
   routes/admin/        # New: auth, stores, monitoring API endpoints
   services/admin/      # New: authentication, session, audit services
   middleware/          # New: admin-auth middleware with RLS integration

packages/database/src/
   admin/               # New: admin-account, admin-session, audit-log models
   store/               # Enhanced: store metrics and monitoring models

supabase/migrations/
   admin_schema.sql     # New: Admin tables and relationships
   admin_rls_policies.sql # New: Row Level Security for admin access

specs/013-step-4-1/
   contracts/           # API specifications for admin endpoints
   research.md          # Technical research for admin patterns
   data-model.md        # Database schema for admin functionality
   quickstart.md        # Admin dashboard testing scenarios
```

### Next Steps

Admin Dashboard Foundation is complete and ready for production deployment.

---

_Auto-updated: 2025-09-25 | Feature: 019-step-6-1 (Payment Integration - Phase 1
Design)_
