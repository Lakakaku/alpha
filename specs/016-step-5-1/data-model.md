# Data Model: Step 5.1 GPT-4o-mini Integration

**Date**: 2025-09-23  
**Feature**: AI-powered phone call system for customer feedback collection  
**Status**: Phase 1 Design

## Database Entities

### 1. feedback_call_sessions
*Represents individual AI-customer conversations*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique session identifier |
| customer_verification_id | UUID | FOREIGN KEY, NOT NULL | Links to existing verification record |
| store_id | UUID | FOREIGN KEY, NOT NULL | Store where feedback was collected |
| phone_number | VARCHAR(20) | NOT NULL | Customer's phone number (encrypted) |
| session_status | VARCHAR(20) | NOT NULL | pending, in_progress, completed, failed, abandoned |
| call_initiated_at | TIMESTAMP | NOT NULL | When call was first attempted |
| call_connected_at | TIMESTAMP | NULL | When customer answered |
| call_ended_at | TIMESTAMP | NULL | When conversation finished |
| duration_seconds | INTEGER | NULL | Total conversation duration |
| retry_count | INTEGER | DEFAULT 0 | Number of retry attempts (max 3) |
| failure_reason | VARCHAR(100) | NULL | Reason for failure if applicable |
| openai_session_id | VARCHAR(100) | NULL | OpenAI Realtime API session ID |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| expires_at | TIMESTAMP | NOT NULL | Auto-deletion after 90 days |

**Indexes**:
- `idx_feedback_call_sessions_store_status` ON (store_id, session_status)
- `idx_feedback_call_sessions_expires` ON (expires_at) for cleanup
- `idx_feedback_call_sessions_verification` ON (customer_verification_id)

**RLS Policies**:
- Store owners can only access sessions for their stores
- Admin accounts have full access for monitoring
- Customer data encrypted and anonymized

### 2. conversation_transcripts
*Complete record of AI-customer dialogue*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique transcript identifier |
| call_session_id | UUID | FOREIGN KEY, NOT NULL | Links to feedback_call_sessions |
| speaker | VARCHAR(10) | NOT NULL | 'ai' or 'customer' |
| message_order | INTEGER | NOT NULL | Sequence number in conversation |
| content | TEXT | NOT NULL | Spoken content (encrypted) |
| timestamp_ms | BIGINT | NOT NULL | Milliseconds from call start |
| confidence_score | DECIMAL(3,2) | NULL | AI transcription confidence |
| language_detected | VARCHAR(10) | DEFAULT 'sv' | Detected language code |
| message_type | VARCHAR(20) | NOT NULL | question, response, system, error |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |

**Indexes**:
- `idx_conversation_transcripts_session_order` ON (call_session_id, message_order)
- `idx_conversation_transcripts_speaker` ON (call_session_id, speaker)

**RLS Policies**:
- Only accessible by admin accounts for quality monitoring
- Business accounts cannot access raw transcripts
- Automatic encryption for customer privacy

### 3. quality_assessments
*AI-generated evaluation of feedback quality*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique assessment identifier |
| call_session_id | UUID | FOREIGN KEY, NOT NULL | Links to feedback_call_sessions |
| legitimacy_score | DECIMAL(3,2) | NOT NULL | 0.00-1.00 fraud detection score |
| depth_score | DECIMAL(3,2) | NOT NULL | 0.00-1.00 feedback detail level |
| usefulness_score | DECIMAL(3,2) | NOT NULL | 0.00-1.00 actionable insights score |
| overall_quality_score | DECIMAL(3,2) | NOT NULL | 0.00-1.00 combined quality metric |
| reward_percentage | DECIMAL(4,2) | NOT NULL | 2.00-15.00 cashback percentage |
| is_fraudulent | BOOLEAN | DEFAULT FALSE | Automated fraud detection flag |
| fraud_reasons | JSONB | NULL | Structured fraud detection reasons |
| analysis_summary | TEXT | NULL | AI-generated feedback summary (encrypted) |
| business_actionable_items | JSONB | NULL | Structured improvement suggestions |
| analysis_metadata | JSONB | NULL | AI model versions, timestamps, etc. |
| created_at | TIMESTAMP | DEFAULT NOW() | Assessment completion time |

**Indexes**:
- `idx_quality_assessments_session` ON (call_session_id)
- `idx_quality_assessments_store_quality` ON (store_id, overall_quality_score) via session
- `idx_quality_assessments_fraud` ON (is_fraudulent, created_at)

**RLS Policies**:
- Store owners can access assessments for their stores
- Customer-identifying data remains encrypted
- Admin access for system monitoring

### 4. business_context_profiles  
*Store-specific information for AI conversation guidance*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique profile identifier |
| store_id | UUID | FOREIGN KEY, NOT NULL | Links to existing stores table |
| context_version | INTEGER | DEFAULT 1 | Version for context evolution |
| operating_hours | JSONB | NOT NULL | Store hours for legitimacy checks |
| departments | JSONB | NOT NULL | Store sections and layout info |
| current_campaigns | JSONB | NULL | Active promotions and changes |
| question_configuration | JSONB | NOT NULL | Custom questions and frequencies |
| baseline_facts | JSONB | NOT NULL | Unmutable store truths for fraud detection |
| context_completeness_score | DECIMAL(3,2) | DEFAULT 0.50 | 0.00-1.00 context quality metric |
| last_updated_at | TIMESTAMP | DEFAULT NOW() | Context modification time |
| updated_by | UUID | NULL | User who last modified context |

**Indexes**:
- `idx_business_context_profiles_store` ON (store_id, context_version)
- `idx_business_context_profiles_updated` ON (last_updated_at)

