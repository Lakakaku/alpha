# Data Model: Swish Payment Integration

**Feature**: 019-step-6-1 | **Created**: 2025-09-25 | **Input**: [spec.md](./spec.md), [research.md](./research.md)

## Database Schema

### Core Payment Tables

#### payment_transactions
Tracks individual Swish payment records sent to customers.

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  amount_sek INTEGER NOT NULL, -- Amount in öre (1 SEK = 100 öre)
  swish_payment_reference TEXT UNIQUE,
  swish_transaction_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'successful', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  batch_id UUID NOT NULL REFERENCES payment_batches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT valid_amount CHECK (amount_sek >= 500), -- 5 SEK minimum (500 öre)
  CONSTRAINT valid_phone CHECK (customer_phone ~ '^467\d{8}$'), -- Swedish mobile format
  CONSTRAINT valid_retry CHECK (retry_count >= 0 AND retry_count <= 3)
);

CREATE INDEX idx_payment_transactions_customer ON payment_transactions(customer_phone);
CREATE INDEX idx_payment_transactions_batch ON payment_transactions(batch_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status) WHERE status != 'successful';
CREATE INDEX idx_payment_transactions_created ON payment_transactions(created_at DESC);
```

#### reward_calculations
Records how much cashback each feedback submission earns.

```sql
CREATE TABLE reward_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_phone TEXT NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  reward_percentage NUMERIC(5,3) NOT NULL CHECK (reward_percentage >= 0.02 AND reward_percentage <= 0.15),
  transaction_amount_sek INTEGER NOT NULL, -- Original transaction in öre
  reward_amount_sek INTEGER NOT NULL, -- Calculated reward in öre
  verified_by_business BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_score_mapping CHECK (
    (quality_score < 50 AND reward_percentage = 0) OR
    (quality_score >= 50 AND quality_score <= 100)
  )
);

CREATE INDEX idx_reward_calculations_feedback ON reward_calculations(feedback_id);
CREATE INDEX idx_reward_calculations_customer ON reward_calculations(customer_phone);
CREATE INDEX idx_reward_calculations_store ON reward_calculations(store_id);
CREATE INDEX idx_reward_calculations_verified ON reward_calculations(verified_by_business) WHERE verified_by_business = TRUE;
CREATE INDEX idx_reward_calculations_payment ON reward_calculations(payment_transaction_id);
CREATE INDEX idx_reward_calculations_pending ON reward_calculations(verified_by_business, payment_transaction_id) WHERE verified_by_business = TRUE AND payment_transaction_id IS NULL;
```

#### payment_batches
Weekly batch processing records.

```sql
CREATE TABLE payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_week TEXT NOT NULL UNIQUE, -- ISO week format: '2025-W09'
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  total_customers INTEGER NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_amount_sek INTEGER NOT NULL DEFAULT 0, -- Sum in öre
  successful_payments INTEGER NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  job_lock_key TEXT UNIQUE, -- For multi-instance coordination
  job_locked_at TIMESTAMPTZ,
  job_locked_by TEXT, -- Railway instance/pod ID
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_week_dates CHECK (week_end_date > week_start_date),
  CONSTRAINT valid_counts CHECK (total_customers >= 0 AND total_transactions >= 0)
);

CREATE INDEX idx_payment_batches_week ON payment_batches(batch_week);
CREATE INDEX idx_payment_batches_status ON payment_batches(status);
CREATE INDEX idx_payment_batches_lock ON payment_batches(job_lock_key) WHERE job_lock_key IS NOT NULL;
CREATE INDEX idx_payment_batches_created ON payment_batches(created_at DESC);
```

#### payment_failures
Detailed failure tracking for retry logic and manual intervention.

```sql
CREATE TABLE payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 4),
  failure_reason TEXT NOT NULL,
  swish_error_code TEXT,
  swish_error_message TEXT,
  retry_scheduled_at TIMESTAMPTZ,
  resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'retrying', 'manual_review', 'resolved', 'cancelled')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES admin_accounts(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT first_attempt_valid CHECK (attempt_number > 1 OR attempt_number = 1)
);

