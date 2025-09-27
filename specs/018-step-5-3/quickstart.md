# Quickstart: Fraud Detection & Security Testing

**Phase 1 Output** | **Date**: 2025-09-24 | **Feature**: 018-step-5-3

## Test Environment Setup

### Prerequisites

```bash
# Ensure Supabase is running
supabase status

# Backend API server running
cd apps/backend && pnpm dev

# Admin dashboard accessible
cd apps/admin && pnpm dev
```

### Test Data Setup

```sql
-- Insert test store with context window
INSERT INTO stores (id, name, business_id) VALUES
  ('test-store-001', 'Test Grocery Store', 'test-business-001');

INSERT INTO store_context_windows (store_id, context_data) VALUES
  ('test-store-001', '{"sections": ["dairy", "produce", "meat", "bakery"], "products": ["milk", "bread", "apples", "chicken"]}');

-- Insert test red flag keywords
INSERT INTO red_flag_keywords (keyword, category, severity_level, language_code) VALUES
  ('flying elephants', 'impossible', 8, 'en'),
  ('bomb', 'threats', 10, 'en'),
  ('terrorist attack', 'threats', 10, 'en');
```

## Fraud Detection Test Scenarios

### Scenario 1: Context-Based Legitimacy Analysis

**Test**: Nonsensical feedback detection

```bash
# Submit feedback with impossible content
curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "feedback_id": "test-fb-001",
    "feedback_content": "I saw flying elephants in the dairy section serving ice cream to unicorns",
    "phone_number_hash": "hash123test",
    "store_id": "test-store-001"
  }'
```

**Expected Result**:

```json
{
  "fraud_score": {
    "overall_score": 15,
    "context_score": 5,
    "keyword_score": 0,
    "behavioral_score": 50,
    "transaction_score": 50
  },
  "is_fraudulent": true,
  "reward_eligible": false,
  "analysis_breakdown": {
    "context_matches": [],
    "red_flags": [
      {
        "keyword": "flying elephants",
        "category": "impossible",
        "severity": 8
      }
    ]
  }
}
```

### Scenario 2: Red Flag Keyword Detection

**Test**: Security threat keyword detection

```bash
curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "feedback_id": "test-fb-002",
    "feedback_content": "There was a bomb in the bathroom, terrorist attack planned",
    "phone_number_hash": "hash456test",
    "store_id": "test-store-001"
  }'
```

**Expected Result**:

```json
{
  "fraud_score": {
    "overall_score": 0,
    "context_score": 50,
    "keyword_score": 0,
    "behavioral_score": 50,
    "transaction_score": 50
  },
  "is_fraudulent": true,
  "reward_eligible": false,
  "analysis_breakdown": {
    "red_flags": [
      {
        "keyword": "bomb",
        "category": "threats",
        "severity": 10
      },
      {
        "keyword": "terrorist attack",
        "category": "threats",
        "severity": 10
      }
    ]
  }
}
```

### Scenario 3: Behavioral Pattern Detection

**Test**: Multiple calls from same phone within 30 minutes

```bash
# First call
curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d '{
    "feedback_id": "test-fb-003a",
    "feedback_content": "Great service today",
    "phone_number_hash": "hash789test",
    "store_id": "test-store-001"
  }'

# Second call (within 30 minutes)
curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d '{
    "feedback_id": "test-fb-003b",
    "feedback_content": "Amazing experience",
    "phone_number_hash": "hash789test",
    "store_id": "test-store-001"
  }'
```

**Expected Result** (second call):

```json
{
  "fraud_score": {
    "overall_score": 45,
    "behavioral_score": 20
  },
  "is_fraudulent": true,
  "analysis_breakdown": {
    "behavioral_warnings": [
      {
        "pattern_type": "call_frequency",
        "risk_level": "high"
      }
    ]
  }
}
```

### Scenario 4: Legitimate Feedback Acceptance

**Test**: Normal, contextually accurate feedback

```bash
curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d '{
    "feedback_id": "test-fb-004",
    "feedback_content": "The milk in the dairy section was fresh and the bread from the bakery was delicious",
    "phone_number_hash": "hash999test",
    "store_id": "test-store-001"
  }'
```

**Expected Result**:

```json
{
  "fraud_score": {
    "overall_score": 85,
    "context_score": 95,
    "keyword_score": 100,
    "behavioral_score": 100,
    "transaction_score": 50
  },
  "is_fraudulent": false,
  "reward_eligible": true,
  "analysis_breakdown": {
    "context_matches": ["dairy", "milk", "bakery", "bread"]
  }
}
```

## Security Hardening Test Scenarios

### Scenario 5: RLS Policy Enforcement

