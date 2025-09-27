# Data Model: Fraud Detection & Security

**Phase 1 Output** | **Date**: 2025-09-24 | **Feature**: 018-step-5-3

## Fraud Detection Entities

### FraudScore

Composite fraud detection score for each feedback submission.

**Table**: `fraud_scores`

```sql
CREATE TABLE fraud_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES feedback_submissions(id) NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  context_score integer NOT NULL CHECK (context_score >= 0 AND context_score <= 100),
  keyword_score integer NOT NULL CHECK (keyword_score >= 0 AND keyword_score <= 100),
  behavioral_score integer NOT NULL CHECK (behavioral_score >= 0 AND behavioral_score <= 100),
  transaction_score integer NOT NULL CHECK (transaction_score >= 0 AND transaction_score <= 100),
  is_fraudulent boolean GENERATED ALWAYS AS (overall_score < 70) STORED,
  scoring_method text NOT NULL DEFAULT 'composite_v1',
  analysis_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Validation Rules**:

- overall_score = (context_score _ 0.4) + (keyword_score _ 0.2) +
  (behavioral_score _ 0.3) + (transaction_score _ 0.1)
- is_fraudulent triggers reward blocking when true
- analysis_metadata stores detailed scoring breakdown

### ContextAnalysis

Store-specific legitimacy assessment for feedback content.

**Table**: `context_analyses`

```sql
CREATE TABLE context_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES feedback_submissions(id) NOT NULL,
  store_id uuid REFERENCES stores(id) NOT NULL,
  context_window_id uuid REFERENCES store_context_windows(id),
  legitimacy_score integer NOT NULL CHECK (legitimacy_score >= 0 AND legitimacy_score <= 100),
  context_matches jsonb DEFAULT '[]'::jsonb,
  context_violations jsonb DEFAULT '[]'::jsonb,
  semantic_similarity_score decimal(5,3) CHECK (semantic_similarity_score >= 0.0 AND semantic_similarity_score <= 1.0),
  impossibility_flags text[] DEFAULT '{}',
  analysis_engine text NOT NULL DEFAULT 'gpt4-omini',
  created_at timestamptz DEFAULT now()
);
```

**Validation Rules**:

- legitimacy_score combines semantic similarity and rule-based validation
- context_matches array contains matched business context elements
- impossibility_flags captures contextually impossible suggestions

### BehavioralPattern

Customer usage patterns and fraud indicators.

**Table**: `behavioral_patterns`

```sql
CREATE TABLE behavioral_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_hash text NOT NULL, -- hashed for privacy
  customer_id uuid REFERENCES customers(id),
  pattern_type text NOT NULL CHECK (pattern_type IN ('call_frequency', 'time_pattern', 'location_pattern', 'similarity_pattern')),
  pattern_data jsonb NOT NULL,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  detection_window interval NOT NULL DEFAULT '30 minutes'::interval,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz DEFAULT now(),
  violation_count integer DEFAULT 1,
  UNIQUE(phone_number_hash, pattern_type, first_detected_at::date)
);
```

**State Transitions**:

- new → monitoring → suspicious → flagged
- pattern_data structure varies by pattern_type
- violation_count tracks repeated infractions

### RedFlagKeyword

Categorized keyword database for fraud detection.

**Table**: `red_flag_keywords`

```sql
CREATE TABLE red_flag_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  category text NOT NULL CHECK (category IN ('profanity', 'threats', 'nonsensical', 'impossible')),
  severity_level integer NOT NULL CHECK (severity_level BETWEEN 1 AND 10),
  language_code text NOT NULL DEFAULT 'sv',
  detection_pattern text, -- regex pattern for advanced matching
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES admin_accounts(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(keyword, language_code)
);
```

**Validation Rules**:

- severity_level 1-3: warning, 4-7: suspicious, 8-10: blocking
- detection_pattern enables regex matching for variations
- Swedish (sv) language support required

## Security Entities

### AuditLog

Comprehensive security event recording.

**Table**: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'authentication', 'authorization', 'data_access', 'data_modification',
    'admin_action', 'security_violation', 'system_event', 'fraud_detection'
  )),
  user_id uuid, -- nullable for system events
  user_type text CHECK (user_type IN ('customer', 'business', 'admin', 'system')),
  action_performed text NOT NULL,
  resource_type text,
  resource_id text,
  ip_address inet,
  user_agent text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_metadata jsonb DEFAULT '{}'::jsonb,
  result_status text NOT NULL CHECK (result_status IN ('success', 'failure', 'blocked', 'warning')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutable audit log - no updates or deletes allowed
CREATE POLICY "audit_logs_immutable" ON audit_logs FOR ALL TO authenticated
USING (false) WITH CHECK (false);
```

