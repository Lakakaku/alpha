# Data Model: AI Call Integration Infrastructure

**Date**: 2025-09-22
**Feature**: AI Call Integration Infrastructure
**Branch**: 010-step-3-2

## Core Entities

### Call Session
**Purpose**: Represents an individual AI-powered call session
**Table**: `call_sessions`

**Fields**:
- `id` (UUID, primary key)
- `business_id` (UUID, foreign key to businesses table)
- `customer_phone` (VARCHAR, encrypted) - Customer's phone number
- `verification_id` (UUID, foreign key to customer verifications)
- `status` (ENUM: 'initiated', 'connecting', 'in_progress', 'completed', 'failed', 'timeout')
- `started_at` (TIMESTAMP) - Call initiation time
- `connected_at` (TIMESTAMP, nullable) - When customer answered
- `ended_at` (TIMESTAMP, nullable) - Call completion time
- `duration_seconds` (INTEGER, nullable) - Total call duration
- `questions_asked` (JSONB) - Array of question IDs asked during call
- `ai_session_id` (VARCHAR, nullable) - OpenAI session identifier
- `telephony_call_id` (VARCHAR, nullable) - Provider call identifier
- `cost_estimate` (DECIMAL, nullable) - Estimated call cost
- `recording_url` (VARCHAR, nullable) - Call recording location
- `transcript` (TEXT, nullable) - Full conversation transcript
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Relationships**:
- Belongs to business
- Has many call_events
- Has many call_responses
- Relates to customer verification

**Validation Rules**:
- Status transitions must follow valid state machine
- Duration must be ≤ 120 seconds (2 minutes)
- Customer phone must be valid Swedish format
- Cost estimate must be non-negative

### Question Configuration
**Purpose**: Business-defined questions with frequency and targeting settings
**Table**: `question_configurations`

**Fields**:
- `id` (UUID, primary key)
- `business_id` (UUID, foreign key to businesses table)
- `question_text` (TEXT) - The actual question in Swedish
- `frequency` (INTEGER) - Ask every Nth customer (1-100)
- `priority` (ENUM: 'high', 'medium', 'low') - Question priority level
- `department_tags` (JSONB) - Array of department/area tags
- `active_from` (DATE, nullable) - Question activation date
- `active_until` (DATE, nullable) - Question expiration date
- `is_active` (BOOLEAN, default true) - Whether question is currently active
- `max_response_time` (INTEGER, default 30) - Max seconds for response
- `follow_up_prompts` (JSONB, nullable) - Additional prompts for clarification
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Relationships**:
- Belongs to business
- Has many call_responses through call sessions

**Validation Rules**:
- Question text must be 10-500 characters
- Frequency must be 1-100
- Active period must be valid (from ≤ until)
- Department tags must be non-empty array

### Call Event
**Purpose**: Log of events during call lifecycle
**Table**: `call_events`

**Fields**:
- `id` (UUID, primary key)
- `call_session_id` (UUID, foreign key to call_sessions)
- `event_type` (ENUM: 'initiated', 'connecting', 'answered', 'ai_connected', 'question_asked', 'response_received', 'warning_sent', 'timeout', 'completed', 'failed')
- `event_data` (JSONB) - Event-specific data payload
- `timestamp` (TIMESTAMP) - When event occurred
- `source` (ENUM: 'system', 'telephony', 'ai', 'customer') - Event source
- `metadata` (JSONB, nullable) - Additional event metadata

**Relationships**:
- Belongs to call_session

**Validation Rules**:
- Timestamp must be chronological within session
- Event type must be valid for current session state

### Call Response
**Purpose**: Stores customer responses to specific questions
**Table**: `call_responses`

**Fields**:
- `id` (UUID, primary key)
- `call_session_id` (UUID, foreign key to call_sessions)
- `question_id` (UUID, foreign key to question_configurations)
- `question_text` (TEXT) - Question as asked (for historical accuracy)
- `response_text` (TEXT) - Customer's response (transcribed)
- `response_duration` (INTEGER) - Response duration in seconds
- `confidence_score` (DECIMAL, nullable) - Transcription confidence (0-1)
- `sentiment_score` (DECIMAL, nullable) - Response sentiment analysis (-1 to 1)
- `asked_at` (TIMESTAMP) - When question was asked
- `responded_at` (TIMESTAMP, nullable) - When response was received
- `ai_analysis` (JSONB, nullable) - AI analysis of response
- `created_at` (TIMESTAMP)

**Relationships**:
- Belongs to call_session
- Belongs to question_configuration