CREATE INDEX idx_payment_failures_transaction ON payment_failures(payment_transaction_id);
CREATE INDEX idx_payment_failures_status ON payment_failures(resolution_status) WHERE resolution_status IN ('pending', 'manual_review');
CREATE INDEX idx_payment_failures_retry ON payment_failures(retry_scheduled_at) WHERE retry_scheduled_at IS NOT NULL;
CREATE INDEX idx_payment_failures_created ON payment_failures(created_at DESC);
```

#### reconciliation_reports
Weekly summary reports for accounting and auditing.

```sql
CREATE TABLE reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL UNIQUE REFERENCES payment_batches(id) ON DELETE RESTRICT,
  report_period TEXT NOT NULL, -- ISO week: '2025-W09'
  total_rewards_paid_sek INTEGER NOT NULL, -- In öre
  admin_fees_collected_sek INTEGER NOT NULL, -- 20% of rewards in öre
  payment_success_count INTEGER NOT NULL,
  payment_failure_count INTEGER NOT NULL,
  payment_success_rate NUMERIC(5,2) NOT NULL, -- Percentage: 95.50
  discrepancy_count INTEGER NOT NULL DEFAULT 0,
  discrepancy_amount_sek INTEGER NOT NULL DEFAULT 0, -- Difference in öre
  business_invoice_total_sek INTEGER NOT NULL, -- Expected business charges in öre
  generated_by UUID REFERENCES admin_accounts(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_success_rate CHECK (payment_success_rate >= 0 AND payment_success_rate <= 100),
  CONSTRAINT valid_admin_fee CHECK (admin_fees_collected_sek = (total_rewards_paid_sek * 20 / 100))
);

CREATE INDEX idx_reconciliation_reports_batch ON reconciliation_reports(batch_id);
CREATE INDEX idx_reconciliation_reports_period ON reconciliation_reports(report_period);
CREATE INDEX idx_reconciliation_reports_generated ON reconciliation_reports(generated_at DESC);
CREATE INDEX idx_reconciliation_reports_discrepancies ON reconciliation_reports(discrepancy_count) WHERE discrepancy_count > 0;
```

#### business_invoices
Invoices sent to businesses for verified feedback rewards.

```sql
CREATE TABLE business_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES payment_batches(id) ON DELETE RESTRICT,
  invoice_period TEXT NOT NULL, -- ISO week: '2025-W09'
  store_count INTEGER NOT NULL,
  total_feedback_count INTEGER NOT NULL,
  verified_feedback_count INTEGER NOT NULL,
  total_reward_amount_sek INTEGER NOT NULL, -- Sum of rewards in öre
  admin_fee_sek INTEGER NOT NULL, -- 20% of rewards in öre
  total_invoice_amount_sek INTEGER NOT NULL, -- rewards + admin fee in öre
  payment_due_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'sent', 'paid', 'overdue', 'disputed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_store_count CHECK (store_count > 0),
  CONSTRAINT valid_feedback_counts CHECK (verified_feedback_count <= total_feedback_count),
  CONSTRAINT valid_invoice_total CHECK (total_invoice_amount_sek = total_reward_amount_sek + admin_fee_sek),
  CONSTRAINT valid_admin_fee_calc CHECK (admin_fee_sek = (total_reward_amount_sek * 20 / 100))
);

CREATE INDEX idx_business_invoices_business ON business_invoices(business_id);
CREATE INDEX idx_business_invoices_batch ON business_invoices(batch_id);
CREATE INDEX idx_business_invoices_period ON business_invoices(invoice_period);
CREATE INDEX idx_business_invoices_status ON business_invoices(payment_status) WHERE payment_status != 'paid';
CREATE INDEX idx_business_invoices_due ON business_invoices(payment_due_date) WHERE payment_status IN ('pending', 'sent');
CREATE INDEX idx_business_invoices_created ON business_invoices(created_at DESC);
```

## Entity Relationships

```
payment_batches (1) ──< (N) payment_transactions
payment_batches (1) ──< (N) reconciliation_reports (1)
payment_batches (1) ──< (N) business_invoices

payment_transactions (1) ──< (N) payment_failures
payment_transactions (1) ──< (N) reward_calculations

feedback_sessions (1) ──< (1) reward_calculations
transactions (1) ──< (1) reward_calculations
stores (1) ──< (N) reward_calculations

businesses (1) ──< (N) business_invoices
admin_accounts (1) ──< (N) reconciliation_reports [generated_by]
admin_accounts (1) ──< (N) payment_failures [resolved_by]
```

## Row Level Security (RLS) Policies

### payment_transactions

```sql
-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY payment_transactions_admin_read ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Admin write access (for retry operations)
CREATE POLICY payment_transactions_admin_write ON payment_transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access (for batch processing)
CREATE POLICY payment_transactions_service_all ON payment_transactions
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

### reward_calculations

```sql
ALTER TABLE reward_calculations ENABLE ROW LEVEL SECURITY;

-- Business can view their own store's rewards
CREATE POLICY reward_calculations_business_read ON reward_calculations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stores
      JOIN businesses ON stores.business_id = businesses.id
      WHERE stores.id = reward_calculations.store_id
      AND businesses.user_id = auth.uid()
    )
  );

-- Admin read access
CREATE POLICY reward_calculations_admin_read ON reward_calculations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access
CREATE POLICY reward_calculations_service_all ON reward_calculations
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

### payment_batches

```sql
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY payment_batches_admin_read ON payment_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access
CREATE POLICY payment_batches_service_all ON payment_batches
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

### payment_failures

