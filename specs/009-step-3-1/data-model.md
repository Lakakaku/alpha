# Data Model: QR Code Landing & Verification System

**Date**: 2025-09-22  
**Feature**: Customer verification entities and relationships

## Core Entities

### **VerificationSession**

Primary entity tracking complete customer verification flow from QR scan to form
submission.

**Fields**:

- `id`: UUID (Primary Key)
- `store_id`: UUID (Foreign Key → Store entity)
- `qr_version`: Integer (QR code version scanned)
- `scan_timestamp`: Timestamp (when QR was scanned)
- `session_token`: String (secure session identifier)
- `status`: Enum (`pending`, `completed`, `expired`, `failed`)
- `ip_address`: String (for fraud detection)
- `user_agent`: String (browser/device info)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**Validation Rules**:

- `store_id` must exist in Store table
- `qr_version` must be between 1 and 9999999
- `session_token` must be cryptographically secure (32+ characters)
- `status` transitions: `pending` → `completed`/`failed`/`expired`
- Sessions expire after 30 minutes of inactivity

**Relationships**:

- Belongs to one Store
- Has one CustomerVerification (optional)
- Has many FraudDetectionLogs

### **CustomerVerification**

Stores validated customer transaction details for verification process.

**Fields**:

- `id`: UUID (Primary Key)
- `session_id`: UUID (Foreign Key → VerificationSession)
- `transaction_time`: Time (customer-provided transaction time)
- `transaction_amount`: Decimal(10,2) (in SEK)
- `phone_number_e164`: String (E.164 format: +46XXXXXXXXX)
- `phone_number_national`: String (National format: 070-XXX XX XX)
- `time_validation_status`: Enum (`valid`, `out_of_tolerance`, `invalid`)
- `amount_validation_status`: Enum (`valid`, `out_of_tolerance`, `invalid`)
- `phone_validation_status`: Enum (`valid`, `invalid_format`, `not_swedish`)
- `tolerance_check_time_diff`: Integer (minutes difference from current time)
- `tolerance_check_amount_diff`: Decimal(10,2) (SEK difference from expected)
- `submitted_at`: Timestamp
- `verified_at`: Timestamp (when business verification completes)

**Validation Rules**:

- `transaction_time` format: HH:MM (24-hour)
- `transaction_amount` must be positive, max 99999.99 SEK
- `phone_number_e164` must match Swedish mobile pattern: `+467[02369]\d{7}`
- `time_validation_status = valid` when within ±2 minutes of current time
- `amount_validation_status = valid` when within ±2 SEK of expected amount
- `phone_validation_status = valid` when Swedish mobile format validated

**Relationships**:

- Belongs to one VerificationSession
- Used by WeeklyVerificationProcess (business validation)

### **Store** (Existing Entity - Extended)

Extended store entity with QR code verification context.

**Additional Fields for QR Verification**:

- `current_qr_version`: Integer (latest QR code version)
- `qr_generation_date`: Timestamp (when current QR was generated)
- `verification_enabled`: Boolean (can accept new verifications)
- `fraud_detection_threshold`: Integer (suspicious activity limit)

**Validation Rules**:

- `current_qr_version` increments on QR regeneration
- `verification_enabled = false` disables new verification sessions
- `fraud_detection_threshold` default: 10 attempts per hour per IP

### **FraudDetectionLog** (New Supporting Entity)

Tracks suspicious activity and fraud prevention metrics.

**Fields**:

- `id`: UUID (Primary Key)
- `session_id`: UUID (Foreign Key → VerificationSession)
- `detection_type`: Enum (`rate_limit`, `invalid_qr`, `suspicious_pattern`,
  `duplicate_attempt`)
- `risk_score`: Integer (1-100, higher = more suspicious)
- `ip_address`: String
- `user_agent`: String
- `detection_details`: JSONB (additional fraud indicators)
- `action_taken`: Enum (`none`, `warning`, `block`, `flag_for_review`)
- `detected_at`: Timestamp

**Validation Rules**:

- `risk_score` range: 1-100
- `detection_details` stores structured fraud indicators
- `action_taken = block` prevents form submission

## State Transitions

### **VerificationSession Status Flow**

```
pending → completed (successful form submission)
pending → failed (validation errors, fraud detection)
pending → expired (30-minute timeout)
```

### **Validation Status Flow**

```
CustomerVerification creation:
1. time_validation_status = validate_time_tolerance(transaction_time)
2. amount_validation_status = validate_amount_tolerance(transaction_amount)
3. phone_validation_status = validate_swedish_phone(phone_number)
4. Overall success = all statuses = 'valid'
```

