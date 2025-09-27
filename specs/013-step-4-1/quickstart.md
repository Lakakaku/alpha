# Quickstart Guide - Admin Dashboard Foundation

**Feature**: Admin Dashboard Foundation  
**Date**: 2025-09-23  
**Target Audience**: QA testers, product managers, developers

## Overview

This quickstart guide provides step-by-step scenarios to validate the Admin
Dashboard Foundation feature. Each scenario corresponds to acceptance criteria
from the feature specification and can be executed against the implemented
system.

## Prerequisites

### System Requirements

- Admin Dashboard deployed at `https://alpha-admin.vercel.app`
- Backend API running at `https://alpha-backend.railway.app`
- Supabase database with admin schema deployed
- Test admin account created in the system

### Test Data Setup

Before running scenarios, ensure the following test data exists:

**Test Admin Account**:

- Username: `test_admin`
- Password: `TestAdmin123!`
- Email: `test.admin@vocilia.com`
- Full Name: `Test Administrator`

**Test Stores** (minimum 3 stores with varied states):

1. **Active Store**: Online, recent sync, good performance
2. **Problem Store**: Offline, sync errors, poor performance
3. **New Store**: Recently created, pending first sync

## Scenario 1: Admin Authentication

**User Story**: System administrators need secure authentication to access the
admin portal.

### Steps

1. **Navigate to Admin Portal**
   - Open browser to `https://alpha-admin.vercel.app`
   - Verify login page displays with username/password fields
   - Confirm "Vocilia Admin Dashboard" branding is visible

2. **Test Invalid Login**
   - Enter username: `invalid_user`
   - Enter password: `wrong_password`
   - Click "Login" button
   - **Expected**: Error message "Invalid username or password"
   - **Expected**: User remains on login page

3. **Test Valid Login**
   - Enter username: `test_admin`
   - Enter password: `TestAdmin123!`
   - Click "Login" button
   - **Expected**: Redirect to main dashboard
   - **Expected**: Welcome message with admin name displayed
   - **Expected**: Navigation menu with Store Management, Monitoring, Audit Log

4. **Verify Session Creation**
   - Check browser developer tools > Application > Local Storage
   - **Expected**: Session token stored
   - **Expected**: Admin user data cached locally

### Success Criteria

- ✅ Login page loads without errors
- ✅ Invalid credentials rejected with clear error message
- ✅ Valid credentials redirect to dashboard
- ✅ Session established and persistent across page refreshes

## Scenario 2: Store Listing and Overview

**User Story**: Admins need to view comprehensive store listings with status
information.

### Steps

1. **Access Store Listing**
   - From dashboard, click "Store Management" in navigation
   - **Expected**: Store listing page loads within 2 seconds
   - **Expected**: HTML blocks layout with store cards

2. **Verify Store Information Display**
   - **Expected**: Each store card shows:
     - Store ID (UUID format)
     - Store name
     - Business email
     - Online/offline status indicator
     - Last sync timestamp
     - Performance score (if available)

3. **Test Store Status Indicators**
   - **Expected**: Green indicator for online stores
   - **Expected**: Red indicator for offline stores
   - **Expected**: Yellow indicator for stores with errors

4. **Test Pagination**
   - If >20 stores exist, verify pagination controls
   - **Expected**: Page numbers displayed
   - **Expected**: Next/Previous buttons functional
   - **Expected**: Store count per page configurable

5. **Test Search Functionality**
   - Enter store name in search box
   - **Expected**: Results filter in real-time
   - Clear search
   - **Expected**: Full listing restored

### Success Criteria

- ✅ Store listing loads with all stores visible
- ✅ Status indicators accurately reflect store health
- ✅ Search and pagination work correctly
- ✅ Performance: <2s load time for store listing

## Scenario 3: Store Details and Monitoring

**User Story**: Admins need detailed store information including monitoring
data.

### Steps

1. **Access Store Details**
   - From store listing, click on a test store card
   - **Expected**: Store details page loads
   - **Expected**: URL format: `/stores/[store-id]`

