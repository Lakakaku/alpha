# Quickstart: QR Code Landing & Verification System

**Date**: 2025-09-22  
**Feature**: Customer verification flow testing and validation

## Quick Validation Tests

### **Prerequisites**

```bash
# Ensure services are running
pnpm dev                    # Start all services
supabase start             # Local Supabase instance
```

### **Environment Setup**

```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
API_BASE_URL=http://localhost:3001  # Backend API
```

## User Story Validation Tests

### **Test 1: Successful QR Scan and Verification**

**User Story**: Customer scans QR code and completes verification within
tolerance

**Steps**:

1. **Generate Test QR Code**:

   ```bash
   curl -X POST http://localhost:3001/api/qr/generate \
     -H "Content-Type: application/json" \
     -d '{"store_id": "550e8400-e29b-41d4-a716-446655440000"}'
   ```

2. **Scan QR Code** (simulate by visiting URL):

   ```
   http://localhost:3000/feedback/550e8400-e29b-41d4-a716-446655440000?v=1&t=1703097600
   ```

3. **Verify Landing Page**:
   - ✅ Store name displayed correctly
   - ✅ Mobile-optimized form layout
   - ✅ All three input fields present (time, amount, phone)
   - ✅ Current time pre-populated in time field

4. **Submit Valid Form**:

   ```javascript
   // Form data within tolerance
   {
     "transaction_time": "14:32",        // Current time ±1 minute
     "transaction_amount": 125.50,       // Any reasonable amount
     "phone_number": "070-123 45 67"     // Valid Swedish mobile
   }
   ```

5. **Expected Results**:
   - ✅ Form submission succeeds
   - ✅ Success message displayed
   - ✅ Verification ID returned
   - ✅ All validation statuses = "valid"

### **Test 2: Time Tolerance Validation**

**User Story**: Customer enters time outside ±2 minute tolerance

**Steps**:

1. **Submit Form with Out-of-Range Time**:

   ```javascript
   {
     "transaction_time": "14:25",        // >2 minutes ago if current is 14:32
     "transaction_amount": 125.50,
     "phone_number": "070-123 45 67"
   }
   ```

2. **Expected Results**:
   - ❌ Form validation fails
   - ✅ Error message: "Time must be within 2 minutes of transaction
     (14:30-14:34)"
   - ✅ time_validation.status = "out_of_tolerance"
   - ✅ Form remains editable for correction

### **Test 3: Amount Tolerance Validation**

**User Story**: Customer enters amount outside ±2 SEK tolerance

**Steps**:

1. **Submit Form with Out-of-Range Amount**:

   ```javascript
   {
     "transaction_time": "14:32",
     "transaction_amount": 120.00,       // >2 SEK difference from expected 125.50
     "phone_number": "070-123 45 67"
   }
   ```

2. **Expected Results**:
   - ❌ Form validation fails
   - ✅ Error message: "Amount should be within 2 SEK of receipt total
     (123.50-127.50 SEK)"
   - ✅ amount_validation.status = "out_of_tolerance"
   - ✅ Tolerance range displayed to user

### **Test 4: Swedish Phone Number Validation**

**User Story**: Customer enters invalid phone number format

**Steps**:

1. **Test Invalid Formats**:

   ```javascript
   // Test cases
   ;[
     '123-456-7890', // US format
     '08-123 45 67', // Swedish landline
     '060-123 45 67', // Invalid mobile prefix
     '+1-555-123-4567', // International non-Swedish
     '07012345', // Too short
     '070-123-45-678', // Too long
   ]
   ```

2. **Expected Results**:
   - ❌ Form validation fails for all invalid formats
   - ✅ Error message: "Please enter a valid Swedish mobile number (070-123 45
     67)"
   - ✅ phone_validation.status = "invalid_format" or "not_swedish"

### **Test 5: Invalid QR Code Handling**

**User Story**: Customer scans corrupted or invalid QR code

**Steps**:

1. **Test Invalid QR URLs**:

   ```bash
   # Non-existent store ID
   http://localhost:3000/feedback/invalid-uuid

   # Invalid QR version
   http://localhost:3000/feedback/550e8400-e29b-41d4-a716-446655440000?v=999999999

   # Missing required parameters
   http://localhost:3000/feedback/550e8400-e29b-41d4-a716-446655440000
   ```

2. **Expected Results**:
   - ✅ Error page displayed with clear message
   - ✅ "Try Again" and "Go Back" buttons present
   - ✅ No form displayed for invalid QR codes
   - ✅ Fraud detection logged for invalid attempts

## API Contract Validation

### **API Test 1: QR Verification Initialization**

```bash
# Test successful QR verification
curl -X POST http://localhost:3001/api/v1/qr/verify/550e8400-e29b-41d4-a716-446655440000?v=1&t=1703097600 \
  -H "Content-Type: application/json" \
  -d '{
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
  }'

# Expected response (200 OK):
{
  "success": true,
  "session_token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "store_info": {
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "store_name": "ICA Supermarket Vasastan",
    "business_name": "ICA Sverige AB",
    "logo_url": "https://cdn.vocilia.com/logos/ica-vasastan.png"
  },
  "fraud_warning": false
}
```

### **API Test 2: Customer Verification Submission**