**RLS Policies**:
- Business users can only access their own store contexts
- Admin accounts have read access for support
- Audit trail for context changes

### 5. weekly_analysis_reports
*Comprehensive business intelligence documents*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique report identifier |
| store_id | UUID | FOREIGN KEY, NOT NULL | Store for this analysis |
| analysis_week | DATE | NOT NULL | Monday of analysis week |
| total_feedback_count | INTEGER | NOT NULL | Number of calls analyzed |
| average_quality_score | DECIMAL(3,2) | NULL | Average quality this week |
| positive_trends | JSONB | NULL | Structured positive feedback themes |
| negative_issues | JSONB | NULL | Structured problems identified |
| new_issues | JSONB | NULL | Issues not present in previous week |
| department_insights | JSONB | NULL | Area-specific analysis |
| historical_comparison | JSONB | NULL | Week-over-week performance |
| predictive_insights | JSONB | NULL | AI-generated future predictions |
| actionable_recommendations | JSONB | NULL | Specific improvement suggestions |
| report_metadata | JSONB | NULL | Analysis parameters and AI model info |
| generated_at | TIMESTAMP | DEFAULT NOW() | Report creation time |

**Indexes**:
- `idx_weekly_analysis_reports_store_week` ON (store_id, analysis_week)
- `idx_weekly_analysis_reports_generated` ON (generated_at)

**RLS Policies**:
- Business users can access reports for their stores
- Historical reports remain accessible beyond 90 days
- Admin monitoring access for system health

### 6. call_quality_metrics
*Technical performance data for system monitoring*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique metric record identifier |
| call_session_id | UUID | FOREIGN KEY, NOT NULL | Links to feedback_call_sessions |
| connection_quality | VARCHAR(20) | NOT NULL | excellent, good, fair, poor |
| audio_clarity_score | DECIMAL(3,2) | NULL | 0.00-1.00 audio quality metric |
| latency_ms | INTEGER | NULL | Average response latency |
| packet_loss_percentage | DECIMAL(4,2) | NULL | Network packet loss during call |
| openai_api_latency | INTEGER | NULL | AI response time in milliseconds |
| technical_errors | JSONB | NULL | Structured error information |
| bandwidth_usage_kb | INTEGER | NULL | Data usage for call |
| device_info | JSONB | NULL | Customer device/browser information |
| measured_at | TIMESTAMP | DEFAULT NOW() | Metric collection time |

**Indexes**:
- `idx_call_quality_metrics_session` ON (call_session_id)
- `idx_call_quality_metrics_quality` ON (connection_quality, measured_at)

**RLS Policies**:
- Admin-only access for system monitoring
- Aggregated metrics available for business dashboard
- No customer-identifying information

### 7. fraud_detection_results
*AI determination of feedback authenticity*

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique fraud check identifier |
| call_session_id | UUID | FOREIGN KEY, NOT NULL | Links to feedback_call_sessions |
| check_type | VARCHAR(50) | NOT NULL | timing, content, context, pattern |
| is_suspicious | BOOLEAN | NOT NULL | Fraud detection result |
| confidence_level | DECIMAL(3,2) | NOT NULL | 0.00-1.00 detection confidence |
| fraud_indicators | JSONB | NULL | Specific red flags identified |
| context_violations | JSONB | NULL | Business context inconsistencies |
| decision_reasoning | TEXT | NULL | AI explanation for fraud determination |
| manual_review_required | BOOLEAN | DEFAULT FALSE | Human review flag |
| reviewed_by | UUID | NULL | Admin who reviewed if applicable |
| review_decision | VARCHAR(20) | NULL | confirmed_fraud, false_positive, needs_investigation |
| created_at | TIMESTAMP | DEFAULT NOW() | Fraud check completion time |

**Indexes**:
- `idx_fraud_detection_results_session` ON (call_session_id, check_type)
- `idx_fraud_detection_results_suspicious` ON (is_suspicious, created_at)
- `idx_fraud_detection_results_review` ON (manual_review_required, created_at)

**RLS Policies**:
- Admin-only access for fraud investigation
- Business users see only aggregated fraud statistics
- Customer data anonymized in fraud reports

## Entity Relationships

```
customer_verification (existing)
    ↓ 1:1
feedback_call_sessions
    ↓ 1:many
conversation_transcripts
    ↓ 1:1
quality_assessments
    ↓ many:1
weekly_analysis_reports

stores (existing)
    ↓ 1:1
business_context_profiles
    ↓ 1:many
feedback_call_sessions
    ↓ many:1
weekly_analysis_reports

feedback_call_sessions
    ↓ 1:1
call_quality_metrics
    ↓ 1:many
fraud_detection_results
```

## Data Lifecycle Management

### Retention Policies
- **Raw transcripts**: 90 days, then automatic deletion
- **Quality assessments**: 90 days for customer data, indefinite for anonymized analytics
- **Weekly reports**: Permanent retention for business insights
- **Fraud detection logs**: 1 year for compliance and pattern analysis
- **Quality metrics**: 6 months for system optimization

### Privacy Compliance
- All customer-identifying fields encrypted at rest
- Automatic data anonymization after retention period
- Business users cannot access raw customer conversations
- Audit trail for all data access and modifications

### Data Migration Strategy
- Add new tables without disrupting existing verification flow
- Gradual migration of business context from existing admin systems
- Backwards compatibility maintained for existing API endpoints
- Zero-downtime deployment with feature flags

---

**Phase 1 Data Model Complete**: All entities defined with proper relationships, constraints, and privacy controls.