# Quickstart Guide: Swish Payment Integration Testing

**Feature**: 019-step-6-1 | **Created**: 2025-09-25 | **Prerequisites**:
[data-model.md](./data-model.md), [contracts/](./contracts/)

## Overview

This quickstart provides step-by-step scenarios to test the Swish payment
integration system from feedback submission through reward calculation, batch
processing, and reconciliation reporting.

## Prerequisites

### Environment Setup

1. **Database**: Supabase PostgreSQL with payment schema migrated
2. **Backend**: Railway deployment with payment services
3. **Admin Dashboard**: Vercel deployment with payment UI
4. **Mock Swish**: Mock Swish client configured (no real merchant account
   needed)
5. **Test Data**: At least 3 stores, 2 businesses, 10 customers with valid
   Swedish phone numbers

### Required Environment Variables

```bash
# Railway backend
SWISH_MERCHANT_NUMBER=1234567890  # Mock value
SWISH_API_URL=http://localhost:3000/mock-swish  # Mock endpoint
SWISH_CERTIFICATE_PATH=/path/to/mock/cert.pem  # Mock cert
DATABASE_URL=postgresql://...  # Supabase connection string
CRON_TIMEZONE=Europe/Stockholm

# Admin dashboard
NEXT_PUBLIC_API_URL=https://api.vocilia.com
```

## Scenario 1: End-to-End Weekly Payment Flow

**Goal**: Verify complete workflow from feedback submission to customer payment.

### Step 1.1: Submit and Verify Feedback

```bash
# Customer submits feedback via AI phone call (quality score 85)
curl -X POST https://api.vocilia.com/api/feedback/submit \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "467012345678",
    "storeId": "e5f6a7b8-c9d0-1234-ef12-345678901234",
    "transactionId": "d4e5f6a7-b8c9-0123-def1-234567890123",
    "feedbackContent": "Excellent service, very helpful staff...",
    "qualityScore": 85
  }'

# Expected: Feedback stored with quality score 85
```

### Step 1.2: Business Verifies Transaction

```bash
# Business admin verifies transaction as legitimate
curl -X POST https://api.vocilia.com/api/business/transactions/verify \
  -H "Authorization: Bearer {business_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "d4e5f6a7-b8c9-0123-def1-234567890123",
    "verified": true
  }'

# Expected: Transaction marked as verified_by_business = true
```

### Step 1.3: Calculate Rewards

```bash
# Admin triggers reward calculation (or automatic after verification)
curl -X POST https://api.vocilia.com/api/admin/payments/calculate-rewards \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]
  }'

# Expected Response:
{
  "success": true,
  "processedCount": 1,
  "totalRewardAmountSek": 22.20,
  "calculations": [
    {
      "feedbackId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "qualityScore": 85,
      "rewardPercentage": 0.111,  # (85-50)/(100-50) * (0.15-0.02) + 0.02
      "transactionAmountSek": 200.00,
      "rewardAmountSek": 22.20,
      "verifiedByBusiness": true
    }
  ]
}
```

### Step 1.4: Trigger Weekly Batch (Sunday 00:00)

```bash
# Manually trigger batch processing (normally via cron)
curl -X POST https://api.vocilia.com/api/admin/payments/process-batch \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "batchWeek": "2025-W09"
  }'

# Expected Response:
{
  "success": true,
  "batchId": "f6a7b8c9-d0e1-2345-f123-456789012345",
  "batchWeek": "2025-W09",
  "status": "processing",
  "estimatedCustomers": 1,
  "estimatedAmountSek": 22.20,
  "startedAt": "2025-09-25T00:00:00Z"
}
```

### Step 1.5: Monitor Batch Progress

```bash
# Check batch status
curl -X GET https://api.vocilia.com/api/admin/payments/batch/f6a7b8c9-d0e1-2345-f123-456789012345 \
  -H "Authorization: Bearer {admin_token}"

# Expected Response (after completion):
{
  "success": true,
  "batch": {
    "id": "f6a7b8c9-d0e1-2345-f123-456789012345",
    "batchWeek": "2025-W09",
    "status": "completed",
    "totalCustomers": 1,
    "totalTransactions": 1,
    "totalAmountSek": 22.20,
    "successfulPayments": 1,
    "failedPayments": 0,
    "successRate": 100.00,
    "startedAt": "2025-09-25T00:00:00Z",
    "completedAt": "2025-09-25T00:01:15Z",
    "processingDurationSeconds": 75
  }
}
```

### Step 1.6: Verify Reconciliation Report

