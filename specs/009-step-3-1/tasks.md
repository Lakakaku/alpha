# Implementation Tasks: QR Code Landing & Verification System

**Date**: 2025-09-22  
**Feature**: Customer verification flow implementation  
**Branch**: `009-step-3-1`

## Task Overview

**Total Tasks**: 44 (T001-T044)  
**Estimated Duration**: 5-7 days  
**Dependencies**: Follow numbered order, parallel tasks marked [P]  
**Testing Strategy**: TDD - Tests must fail before implementation begins

## Phase 1: Setup & Dependencies (T001-T004)

### T001: Install Required Dependencies ✅

**Priority**: High **Estimated Time**: 30 minutes **Dependencies**: None
**Parallel**: No

```bash
# Frontend dependencies
pnpm --filter @vocilia/customer add libphonenumber-js zod @hookform/resolvers react-hook-form

# Backend dependencies
pnpm --filter @vocilia/backend add libphonenumber-js zod express-rate-limit helmet

# Shared types
pnpm --filter @vocilia/types add libphonenumber-js
```

**Acceptance Criteria**:

- All dependencies installed without conflicts
- TypeScript compilation succeeds
- No security vulnerabilities in new packages

### T002: Update Database Types ✅

**Priority**: High **Estimated Time**: 45 minutes **Dependencies**: T001
**Parallel**: No

Generate TypeScript types for new database tables and update shared types
package.

```bash
pnpm --filter @vocilia/types run generate-types
```

**Acceptance Criteria**:

- New types exported from `@vocilia/types`
- `VerificationSession`, `CustomerVerification`, `FraudDetectionLog` types
  available
- All imports resolve without errors

### T003: Environment Configuration ✅

**Priority**: High **Estimated Time**: 20 minutes **Dependencies**: T001
**Parallel**: [P] with T002

Add required environment variables for QR verification system.

**Files to Update**:

- `.env.example`
- `apps/backend/.env.local`
- `apps/customer/.env.local`

**Acceptance Criteria**:

- All required environment variables documented
- Local development environment configured
- Railway/Vercel environment variables set

### T004: Jest Configuration for Backend ✅

**Priority**: Medium **Estimated Time**: 30 minutes **Dependencies**: T001
**Parallel**: [P] with T002, T003

Set up Jest testing environment for backend integration tests.

**Acceptance Criteria**:

- Jest configured with ts-jest preset
- Test database connection working
- Basic test runner operational

## Phase 2: Tests First - Must Fail (T005-T012)

### T005: QR Verification Contract Test ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T002, T004  
**Parallel**: No

**File**: `apps/backend/tests/contract/qr-verification.test.ts`

Create failing contract test for `/api/v1/qr/verify/{storeId}` endpoint.

**Test Cases**:

- Valid QR parameters return session token
- Invalid store ID returns 404
- Missing version parameter returns 400
- Rate limiting after 10 requests

**Expected**: All tests MUST fail (no implementation yet)

### T006: Verification Submission Contract Test ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T005  
**Parallel**: [P] with T007

**File**: `apps/backend/tests/contract/verification-submission.test.ts`

Create failing contract test for `/api/v1/verification/submit` endpoint.

**Test Cases**:

- Valid submission returns verification ID
- Invalid session token returns 401
- Out-of-tolerance time returns validation error
- Out-of-tolerance amount returns validation error
- Invalid phone number returns validation error

**Expected**: All tests MUST fail

### T007: Session Details Contract Test ✅

**Priority**: High  
**Estimated Time**: 30 minutes  
**Dependencies**: T005  
**Parallel**: [P] with T006

**File**: `apps/backend/tests/contract/session-details.test.ts`

Create failing contract test for `/api/v1/verification/session/{sessionToken}`
endpoint.

**Test Cases**:

- Valid session token returns session details
- Invalid session token returns 404
- Expired session returns 410

**Expected**: All tests MUST fail

### T008: Phone Validation Unit Test ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T002  
**Parallel**: [P] with T009, T010

**File**: `apps/backend/tests/unit/phone-validation.test.ts`

Create comprehensive phone validation tests for Swedish numbers.

**Test Cases**:

- Valid Swedish mobile formats (070, 072, 073, 076, 079)
- Invalid formats return specific error messages
- E.164 conversion working correctly
- Non-Swedish numbers rejected

