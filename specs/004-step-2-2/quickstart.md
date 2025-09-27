# QR Code Management System - Quickstart Guide

**Feature**: QR Code Management System (004-step-2-2)  
**Date**: 2025-09-20  
**Audience**: Developers, QA Engineers, Product Managers

## Overview

This quickstart guide provides step-by-step instructions to validate the QR Code Management System implementation. Follow these workflows to ensure all functionality works correctly in the production environment.

## Prerequisites

### Environment Setup
```bash
# Ensure you're on the correct branch
git checkout 004-step-2-2

# Install dependencies (if new packages were added)
pnpm install

# Start development environment
pnpm dev

# Start backend services
cd apps/backend && pnpm dev

# Run database migrations (if schema changes applied)
npx supabase db push
```

### Test Data Requirements
- ✅ Approved business account with multiple stores
- ✅ Valid Supabase authentication token
- ✅ Stores with manage_qr and view_analytics permissions
- ✅ Test customer session for scan tracking

### API Access
- **Frontend**: http://localhost:3000 (Business Dashboard)
- **Backend**: http://localhost:3001 (API Services)
- **Database**: Supabase project "alpha"

## Workflow 1: Basic QR Code Management

### Step 1: View Store QR Code
**Goal**: Verify QR code generation and display functionality

1. **Login to Business Dashboard**
   ```
   URL: http://localhost:3000/login
   Credentials: Use approved business account
   ```

2. **Navigate to QR Management**
   ```
   Path: Dashboard → QR Codes → Select Store
   Expected: QR code image displayed with store information
   ```

3. **Verify QR Code Information**
   ```
   Check: QR code URL format
   Expected: https://customer.vocilia.se/entry/store/{store_id}
   
   Check: QR status
   Expected: "Active" for verified stores
   
   Check: Version number
   Expected: Integer starting from 1
   
   Check: Generation timestamp
   Expected: Recent date/time
   ```

4. **Test QR Code Scanning** (Manual)
   ```
   Action: Scan QR code with mobile device
   Expected: Redirects to customer feedback page
   Expected: Correct store context loaded
   ```

**Success Criteria**: ✅ QR code displays correctly, ✅ Scan leads to correct store

### Step 2: Download Printable QR Code
**Goal**: Validate PDF generation and customization

1. **Access Download Options**
   ```
   Location: QR Management → Store → Download/Print
   Options: A4, Letter, Business Card, Label Sheet
   ```

2. **Download Default Template**
   ```
   Action: Click "Download PDF" (A4 format)
   Expected: PDF file downloads automatically
   File name: store-{store_name}-qr-code.pdf
   ```

3. **Verify PDF Content**
   ```
   Check: QR code image (center, readable)
   Check: Store name and address
   Check: "Scan for feedback" text
   Check: Vocilia branding (footer)
   Check: Print quality (300+ DPI)
   ```

4. **Test Custom Template** (If implemented)
   ```
   Action: Create custom template with business logo
   Action: Download using custom template
   Expected: Logo appears in PDF
   Expected: Custom colors and text applied
   ```

**Success Criteria**: ✅ PDF downloads correctly, ✅ Content is printable quality, ✅ Customization works

## Workflow 2: QR Code Regeneration

### Step 3: Regenerate Single QR Code
**Goal**: Test QR code versioning and transition periods

1. **Initiate Regeneration**
   ```
   Location: QR Management → Store → Actions → Regenerate
   Reason: "Testing new QR code"
   Transition: 24 hours (default)
   ```

2. **Verify New QR Code**
   ```
   Check: Version number incremented
   Check: Status shows "Pending Regeneration"
   Check: New QR URL has timestamp parameter (?t=timestamp)
   Check: Transition period displayed (24 hours)
   ```

3. **Test Both QR Codes Work**
   ```
   Test: Scan original QR code → Should work
   Test: Scan new QR code → Should work
   Expected: Both redirect to same store entry page
   ```

4. **Check History Record**
   ```
   Location: QR Management → Store → History
   Expected: Regeneration event logged
   Expected: Timestamp, reason, user recorded
   ```

**Success Criteria**: ✅ Version incremented, ✅ Both QRs functional, ✅ History tracked

### Step 4: Monitor Transition Period
**Goal**: Verify automatic transition completion

1. **Wait for Transition** (Or simulate time passage)
   ```
   Note: In production, wait 24 hours
   For testing: May need to adjust transition period to 1-5 minutes
   ```