```bash
# Get reconciliation report
curl -X GET https://api.vocilia.com/api/admin/payments/reconciliation/f6a7b8c9-d0e1-2345-f123-456789012345 \
  -H "Authorization: Bearer {admin_token}"

# Expected Response:
{
  "success": true,
  "report": {
    "batchId": "f6a7b8c9-d0e1-2345-f123-456789012345",
    "reportPeriod": "2025-W09",
    "totalRewardsPaidSek": 22.20,
    "adminFeesCollectedSek": 4.44,  # 20% of 22.20
    "paymentSuccessCount": 1,
    "paymentFailureCount": 0,
    "paymentSuccessRate": 100.00,
    "discrepancyCount": 0,
    "businessInvoiceTotalSek": 26.64,  # 22.20 + 4.44
    "storeBreakdown": [
      {
        "storeId": "e5f6a7b8-c9d0-1234-ef12-345678901234",
        "storeName": "Store A",
        "feedbackCount": 1,
        "verifiedCount": 1,
        "totalRewardsSek": 22.20,
        "successfulPayments": 1
      }
    ]
  }
}
```

**✅ Success Criteria**:

- Reward calculation: 11.1% of 200 SEK = 22.20 SEK
- Payment status: successful
- Reconciliation: 0 discrepancies
- Business invoice: 26.64 SEK (reward + 20% admin fee)

---

## Scenario 2: Multiple Stores Aggregation

**Goal**: Verify weekly aggregation across 3 stores for same customer.

### Step 2.1: Create Test Data

```sql
-- Insert 3 feedback submissions from same customer (467012345678)
-- Store A: 100 SEK transaction, quality score 70 → 7.2% reward → 7.20 SEK
-- Store B: 200 SEK transaction, quality score 85 → 11.1% reward → 22.20 SEK
-- Store C: 150 SEK transaction, quality score 95 → 14.6% reward → 21.90 SEK

-- All verified by respective businesses
-- Expected total: 51.30 SEK aggregated payment
```

### Step 2.2: Process Batch

```bash
curl -X POST https://api.vocilia.com/api/admin/payments/process-batch \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"batchWeek": "2025-W09"}'

# Expected: Single payment transaction for 51.30 SEK to 467012345678
```

### Step 2.3: Verify Customer History

```bash
curl -X GET https://api.vocilia.com/api/admin/payments/customer/467012345678 \
  -H "Authorization: Bearer {admin_token}"

# Expected Response:
{
  "success": true,
  "customerPhone": "467012345678",
  "summary": {
    "totalPaymentsReceived": 1,
    "totalAmountSek": 51.30,
    "successfulPayments": 1,
    "totalFeedbackSubmissions": 3,
    "avgQualityScore": 83.33,
    "uniqueStoresVisited": 3
  },
  "transactions": [
    {
      "batchWeek": "2025-W09",
      "amountSek": 51.30,
      "status": "successful",
      "rewardCount": 3,
      "storeNames": ["Store A", "Store B", "Store C"]
    }
  ]
}
```

**✅ Success Criteria**:

- Single aggregated payment: 51.30 SEK
- Reward count: 3 submissions
- Store count: 3 unique stores
- Customer receives one payment, not three

---

## Scenario 3: Quality Score Threshold and Mapping

**Goal**: Verify quality score to reward percentage mapping.

### Test Cases

| Quality Score | Expected Reward % | Formula                                       |
| ------------- | ----------------- | --------------------------------------------- |
| 49            | 0%                | Below threshold                               |
| 50            | 2%                | Minimum: (50-50)/(100-50) × 13% + 2% = 2%     |
| 75            | 8.5%              | Mid-range: (75-50)/(100-50) × 13% + 2% = 8.5% |
| 85            | 11.1%             | High: (85-50)/(100-50) × 13% + 2% = 11.1%     |
| 100           | 15%               | Maximum: (100-50)/(100-50) × 13% + 2% = 15%   |

### Step 3.1: Test Below Threshold

```bash
# Submit feedback with quality score 49
# Expected: No reward calculation created (score < 50)

# Verify in database:
SELECT COUNT(*) FROM reward_calculations
WHERE quality_score < 50;
# Expected: 0 rows
```

### Step 3.2: Test Boundary Cases

```bash
# Submit feedback with quality score 50 on 100 SEK transaction
# Expected: 2% reward = 2.00 SEK

# Submit feedback with quality score 100 on 100 SEK transaction
# Expected: 15% reward = 15.00 SEK

curl -X POST https://api.vocilia.com/api/admin/payments/calculate-rewards \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"feedbackIds": ["score50-uuid", "score100-uuid"]}'

# Verify calculations match expected percentages
```

**✅ Success Criteria**:

- Score 49: No reward
- Score 50: Exactly 2%
- Score 75: Exactly 8.5%
- Score 100: Exactly 15%
- Linear interpolation verified for all intermediate scores

---

## Scenario 4: Payment Failure and Retry

**Goal**: Verify automatic retry with exponential backoff.

### Step 4.1: Simulate Payment Failure

