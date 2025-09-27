# Quickstart: Comprehensive Testing System

**Date**: 2025-09-26 **Feature**: Step 7.1 Comprehensive Testing Infrastructure

## Overview

This quickstart validates the comprehensive testing system implementation
through key user scenarios. Each scenario represents a critical testing workflow
that must function correctly.

## Prerequisites

- Existing Vocilia Alpha monorepo with customer/business/admin apps
- Supabase database with branch support
- Railway backend deployment
- Vercel frontend deployments
- Node.js 18+ with pnpm

## Test Environment Setup

### 1. Install Testing Dependencies

```bash
# Navigate to repository root
cd /path/to/vocilia-alpha

# Install testing dependencies across all packages
pnpm add -D jest @jest/globals ts-jest @types/jest
pnpm add -D playwright @playwright/test
pnpm add -D artillery faker @types/faker
pnpm add -D lighthouse ci

# Install testing types
pnpm --filter @vocilia/types add -D @types/testing-library__jest-dom
```

### 2. Create Test Configuration

```bash
# Create Jest configuration
cat > jest.config.js << EOF
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.contract.ts'
  ],
  collectCoverageFrom: [
    'apps/*/src/**/*.ts',
    'packages/*/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000
};
EOF

# Create Playwright configuration
cat > playwright.config.ts << EOF
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] }
    }
  ]
});
EOF

# Create Artillery configuration
cat > artillery.yml << EOF
config:
  target: 'http://localhost:3001'
  phases:
    - duration: 60
      arrivalRate: 10
  payload:
    path: 'tests/data/test-scenarios.csv'
scenarios:
  - name: 'QR Scan to Payment Flow'
    weight: 70
    flow:
      - get:
          url: '/api/qr/{{ qr_code }}'
      - post:
          url: '/api/verification'
          json:
            transactionTime: '{{ transaction_time }}'
            transactionValue: '{{ transaction_value }}'
            phoneNumber: '{{ phone_number }}'
      - post:
          url: '/api/feedback/call'
          json:
            verificationId: '{{ verification_id }}'
EOF
```

## Scenario Validation

### Scenario 1: Unit Test Suite Creation and Execution

**Purpose**: Validate individual component testing infrastructure

**Steps**:

1. Create a test suite for QR code generation
2. Add unit tests for QR generation logic
3. Execute tests with coverage reporting
4. Verify risk-based coverage targets are met

**Commands**:

```bash
# Create test suite
curl -X POST http://localhost:3001/api/test/suites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "name": "QR Code Generation Tests",
    "type": "unit",
    "component": "customer-app",
    "priority": "high",
    "coverageTarget": 85
  }'

# Create sample unit test
mkdir -p tests/unit/customer/qr
cat > tests/unit/customer/qr/qr-generator.test.ts << EOF
import { describe, test, expect } from '@jest/globals';
import { generateQRCode, validateQRCode } from '../../../../apps/customer/src/services/qr-service';

describe('QR Code Generation', () => {
  test('should generate valid QR code for store', () => {
    const storeId = 'store-123';
    const qrCode = generateQRCode(storeId);

    expect(qrCode).toBeDefined();
    expect(qrCode).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
    expect(validateQRCode(qrCode, storeId)).toBe(true);
  });

  test('should generate unique codes for different stores', () => {
    const qr1 = generateQRCode('store-1');
    const qr2 = generateQRCode('store-2');

    expect(qr1).not.toBe(qr2);
  });

  test('should handle invalid store IDs', () => {
    expect(() => generateQRCode('')).toThrow('Invalid store ID');
    expect(() => generateQRCode(null)).toThrow('Invalid store ID');
  });
});
EOF

# Run unit tests with coverage
pnpm test -- --coverage --testPathPattern=unit

# Verify coverage meets target (85%)
echo "✓ Coverage target verification"
```

**Expected Results**:

- Test suite created successfully (HTTP 201)
- Unit tests execute without errors
- Coverage report shows ≥85% for QR generation module
- All tests pass on first run

### Scenario 2: Integration Test Execution

**Purpose**: Validate end-to-end component interaction testing

**Steps**:

1. Create integration test suite for feedback flow
2. Test QR scan → verification → AI call integration
3. Validate database interactions and API responses
4. Verify error handling across components

**Commands**:

