# Data Model: Weekly Verification Workflow

**Date**: 2025-09-23  
**Feature**: Weekly Verification Workflow  
**Branch**: 014-step-4-2

## Database Schema Extensions

### New Tables

#### weekly_verification_cycles
Represents the complete weekly verification workflow lifecycle.

```sql
CREATE TABLE weekly_verification_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_week DATE NOT NULL, -- Start date of the week (Monday)
  status verification_cycle_status NOT NULL DEFAULT 'preparing',
  total_stores INTEGER NOT NULL DEFAULT 0,
  completed_stores INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_accounts(id),
  
  UNIQUE(cycle_week)
);

CREATE TYPE verification_cycle_status AS ENUM (
  'preparing',      -- Data aggregation in progress
  'ready',          -- Databases prepared, ready for distribution
  'distributed',    -- Sent to businesses
  'collecting',     -- Waiting for business submissions
  'processing',     -- Processing submitted verifications
  'invoicing',      -- Generating invoices
  'completed',      -- All payments processed
  'expired'         -- Deadline passed with incomplete submissions
);
```

#### verification_databases
Store-specific transaction data prepared for business verification.

```sql
CREATE TABLE verification_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES weekly_verification_cycles(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  
  -- File information
  csv_file_url TEXT,
  excel_file_url TEXT,
  json_file_url TEXT,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  
  -- Status tracking
  status verification_db_status NOT NULL DEFAULT 'preparing',
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  
  -- Verification results
  verified_count INTEGER DEFAULT 0,
  fake_count INTEGER DEFAULT 0,
  unverified_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(cycle_id, store_id)
);

CREATE TYPE verification_db_status AS ENUM (
  'preparing',      -- Database being generated
  'ready',          -- Ready for business download
  'downloaded',     -- Business has accessed files
  'submitted',      -- Business has submitted verification
  'processed',      -- Admin has processed submission
  'expired'         -- Deadline passed without submission
);
```

#### verification_records
Individual transaction verification status from businesses.

```sql
CREATE TABLE verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_db_id UUID NOT NULL REFERENCES verification_databases(id),
  
  -- Original transaction reference
  original_feedback_id UUID NOT NULL REFERENCES feedback_sessions(id),
  transaction_time TIMESTAMPTZ NOT NULL,
  transaction_value DECIMAL(10,2) NOT NULL,
  
  -- Verification result
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES business_accounts(id),
  verified_at TIMESTAMPTZ,
  
  -- Rewards calculation
  reward_percentage DECIMAL(4,2), -- 2.00 to 15.00
  reward_amount DECIMAL(10,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE verification_status AS ENUM (
  'pending',        -- Awaiting business verification
  'verified',       -- Confirmed as legitimate transaction
  'fake',           -- Marked as fraudulent by business
  'expired'         -- Not verified before deadline
);
```

#### payment_invoices
Business payment records for verified feedback rewards.

```sql
CREATE TABLE payment_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES weekly_verification_cycles(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  
  -- Financial details
  total_rewards DECIMAL(12,2) NOT NULL DEFAULT 0,
  admin_fee DECIMAL(12,2) NOT NULL DEFAULT 0, -- 20% of rewards
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0, -- rewards + fee
  
  -- Payment tracking
  status payment_status NOT NULL DEFAULT 'pending',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  
  -- File delivery
  feedback_database_delivered BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(cycle_id, business_id)
);

CREATE TYPE payment_status AS ENUM (
  'pending',        -- Invoice generated, awaiting payment
  'paid',           -- Payment received and confirmed
  'overdue',        -- Past due date
  'disputed',       -- Business has disputed charges
  'cancelled'       -- Invoice cancelled by admin
);
```

#### customer_reward_batches
Weekly aggregation of customer rewards for Swish payments.

```sql
CREATE TABLE customer_reward_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES weekly_verification_cycles(id),
  phone_number TEXT NOT NULL,
  
  -- Reward aggregation
  total_reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  
  -- Payment processing
  swish_payment_status swish_status NOT NULL DEFAULT 'pending',
  swish_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(cycle_id, phone_number)
);

CREATE TYPE swish_status AS ENUM (
  'pending',        -- Ready for Swish payment
  'processing',     -- Payment initiated with Swish
  'completed',      -- Payment successful
  'failed',         -- Payment failed
  'invalid_number'  -- Phone number invalid for Swish
);
```

## Entity Relationships

### Core Workflow Flow
```
weekly_verification_cycles (1) -> (many) verification_databases
verification_databases (1) -> (many) verification_records
weekly_verification_cycles (1) -> (many) payment_invoices
weekly_verification_cycles (1) -> (many) customer_reward_batches
```

### Business Relationships
```
businesses (1) -> (many) verification_databases
businesses (1) -> (many) payment_invoices
stores (1) -> (many) verification_databases
feedback_sessions (1) -> (1) verification_records
```

## Validation Rules

### Business Rules
- Verification deadline = cycle start + 5 business days
- Admin fee = 20% of total verified rewards
- Maximum 1,000 verification records per database
- Reward percentage between 2.00% and 15.00%

### Data Integrity
- verification_databases.deadline_at must be within cycle week + 5 business days
- verification_records.reward_amount = transaction_value * reward_percentage
- payment_invoices.total_amount = total_rewards + admin_fee
- customer_reward_batches.total_reward_amount = sum of all verified rewards for phone number

### State Transitions
- verification_cycle_status: preparing -> ready -> distributed -> collecting -> processing -> invoicing -> completed
- verification_db_status: preparing -> ready -> downloaded -> submitted -> processed
- verification_status: pending -> (verified | fake | expired)
- payment_status: pending -> (paid | overdue | disputed | cancelled)

## RLS Policies

### Admin Access
```sql
-- Admin users can access all verification data
CREATE POLICY admin_verification_access ON weekly_verification_cycles
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'user_type' = 'admin');
```

### Business Access
```sql
-- Businesses can only access their own verification databases
CREATE POLICY business_verification_access ON verification_databases
  FOR SELECT TO authenticated
  USING (business_id = auth.jwt() ->> 'business_id');

-- Businesses can update verification status for their records
CREATE POLICY business_verification_update ON verification_records
  FOR UPDATE TO authenticated
  USING (verification_db_id IN (
    SELECT id FROM verification_databases 
    WHERE business_id = auth.jwt() ->> 'business_id'
  ));
```

### Customer Privacy
```sql
-- No direct customer access to verification tables
-- Phone numbers in customer_reward_batches hidden from business users
CREATE POLICY customer_privacy ON customer_reward_batches
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'user_type' = 'admin');
```

---

**Status**: Complete - All entities and relationships defined  
**Next**: API Contracts (contracts/ directory)