```bash
# Configure mock Swish to return failure for specific phone
# POST to mock Swish admin endpoint
curl -X POST http://localhost:3000/mock-swish/admin/simulate-failure \
  -d '{
    "phone": "467099999999",
    "errorCode": "INVALID_PHONE_NUMBER",
    "failureCount": 2  # Fail first 2 attempts, succeed on 3rd
  }'
```

### Step 4.2: Process Batch with Failing Payment

```bash
curl -X POST https://api.vocilia.com/api/admin/payments/process-batch \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"batchWeek": "2025-W09"}'

# Expected: Batch starts, payment fails, automatic retry scheduled
```

### Step 4.3: Monitor Retry Attempts

```bash
# Check failed payments list
curl -X GET https://api.vocilia.com/api/admin/payments/failed \
  -H "Authorization: Bearer {admin_token}"

# Expected Response:
{
  "success": true,
  "failures": [
    {
      "paymentTransactionId": "c9d0e1f2-a3b4-5678-c123-456789012345",
      "customerPhone": "467099999999",
      "attemptNumber": 1,
      "failureReason": "Swish payment declined",
      "swishErrorCode": "INVALID_PHONE_NUMBER",
      "resolutionStatus": "retrying",
      "retryScheduledAt": "2025-09-25T00:01:00Z"  # 1 minute after first attempt
    }
  ]
}

# Wait for retry attempts:
# Attempt 1: Immediate (fails)
# Attempt 2: +1 minute (fails)
# Attempt 3: +2 minutes (succeeds)
# Attempt 4: Would be +4 minutes (not needed)
```

### Step 4.4: Verify Successful Retry

```bash
# After 3 minutes, check transaction status
curl -X GET https://api.vocilia.com/api/admin/payments/batch/f6a7b8c9-d0e1-2345-f123-456789012345 \
  -H "Authorization: Bearer {admin_token}"

# Expected: Payment now successful, retry_count = 2
```

**✅ Success Criteria**:

- First attempt fails immediately
- Retry 1 after 1 minute (exponential backoff: 2^0 = 1 min)
- Retry 2 after 2 minutes (exponential backoff: 2^1 = 2 min)
- Retry 3 succeeds
- Total retry count: 2 (initial attempt not counted)
- Payment status: successful

---

## Scenario 5: Manual Intervention for Failed Payment

**Goal**: Admin manually retries payment with updated phone number.

### Step 5.1: Create Permanently Failed Payment

```bash
# Configure mock to always fail for phone 467011111111
curl -X POST http://localhost:3000/mock-swish/admin/simulate-failure \
  -d '{
    "phone": "467011111111",
    "errorCode": "INVALID_PHONE_NUMBER",
    "failureCount": 999  # Always fail
  }'

# Process batch - payment will fail all 3 automatic retries
```

### Step 5.2: Admin Updates Phone and Retries

```bash
# Admin gets customer support ticket with corrected phone: 467022222222
curl -X POST https://api.vocilia.com/api/admin/payments/retry/c9d0e1f2-a3b4-5678-c123-456789012345 \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "updatedPhone": "467022222222",
    "adminNotes": "Customer provided corrected phone via support ticket #12345",
    "force": true
  }'

# Expected: Payment retried with new phone, succeeds
```

### Step 5.3: Verify Resolution

```bash
curl -X GET https://api.vocilia.com/api/admin/payments/failed \
  -H "Authorization: Bearer {admin_token}"

# Expected: failure record now shows resolutionStatus = "resolved"
```

**✅ Success Criteria**:

- Original phone fails 4 times (initial + 3 retries)
- Admin manually updates phone
- Retry with new phone succeeds
- Audit trail preserved in payment_failures table
- Admin notes recorded

---

## Scenario 6: Below Minimum Threshold (5 SEK)

**Goal**: Verify rewards below 5 SEK are carried forward.

### Step 6.1: Create Small Reward

```bash
# Customer feedback on 30 SEK transaction with quality score 60
# Expected reward: 4.2% × 30 SEK = 1.26 SEK (below 5 SEK threshold)
```

### Step 6.2: Process Week 1 Batch

```bash
curl -X POST https://api.vocilia.com/api/admin/payments/process-batch \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"batchWeek": "2025-W09"}'

# Expected: No payment created, reward stored but not paid
```

### Step 6.3: Verify No Payment Transaction

```sql
-- Check payment_transactions for customer
SELECT * FROM payment_transactions
WHERE customer_phone = '467033333333'
AND batch_id IN (
  SELECT id FROM payment_batches WHERE batch_week = '2025-W09'
);
-- Expected: 0 rows (payment below threshold)
```

### Step 6.4: Add More Rewards Week 2