```bash
# Create integration test suite
curl -X POST http://localhost:3001/api/test/suites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "name": "Feedback Flow Integration Tests",
    "type": "integration",
    "component": "backend-api",
    "priority": "critical",
    "coverageTarget": 90
  }'

# Create sample integration test
mkdir -p tests/integration/feedback
cat > tests/integration/feedback/feedback-flow.test.ts << EOF
import { describe, test, expect, beforeEach } from '@jest/globals';
import { supabase } from '../../../packages/database/src/client/supabase';
import { QRService } from '../../../apps/backend/src/services/qr-service';
import { VerificationService } from '../../../apps/backend/src/services/verification-service';

describe('Feedback Flow Integration', () => {
  beforeEach(async () => {
    // Setup test data using synthetic generators
    await setupTestStore();
    await setupTestCustomer();
  });

  test('should complete full QR to verification flow', async () => {
    // 1. Generate QR code for test store
    const qrCode = await QRService.generateForStore('test-store-1');
    expect(qrCode).toBeDefined();

    // 2. Customer scans QR and gets verification page
    const scanResult = await QRService.processQRScan(qrCode);
    expect(scanResult.storeId).toBe('test-store-1');
    expect(scanResult.verificationUrl).toContain('/verification/');

    // 3. Customer submits verification data
    const verification = await VerificationService.submitVerification({
      storeId: 'test-store-1',
      transactionTime: new Date().toISOString(),
      transactionValue: 150,
      phoneNumber: '+46701234567'
    });

    expect(verification.status).toBe('pending');
    expect(verification.id).toBeDefined();

    // 4. Verify database state
    const { data: dbVerification } = await supabase
      .from('verification_records')
      .select('*')
      .eq('id', verification.id)
      .single();

    expect(dbVerification).toBeDefined();
    expect(dbVerification.status).toBe('pending');
  });

  test('should handle invalid verification data', async () => {
    const qrCode = await QRService.generateForStore('test-store-1');

    // Submit verification with invalid transaction value
    await expect(VerificationService.submitVerification({
      storeId: 'test-store-1',
      transactionTime: new Date().toISOString(),
      transactionValue: -50, // Invalid negative value
      phoneNumber: '+46701234567'
    })).rejects.toThrow('Invalid transaction value');
  });
});
EOF

# Run integration tests
pnpm test -- --testPathPattern=integration --runInBand

echo "✓ Integration test validation"
```

**Expected Results**:

- Integration tests connect to test database successfully
- QR generation and verification flow completes end-to-end
- Database state correctly reflects test operations
- Error handling tests pass for invalid inputs

### Scenario 3: End-to-End Browser Testing

**Purpose**: Validate complete user workflows in browser environment

**Steps**:

1. Launch customer app in test browser
2. Simulate QR code scanning workflow
3. Complete verification form submission
4. Validate mobile responsiveness
5. Test PWA functionality

**Commands**:

```bash
# Create E2E test suite
curl -X POST http://localhost:3001/api/test/suites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "name": "Customer App E2E Tests",
    "type": "e2e",
    "component": "customer-app",
    "priority": "high",
    "coverageTarget": 75
  }'

# Create sample E2E test
mkdir -p tests/e2e/customer
cat > tests/e2e/customer/qr-verification.spec.ts << EOF
import { test, expect } from '@playwright/test';

test.describe('QR Code to Verification Flow', () => {
  test('should complete verification on mobile device', async ({ page }) => {
    // Navigate to customer app
    await page.goto('/');

    // Verify PWA is properly configured
    await expect(page).toHaveTitle(/Vocilia/);

    // Simulate QR code scan by navigating to verification page
    await page.goto('/qr/test-store-qr-code');

    // Verify store information is displayed
    await expect(page.locator('[data-testid="store-name"]')).toContainText('Test Store');

    // Fill verification form
    await page.fill('[data-testid="transaction-time"]', '2025-09-26T14:30:00');
    await page.fill('[data-testid="transaction-value"]', '150');
    await page.fill('[data-testid="phone-number"]', '+46701234567');

    // Submit form
    await page.click('[data-testid="submit-verification"]');

    // Verify submission success
    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="call-notification"]')).toContainText('You will receive a call');

    // Verify page performance
    const performanceTiming = await page.evaluate(() => performance.now());
    expect(performanceTiming).toBeLessThan(3000); // <3s page load requirement
  });

  test('should validate form inputs', async ({ page }) => {
    await page.goto('/qr/test-store-qr-code');

    // Try to submit empty form
    await page.click('[data-testid="submit-verification"]');

    // Verify validation errors
    await expect(page.locator('[data-testid="error-transaction-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-transaction-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-phone-number"]')).toBeVisible();

    // Fill invalid data
    await page.fill('[data-testid="transaction-value"]', '-50');
    await page.fill('[data-testid="phone-number"]', 'invalid-phone');

    await page.click('[data-testid="submit-verification"]');

    // Verify specific validation messages
    await expect(page.locator('[data-testid="error-transaction-value"]')).toContainText('must be positive');
    await expect(page.locator('[data-testid="error-phone-number"]')).toContainText('valid Swedish phone number');
  });
});
EOF

# Run E2E tests
npx playwright test

echo "✓ E2E test validation"
```

**Expected Results**:

- Browser tests launch successfully on desktop and mobile viewports
- QR verification form functions correctly
- Form validation works as expected
- Page load times meet <3s requirement
- PWA features are accessible

### Scenario 4: Performance Testing

**Purpose**: Validate system performance under load

**Steps**:

1. Create performance benchmark targets
2. Execute load testing scenarios
3. Validate API response times <1s
4. Verify page load times <3s
5. Check error rates under load

**Commands**:

