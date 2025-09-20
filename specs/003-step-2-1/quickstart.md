# Quickstart: Business Authentication & Account Management

**Feature**: Business Authentication & Account Management
**Date**: 2025-09-20
**Prerequisites**: Supabase project configured, Next.js development environment

## Overview
This quickstart validates the complete business authentication flow from registration through multi-store dashboard access. Follow these steps to verify the implementation meets all functional requirements.

## Prerequisites Checklist
- [ ] Supabase project configured with authentication enabled
- [ ] Next.js 14 development environment running
- [ ] @vocilia/auth package built and linked
- [ ] Database migrations applied
- [ ] Admin account configured in Supabase

## Test Scenarios

### 1. Business Registration Flow
**Objective**: Verify new business can register and enter admin approval workflow

**Steps**:
1. Navigate to `http://localhost:3001/register`
2. Fill registration form:
   - Email: `test@examplestore.se` (business domain)
   - Password: `SecurePass123!`
   - Business Name: `Example Store AB`
   - Contact Person: `Erik Andersson`
   - Phone: `+46701234567`
3. Submit registration form

**Expected Results**:
- [ ] Registration form submits successfully
- [ ] Success message displays: "Account created successfully. Pending admin approval."
- [ ] User redirected to pending approval page
- [ ] Admin notification triggered (check admin dashboard)
- [ ] Business entry created in database with status "pending"

**Database Verification**:
```sql
SELECT
  id,
  email,
  user_metadata->>'verification_status' as status,
  user_metadata->>'business_name' as business_name
FROM auth.users
WHERE email = 'test@examplestore.se';
```

### 2. Admin Approval Workflow
**Objective**: Verify admin can approve business registration

**Steps**:
1. Login to admin dashboard as admin user
2. Navigate to pending business approvals
3. Locate test business registration
4. Review business details
5. Click "Approve" button
6. Add approval notes (optional)

**Expected Results**:
- [ ] Business appears in pending approvals list
- [ ] Business details display correctly
- [ ] Approval action completes successfully
- [ ] Business status updated to "approved"
- [ ] Email notification sent to business (if configured)

**Database Verification**:
```sql
SELECT
  user_metadata->>'verification_status' as status,
  updated_at
FROM auth.users
WHERE email = 'test@examplestore.se';
```

### 3. Business Login Flow
**Objective**: Verify approved business can login and access dashboard

**Steps**:
1. Navigate to `http://localhost:3001/login`
2. Enter credentials:
   - Email: `test@examplestore.se`
   - Password: `SecurePass123!`
3. Submit login form

**Expected Results**:
- [ ] Login form submits successfully
- [ ] User authenticated and redirected to dashboard
- [ ] Dashboard displays business email in header
- [ ] Navigation menu shows available options
- [ ] Session established with proper expiration

**Dashboard Verification**:
- [ ] Company email displays: `test@examplestore.se`
- [ ] Logout button present and functional
- [ ] Dashboard loads in <100ms
- [ ] Responsive design works on mobile

### 4. Multi-Store Setup
**Objective**: Verify business can manage multiple store locations

**Steps**:
1. As admin, create test stores for the business:
   ```sql
   INSERT INTO stores (id, name, address, qr_code_id) VALUES
   ('550e8400-e29b-41d4-a716-446655440001', 'Main Store', 'Kungsgatan 1, Stockholm', 'qr-001'),
   ('550e8400-e29b-41d4-a716-446655440002', 'Branch Store', 'Götgatan 2, Göteborg', 'qr-002');

   INSERT INTO business_stores (business_id, store_id, permissions, role) VALUES
   ((SELECT id FROM auth.users WHERE email = 'test@examplestore.se'), '550e8400-e29b-41d4-a716-446655440001', '{"read_feedback": true, "write_context": true, "manage_qr": true, "view_analytics": true, "admin": true}', 'owner'),
   ((SELECT id FROM auth.users WHERE email = 'test@examplestore.se'), '550e8400-e29b-41d4-a716-446655440002', '{"read_feedback": true, "write_context": false, "manage_qr": false, "view_analytics": true, "admin": false}', 'manager');
   ```

