# Quickstart: AI Call Integration Infrastructure

**Date**: 2025-09-22
**Feature**: AI Call Integration Infrastructure
**Branch**: 010-step-3-2

## Overview
This quickstart guide validates the complete AI call integration system by walking through a customer feedback call scenario from initiation to completion.

## Prerequisites
- Customer has completed QR verification with valid transaction data
- Business has configured at least one question in their context
- 46elks telephony provider account configured
- OpenAI API access with GPT-4o-mini real-time preview
- Supabase database with call tables created

## Test Scenario: Complete Customer Call Flow

### Step 1: Customer Verification Complete
**Given**: Customer "Anna Svensson" scanned QR code and provided:
- Transaction time: 14:30 (within 2 minutes of current time)
- Transaction amount: 145 SEK (within store tolerance)
- Phone number: +46701234567

**Expected Database State**:
```sql
-- Verification record exists and is validated
SELECT * FROM customer_verifications
WHERE phone_number = '+46701234567'
AND status = 'verified';
```

### Step 2: Question Selection
**When**: System determines questions for customer #7 for "ICA Maxi Linköping"

**API Call**:
```bash
curl -X POST https://api.vocilia.com/v1/questions/select \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "550e8400-e29b-41d4-a716-446655440000",
    "customerCount": 7,
    "timeBudgetSeconds": 90
  }'
```

**Expected Response**:
```json
{
  "selectedQuestions": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "questionText": "Hur var din upplevelse av vårt kött- och charkavdelning idag?",
      "priority": "high",
      "maxResponseTime": 30
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "questionText": "Vad tycker du om våra öppettider?",
      "priority": "medium",
      "maxResponseTime": 25
    }
  ],
  "estimatedDuration": 75
}
```

### Step 3: Call Initiation
**When**: System initiates AI call for verified customer

**API Call**:
```bash
curl -X POST https://api.vocilia.com/v1/calls/initiate \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationId": "550e8400-e29b-41d4-a716-446655440001",
    "businessId": "550e8400-e29b-41d4-a716-446655440000",
    "customerPhone": "+46701234567",
    "priority": "normal"
  }'
```

**Expected Response**:
```json
{
  "id": "call-session-uuid-here",
  "businessId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "initiated",
  "startedAt": "2025-09-22T14:35:00Z",
  "questionsAsked": [],
  "costEstimate": 0
}
```

**Expected Database Changes**:
- New record in `call_sessions` with status 'initiated'
- New record in `call_events` with event_type 'initiated'
- New record in `telephony_provider_logs` for 46elks API call

### Step 4: Telephony Connection
**When**: 46elks places call to customer's phone

**Expected Webhook from 46elks**:
```bash
curl -X POST https://api.vocilia.com/v1/calls/webhooks/telephony \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "call_answered",
    "callId": "46elks-call-id-123",
    "sessionId": "call-session-uuid-here",
    "timestamp": "2025-09-22T14:35:15Z",
    "data": {
      "answerTime": "2025-09-22T14:35:15Z",
      "callDuration": 0
    }
  }'
```

**Expected Database Changes**:
- `call_sessions.status` updated to 'in_progress'
- `call_sessions.connected_at` set to answer time
- New `call_events` record with event_type 'answered'

### Step 5: AI Conversation Flow
**Expected AI Introduction** (in Swedish):
> "Hej Anna! Jag är en AI-assistent från ICA Maxi Linköping. Tack för att du handlade hos oss idag. Jag skulle vilja ställa några korta frågor om din upplevelse, det tar bara en minut. Är det okej?"

**Expected Customer Consent**:
> "Ja, det är bra."

**Expected First Question**:
> "Hur var din upplevelse av vårt kött- och charkavdelning idag?"

**Expected Customer Response**:
> "Det var bra, personalen var hjälpsam och köttet såg fräscht ut."

**Expected Database Changes**:
- New `call_responses` record with question and response
- `call_events` records for question_asked and response_received

### Step 6: Duration Monitoring
**At 90 seconds**: System sends warning
**Expected AI Warning**:
> "Vi har tid för en sista snabb fråga."