**Expected**: All tests MUST fail

### T009: Time Tolerance Unit Test ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T002  
**Parallel**: [P] with T008, T010

**File**: `apps/backend/tests/unit/time-tolerance.test.ts`

Create time tolerance validation tests.

**Test Cases**:

- Times within ±2 minutes validate as "valid"
- Times outside tolerance return "out_of_tolerance"
- Edge cases (midnight, daylight saving)
- Invalid time formats rejected

**Expected**: All tests MUST fail

### T010: Amount Tolerance Unit Test ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T002  
**Parallel**: [P] with T008, T009

**File**: `apps/backend/tests/unit/amount-tolerance.test.ts`

Create amount tolerance validation tests.

**Test Cases**:

- Amounts within ±2 SEK validate as "valid"
- Amounts outside tolerance return "out_of_tolerance"
- Negative amounts rejected
- Decimal precision handling

**Expected**: All tests MUST fail

### T011: QR Landing Component Test ✅

**Priority**: Medium  
**Estimated Time**: 45 minutes  
**Dependencies**: T002  
**Parallel**: [P] with T012

**File**: `apps/customer/tests/components/qr-landing.test.tsx`

Create failing tests for QR landing page component.

**Test Cases**:

- Store information displays correctly
- Form renders with all required fields
- Error states display properly
- Mobile responsive layout

**Expected**: All tests MUST fail

### T012: Verification Form Component Test ✅

**Priority**: Medium  
**Estimated Time**: 45 minutes  
**Dependencies**: T002  
**Parallel**: [P] with T011

**File**: `apps/customer/tests/components/verification-form.test.tsx`

Create failing tests for verification form component.

**Test Cases**:

- Form validation working correctly
- Submit button disabled until valid
- Error messages display appropriately
- Success state handling

**Expected**: All tests MUST fail

## Phase 3: Database & Models (T013-T018)

### T013: Create Database Migrations ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: All Phase 2 tests failing  
**Parallel**: No

**Files**:

- `supabase/migrations/[timestamp]_create_verification_sessions.sql`
- `supabase/migrations/[timestamp]_create_customer_verifications.sql`
- `supabase/migrations/[timestamp]_create_fraud_detection_logs.sql`

Apply SQL migrations from data-model.md.

**Acceptance Criteria**:

- All tables created with correct constraints
- Indexes created for performance
- Foreign key relationships established

### T014: Create RLS Policies ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T013  
**Parallel**: No

**File**: `supabase/migrations/[timestamp]_setup_rls_policies.sql`

Implement Row Level Security policies from data-model.md.

**Acceptance Criteria**:

- RLS enabled on all tables
- Session-based access policies working
- Service role bypass policies configured

### T015: Database Model Classes ✅

**Priority**: Medium  
**Estimated Time**: 60 minutes  
**Dependencies**: T014  
**Parallel**: [P] with T016

**Files**:

- `apps/backend/src/models/VerificationSession.ts`
- `apps/backend/src/models/CustomerVerification.ts`
- `apps/backend/src/models/FraudDetectionLog.ts`

Create database model classes with type safety.

**Acceptance Criteria**:

- Full TypeScript type safety
- CRUD operations implemented
- Supabase client integration

### T016: Update Store Model ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T014  
**Parallel**: [P] with T015

**File**: `apps/backend/src/models/Store.ts`

Extend existing Store model with QR verification fields.

**Acceptance Criteria**:

- New fields added (`current_qr_version`, `verification_enabled`)
- Backward compatibility maintained
- Existing functionality unaffected

### T017: Database Connection Service ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T015, T016  
**Parallel**: [P] with T018

**File**: `apps/backend/src/services/database.ts`

Create centralized database connection service.

**Acceptance Criteria**:

- Connection pooling configured
- Error handling implemented
- Environment-based configuration

### T018: Seed Test Data ✅

**Priority**: Low  
**Estimated Time**: 30 minutes  
**Dependencies**: T015, T016  
**Parallel**: [P] with T017

**File**: `apps/backend/tests/fixtures/verification-test-data.sql`

Create test data for development and testing.

**Acceptance Criteria**:

- Sample stores with QR codes
- Test verification sessions
- Fraud detection examples