```sql
ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY payment_failures_admin_read ON payment_failures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Admin write access (for manual resolution)
CREATE POLICY payment_failures_admin_write ON payment_failures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access
CREATE POLICY payment_failures_service_all ON payment_failures
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

### reconciliation_reports

```sql
ALTER TABLE reconciliation_reports ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY reconciliation_reports_admin_read ON reconciliation_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access
CREATE POLICY reconciliation_reports_service_all ON reconciliation_reports
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

### business_invoices

```sql
ALTER TABLE business_invoices ENABLE ROW LEVEL SECURITY;

-- Business can view their own invoices
CREATE POLICY business_invoices_business_read ON business_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_invoices.business_id
      AND businesses.user_id = auth.uid()
    )
  );

-- Admin read access
CREATE POLICY business_invoices_admin_read ON business_invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Admin write access (for invoice management)
CREATE POLICY business_invoices_admin_write ON business_invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_accounts
      WHERE admin_accounts.user_id = auth.uid()
      AND admin_accounts.is_active = TRUE
    )
  );

-- Backend service access
CREATE POLICY business_invoices_service_all ON business_invoices
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
```

## Performance Optimization

### Materialized Views

#### weekly_payment_summary
Pre-aggregated view for admin dashboard performance.

```sql
CREATE MATERIALIZED VIEW weekly_payment_summary AS
SELECT 
  pb.batch_week,
  pb.status AS batch_status,
  COUNT(DISTINCT pt.customer_phone) AS unique_customers,
  COUNT(pt.id) AS total_payments,
  SUM(pt.amount_sek) AS total_amount_ore,
  SUM(CASE WHEN pt.status = 'successful' THEN 1 ELSE 0 END) AS successful_count,
  SUM(CASE WHEN pt.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
  ROUND(
    100.0 * SUM(CASE WHEN pt.status = 'successful' THEN 1 ELSE 0 END) / NULLIF(COUNT(pt.id), 0),
    2
  ) AS success_rate_pct
FROM payment_batches pb
LEFT JOIN payment_transactions pt ON pt.batch_id = pb.id
GROUP BY pb.id, pb.batch_week, pb.status;

CREATE UNIQUE INDEX idx_weekly_payment_summary_week ON weekly_payment_summary(batch_week);
```

#### store_reward_summary
Pre-aggregated rewards by store for business dashboard.

```sql
CREATE MATERIALIZED VIEW store_reward_summary AS
SELECT 
  rc.store_id,
  DATE_TRUNC('week', rc.created_at) AS week_start,
  COUNT(rc.id) AS total_feedbacks,
  SUM(CASE WHEN rc.verified_by_business THEN 1 ELSE 0 END) AS verified_count,
  AVG(rc.quality_score) AS avg_quality_score,
  SUM(rc.reward_amount_sek) AS total_rewards_ore,
  SUM(CASE WHEN rc.payment_transaction_id IS NOT NULL THEN rc.reward_amount_sek ELSE 0 END) AS paid_rewards_ore
FROM reward_calculations rc
GROUP BY rc.store_id, DATE_TRUNC('week', rc.created_at);

CREATE INDEX idx_store_reward_summary_store ON store_reward_summary(store_id);
CREATE INDEX idx_store_reward_summary_week ON store_reward_summary(week_start DESC);
```

### Refresh Strategy

```sql
-- Refresh weekly_payment_summary after batch completion
CREATE OR REPLACE FUNCTION refresh_weekly_payment_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_payment_summary;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_weekly_payment_summary
AFTER UPDATE OF status ON payment_batches
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION refresh_weekly_payment_summary();

-- Refresh store_reward_summary nightly
-- (Configured via cron job: 0 2 * * * - runs at 2 AM daily)
```

## Data Retention

All payment tables use indefinite retention for accounting compliance:
- **payment_transactions**: Permanent retention
- **reward_calculations**: Permanent retention
- **payment_batches**: Permanent retention
- **payment_failures**: Permanent retention (audit trail)
- **reconciliation_reports**: Permanent retention (legal requirement)
- **business_invoices**: Permanent retention (tax compliance)

## Migration Dependencies

This schema depends on existing tables:
- `feedback_sessions` (established)
- `transactions` (established)
- `stores` (established)
- `businesses` (established)
- `admin_accounts` (established in 013-step-4-1)

Migration order:
1. Create `payment_batches` (no dependencies)
2. Create `payment_transactions` (depends on payment_batches)
3. Create `reward_calculations` (depends on feedback_sessions, transactions, stores, payment_transactions)
4. Create `payment_failures` (depends on payment_transactions, admin_accounts)
5. Create `reconciliation_reports` (depends on payment_batches, admin_accounts)
6. Create `business_invoices` (depends on businesses, payment_batches)
7. Create materialized views and triggers

---
*Based on spec.md FR-001 through FR-040 and research.md technical decisions*