2. Login to business dashboard
3. Verify store selector appears
4. Switch between stores

**Expected Results**:
- [ ] Store selector displays both stores
- [ ] Current store highlighted in interface
- [ ] Store switching completes in <50ms
- [ ] Store context persists across page refreshes
- [ ] Permissions correctly filter available actions

### 5. Password Reset Flow
**Objective**: Verify business user can reset forgotten password

**Steps**:
1. Navigate to `http://localhost:3001/login`
2. Click "Forgot Password?" link
3. Enter email: `test@examplestore.se`
4. Submit reset request
5. Check email for reset link (or check Supabase logs)
6. Follow reset link and set new password

**Expected Results**:
- [ ] Reset form submits successfully
- [ ] Confirmation message displays
- [ ] Reset email sent (check logs if email not configured)
- [ ] Reset link opens password update form
- [ ] New password saves successfully
- [ ] Login works with new password

### 6. Session Management
**Objective**: Verify secure session handling and logout

**Steps**:
1. Login to business dashboard
2. Note session expiration time
3. Perform various dashboard actions
4. Click logout button
5. Attempt to access protected page

**Expected Results**:
- [ ] Session created with proper expiration
- [ ] Session activity updates with user actions
- [ ] Logout clears session completely
- [ ] Protected pages redirect to login after logout
- [ ] No authentication bypass possible

### 7. Security & Access Control
**Objective**: Verify data isolation and security measures

**Steps**:
1. Create second business account (different email)
2. Login as second business
3. Attempt to access first business's stores
4. Test direct API calls with wrong business ID

**Expected Results**:
- [ ] Second business cannot see first business's stores
- [ ] API calls return 403 for unauthorized store access
- [ ] RLS policies properly isolate business data
- [ ] Session tokens cannot be reused across businesses

## Performance Validation

### Response Time Requirements
Test with browser developer tools:
- [ ] Login response: <200ms
- [ ] Dashboard load: <100ms
- [ ] Store switching: <50ms
- [ ] Session validation: <10ms

### Load Testing (Optional)
Simulate concurrent users if load testing tools available:
- [ ] 10 concurrent business logins
- [ ] Store switching under load
- [ ] Session cleanup under high load

## Error Handling Validation

### Invalid Input Testing
- [ ] Registration with invalid email domain (should fail)
- [ ] Login with wrong password (should show error)
- [ ] Access expired session (should redirect to login)
- [ ] Switch to unauthorized store (should show error)

### Edge Cases
- [ ] Multiple rapid login attempts (rate limiting)
- [ ] Very long business names (validation)
- [ ] Special characters in business data
- [ ] Concurrent store switching

## Cleanup
After testing, clean up test data:
```sql
DELETE FROM business_stores WHERE business_id = (SELECT id FROM auth.users WHERE email = 'test@examplestore.se');
DELETE FROM stores WHERE id IN ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002');
DELETE FROM auth.users WHERE email = 'test@examplestore.se';
```

## Success Criteria
✅ All test scenarios pass without errors
✅ Performance requirements met
✅ Security measures validated
✅ Error handling works correctly
✅ Database integrity maintained

## Troubleshooting

### Common Issues
- **Registration fails**: Check email domain validation
- **Login redirects to approval page**: Verify admin approval completed
- **Store switching fails**: Check business_stores permissions
- **Session expires immediately**: Verify Supabase session configuration

### Debug Commands
```bash
# Check Supabase logs
npx supabase logs --project-ref YOUR_PROJECT_REF

# Verify database connection
npx supabase db ping

# Test API endpoints
curl -X POST http://localhost:3000/api/v1/auth/business/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@examplestore.se","password":"SecurePass123!"}'
```

This quickstart provides comprehensive validation of the business authentication system and ensures all requirements are met before production deployment.