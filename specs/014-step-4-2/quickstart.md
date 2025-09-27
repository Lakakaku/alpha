# Quickstart: Weekly Verification Workflow Testing

**Date**: 2025-09-23  
**Feature**: Weekly Verification Workflow  
**Branch**: 014-step-4-2

## Prerequisites

- Existing Supabase database with admin accounts and business accounts
- Admin dashboard application running
- Business portal application running
- Sample feedback data with transaction times and values
- Test business with at least one store

## Test Scenarios

### Scenario 1: Complete Weekly Verification Cycle (Happy Path)

**Goal**: Test the full verification workflow from database preparation to
payment processing.

#### Setup

1. Create test data:
   - At least 10 feedback entries for a test store from the past week
   - Test business account with access to the store
   - Test admin account with verification permissions

#### Test Steps

**Phase 1: Database Preparation (Admin)**

1. Login to admin dashboard as verification admin
2. Navigate to Verification > Weekly Cycles
3. Click "Create New Cycle" for current week
4. Verify cycle appears with status "preparing"
5. Click "Prepare Databases" action
6. Wait for background job completion (should complete within 2 minutes for test
   data)
7. Verify cycle status changes to "ready"
8. Verify verification databases created for each store with transaction count

**Phase 2: Database Distribution (Admin)**

1. Navigate to Verification > Databases for the cycle
2. Verify each database shows transaction count and deadline (5 business days)
3. Test download links for CSV, Excel, and JSON formats
4. Verify downloaded files contain:
   - Transaction times and values only
   - No phone numbers or feedback content
   - Proper format structure

**Phase 3: Business Verification (Business User)**

1. Login to business portal as test business
2. Navigate to Verification section
3. Verify new verification database appears with "ready" status
4. Download verification database (test all formats)
5. Verify file contents match expected transaction data
6. Mark transactions as verified/fake (mix of both for testing)
7. Submit verification results
8. Verify database status changes to "submitted"

**Phase 4: Payment Processing (Admin)**

1. Return to admin dashboard
2. Navigate to completed verification databases
3. Click "Generate Invoices" for the cycle
4. Verify invoices created with:
   - Total rewards based on verified transactions
   - 20% admin fee calculated correctly
   - Proper due dates
5. Mark test invoice as "paid"
6. Verify feedback database delivered to business
7. Verify customer rewards batch created for Swish payments

#### Expected Results

- Complete cycle from preparation to payment in under 30 minutes
- All transaction data properly sanitized for business verification
- Accurate reward calculations and fee application
- Proper status tracking throughout workflow
- Audit logs for all verification actions

### Scenario 2: Deadline Management and Notifications

**Goal**: Test deadline monitoring and notification system.

#### Test Steps

1. Create verification cycle with test data
2. Prepare and distribute databases to businesses
3. Wait for notification triggers (use shorter deadlines for testing)
4. Verify email notifications sent to businesses
5. Verify in-app notifications appear in business portal
6. Test deadline expiry behavior:
   - Databases marked as "expired" after deadline
   - No feedback delivery for expired submissions

#### Expected Results

- Timely notifications via email and in-app
- Proper deadline enforcement
- Clear messaging about verification requirements

### Scenario 3: File Format Validation

**Goal**: Test multiple export formats and business submission validation.

#### Test Steps

1. Generate verification database with sample transactions
2. Download and validate each format:
   - **CSV**: Proper comma separation, UTF-8 encoding, headers
   - **Excel**: Readable spreadsheet format, proper cell types
   - **JSON**: Valid JSON structure, proper data types
3. Test business submission with each format
4. Test invalid file submissions:
   - Wrong format files
   - Corrupted data
   - Missing required fields

#### Expected Results

- All formats generate correctly and contain identical data
- Proper validation errors for invalid submissions
- Clear error messages for businesses

### Scenario 4: Error Handling and Edge Cases

**Goal**: Test system behavior under error conditions.

#### Test Steps

1. **Partial Verification Testing**:
   - Submit verification with some transactions unmarked
   - Verify system handling of incomplete submissions

2. **Payment Dispute Testing**:
   - Mark invoice as "disputed"
   - Test admin override capabilities
   - Verify workflow continues after resolution

3. **File Generation Failure**:
   - Test with large dataset (near 1,000 transaction limit)
   - Verify performance targets met
   - Test retry mechanisms for failures

4. **Invalid Swish Numbers**:
   - Include customer records with invalid phone numbers
   - Verify proper error handling and admin notification

#### Expected Results

- Graceful error handling with clear messaging
- Admin tools for manual intervention
- Performance targets maintained under load
- Proper logging of all error conditions

## Performance Validation

### Database Preparation Performance

- **Target**: Complete within 2 hours for full weekly cycle
- **Test**: Measure preparation time with 1,000 transactions per store
- **Validation**: Background job completion time tracking

### File Export Performance

- **Target**: Generate exports within 15 minutes per store
- **Test**: Time individual store database generation
- **Validation**: Export process monitoring and alerts

### API Response Performance

- **Target**: <500ms for CRUD operations
- **Test**: Use API testing tools to measure response times
- **Validation**: All verification endpoints meet performance targets

## Security Validation

### Data Privacy

- **Test**: Verify verification databases contain no sensitive data
- **Validation**: Automated checks for phone numbers and feedback content

### Access Control

- **Test**: Verify RLS policies prevent cross-business data access
- **Validation**: Attempt unauthorized access with different business accounts

### File Security

- **Test**: Verify signed URLs expire properly
- **Validation**: Test expired URL access and proper error responses

## Cleanup

After testing completion:

1. Remove test verification cycles and databases
2. Clear test payment invoices and reward batches
3. Reset test business and admin accounts
4. Clean up test file uploads

---

**Status**: Ready for execution  
**Estimated Testing Time**: 2-3 hours for complete validation  
**Next Phase**: Task Generation (Phase 2)