## Phase 4: Backend Services & Validation (T019-T023)

### T019: Phone Validation Service ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T015  
**Parallel**: No

**File**: `apps/backend/src/services/validation/phone-validation.ts`

Implement Swedish phone number validation service.

**Acceptance Criteria**:

- T008 phone validation tests now pass
- libphonenumber-js integration working
- E.164 format conversion
- Clear error messages for invalid formats

### T020: Time Tolerance Service ✅

**Priority**: High  
**Estimated Time**: 30 minutes  
**Dependencies**: T019  
**Parallel**: [P] with T021

**File**: `apps/backend/src/services/validation/time-tolerance.ts`

Implement time tolerance validation service.

**Acceptance Criteria**:

- T009 time tolerance tests now pass
- ±2 minute tolerance enforced
- Timezone handling implemented
- Edge case handling

### T021: Amount Tolerance Service ✅

**Priority**: High  
**Estimated Time**: 30 minutes  
**Dependencies**: T019  
**Parallel**: [P] with T020

**File**: `apps/backend/src/services/validation/amount-tolerance.ts`

Implement amount tolerance validation service.

**Acceptance Criteria**:

- T010 amount tolerance tests now pass
- ±2 SEK tolerance enforced
- Decimal precision handling
- Range calculation for user feedback

### T022: QR Verification Service ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: T020, T021  
**Parallel**: No

**File**: `apps/backend/src/services/qr/qr-verification.ts`

Implement QR code verification and session creation service.

**Acceptance Criteria**:

- QR parameter validation
- Session token generation
- Store lookup functionality
- Fraud detection integration

### T023: Fraud Detection Service ✅

**Priority**: Medium  
**Estimated Time**: 45 minutes  
**Dependencies**: T022  
**Parallel**: No

**File**: `apps/backend/src/services/security/fraud-detection.ts`

Implement fraud detection and prevention service.

**Acceptance Criteria**:

- Rate limiting detection
- Suspicious pattern recognition
- Risk scoring algorithm
- Action determination logic

### T024: QR Verification Endpoint ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: T022, T023  
**Parallel**: No

**File**: `apps/backend/src/routes/qr/verify.ts`

Implement `/api/v1/qr/verify/{storeId}` endpoint.

**Acceptance Criteria**:

- T005 QR verification contract tests now pass
- Proper error handling and status codes
- Session token generation
- Store information retrieval

### T025: Verification Submission Endpoint ✅

**Priority**: High  
**Estimated Time**: 75 minutes  
**Dependencies**: T024  
**Parallel**: [P] with T026

**File**: `apps/backend/src/routes/verification/submit.ts`

Implement `/api/v1/verification/submit` endpoint.

**Acceptance Criteria**:

- T006 verification submission contract tests now pass
- All validation services integrated
- Comprehensive error responses
- Success confirmation with validation results

### T026: Session Details Endpoint ✅

**Priority**: Medium  
**Estimated Time**: 45 minutes  
**Dependencies**: T024  
**Parallel**: [P] with T025

**File**: `apps/backend/src/routes/verification/session.ts`

Implement `/api/v1/verification/session/{sessionToken}` endpoint.

**Acceptance Criteria**:

- T007 session details contract tests now pass
- Session validation and retrieval
- Proper authorization checks
- Session expiration handling

### T027: QR Landing Page Layout ✅

**Priority**: High  
**Estimated Time**: 90 minutes  
**Dependencies**: T024  
**Parallel**: No

**File**: `apps/customer/src/app/feedback/[storeId]/page.tsx`

Create mobile-optimized QR landing page.

**Acceptance Criteria**:

- Mobile-first responsive design
- Store information display
- QR parameter extraction
- Error state handling

### T028: Verification Form Component ✅

**Priority**: High  
**Estimated Time**: 120 minutes  
**Dependencies**: T027  
**Parallel**: No

**File**: `apps/customer/src/components/verification/VerificationForm.tsx`

Create verification form with validation.

**Acceptance Criteria**:

- T012 verification form component tests now pass
- All three input fields (time, amount, phone)
- Real-time validation feedback
- Progressive enhancement
- Touch-friendly 48px targets

### T029: Form Field Components ✅

**Priority**: Medium  
**Estimated Time**: 90 minutes  
**Dependencies**: T028  
**Parallel**: [P] with T030