**Test**: Unauthorized data access attempt

```bash
# Try to access audit logs without admin privileges
curl -X GET http://localhost:3001/api/security/audit-logs \
  -H "Authorization: Bearer ${CUSTOMER_TOKEN}"
```

**Expected Result**:

```json
{
  "error": "insufficient_permissions",
  "message": "Admin access required",
  "correlation_id": "uuid-here"
}
```

**Verification**: Check audit log was created

```bash
curl -X GET http://localhost:3001/api/security/audit-logs \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  | grep "authorization_violation"
```

### Scenario 6: Audit Logging System

**Test**: Admin action logging

```bash
# Perform admin action (add keyword)
curl -X POST http://localhost:3001/api/fraud/keywords \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "keyword": "test-word",
    "category": "nonsensical",
    "severity_level": 5
  }'

# Check audit log created
curl -X GET "http://localhost:3001/api/security/audit-logs?event_type=admin_action" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

**Expected Result**:

```json
{
  "logs": [
    {
      "event_type": "admin_action",
      "action_performed": "create_red_flag_keyword",
      "user_type": "admin",
      "result_status": "success",
      "event_metadata": {
        "keyword": "test-word",
        "category": "nonsensical"
      }
    }
  ]
}
```

### Scenario 7: Intrusion Detection

**Test**: Brute force detection

```bash
# Simulate multiple failed login attempts
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@test.com", "password": "wrong-password"}'
  sleep 1
done
```

**Expected Result**: After 5 failed attempts

```bash
# Check intrusion event created
curl -X GET http://localhost:3001/api/security/intrusion-events \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

```json
{
  "events": [
    {
      "event_type": "brute_force",
      "source_ip": "127.0.0.1",
      "severity_level": 8,
      "detection_method": "failed_login_threshold",
      "automated_response": {
        "action": "temporary_ip_block",
        "duration": "15m"
      },
      "admin_notified": true
    }
  ]
}
```

### Scenario 8: Data Encryption Verification

**Test**: Verify sensitive data encryption

```bash
# Check that phone numbers are encrypted in database
psql ${DATABASE_URL} -c "SELECT phone_number_hash FROM behavioral_patterns LIMIT 1;"
```

**Expected Result**: Hash values, not plaintext phone numbers

```
         phone_number_hash
------------------------------------
 $2b$10$abcdef1234567890...
```

## Performance Validation

### Scenario 9: Fraud Detection Performance

**Test**: Response time under load

```bash
# Test fraud detection speed
time curl -X POST http://localhost:3001/api/fraud/analyze \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -d '{
    "feedback_id": "perf-test-001",
    "feedback_content": "Normal feedback about store experience",
    "phone_number_hash": "perfhash001",
    "store_id": "test-store-001"
  }'
```

**Expected Result**: Response time < 500ms

### Scenario 10: Security Monitoring Performance

**Test**: Real-time alert generation speed

```bash
# Trigger security alert and measure response time
time curl -X POST http://localhost:3001/api/security/intrusion-events \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{
    "event_type": "unusual_access",
    "source_ip": "192.168.1.100",
    "severity_level": 7,
    "detection_method": "anomaly_detection"
  }'
```

**Expected Result**: Response time < 100ms, admin alert < 2s

## Cleanup

```bash
# Remove test data
psql ${DATABASE_URL} -c "DELETE FROM fraud_scores WHERE feedback_id LIKE 'test-fb-%';"
psql ${DATABASE_URL} -c "DELETE FROM red_flag_keywords WHERE keyword = 'test-word';"
psql ${DATABASE_URL} -c "DELETE FROM audit_logs WHERE correlation_id IN (SELECT correlation_id FROM audit_logs WHERE event_metadata->>'keyword' = 'test-word');"
```

## Success Criteria

### Fraud Detection

- ✅ Contextually impossible feedback scores < 20%
- ✅ Threat keywords immediately flagged (score = 0)
- ✅ Behavioral patterns detected within 30 minutes
- ✅ Legitimate feedback scores > 70%
- ✅ All fraud decisions logged with correlation IDs

### Security Hardening

- ✅ Unauthorized access blocked by RLS policies
- ✅ All admin actions logged with full audit trail
- ✅ Brute force attempts detected and blocked
- ✅ Sensitive data encrypted at rest
- ✅ Real-time security alerts generated

### Performance

- ✅ Fraud detection: < 500ms response time
- ✅ Security monitoring: < 100ms for alerts
- ✅ Audit log queries: < 1s with pagination
- ✅ System maintains performance under normal load

**Manual Testing Note**: Run these scenarios in sequence to validate complete
fraud detection and security hardening implementation. Each test should pass
independently and collectively demonstrate the system's security posture.