2. **Verify Status Update**
   ```
   Check: Status changes from "Pending" to "Active"
   Check: Old QR code becomes inactive
   Check: New QR code becomes primary
   ```

3. **Test QR Code Access**
   ```
   Test: Original QR code → Should show "expired" or redirect with warning
   Test: New QR code → Should work normally
   ```

**Success Criteria**: ✅ Automatic transition occurs, ✅ Old QR deactivated, ✅ New QR becomes primary

## Workflow 3: Analytics and Monitoring

### Step 5: QR Scan Tracking
**Goal**: Validate analytics data collection

1. **Generate Scan Events**
   ```
   Action: Scan QR codes multiple times with different devices
   Vary: User agents (mobile, desktop, tablet)
   Vary: Time intervals (spread over hours)
   Target: At least 10 scans for meaningful data
   ```

2. **Check Real-time Updates**
   ```
   Location: QR Management → Analytics → Real-time
   Expected: Scan count updates within 5 minutes
   Expected: Recent scan activity visible
   ```

3. **Verify Analytics Dashboard**
   ```
   Location: QR Management → Analytics → Store Dashboard
   
   Check: Total scans (last 24 hours)
   Check: Scan trend chart (hourly breakdown)
   Check: Peak activity times
   Check: Unique sessions count
   ```

4. **Test Time Period Filters**
   ```
   Filter: Last hour → Should show recent scans
   Filter: Last day → Should show 24-hour data
   Filter: Last week → Should show weekly trends
   Filter: Last month → Should show monthly patterns
   ```

**Success Criteria**: ✅ Scans tracked accurately, ✅ Analytics update timely, ✅ Filters work correctly

### Step 6: Analytics Aggregation
**Goal**: Confirm data aggregation accuracy

1. **Check 5-Minute Aggregations**
   ```
   API: GET /api/qr/analytics/{storeId}?period=hour
   Expected: Data points every 5 minutes
   Expected: Scan counts match raw events
   ```

2. **Verify Hourly Aggregations**
   ```
   API: GET /api/qr/analytics/{storeId}?period=day
   Expected: 24 data points (one per hour)
   Expected: Peak hour identification
   ```

3. **Test Daily Aggregations**
   ```
   API: GET /api/qr/analytics/{storeId}?period=week
   Expected: 7 data points (one per day)
   Expected: Busiest day highlighted
   ```

**Success Criteria**: ✅ Data aggregated correctly, ✅ No data loss, ✅ Calculations accurate

## Workflow 4: Multi-Store Bulk Operations

### Step 7: Bulk QR Regeneration
**Goal**: Test bulk operations for multi-location businesses

1. **Select Multiple Stores**
   ```
   Location: QR Management → Bulk Operations
   Action: Select 3-5 stores from different locations
   Verify: Only stores with manage_qr permission selectable
   ```

2. **Execute Bulk Regeneration**
   ```
   Operation: Regenerate All Selected
   Reason: "Security update - bulk test"
   Transition: 24 hours
   ```

3. **Monitor Bulk Progress**
   ```
   Expected: Progress indicator shows completion status
   Expected: Success/failure count per store
   Expected: Real-time updates on operation status
   ```

4. **Verify Bulk Results**
   ```
   Check: All successful stores have new QR versions
   Check: Failed operations show error messages
   Check: Bulk operation ID recorded in history
   Check: All stores maintain 24-hour transition periods
   ```

**Success Criteria**: ✅ Bulk operation completes, ✅ Progress tracked, ✅ Results accurate

### Step 8: Permission-Based Access
**Goal**: Validate permission enforcement

1. **Test Limited Permissions**
   ```
   Setup: Use account with view_analytics but not manage_qr
   Expected: Can view QR codes and analytics
   Expected: Cannot regenerate or download QRs
   ```

2. **Test Store-Specific Permissions**
   ```
   Setup: Account with access to only some stores
   Expected: QR management limited to authorized stores
   Expected: Bulk operations only show accessible stores
   ```

3. **Test Permission Escalation**
   ```
   Verify: No unauthorized access to other businesses' QRs
   Verify: RLS policies prevent cross-business data access
   ```

**Success Criteria**: ✅ Permissions enforced, ✅ No unauthorized access, ✅ RLS working

## Workflow 5: Print Template Customization

### Step 9: Custom Template Creation
**Goal**: Validate template system functionality