**Validation Rules**:

- Immutable records - no updates or deletes permitted
- correlation_id links related events across services
- event_metadata contains structured event details

### RLSPolicy

Enhanced Row Level Security policy management.

**Table**: `rls_policies`

```sql
CREATE TABLE rls_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL UNIQUE,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')),
  role_type text NOT NULL CHECK (role_type IN ('customer', 'business', 'admin', 'super_admin')),
  policy_expression text NOT NULL,
  data_classification text NOT NULL CHECK (data_classification IN ('public', 'internal', 'sensitive', 'restricted')),
  is_active boolean DEFAULT true,
  violation_action text DEFAULT 'block' CHECK (violation_action IN ('block', 'log', 'warn')),
  created_by uuid REFERENCES admin_accounts(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Validation Rules**:

- policy_expression contains SQL expression for RLS
- data_classification determines access requirements
- violation tracking through audit_logs

### IntrusionEvent

Security incident detection and response.

**Table**: `intrusion_events`

```sql
CREATE TABLE intrusion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'brute_force', 'sql_injection', 'unusual_access', 'privilege_escalation',
    'data_exfiltration', 'rate_limit_violation', 'authentication_bypass'
  )),
  source_ip inet NOT NULL,
  target_resource text,
  attack_pattern text,
  severity_level integer NOT NULL CHECK (severity_level BETWEEN 1 AND 10),
  detection_method text NOT NULL,
  automated_response jsonb DEFAULT '{}'::jsonb,
  admin_notified boolean DEFAULT false,
  incident_status text DEFAULT 'detected' CHECK (incident_status IN (
    'detected', 'investigating', 'contained', 'resolved', 'false_positive'
  )),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);
```

**State Transitions**:

- detected → investigating → (contained | false_positive) → resolved
- automated_response records blocking/alerting actions taken
- admin notification triggers for severity >= 7

### EncryptionKey

Data protection key management.

**Table**: `encryption_keys`

```sql
CREATE TABLE encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_alias text NOT NULL UNIQUE,
  key_type text NOT NULL CHECK (key_type IN ('aes_256', 'rsa_2048', 'rsa_4096')),
  purpose text NOT NULL CHECK (purpose IN ('customer_pii', 'feedback_content', 'phone_numbers', 'transaction_data')),
  key_status text DEFAULT 'active' CHECK (key_status IN ('active', 'rotating', 'retired', 'compromised')),
  created_at timestamptz DEFAULT now(),
  rotation_scheduled_at timestamptz,
  retired_at timestamptz,
  -- Key material stored in environment variables, not database
  key_fingerprint text NOT NULL UNIQUE
);

-- Restrict access to super admins only
CREATE POLICY "encryption_keys_super_admin" ON encryption_keys FOR ALL TO authenticated
USING (auth.jwt() ->> 'role' = 'super_admin')
WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');
```

**Validation Rules**:

- Key material never stored in database - environment variables only
- key_fingerprint enables key verification without exposure
- Automated rotation scheduling for compliance

## Entity Relationships

### Fraud Detection Flow

```
feedback_submissions → fraud_scores → (reward processing decision)
                   ↓
                context_analyses → store_context_windows
                   ↓
                behavioral_patterns ← phone_number_hash
                   ↓
                red_flag_keywords → detection_pattern
```

### Security Audit Chain

```
user_actions → audit_logs → correlation_id
              ↓
          rls_policies → violation_detection
              ↓
          intrusion_events → automated_response
              ↓
          encryption_keys → data_protection
```

## Integration Points

### Existing System Integration

- **feedback_submissions**: Links fraud scores to existing feedback system
- **stores**: Context analysis requires store information and context windows
- **customers**: Behavioral patterns tied to customer records
- **admin_accounts**: All security administration requires admin authentication

### Performance Considerations

- **Indexes**: fraud_scores.feedback_id, behavioral_patterns.phone_number_hash,
  audit_logs.correlation_id
- **Partitioning**: audit_logs by created_at (monthly), intrusion_events by
  severity
- **Caching**: red_flag_keywords in Redis for real-time detection

## Constitutional Compliance

✅ **Real Data**: All entities work with production customer feedback and
business data  
✅ **TypeScript Strict**: All entity interfaces will be strictly typed  
✅ **Security First**: Comprehensive RLS policies and audit logging built-in  
✅ **Production Ready**: Immutable audit logs, encrypted sensitive data, proper
indexing