2. **Verify Comprehensive Store Information**
   - **Expected**: All store fields displayed:
     - Name, business email, phone number
     - Physical address, business registration number
     - QR code data/link
     - Creation and last update timestamps

3. **Verify Status Monitoring Data**
   - **Expected**: Current online/offline status
   - **Expected**: Last sync timestamp and status
   - **Expected**: Error count (last 24 hours)
   - **Expected**: Performance score with trend indicator

4. **Test Metrics History**
   - **Expected**: Chart showing performance over time
   - **Expected**: Sync history with success/failure indicators
   - **Expected**: Error log (if any errors exist)

5. **Test Real-time Updates**
   - Leave page open for 30 seconds
   - **Expected**: Status indicators refresh automatically
   - **Expected**: Last sync time updates if sync occurs

### Success Criteria

- ✅ Store details page loads with complete information
- ✅ Monitoring data displays accurately
- ✅ Real-time updates function properly
- ✅ Performance metrics chart renders correctly

## Scenario 4: Store Creation Workflow

**User Story**: Admins need to create new store entries with comprehensive
business information.

### Steps

1. **Access Store Creation**
   - From store listing, click "Create New Store" button
   - **Expected**: Store creation form loads
   - **Expected**: All required fields marked with asterisk

2. **Test Form Validation**
   - Try submitting empty form
   - **Expected**: Validation errors for all required fields
   - **Expected**: No network request sent

3. **Test Field-Specific Validation**
   - Enter invalid email format
   - **Expected**: Email validation error
   - Enter invalid Swedish phone number
   - **Expected**: Phone validation error
   - Enter invalid business registration number
   - **Expected**: Registration number validation error

4. **Create Valid Store**
   - Fill all required fields with valid data:
     - Name: `Test Store Quickstart`
     - Email: `quickstart@teststore.se`
     - Phone: `+46 8 555 0123`
     - Address: `Testgatan 123, 123 45 Stockholm, Sweden`
     - Registration: `556987-6543`
   - Click "Create Store"
   - **Expected**: Success message displayed
   - **Expected**: Redirect to new store details page

5. **Verify Store Creation**
   - **Expected**: Store appears in listing
   - **Expected**: QR code generated automatically
   - **Expected**: Initial status set to "pending"
   - **Expected**: Audit log entry created

### Success Criteria

- ✅ Store creation form validates all inputs correctly
- ✅ Valid store data creates new store successfully
- ✅ QR code generated automatically
- ✅ Store appears in listing immediately after creation

## Scenario 5: Database Upload Process

**User Story**: Admins need to upload weekly verification databases to store
accounts.

### Steps

1. **Access Upload Interface**
   - Navigate to store details page
   - Locate "Upload Database" section
   - **Expected**: Upload form with file picker and date selector

2. **Test File Validation**
   - Try uploading non-CSV file
   - **Expected**: File type validation error
   - Try uploading file >10MB
   - **Expected**: File size validation error

3. **Prepare Test CSV File**
   - Create CSV with columns: `transaction_id,amount,timestamp,pos_reference`
   - Add 10-20 test rows with realistic data
   - Save as `test_verification_2025_09_22.csv`

4. **Execute Upload**
   - Select test CSV file
   - Set week start date: `2025-09-22`
   - Add notes: `Quickstart test upload`
   - Click "Upload Database"
   - **Expected**: Progress indicator shown
   - **Expected**: Success confirmation with record count

5. **Verify Upload Results**
   - **Expected**: Upload ID provided
   - **Expected**: Number of processed records displayed
   - **Expected**: Store sync status updated
   - **Expected**: Audit log entry created for upload

### Success Criteria

- ✅ File validation prevents invalid uploads
- ✅ Valid CSV processes successfully
- ✅ Upload progress feedback provided
- ✅ Store sync status reflects successful upload

## Scenario 6: Session Management and Security

**User Story**: Admin sessions must be secure with appropriate timeouts.

### Steps

1. **Test Session Persistence**
   - Log in successfully
   - Close browser tab
   - Reopen admin dashboard URL
   - **Expected**: Still logged in (within 2-hour window)

2. **Test Activity Tracking**
   - Note current session activity time
   - Navigate between pages
   - Check if activity time updates
   - **Expected**: Last activity timestamp updates