**Files**:

- `apps/customer/src/components/verification/TimeInput.tsx`
- `apps/customer/src/components/verification/AmountInput.tsx`
- `apps/customer/src/components/verification/PhoneInput.tsx`

Create specialized input components.

**Acceptance Criteria**:

- Appropriate input types and keyboards
- Validation state visualization
- Accessibility compliance
- Error message display

### T030: Store Display Component ✅

**Priority**: Medium  
**Estimated Time**: 60 minutes  
**Dependencies**: T027  
**Parallel**: [P] with T029

**File**: `apps/customer/src/components/verification/StoreDisplay.tsx`

Create store information display component.

**Acceptance Criteria**:

- Store name and logo display
- Business information presentation
- Loading and error states
- Mobile-optimized layout

### T031: Error Handling Components ✅

**Priority**: Medium  
**Estimated Time**: 60 minutes  
**Dependencies**: T028, T029  
**Parallel**: [P] with T032

**Files**:

- `apps/customer/src/components/verification/ErrorDisplay.tsx`
- `apps/customer/src/components/verification/ValidationError.tsx`

Create comprehensive error display components.

**Acceptance Criteria**:

- QR code error handling
- Validation error display
- Network error handling
- User-friendly error messages

### T032: Success State Component ✅

**Priority**: Low  
**Estimated Time**: 45 minutes  
**Dependencies**: T028  
**Parallel**: [P] with T031

**File**: `apps/customer/src/components/verification/SuccessDisplay.tsx`

Create success confirmation component.

**Acceptance Criteria**:

- Verification confirmation display
- Next steps information
- Call-to-action buttons
- Success animation (optional)

## Phase 7: Security & Middleware (T033-T037)

### T033: Rate Limiting Middleware ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T025, T026  
**Parallel**: No

**File**: `apps/backend/src/middleware/rate-limiting.ts`

Implement rate limiting for API endpoints.

**Acceptance Criteria**:

- Per-IP rate limiting (10 requests/hour)
- Different limits for different endpoints
- Redis integration for distributed systems
- Proper error responses

### T034: Session Validation Middleware ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: T033  
**Parallel**: [P] with T035

**File**: `apps/backend/src/middleware/session-validation.ts`

Implement session token validation middleware.

**Acceptance Criteria**:

- Session token verification
- Session expiration checking
- Proper authorization responses
- Integration with RLS policies

### T035: Input Sanitization Middleware ✅

**Priority**: High  
**Estimated Time**: 45 minutes  
**Dependencies**: T033  
**Parallel**: [P] with T034

**File**: `apps/backend/src/middleware/input-sanitization.ts`

Implement comprehensive input sanitization.

**Acceptance Criteria**:

- SQL injection prevention
- XSS attack prevention
- Data type validation
- Zod schema integration

### T036: CORS and Security Headers ✅

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: T034, T035  
**Parallel**: [P] with T037

**File**: `apps/backend/src/middleware/security-headers.ts`

Implement security headers and CORS configuration.

**Acceptance Criteria**:

- Proper CORS configuration
- Security headers (helmet.js)
- Content Security Policy
- Environment-based configuration

### T037: Audit Logging Middleware ✅

**Priority**: Low  
**Estimated Time**: 45 minutes  
**Dependencies**: T034, T035  
**Parallel**: [P] with T036

**File**: `apps/backend/src/middleware/audit-logging.ts`

Implement audit logging for security monitoring.

**Acceptance Criteria**:

- Request/response logging
- Security event logging
- Performance metrics collection
- Log rotation and storage

## Phase 8: Integration & Polish (T038-T044)

### T038: Frontend API Integration ✅

**Priority**: High  
**Estimated Time**: 90 minutes  
**Dependencies**: T032, T037  
**Parallel**: No

**File**: `apps/customer/src/services/api/verification-api.ts`

Integrate frontend with backend API endpoints.

**Acceptance Criteria**:

- T011 QR landing component tests now pass
- All API calls implemented
- Error handling integration
- Loading state management

### T039: Form Validation Integration ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: T038  
**Parallel**: [P] with T040

Update frontend validation to match backend validation logic.

**Acceptance Criteria**:

- Client-side validation mirrors server-side
- Real-time feedback working
- Error message consistency
- Validation state synchronization

