# Security & Privacy Testing Quickstart Guide

**Feature**: Security & Privacy Testing Framework
**Date**: 2025-09-27
**Time to Complete**: ~45 minutes

## Prerequisites

### Environment Setup
- Node.js 18+ with pnpm package manager
- Access to Vocilia Alpha staging environment
- Security tester account with full admin permissions
- Test customer phone numbers for GDPR testing

### Required Dependencies
```bash
# Security testing tools
npm install -g owasp-zap
pnpm add --save-dev jest playwright supertest artillery

# Security testing libraries
pnpm add --save-dev @types/jest @types/supertest
```

### Environment Variables
```bash
export SECURITY_TEST_ENV=staging
export ADMIN_TOKEN=<full-admin-access-token>
export TEST_CUSTOMER_PHONE=<anonymized-test-phone>
export SUPABASE_URL=<staging-supabase-url>
export PERFORMANCE_LIMIT=10
```

## Test Scenario 1: Authentication Security Validation

**User Story**: Security tester validates that authentication barriers properly protect customer data access

**Duration**: ~10 minutes

### Steps

1. **Start Authentication Security Test Suite**
   ```bash
   curl -X POST https://staging-api.alpha.vocilia.com/api/security/test-suites/auth-security/execute \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "performance_limit": 10,
       "target_environment": "staging"
     }'
   ```

2. **Verify Brute Force Protection**
   - Attempt 50 rapid login attempts with invalid credentials
   - System MUST block attempts after 5 failures
   - System MUST log all attempts with source IP

3. **Test Session Hijacking Resistance**
   - Capture valid session token
   - Attempt to use token from different IP/browser
   - System MUST deny access and invalidate session

4. **Validate Password Reset Security**
   - Request password reset for admin account
   - Attempt to exploit reset token for account takeover
   - System MUST prevent unauthorized password changes

**Expected Results**:
- All authentication attacks blocked: ✅ PASS
- Security events logged: ✅ PASS
- Performance impact ≤10%: ✅ PASS

## Test Scenario 2: Data Privacy Protection Validation

**User Story**: Security tester confirms customer phone numbers are never exposed during business verification

**Duration**: ~12 minutes

### Steps

1. **Create Privacy Assessment**
   ```bash
   curl -X POST https://staging-api.alpha.vocilia.com/api/privacy/assessments \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "component_name": "business_verification_database",
       "data_flow_path": ["customer_input", "verification_processing", "business_delivery"],
       "personal_data_types": ["phone_number", "transaction_data"]
     }'
   ```

2. **Test Phone Number Protection**
   - Submit test feedback with customer phone number
   - Verify phone number not included in business verification export
   - Attempt SQL injection to access phone number table
   - System MUST deny all phone number access attempts

3. **Validate Feedback Anonymization**
   - Submit feedback containing personal identifiers
   - Verify anonymization removes all PII before business delivery
   - Test that feedback content value is preserved

4. **Test Transaction Data Inference Prevention**
   - Attempt to correlate transaction times across stores
   - Try to exploit ±2 minute/±2 SEK tolerances for data inference
   - System MUST prevent cross-store customer identification

**Expected Results**:
- Phone numbers never exposed: ✅ PASS
- Feedback properly anonymized: ✅ PASS
- Transaction correlation prevented: ✅ PASS

## Test Scenario 3: GDPR Compliance Verification

**User Story**: Security tester validates 72-hour GDPR deletion response time

**Duration**: ~15 minutes

### Steps

1. **Submit Test Deletion Request**
   ```bash
   curl -X POST https://staging-api.alpha.vocilia.com/api/gdpr/deletion-requests \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "customer_identifier": "test-customer-123",
       "deletion_scope": ["phone_number", "transaction_data", "feedback_content"],
       "test_mode": true
     }'
   ```

2. **Monitor Deletion Processing**
   - Track request through pending → in_progress → completed states
   - Verify processing stays within 72-hour limit
   - Confirm all audit trail entries created