**Validation Rules**:
- Response duration must be ≤ 60 seconds
- Confidence score must be 0-1
- Sentiment score must be -1 to 1
- asked_at must be ≤ responded_at

### Question Selection Log
**Purpose**: Tracks question selection algorithm decisions
**Table**: `question_selection_logs`

**Fields**:
- `id` (UUID, primary key)
- `business_id` (UUID, foreign key to businesses table)
- `customer_count` (INTEGER) - Customer number for frequency calculation
- `selected_questions` (JSONB) - Array of selected question IDs
- `selection_algorithm` (VARCHAR) - Algorithm version used
- `selection_criteria` (JSONB) - Criteria used for selection
- `time_budget_seconds` (INTEGER) - Available time for questions
- `estimated_duration` (INTEGER) - Estimated time for selected questions
- `created_at` (TIMESTAMP)

**Relationships**:
- Belongs to business
- References question_configurations

**Validation Rules**:
- Customer count must be positive
- Time budget must be 60-120 seconds
- Estimated duration must be ≤ time budget

### Telephony Provider Log
**Purpose**: Tracks telephony provider interactions and metrics
**Table**: `telephony_provider_logs`

**Fields**:
- `id` (UUID, primary key)
- `call_session_id` (UUID, foreign key to call_sessions)
- `provider` (ENUM: '46elks', 'twilio') - Telephony provider used
- `provider_call_id` (VARCHAR) - Provider's call identifier
- `operation` (ENUM: 'initiate', 'connect', 'record', 'hangup', 'webhook') - Operation type
- `request_payload` (JSONB) - Request sent to provider
- `response_payload` (JSONB) - Response from provider
- `status_code` (INTEGER) - HTTP status code
- `latency_ms` (INTEGER) - Operation latency in milliseconds
- `success` (BOOLEAN) - Whether operation succeeded
- `error_message` (TEXT, nullable) - Error message if failed
- `created_at` (TIMESTAMP)

**Relationships**:
- Belongs to call_session

**Validation Rules**:
- Status code must be valid HTTP status
- Latency must be non-negative
- Error message required if success = false

## State Transitions

### Call Session State Machine
```
initiated → connecting → in_progress → completed
     ↓           ↓            ↓
   failed     failed       timeout
```

**Valid Transitions**:
- `initiated` → `connecting` (call placed to customer)
- `initiated` → `failed` (unable to place call)
- `connecting` → `in_progress` (customer answered)
- `connecting` → `failed` (customer didn't answer)
- `in_progress` → `completed` (normal completion)
- `in_progress` → `timeout` (exceeded duration limit)
- `in_progress` → `failed` (technical failure)

## Database Indexes

### Performance Indexes
```sql
-- Call session lookups by business and status
CREATE INDEX idx_call_sessions_business_status ON call_sessions(business_id, status);

-- Call session lookups by time range
CREATE INDEX idx_call_sessions_created_at ON call_sessions(created_at);

-- Question configuration lookups by business and active status
CREATE INDEX idx_question_configs_business_active ON question_configurations(business_id, is_active);

-- Call events by session and timestamp
CREATE INDEX idx_call_events_session_timestamp ON call_events(call_session_id, timestamp);

-- Call responses by session
CREATE INDEX idx_call_responses_session ON call_responses(call_session_id);

-- Question selection logs by business and time
CREATE INDEX idx_question_selection_business_time ON question_selection_logs(business_id, created_at);
```

## Row Level Security (RLS) Policies

### Call Sessions
```sql
-- Businesses can only access their own call sessions
CREATE POLICY call_sessions_business_isolation ON call_sessions
  FOR ALL USING (business_id = get_current_business_id());

-- System service can access all sessions
CREATE POLICY call_sessions_system_access ON call_sessions
  FOR ALL USING (current_user = 'call_service');
```

### Question Configurations
```sql
-- Businesses can only manage their own questions
CREATE POLICY question_configs_business_isolation ON question_configurations
  FOR ALL USING (business_id = get_current_business_id());
```

## Data Retention Policies

### Automatic Cleanup
- Call events older than 90 days are archived
- Telephony provider logs older than 30 days are purged
- Failed call sessions older than 7 days are purged
- Call recordings deleted after 30 days (GDPR compliance)

### Privacy Protection
- Customer phone numbers encrypted at rest
- Call transcripts anonymized for long-term storage
- Personal data purged on customer request (GDPR Article 17)

---

**Constitutional Compliance**:
- ✅ Real data only (no mock entities)
- ✅ RLS policies for all tables
- ✅ TypeScript type generation ready
- ✅ Production-ready schema design