```bash
# Customer submits feedback on 40 SEK transaction, quality score 70
# Expected reward: 7.2% × 40 SEK = 2.88 SEK
# Total pending: 1.26 + 2.88 = 4.14 SEK (still below threshold)

# Process Week 2 batch
# Expected: Still no payment
```

### Step 6.5: Exceed Threshold Week 3

```bash
# Customer submits feedback on 50 SEK transaction, quality score 65
# Expected reward: 5.9% × 50 SEK = 2.95 SEK
# Total pending: 1.26 + 2.88 + 2.95 = 7.09 SEK (exceeds 5 SEK threshold)

# Process Week 3 batch
# Expected: Single payment of 7.09 SEK for all 3 weeks combined
```

**✅ Success Criteria**:

- Week 1 (1.26 SEK): No payment, carried forward
- Week 2 (4.14 SEK total): No payment, carried forward
- Week 3 (7.09 SEK total): Payment created and sent
- Customer receives one aggregated payment after threshold met

---

## Scenario 7: Business Verification Filtering

**Goal**: Verify only business-verified feedback generates payments.

### Step 7.1: Submit Mixed Feedback

```bash
# Submit 5 feedback items for Store A:
# - Feedback 1: Verified by business ✅
# - Feedback 2: Verified by business ✅
# - Feedback 3: Marked fraudulent by business ❌
# - Feedback 4: Not yet verified ⏳
# - Feedback 5: Verified by business ✅
```

### Step 7.2: Calculate Rewards

```bash
curl -X POST https://api.vocilia.com/api/admin/payments/calculate-rewards \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"feedbackIds": ["fb1", "fb2", "fb3", "fb4", "fb5"]}'

# Expected: Only 3 reward calculations created (fb1, fb2, fb5)
# fb3: Excluded (fraudulent)
# fb4: Excluded (not verified)
```

### Step 7.3: Verify Reconciliation

```bash
curl -X GET https://api.vocilia.com/api/admin/payments/reconciliation/{batchId} \
  -H "Authorization: Bearer {admin_token}"

# Expected store breakdown:
{
  "storeBreakdown": [
    {
      "storeName": "Store A",
      "feedbackCount": 5,
      "verifiedCount": 3,  # Only verified feedback counted
      "totalRewardsSek": X  # Sum of 3 verified rewards only
    }
  ]
}
```

**✅ Success Criteria**:

- Only verified feedback generates rewards
- Fraudulent feedback excluded
- Unverified feedback excluded
- Store breakdown shows correct verified count

---

## Performance Validation

### Load Test: 10,000 Customers

```bash
# Generate 10,000 test customers with pending rewards
node scripts/generate-test-data.js --customers=10000

# Trigger batch processing
time curl -X POST https://api.vocilia.com/api/admin/payments/process-batch \
  -H "Authorization: Bearer {admin_token}"

# Expected performance:
# - Total duration: < 10 minutes (600 seconds)
# - Average: < 60ms per customer payment
# - Database queries: Batched upserts (not 10k individual INSERTs)
# - Memory usage: < 512 MB
```

**✅ Performance Targets**:

- Reward calculation: <500ms per feedback
- Batch processing: <10 minutes for 10k customers
- Payment API calls: <2s per Swish transaction
- Admin dashboard load: <2s for reconciliation reports

---

## Troubleshooting

### Issue: Batch Processing Stuck

```bash
# Check job lock status
SELECT * FROM payment_batches
WHERE job_lock_key IS NOT NULL
AND job_locked_at < NOW() - INTERVAL '30 minutes';

# Release stuck lock manually
UPDATE payment_batches
SET job_lock_key = NULL, job_locked_at = NULL
WHERE id = '{stuck_batch_id}';
```

### Issue: Swish Payment Failing

```bash
# Check mock Swish logs
curl -X GET http://localhost:3000/mock-swish/admin/logs

# Verify phone number format
SELECT customer_phone FROM payment_transactions
WHERE customer_phone !~ '^467\d{8}$';
# Expected: 0 rows (all valid Swedish mobile numbers)
```

### Issue: Reward Calculation Incorrect

```bash
# Verify quality score mapping
SELECT
  quality_score,
  reward_percentage,
  ROUND((quality_score - 50.0) / (100.0 - 50.0) * 0.13 + 0.02, 3) AS expected_percentage
FROM reward_calculations
WHERE reward_percentage != ROUND((quality_score - 50.0) / (100.0 - 50.0) * 0.13 + 0.02, 3);
# Expected: 0 rows (all calculations correct)
```

---

## Next Steps

After completing all scenarios:

1. **Production Swish Integration**: Replace mock client with real Swish
   merchant credentials
2. **Monitoring**: Set up alerts for failed payments, batch processing delays
3. **Business Training**: Train business admins on verification workflow
4. **Customer Communication**: Design Swish payment notification messages

---

_Based on spec.md acceptance scenarios and constitutional testing principles_
