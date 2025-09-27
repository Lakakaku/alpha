# Quickstart: Step 5.1 GPT-4o-mini Integration

**Date**: 2025-09-23  
**Feature**: AI-powered phone call system for customer feedback collection  
**Status**: Phase 1 Test Scenarios

## Test Environment Setup

### Prerequisites
- Railway backend deployment with OpenAI API access
- Supabase database with existing verification tables
- 46elks Swedish phone service configured
- Redis instance for session management
- Test Swedish phone numbers for validation

### Environment Variables
```bash
# OpenAI Integration
OPENAI_API_KEY=sk-test-...
OPENAI_REALTIME_MODEL=gpt-4o-mini
OPENAI_VOICE_MODEL=sv-SE-MattiasNeural

# Phone Service (46elks)
FORTYSIXELKS_USERNAME=test_username
FORTYSIXELKS_PASSWORD=test_password
FORTYSIXELKS_WEBHOOK_URL=https://api.vocilia.com/webhooks/46elks

# Redis Session Storage
REDIS_URL=redis://localhost:6379
REDIS_SESSION_TTL=7776000  # 90 days in seconds

# Feature Flags
AI_CALLS_ENABLED=true
AI_ANALYSIS_ENABLED=true
BUSINESS_ANALYSIS_ENABLED=true
```

## Integration Test Scenarios

### Scenario 1: Successful AI Call Completion
*Based on Acceptance Scenario 1-3 from specification*

#### Test Setup
```bash
# Create test customer verification record
POST /api/verification/create
{
  "store_id": "test-store-uuid",
  "transaction_time": "2025-09-23T14:30:00Z",
  "transaction_value": 125.50,
  "phone_number": "+46701234567"
}
```

#### Test Steps
1. **Verify Call Initiation** *(FR-001, FR-026)*
   ```bash
   # Should trigger immediately after verification
   GET /ai/calls/status?verification_id={verification_id}
   # Expected: status="pending", retry_count=0
   ```

2. **Simulate Call Connection** *(FR-002, FR-003)*
   ```bash
   # Mock OpenAI Realtime API response
   POST /ai/calls/{call_session_id}/simulate-connection
   {
     "language": "sv",
     "duration_target": 90,  # 1.5 minutes target
     "customer_response_pattern": "detailed_feedback"
   }
   ```

3. **Submit Conversation Transcript** *(FR-006)*
   ```bash
   POST /ai/calls/{call_session_id}/transcript
   {
     "messages": [
       {
         "speaker": "ai",
         "content": "Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?",
         "timestamp_ms": 0,
         "message_order": 1,
         "message_type": "question"
       },
       {
         "speaker": "customer", 
         "content": "Butiken var ren och personalen var mycket hjälpsam vid köttdisken.",
         "timestamp_ms": 5000,
         "message_order": 2,
         "message_type": "response"
       }
     ],
     "total_duration_seconds": 95,  # Must be 60-120 for analysis
     "openai_session_id": "sess_test123"
   }
   ```

4. **Verify Analysis Processing** *(FR-009, FR-010)*
   ```bash
   POST /ai/analysis/process
   {
     "call_session_id": "{call_session_id}",
     "transcript_id": "{transcript_id}"
   }
   # Expected: 202 with analysis_id
   
   GET /ai/analysis/{analysis_id}/results
   # Expected: reward_percentage between 2.00-15.00
   ```

#### Expected Results
- Call session status: `completed`
- Quality assessment generated with scores 0.00-1.00
- Reward percentage: 8-12% range (detailed, legitimate feedback)
- No fraud flags: `is_fraudulent=false`

### Scenario 2: Fraud Detection and Call Failure
*Based on Edge Cases from specification*

#### Test Setup - Business Hours Violation
```bash
# Create verification outside business hours
POST /api/verification/create
{
  "store_id": "test-store-uuid",
  "transaction_time": "2025-09-23T02:00:00Z",  # 2 AM - store closed
  "transaction_value": 50.00,
  "phone_number": "+46701234568"
}
```

#### Test Steps
1. **Verify Immediate Fraud Detection** *(FR-011, FR-016)*
   ```bash
   POST /ai/analysis/fraud-check
   {
     "call_session_id": "{call_session_id}",
     "check_types": ["timing", "context"],
     "business_context": {
       "operating_hours": {
         "monday": {"open": "08:00", "close": "20:00"}
       }
     }
   }
   ```

2. **Test Call Retry Logic** *(FR-001 - max 3 attempts)*
   ```bash
   # First retry attempt
   POST /ai/calls/retry/{customer_verification_id}
   # Expected: retry_number=1
   
   # Second retry attempt  
   POST /ai/calls/retry/{customer_verification_id}
   # Expected: retry_number=2
   
   # Third attempt should fail
   POST /ai/calls/retry/{customer_verification_id}
   # Expected: 409 "Maximum retries exceeded"
   ```

#### Expected Results
- Fraud detection: `is_fraudulent=true` 
- Fraud reasons: `["business_hours_violation"]`
- Call status: `failed` after 3 attempts
- No reward calculation performed

### Scenario 3: Swedish Language Validation
*Based on FR-002, FR-008*