```bash
# Test successful verification submission
curl -X POST http://localhost:3001/api/v1/verification/submit \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: abc123def456ghi789jkl012mno345pqr678stu901vwx234yz" \
  -d '{
    "transaction_time": "14:32",
    "transaction_amount": 125.50,
    "phone_number": "070-123 45 67"
  }'

# Expected response (200 OK):
{
  "success": true,
  "verification_id": "110e8400-e29b-41d4-a716-446655440000",
  "validation_results": {
    "time_validation": {
      "status": "valid",
      "difference_minutes": 1,
      "tolerance_range": "14:30 - 14:34"
    },
    "amount_validation": {
      "status": "valid",
      "difference_sek": 1.50,
      "tolerance_range": "123.50 - 127.50 SEK"
    },
    "phone_validation": {
      "status": "valid",
      "e164_format": "+46701234567",
      "national_format": "070-123 45 67"
    },
    "overall_valid": true
  },
  "next_steps": "Your verification is complete. You'll receive a feedback call within 24 hours."
}
```

### **API Test 3: Session Details Retrieval**

```bash
# Test session details retrieval
curl -X GET http://localhost:3001/api/v1/verification/session/abc123def456ghi789jkl012mno345pqr678stu901vwx234yz

# Expected response (200 OK):
{
  "session_id": "220e8400-e29b-41d4-a716-446655440000",
  "store_info": {
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "store_name": "ICA Supermarket Vasastan",
    "business_name": "ICA Sverige AB",
    "logo_url": "https://cdn.vocilia.com/logos/ica-vasastan.png"
  },
  "status": "pending",
  "qr_version": 1,
  "created_at": "2025-09-22T14:30:00Z",
  "expires_at": "2025-09-22T15:00:00Z"
}
```

## Database Validation Tests

### **Data Integrity Test 1: Verification Session Creation**

```sql
-- Verify session record created correctly
SELECT
    id,
    store_id,
    qr_version,
    status,
    session_token,
    created_at
FROM verification_sessions
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Single record with status='pending'
```

### **Data Integrity Test 2: Customer Verification Record**

```sql
-- Verify customer verification data saved correctly
SELECT
    cv.id,
    cv.transaction_time,
    cv.transaction_amount,
    cv.phone_number_e164,
    cv.time_validation_status,
    cv.amount_validation_status,
    cv.phone_validation_status,
    vs.session_token
FROM customer_verifications cv
JOIN verification_sessions vs ON cv.session_id = vs.id
WHERE vs.session_token = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';

-- Expected: Single record with all validation statuses = 'valid'
```

### **Data Integrity Test 3: RLS Policy Enforcement**

```sql
-- Test Row Level Security policies
SET request.jwt.claims = '{"role": "anon"}';
SET request.headers = '{"session-token": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"}';

-- Should return only sessions for this token
SELECT COUNT(*) FROM verification_sessions;

-- Reset settings
RESET request.jwt.claims;
RESET request.headers;
```

## Performance Validation

### **Load Test: Form Submission**

```bash
# Test concurrent form submissions
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/v1/verification/submit \
    -H "Content-Type: application/json" \
    -H "X-Session-Token: session-token-$i" \
    -d '{"transaction_time": "14:32", "transaction_amount": 125.50, "phone_number": "070-123 45 67"}' &
done
wait

# Expected: All requests complete within 500ms
```

### **Mobile Performance Test**

```bash
# Test page load performance
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/feedback/550e8400-e29b-41d4-a716-446655440000?v=1&t=1703097600

# Expected:
# - time_total < 2.0s
# - time_connect < 0.1s
# - time_starttransfer < 0.5s
```

## Security Validation

### **Security Test 1: Session Token Validation**

```bash
# Test with invalid session token
curl -X POST http://localhost:3001/api/v1/verification/submit \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: invalid-token" \
  -d '{"transaction_time": "14:32", "transaction_amount": 125.50, "phone_number": "070-123 45 67"}'

# Expected: 401 Unauthorized
```

### **Security Test 2: Rate Limiting**

```bash
# Test rate limiting (10+ requests from same IP)
for i in {1..15}; do
  curl -X POST http://localhost:3001/api/v1/qr/verify/550e8400-e29b-41d4-a716-446655440000?v=1&t=1703097600 \
    -H "Content-Type: application/json" \
    -d '{"ip_address": "192.168.1.100", "user_agent": "test"}'
done

# Expected: 429 Rate Limit Exceeded after 10 requests
```

### **Security Test 3: Input Sanitization**

```bash
# Test SQL injection attempt
curl -X POST http://localhost:3001/api/v1/verification/submit \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: valid-token" \
  -d '{
    "transaction_time": "14:32'\'' OR 1=1--",
    "transaction_amount": 125.50,
    "phone_number": "070-123 45 67"
  }'

# Expected: 400 Bad Request with validation error
```

## Success Criteria Checklist

- [ ] **QR Code Landing**: Store information displays correctly from QR scan
- [ ] **Mobile Interface**: Form displays optimally on mobile devices (320px+)
- [ ] **Time Validation**: ±2 minute tolerance enforced with clear error
      messages
- [ ] **Amount Validation**: ±2 SEK tolerance enforced with range display
- [ ] **Phone Validation**: Swedish mobile numbers validated with Swish
      compatibility
- [ ] **Error Handling**: Invalid QR codes show helpful error messages
- [ ] **Performance**: Page loads <2s, API responses <500ms
- [ ] **Security**: RLS policies enforced, input sanitization active
- [ ] **API Contracts**: All endpoints return documented response formats
- [ ] **Database Integrity**: All foreign keys and constraints working
- [ ] **Accessibility**: Form usable with screen readers and keyboard navigation