**Expected Final Question**:
> "Vad tycker du om våra öppettider?"

**Expected Customer Response**:
> "De är bra, öppet tillräckligt länge."

### Step 7: Call Completion
**At 110 seconds**: System initiates graceful ending

**Expected AI Conclusion**:
> "Tack så mycket för dina svar, Anna! Din feedback hjälper oss att förbättra oss. Ha en bra dag!"

**Expected Database Changes**:
- `call_sessions.status` updated to 'completed'
- `call_sessions.ended_at` set to completion time
- `call_sessions.duration_seconds` set to actual duration
- Final `call_events` record with event_type 'completed'

### Step 8: Status Verification
**API Call**:
```bash
curl -X GET https://api.vocilia.com/v1/calls/call-session-uuid-here/status \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

**Expected Response**:
```json
{
  "id": "call-session-uuid-here",
  "businessId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "startedAt": "2025-09-22T14:35:00Z",
  "connectedAt": "2025-09-22T14:35:15Z",
  "endedAt": "2025-09-22T14:37:05Z",
  "durationSeconds": 110,
  "questionsAsked": [
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-12d3-a456-426614174001"
  ],
  "costEstimate": 0.12,
  "recordingUrl": "https://recordings.46elks.com/path/to/recording"
}
```

## Validation Checklist

### ✅ Call Session Management
- [ ] Call can be initiated for verified customer
- [ ] Call status updates correctly through lifecycle
- [ ] Call duration is monitored and enforced (≤120 seconds)
- [ ] Call events are logged with proper timestamps
- [ ] Call costs are tracked and estimated

### ✅ Question Selection Logic
- [ ] Questions are selected based on customer frequency
- [ ] Multiple questions are combined within time budget
- [ ] High priority questions are favored
- [ ] Business context is considered in selection

### ✅ AI Integration
- [ ] GPT-4o-mini responds in Swedish language
- [ ] Conversation follows structured interview flow
- [ ] AI obtains customer consent before proceeding
- [ ] AI handles time constraints gracefully
- [ ] Responses are transcribed accurately

### ✅ Telephony Integration
- [ ] 46elks successfully places outbound calls
- [ ] Call events are received via webhooks
- [ ] Call recording is enabled and accessible
- [ ] Swedish phone numbers are handled correctly

### ✅ Database Operations
- [ ] All entities are created with proper relationships
- [ ] RLS policies prevent unauthorized access
- [ ] State transitions follow defined rules
- [ ] Event timestamps are chronological

### ✅ Error Handling
- [ ] Customer doesn't answer → status 'failed'
- [ ] AI service failure → graceful fallback
- [ ] Timeout exceeded → status 'timeout'
- [ ] Invalid requests return proper error codes

## Success Criteria
1. **Functional**: Complete call from initiation to completion in ≤120 seconds
2. **Technical**: All API endpoints respond within SLA (p95 < 500ms)
3. **Business**: Customer feedback is collected and stored accurately
4. **Cost**: Call costs remain within budget (≤$0.25 per call)
5. **Quality**: AI conversation is natural and professional in Swedish

## Performance Benchmarks
- **Call Initiation**: <5 seconds from API call to customer phone ringing
- **AI Response**: <2 seconds from customer speech to AI response
- **Question Selection**: <100ms for algorithm execution
- **Database Operations**: <50ms for standard queries
- **Webhook Processing**: <200ms for event handling

## Test Data Cleanup
After validation, ensure test data is properly cleaned:
```sql
-- Remove test call sessions and related data
DELETE FROM call_responses WHERE call_session_id IN (
  SELECT id FROM call_sessions WHERE customer_phone = '+46701234567'
);
DELETE FROM call_events WHERE call_session_id IN (
  SELECT id FROM call_sessions WHERE customer_phone = '+46701234567'
);
DELETE FROM call_sessions WHERE customer_phone = '+46701234567';
```

---

**This quickstart validates all functional requirements and confirms the system is ready for production deployment.**