#### Test Setup - Non-Swedish Response
```bash
# Simulate call with English responses
POST /ai/calls/{call_session_id}/transcript
{
  "messages": [
    {
      "speaker": "ai",
      "content": "Hej! Kan du berätta om din upplevelse?",
      "timestamp_ms": 0,
      "message_order": 1,
      "language_detected": "sv"
    },
    {
      "speaker": "customer",
      "content": "Sorry, I don't speak Swedish",
      "timestamp_ms": 3000,
      "message_order": 2,
      "language_detected": "en"
    }
  ],
  "total_duration_seconds": 15  # Short duration
}
```

#### Expected Results
- Call terminated early due to language barrier
- Status: `abandoned` with reason `language_barrier`
- No quality analysis performed
- Duration below 60-second threshold

### Scenario 4: Weekly Business Analysis Generation
*Based on FR-017, FR-018, FR-019*

#### Test Setup - Week with Multiple Feedback Sessions
```bash
# Generate test data for full week analysis
for day in range(7):
  POST /ai/calls/initiate  # Create 5-10 calls per day
  # Vary feedback content: positive, negative, department-specific
```

#### Test Steps
1. **Generate Weekly Report** *(FR-017)*
   ```bash
   POST /ai/business-analysis/weekly-reports
   {
     "store_id": "test-store-uuid",
     "analysis_week": "2025-09-22",  # Monday of test week
     "analysis_depth": "comprehensive"
   }
   ```

2. **Verify Report Content** *(FR-018, FR-019)*
   ```bash
   GET /ai/business-analysis/weekly-reports/test-store-uuid/2025-09-22
   # Expected sections:
   # - positive_trends: array of improvements
   # - negative_issues: array of problems  
   # - new_issues: issues not in previous week
   # - department_insights: area-specific analysis
   ```

3. **Test Natural Language Search** *(FR-023)*
   ```bash
   POST /ai/business-analysis/search
   {
     "store_id": "test-store-uuid", 
     "query": "meat section opinions",
     "time_range": {
       "start_date": "2025-09-22",
       "end_date": "2025-09-28"
     }
   }
   ```

#### Expected Results
- Weekly report generated with all required sections
- Trend analysis comparing to previous weeks
- Search returns relevant meat department feedback
- Actionable recommendations provided

### Scenario 5: Data Retention and Cleanup
*Based on clarification: 90-day retention policy*

#### Test Setup - Expired Data
```bash
# Create call session with past expiration date
UPDATE feedback_call_sessions 
SET expires_at = '2025-06-25T00:00:00Z'  # 90 days ago
WHERE id = 'test-expired-session-uuid';
```

#### Test Steps
1. **Automatic Cleanup Trigger** *(FR-015)*
   ```bash
   DELETE /ai/analysis/cleanup?quality_threshold=0.02
   # Should remove expired low-quality feedback
   ```

2. **Verify Data Removal**
   ```bash
   GET /ai/calls/test-expired-session-uuid/status
   # Expected: 404 Not Found
   ```

#### Expected Results
- Expired conversation transcripts deleted
- Quality assessments anonymized but preserved for analytics
- Business reports retained permanently

## Performance Validation

### Load Testing Scenarios

#### Concurrent Call Handling
```bash
# Test unlimited concurrent calls per store (clarification requirement)
for i in range(50):
  POST /ai/calls/initiate  # Same store_id, different customers
# All should return 202 Accepted
```

#### API Response Times
```bash
# Test <500ms requirement for API endpoints
time curl -X POST /ai/calls/initiate
time curl -X GET /ai/calls/{id}/status  
time curl -X POST /ai/analysis/process
# All should complete within 500ms
```

## Security Validation

### Authentication Testing
```bash
# Test without valid JWT token
curl -X POST /ai/calls/initiate
# Expected: 401 Unauthorized

# Test with expired token
curl -H "Authorization: Bearer expired_token" -X POST /ai/calls/initiate
# Expected: 401 Unauthorized
```

### Data Privacy Testing  
```bash
# Verify phone number encryption
GET /ai/calls/{session_id}/transcript
# Customer phone number should not appear in raw form

# Test business user access restrictions
GET /ai/calls/{session_id}/transcript  # As business user
# Expected: 403 Forbidden (only admin access to raw transcripts)
```

## Monitoring and Observability

### Health Check Endpoints
```bash
GET /health/ai-services
# Expected: All AI services operational

GET /health/openai-connectivity  
# Expected: OpenAI API reachable and responsive

GET /health/phone-service
# Expected: 46elks service available
```

### Metrics Validation
```bash
GET /metrics/ai-calls/success-rate
# Expected: >95% success rate for valid calls

GET /metrics/ai-analysis/processing-time
# Expected: Average <30 seconds for analysis completion
```

## Rollback Scenarios

### Feature Flag Disable
```bash
# Disable AI calls in production
PUT /admin/feature-flags
{
  "AI_CALLS_ENABLED": false
}

# Verify graceful degradation
POST /ai/calls/initiate
# Expected: 503 Service Unavailable with clear message
```

### Database Migration Rollback
```bash
# Test backwards compatibility
# Ensure existing verification flow continues without AI tables
```

---

**Phase 1 Quickstart Complete**: All critical user journeys validated with comprehensive test scenarios covering functionality, performance, security, and failure cases.