1. **Create Custom Template**
   ```
   Location: QR Management → Templates → Create New
   
   Settings:
   - Name: "Holiday Special Template"
   - Size: A4
   - QR Size: 300px
   - Include Logo: Yes (upload test logo)
   - Custom Text: "Scan for Holiday Feedback!"
   - Colors: Custom brand colors
   - Border: Thick
   ```

2. **Test Template Application**
   ```
   Action: Download QR using custom template
   Expected: All customizations applied correctly
   Expected: Logo positioned properly
   Expected: Colors and text as specified
   ```

3. **Manage Template Library**
   ```
   Action: Create multiple templates for different purposes
   Action: Set one as default for business
   Action: Edit existing template
   Action: Delete non-default template
   ```

**Success Criteria**: ✅ Templates create correctly, ✅ Customizations apply, ✅ Management works

## Workflow 6: Error Handling and Edge Cases

### Step 10: Error Scenarios
**Goal**: Validate robust error handling

1. **Test Invalid Operations**
   ```
   Try: Regenerate QR for non-existent store
   Try: Download template with invalid parameters
   Try: Bulk operation with unauthorized stores
   Expected: Appropriate error messages displayed
   ```

2. **Test Network Failures**
   ```
   Simulate: Network timeout during PDF generation
   Simulate: Database unavailable during scan tracking
   Expected: Graceful error handling and user feedback
   ```

3. **Test Data Validation**
   ```
   Try: Submit invalid QR scan data
   Try: Create template with invalid colors
   Try: Bulk operation exceeding store limits
   Expected: Validation errors with helpful messages
   ```

**Success Criteria**: ✅ Errors handled gracefully, ✅ Messages are helpful, ✅ No crashes

## Performance Validation

### Step 11: Performance Benchmarks
**Goal**: Ensure performance meets specifications

1. **QR Generation Speed**
   ```
   Test: Single QR regeneration
   Target: <200ms response time
   Measure: API response time in browser dev tools
   ```

2. **PDF Download Size**
   ```
   Test: Download A4 QR PDF
   Target: <2MB file size
   Measure: File size of downloaded PDF
   ```

3. **Analytics Query Speed**
   ```
   Test: Load analytics dashboard with 1 month data
   Target: <1 second load time
   Measure: Time to render charts and data
   ```

4. **Bulk Operation Efficiency**
   ```
   Test: Bulk regenerate 20 stores
   Target: <30 seconds total completion
   Measure: Time from initiation to completion
   ```

**Success Criteria**: ✅ All performance targets met, ✅ No timeouts, ✅ Responsive UX

## Production Readiness Checklist

### Final Validation
- [ ] **QR Code Generation**: Single and bulk operations work
- [ ] **PDF Downloads**: All formats generate correctly
- [ ] **Analytics Tracking**: Real-time and aggregated data accurate
- [ ] **Permission System**: RLS and business permissions enforced
- [ ] **Template System**: Customization and management functional
- [ ] **Error Handling**: Graceful failures with user feedback
- [ ] **Performance**: All benchmarks met
- [ ] **Security**: No unauthorized access possible
- [ ] **Database**: Migrations applied, RLS policies active
- [ ] **Integration**: Customer QR scanning works end-to-end

### Environment Check
- [ ] **Development**: All workflows pass on localhost
- [ ] **Staging**: All workflows pass on staging environment
- [ ] **Production**: Ready for deployment (contracts validated)

## Troubleshooting Common Issues

### QR Code Not Generating
**Symptoms**: QR code shows as blank or error
**Check**: Database migrations applied, store has valid ID
**Fix**: `npx supabase db push && pnpm restart`

### PDF Download Fails
**Symptoms**: 500 error on download or corrupted PDF
**Check**: Canvas and jsPDF libraries installed
**Fix**: `pnpm install canvas jspdf && restart backend`

### Analytics Not Updating
**Symptoms**: Scan counts not increasing or stale data
**Check**: Analytics aggregation jobs running
**Fix**: Check backend cron jobs and database permissions

### Bulk Operations Timeout
**Symptoms**: Bulk operations never complete or hang
**Check**: Database connection limits and query performance
**Fix**: Review database indexing and connection pooling

### Permission Errors
**Symptoms**: 403 errors or unauthorized access
**Check**: RLS policies applied and business_stores permissions
**Fix**: Verify user has correct roles in business_stores table

---

**Status**: Ready for implementation validation  
**Next Steps**: Execute workflows during development and testing phases  
**Update Frequency**: After each implementation milestone