### T040: Mobile Performance Optimization ✅

**Priority**: Medium  
**Estimated Time**: 75 minutes  
**Dependencies**: T038  
**Parallel**: [P] with T039

Optimize for mobile performance targets.

**Acceptance Criteria**:

- Page load time <2s on 3G
- API response time <500ms
- Touch target size ≥48px
- Responsive layout testing

### T041: Accessibility Compliance ✅

**Priority**: Medium  
**Estimated Time**: 60 minutes  
**Dependencies**: T039, T040  
**Parallel**: [P] with T042

Ensure WCAG 2.1 AA compliance.

**Acceptance Criteria**:

- Screen reader compatibility
- Keyboard navigation support
- Color contrast compliance
- Focus management

### T042: End-to-End Testing ✅

**Priority**: High  
**Estimated Time**: 90 minutes  
**Dependencies**: T039, T040  
**Parallel**: [P] with T041

**File**: `apps/customer/tests/e2e/verification-flow.test.ts`

Create end-to-end user flow tests.

**Acceptance Criteria**:

- Complete user journey testing
- Cross-browser compatibility
- Mobile device testing
- Performance validation

### T043: Documentation Updates ✅

**Priority**: Low  
**Estimated Time**: 45 minutes  
**Dependencies**: T041, T042  
**Parallel**: [P] with T044

Update project documentation.

**Files**:

- API documentation updates
- Component documentation
- Setup instructions
- Troubleshooting guide

**Acceptance Criteria**:

- Complete API documentation
- Component usage examples
- Development setup guide
- Deployment instructions

### T044: Final Integration Validation ✅

**Priority**: High  
**Estimated Time**: 60 minutes  
**Dependencies**: T041, T042, T043  
**Parallel**: No

Final validation against quickstart.md acceptance criteria.

**Acceptance Criteria**:

- All quickstart tests pass
- Performance targets met
- Security requirements satisfied
- Constitution compliance verified

## Execution Examples

### Starting Development

```bash
# Run prerequisite check
./.specify/scripts/bash/check-task-prerequisites.sh 009-step-3-1

# Verify design documents
ls specs/009-step-3-1/{research,data-model,contracts,quickstart}.md

# Start with dependencies
git checkout -b feature/qr-verification-system
# Execute T001: Install dependencies
```

### TDD Workflow Example

```bash
# Create failing test first (T005)
npm test apps/backend/tests/contract/qr-verification.test.ts
# Should fail: "Cannot find module '../routes/qr/verify'"

# Implement minimal code to make test pass (T024)
# Create endpoint that returns 200 but no logic

# Refactor with full implementation
# Add validation, error handling, business logic
```

### Parallel Execution Example

```bash
# Phase 2: Run tests in parallel
pnpm run test apps/backend/tests/unit/phone-validation.test.ts &  # T008
pnpm run test apps/backend/tests/unit/time-tolerance.test.ts &   # T009
pnpm run test apps/backend/tests/unit/amount-tolerance.test.ts & # T010
wait

# All should fail - ready for implementation phase
```

## Dependencies Graph

```
T001 → T002 → T005 → T006 → T013 → T014 → T015 → T019 → T022 → T024 → T027 → T028 → T038 → T044
       ↓      ↓      ↓                    ↓      ↓      ↓      ↓      ↓      ↓      ↓
       T003   T007   T008               T016   T020   T023   T025   T029   T039   T042
       ↓      ↓      ↓                           ↓              ↓      ↓      ↓      ↓
       T004   T009   T011                       T021           T026   T030   T040   T043
              ↓      ↓                                                 ↓      ↓
              T010   T012                                              T031   T041
                                                                       ↓
                                                                       T032
```

## Success Criteria Summary

- ✅ All 44 tasks completed in order
- ✅ All tests pass (unit, integration, contract, e2e)
- ✅ Performance targets met (<2s load, <500ms API)
- ✅ Security requirements satisfied (RLS, input validation, rate limiting)
- ✅ Mobile optimization complete (responsive, touch-friendly)
- ✅ Accessibility compliance (WCAG 2.1 AA)
- ✅ All quickstart.md validation tests pass
- ✅ Constitution compliance verified

---

_Generated from design documents in `/specs/009-step-3-1/` following TDD
methodology_