3. **Test Session Timeout Warning**
   - Wait near 2-hour timeout (or simulate with dev tools)
   - **Expected**: Warning message before automatic logout
   - **Expected**: Option to extend session

4. **Test Automatic Logout**
   - Wait for 2-hour timeout (or simulate)
   - Try to perform admin action
   - **Expected**: Automatic logout and redirect to login
   - **Expected**: Session expired message displayed

5. **Test Manual Logout**
   - Log in again
   - Click "Logout" button
   - **Expected**: Immediate logout and redirect
   - **Expected**: Session token cleared from storage

### Success Criteria

- ✅ Sessions persist for up to 2 hours of inactivity
- ✅ Activity tracking updates correctly
- ✅ Automatic logout functions at timeout
- ✅ Manual logout clears session immediately

## Scenario 7: Audit Logging and Monitoring

**User Story**: All admin actions must be logged for security and compliance.

### Steps

1. **Access Audit Log**
   - From dashboard, click "Audit Log" in navigation
   - **Expected**: Audit log page loads with recent entries

2. **Verify Login Action Logged**
   - Find most recent login entry
   - **Expected**: Entry shows admin username, timestamp, IP address
   - **Expected**: Action type "login" with success status

3. **Test Store Creation Audit**
   - Find store creation entry from Scenario 4
   - **Expected**: Action type "create", resource type "store"
   - **Expected**: Store details in action_details field

4. **Test Upload Action Audit**
   - Find database upload entry from Scenario 5
   - **Expected**: Action type "upload" with file information
   - **Expected**: Record count and week date in details

5. **Test Audit Filtering**
   - Filter by action type "create"
   - **Expected**: Only creation actions shown
   - Filter by date range
   - **Expected**: Only actions in range shown

### Success Criteria

- ✅ All admin actions appear in audit log
- ✅ Audit entries contain complete information
- ✅ Filtering and search work correctly
- ✅ Audit log loads quickly with pagination

## Performance Validation

### Load Time Requirements

- **Login page**: <1 second
- **Dashboard**: <2 seconds
- **Store listing**: <2 seconds
- **Store details**: <1.5 seconds
- **Audit log**: <2 seconds

### Stress Testing

1. **Multiple Store Operations**
   - Create 5 stores rapidly
   - **Expected**: All operations complete successfully
   - **Expected**: No database conflicts

2. **Large Store Listing**
   - Test with 100+ stores
   - **Expected**: Pagination handles large datasets
   - **Expected**: Search remains responsive

3. **Concurrent Admin Sessions**
   - Test 2-3 admin users simultaneously
   - **Expected**: No session conflicts
   - **Expected**: Audit logs correctly attribute actions

## Security Validation

### Authentication Security

- ✅ Passwords must meet complexity requirements
- ✅ Failed login attempts are rate limited
- ✅ Sessions use secure tokens
- ✅ Admin routes require authentication

### Data Access Security

- ✅ RLS policies prevent unauthorized data access
- ✅ Admin actions require proper authentication
- ✅ Sensitive data properly encrypted
- ✅ Audit trail cannot be modified by admins

## Troubleshooting

### Common Issues

1. **Login fails**: Check admin account exists and is active
2. **Store listing empty**: Verify database connection and RLS policies
3. **Upload fails**: Check file format and size limits
4. **Performance slow**: Check network connection and database indexes

### Debug Information

- Backend API logs: Check Railway deployment logs
- Frontend errors: Check browser developer console
- Database issues: Check Supabase dashboard for errors
- Authentication: Verify Supabase Auth configuration

## Success Criteria Summary

**Feature Complete When**:

- ✅ All 7 scenarios pass successfully
- ✅ Performance requirements met
- ✅ Security validation passes
- ✅ No critical bugs in functionality
- ✅ Audit logging captures all admin actions
- ✅ Session management works as specified

**Ready for Production When**:

- All quickstart scenarios consistently pass
- Load testing validates performance under expected usage
- Security review confirms no vulnerabilities
- Monitoring and alerting configured
- Documentation complete for operations team