```bash
# Create performance benchmarks
curl -X POST http://localhost:3001/api/test/performance/benchmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "operation": "qr-scan",
    "component": "customer-app",
    "metric": "page-load",
    "target": 3000,
    "unit": "ms",
    "threshold": {
      "warning": 2500,
      "critical": 3000
    },
    "environment": "test"
  }'

curl -X POST http://localhost:3001/api/test/performance/benchmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{
    "operation": "verification-submit",
    "component": "backend-api",
    "metric": "response-time",
    "target": 1000,
    "unit": "ms",
    "threshold": {
      "warning": 800,
      "critical": 1000
    },
    "environment": "test"
  }'

# Generate test data for performance testing
cat > tests/data/test-scenarios.csv << EOF
qr_code,transaction_time,transaction_value,phone_number
test-qr-1,2025-09-26T14:30:00,150,+46701234567
test-qr-2,2025-09-26T14:31:00,200,+46701234568
test-qr-3,2025-09-26T14:32:00,75,+46701234569
EOF

# Run performance tests
artillery run artillery.yml

# Run Lighthouse performance audit
lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-audit.json

echo "✓ Performance test validation"
```

**Expected Results**:

- Load testing completes without errors
- Average API response time <1000ms
- 95th percentile response time <1500ms
- Lighthouse Performance score >90
- Error rate <1% under normal load

### Scenario 5: Automated Test Run on Commit

**Purpose**: Validate continuous testing pipeline

**Steps**:

1. Trigger automated test run
2. Verify all test types execute in sequence
3. Check deployment blocking on failures
4. Validate test reporting and coverage

**Commands**:

```bash
# Trigger test run for current commit
COMMIT_SHA=$(git rev-parse HEAD)
curl -X POST http://localhost:3001/api/test/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d "{
    \"triggerType\": \"commit\",
    \"triggerReference\": \"$COMMIT_SHA\",
    \"branch\": \"021-step-7-1\",
    \"suiteIds\": []
  }"

# Monitor test run progress
RUN_ID=$(curl -s http://localhost:3001/api/test/runs?limit=1 | jq -r '.[0].id')
echo "Monitoring test run: $RUN_ID"

# Wait for completion and check results
while true; do
  STATUS=$(curl -s http://localhost:3001/api/test/runs/$RUN_ID | jq -r '.status')
  echo "Current status: $STATUS"

  if [[ "$STATUS" == "passed" || "$STATUS" == "failed" || "$STATUS" == "cancelled" ]]; then
    break
  fi

  sleep 10
done

# Get final results
curl -s http://localhost:3001/api/test/runs/$RUN_ID/results | jq '.'

# Generate test report
curl -s http://localhost:3001/api/test/reports/$RUN_ID?format=json | jq '.'

echo "✓ Automated testing pipeline validation"
```

**Expected Results**:

- Test run triggers successfully for commit
- All test suites execute in correct order (unit → integration → E2E →
  performance)
- Coverage targets are met for each component
- Test results are properly recorded and accessible
- Reports are generated in multiple formats

## Success Criteria

### ✅ Test Infrastructure

- [ ] Jest configuration supports TypeScript across monorepo
- [ ] Playwright E2E testing works on mobile and desktop
- [ ] Artillery performance testing executes load scenarios
- [ ] Test data generators create realistic Swedish data

### ✅ API Functionality

- [ ] Test suite CRUD operations work correctly
- [ ] Test run triggering and monitoring functions
- [ ] Performance benchmarks can be created and measured
- [ ] Test data generation produces valid synthetic data

### ✅ Integration Points

- [ ] Tests connect to Supabase branch databases
- [ ] Railway backend APIs are testable
- [ ] Vercel preview deployments support E2E testing
- [ ] CI/CD pipeline executes tests on every commit

### ✅ Performance Validation

- [ ] API response times consistently <1s
- [ ] Page load times consistently <3s
- [ ] Test execution completes within reasonable time
- [ ] System handles concurrent test execution

### ✅ Quality Gates

- [ ] Failed tests block deployment pipeline
- [ ] Coverage targets are enforced per component
- [ ] Test results are properly stored and reportable
- [ ] Error scenarios are correctly detected and handled

## Troubleshooting

### Common Issues

**Test Database Connection Fails**:

```bash
# Verify Supabase branch database is accessible
npx supabase status
npx supabase db ping
```

**E2E Tests Timeout**:

```bash
# Increase timeout in playwright.config.ts
# Verify frontend app is running on correct port
```

**Performance Tests Show High Response Times**:

```bash
# Check backend service health
curl http://localhost:3001/api/health
# Monitor system resources during test execution
```

**Coverage Targets Not Met**:

```bash
# Review coverage report details
npx jest --coverage --verbose
# Identify untested code paths and add tests
```

## Next Steps

After successful quickstart validation:

1. **Run `/tasks` command** to generate detailed implementation tasks
2. **Execute TDD implementation** following generated task order
3. **Integrate with CI/CD pipeline** for automated execution
4. **Add custom test scenarios** for Vocilia-specific workflows
5. **Configure monitoring and alerts** for test failures