3. **Verify Complete Data Deletion**
   ```bash
   curl -X POST https://staging-api.alpha.vocilia.com/api/gdpr/deletion-requests/{requestId}/verify \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   - Confirm all customer data removed from all tables
   - Verify no data remains in cache or logs
   - Check that business verification data excludes deleted customer

4. **Test Data Export Capability**
   - Request complete customer data export
   - Verify all personal data included in export
   - Confirm export format meets GDPR requirements

**Expected Results**:
- Deletion completed within 72 hours: ✅ PASS
- All data completely removed: ✅ PASS
- Export includes all customer data: ✅ PASS

## Test Scenario 4: AI Model Security Testing

**User Story**: Security tester validates AI feedback processing cannot expose system prompts or training data

**Duration**: ~8 minutes

### Steps

1. **Test Prompt Injection Attacks**
   - Submit feedback containing prompt injection attempts
   - Try to extract system prompts through feedback processing
   - Attempt to manipulate AI responses with malicious input
   - System MUST sanitize all input and prevent prompt leakage

2. **Validate Training Data Protection**
   - Attempt to extract AI training data through feedback analysis
   - Test for memorized training examples in AI responses
   - Verify model doesn't expose internal architecture details

3. **Test Model Security Boundaries**
   - Submit feedback designed to probe AI model limits
   - Attempt to cause AI to generate inappropriate content
   - Verify rate limiting prevents AI model abuse

**Expected Results**:
- Prompt injection blocked: ✅ PASS
- Training data protected: ✅ PASS
- Model boundaries enforced: ✅ PASS

## Test Scenario 5: Vulnerability Assessment Execution

**User Story**: Security tester runs comprehensive OWASP Top 10 vulnerability scan

**Duration**: ~5 minutes setup + 25 minutes automated scan

### Steps

1. **Initialize Weekly Vulnerability Scan**
   ```bash
   curl -X POST https://staging-api.alpha.vocilia.com/api/security/test-suites/owasp-scan/execute \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "performance_limit": 10,
       "target_environment": "staging",
       "scan_depth": "comprehensive"
     }'
   ```

2. **Monitor Scan Progress**
   - Check scan execution status every 5 minutes
   - Verify performance impact stays ≤10%
   - Confirm no service disruption during scan

3. **Review Vulnerability Report**
   ```bash
   curl -X GET https://staging-api.alpha.vocilia.com/api/security/vulnerabilities?severity=high \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   - Review all discovered vulnerabilities
   - Validate severity assessments
   - Confirm remediation timelines (24h critical, 72h high)

**Expected Results**:
- Scan completes successfully: ✅ PASS
- Performance impact ≤10%: ✅ PASS
- Vulnerabilities properly categorized: ✅ PASS

## System Performance Validation

### Performance Monitoring
Throughout all test scenarios, continuously monitor:

- **Response Times**: API responses must remain <500ms for CRUD operations
- **System Load**: CPU/memory usage increase ≤10% during testing
- **Database Performance**: Query times must not degrade >10%
- **Frontend Responsiveness**: Admin dashboard loads <2s during testing

### Performance Validation Commands
```bash
# Monitor API response times
artillery run qr-workflow-load.yml --target staging-api.alpha.vocilia.com

# Check database performance
SELECT pg_stat_activity FROM pg_stat_database WHERE datname = 'vocilia_staging';

# Validate frontend performance
lighthouse https://staging-admin.alpha.vocilia.com --chrome-flags="--headless"
```

## Success Criteria

### All Tests Must Pass
- ✅ Authentication attacks blocked and logged
- ✅ Customer phone numbers never exposed
- ✅ GDPR deletion within 72 hours
- ✅ AI model security boundaries enforced
- ✅ OWASP vulnerabilities identified and categorized
- ✅ Performance impact ≤10% throughout testing

### Compliance Requirements Met
- ✅ Swedish data protection requirements validated
- ✅ GDPR compliance verified with audit trails
- ✅ Security testing access properly logged
- ✅ All test artifacts stored for compliance review

## Troubleshooting

### Common Issues

**Authentication Test Failures**
- Verify admin token has full security testing permissions
- Check staging environment authentication service status
- Confirm test rate limits not exceeded

**Performance Impact >10%**
- Reduce test concurrency levels
- Schedule tests during low-traffic periods
- Check staging environment resource allocation

**GDPR Deletion Timeout**
- Verify deletion queue processing is active
- Check for blocking transactions or locks
- Confirm test customer data exists before deletion

### Support Contacts
- Security Team: security@vocilia.com
- DevOps Team: devops@vocilia.com
- Compliance Team: compliance@vocilia.com

## Post-Test Cleanup

### Data Cleanup
```bash
# Remove test customer data
curl -X DELETE https://staging-api.alpha.vocilia.com/api/testing/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Reset test environment state
pnpm run test:cleanup
```

### Report Generation
```bash
# Generate compliance report
curl -X GET https://staging-api.alpha.vocilia.com/api/security/reports/compliance \
  -H "Authorization: Bearer $ADMIN_TOKEN" > security-test-report.json
```

**Next Steps**: After successful completion, security testing framework is validated and ready for production deployment. Schedule weekly automated scans and configure alert notifications for security violations.