## Database Schema (Supabase PostgreSQL)

### **verification_sessions Table**

```sql
CREATE TABLE verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    qr_version INTEGER NOT NULL CHECK (qr_version >= 1 AND qr_version <= 9999999),
    scan_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_verification_sessions_store_id ON verification_sessions(store_id);
CREATE INDEX idx_verification_sessions_status ON verification_sessions(status);
CREATE INDEX idx_verification_sessions_session_token ON verification_sessions(session_token);
CREATE INDEX idx_verification_sessions_scan_timestamp ON verification_sessions(scan_timestamp);
```

### **customer_verifications Table**

```sql
CREATE TABLE customer_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES verification_sessions(id) ON DELETE CASCADE,
    transaction_time TIME NOT NULL,
    transaction_amount DECIMAL(10,2) NOT NULL CHECK (transaction_amount > 0),
    phone_number_e164 VARCHAR(15) NOT NULL CHECK (phone_number_e164 ~ '^\\+467[02369]\\d{7}$'),
    phone_number_national VARCHAR(20) NOT NULL,
    time_validation_status VARCHAR(20) NOT NULL
        CHECK (time_validation_status IN ('valid', 'out_of_tolerance', 'invalid')),
    amount_validation_status VARCHAR(20) NOT NULL
        CHECK (amount_validation_status IN ('valid', 'out_of_tolerance', 'invalid')),
    phone_validation_status VARCHAR(20) NOT NULL
        CHECK (phone_validation_status IN ('valid', 'invalid_format', 'not_swedish')),
    tolerance_check_time_diff INTEGER, -- minutes difference
    tolerance_check_amount_diff DECIMAL(10,2), -- SEK difference
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_customer_verifications_session_id ON customer_verifications(session_id);
CREATE INDEX idx_customer_verifications_submitted_at ON customer_verifications(submitted_at);
CREATE INDEX idx_customer_verifications_phone_e164 ON customer_verifications(phone_number_e164);
```

### **fraud_detection_logs Table**

```sql
CREATE TABLE fraud_detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES verification_sessions(id) ON DELETE CASCADE,
    detection_type VARCHAR(30) NOT NULL
        CHECK (detection_type IN ('rate_limit', 'invalid_qr', 'suspicious_pattern', 'duplicate_attempt')),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 1 AND risk_score <= 100),
    ip_address INET,
    user_agent TEXT,
    detection_details JSONB,
    action_taken VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (action_taken IN ('none', 'warning', 'block', 'flag_for_review')),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fraud_detection_logs_session_id ON fraud_detection_logs(session_id);
CREATE INDEX idx_fraud_detection_logs_detection_type ON fraud_detection_logs(detection_type);
CREATE INDEX idx_fraud_detection_logs_risk_score ON fraud_detection_logs(risk_score);
CREATE INDEX idx_fraud_detection_logs_detected_at ON fraud_detection_logs(detected_at);
```

## Row Level Security (RLS) Policies

### **verification_sessions RLS**

```sql
-- Enable RLS
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own session via session_token
CREATE POLICY "Users can access own verification session" ON verification_sessions
    FOR ALL USING (
        session_token = current_setting('request.headers')::json->>'session-token'
    );

-- Policy: Backend service can access all sessions
CREATE POLICY "Backend service full access" ON verification_sessions
    FOR ALL USING (
        current_setting('request.jwt.claims')::json->>'role' = 'service_role'
    );
```

### **customer_verifications RLS**

```sql
-- Enable RLS
ALTER TABLE customer_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access verifications for their session
CREATE POLICY "Users can access own verification data" ON customer_verifications
    FOR ALL USING (
        session_id IN (
            SELECT id FROM verification_sessions
            WHERE session_token = current_setting('request.headers')::json->>'session-token'
        )
    );

-- Policy: Backend service can access all verifications
CREATE POLICY "Backend service full access" ON customer_verifications
    FOR ALL USING (
        current_setting('request.jwt.claims')::json->>'role' = 'service_role'
    );
```

## Data Flow Summary

1. **QR Scan** → Create VerificationSession with store_id and qr_version
2. **Form Display** → Validate session_token and show verification form
3. **Form Submission** → Create CustomerVerification with tolerance validation
4. **Success Response** → Update VerificationSession.status to 'completed'
5. **Weekly Process** → Business verification updates verified_at timestamp
