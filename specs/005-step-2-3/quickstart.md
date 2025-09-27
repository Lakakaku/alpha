# Quickstart: Business Context Window

**Feature**: 005-step-2-3 | **Date**: 2025-09-21 | **Environment**: Development

## Prerequisites

### System Requirements

- Node.js 18+ and pnpm 8+
- Supabase project "alpha" configured
- Existing Vocilia monorepo with business authentication

### Environment Setup

```bash
# Verify monorepo structure
cd /path/to/alpha
pnpm install

# Check existing business app
cd apps/business && pnpm dev
# Should start on http://localhost:3001

# Check existing backend
cd apps/backend && pnpm dev
# Should start on http://localhost:3000
```

### Database Prerequisites

```bash
# Verify business authentication tables exist
npx supabase db pull
# Should include: businesses, business_stores, business_store_permissions

# Apply new context migrations (when available)
npx supabase db push
```

## Quick Test Scenarios

### Scenario 1: Store Profile Configuration ⏱️ 3 minutes

**Goal**: Business owner configures basic store information

1. **Access Context Route**

   ```bash
   # Start business app
   cd apps/business && pnpm dev

   # Navigate to: http://localhost:3001/login
   # Login with existing business account
   # Navigate to: http://localhost:3001/context
   ```

2. **Configure Store Profile**
   - Store Type: "grocery"
   - Size: 500 square meters
   - Departments: 8
   - Layout: "grid"
   - Operating Hours: Mon-Fri 8:00-20:00, Sat-Sun 10:00-18:00

3. **Verify API Integration**

   ```bash
   # Check backend logs for context API calls
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:3000/api/business/stores/STORE_ID/context/profile
   ```

4. **Expected Result**
   - Form saves successfully with <200ms response time
   - Context completeness shows 25% (profile section complete)
   - Navigation shows "Personnel" as next step

### Scenario 2: Personnel Management ⏱️ 4 minutes

**Goal**: Business configures staff information and service points

1. **Access Personnel Section**

   ```bash
   # From previous scenario or direct navigation
   # Navigate to: http://localhost:3001/context/personnel
   ```

2. **Configure Personnel Details**
   - Total Staff: 12 employees
   - Manager: "Anna Svensson"
   - Service Points: Main entrance info desk (2 staff)
   - Department Heads: Grocery "Erik Johansson", Electronics "Maria Lindberg"
   - Shifts: Morning (6-14), Afternoon (14-22)

3. **Verify Shift Configuration**
   - Morning: 8 staff, allocation: Checkout(3), Grocery(3), Electronics(2)
   - Afternoon: 6 staff, allocation: Checkout(2), Grocery(2), Electronics(2)

4. **Expected Result**
   - Personnel data saves with proper validation
   - Context completeness shows 50% (profile + personnel complete)
   - Shift calculations display correctly

### Scenario 3: Interactive Layout Builder ⏱️ 5 minutes

**Goal**: Business documents store layout and department positioning

1. **Access Layout Section**

   ```bash
   # Navigate to: http://localhost:3001/context/layout
   ```

2. **Configure Basic Layout**
   - Entrances: 2 (main + side)
   - Exits: 3 (including emergency)
   - Customer Flow: "clockwise"
   - Checkout Location: Near main entrance

3. **Position Departments**
   - Grocery: Front-left quadrant
   - Electronics: Back-right quadrant
   - Customer Service: Near main entrance
   - Returns: Side entrance area

4. **Test Image Upload** (when available)

   ```bash
   # Upload store layout image (optional)
   # File should be <2MB, formats: JPG, PNG, PDF
   ```

5. **Expected Result**
   - Layout saves with department positions
   - Context completeness shows 75% (3/4 sections complete)
   - Store map displays department locations

### Scenario 4: Inventory & Services Configuration ⏱️ 3 minutes

**Goal**: Complete context with product categories and services

1. **Access Inventory Section**

   ```bash
   # Navigate to: http://localhost:3001/context/inventory
   ```

2. **Configure Product Categories**
   - Primary: ["grocery", "electronics", "household"]
   - Payment Methods: ["cash", "card", "swish", "klarna"]
   - Price Range: "mid-range"
   - Brand Focus: "mixed"

3. **Add Special Services**
   - Delivery: Available Mon-Fri, fee-based
   - Installation: Electronics only, purchase-dependent
   - Custom Orders: All departments, advance payment required

4. **Complete Configuration**
   - Seasonal Variations: Summer (outdoor items), Winter (indoor focus)
   - Loyalty Program: "ICA-kort integration"

5. **Expected Result**
   - Context completeness shows 100%
   - All sections show green completion indicators
   - Export for AI integration available

### Scenario 5: Version Management & AI Export ⏱️ 2 minutes

**Goal**: Test context versioning and AI integration export

1. **Create Context Version**

   ```bash
   # API call to create version snapshot
   curl -X POST \
        -H "Authorization: Bearer TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"changeSummary": "Initial complete context setup"}' \
        http://localhost:3000/api/business/stores/STORE_ID/context/versions
   ```

2. **Test AI Export**

   ```bash
   # Export structured format for AI
   curl -H "Authorization: Bearer TOKEN" \
        "http://localhost:3000/api/business/stores/STORE_ID/context/export?format=structured"

   # Export narrative format for AI
   curl -H "Authorization: Bearer TOKEN" \
        "http://localhost:3000/api/business/stores/STORE_ID/context/export?format=narrative"
   ```

3. **Verify Real-time Updates**
   - Make small change to store profile
   - Verify AI export reflects changes immediately
   - Check context version history shows incremental changes

4. **Expected Result**
   - Context exports in multiple formats for AI consumption
   - Version history tracks all changes with timestamps
   - Real-time updates work without browser refresh

## Integration Verification

### API Contract Validation

```bash
# Run contract tests (when available)
cd apps/backend && pnpm test:contracts

# Verify all endpoints respond correctly
npm run test:integration -- --grep "context"
```

### Database Validation

```bash
# Check RLS policies
npx supabase db test

# Verify context data isolation between businesses
# Test with multiple business accounts
```

### Frontend Validation

```bash
# Component tests
cd apps/business && pnpm test

# Accessibility tests
npm run test:a11y -- --grep "context"

# Performance tests (form save <200ms)
npm run test:performance
```

## Common Issues & Solutions

### Issue 1: Context Not Saving

**Symptoms**: Form submits but data not persisted **Solution**:

```bash
# Check backend logs for validation errors
cd apps/backend && pnpm dev

# Verify business has context permissions
# Check RLS policies allow INSERT/UPDATE for business_id
```

### Issue 2: Layout Image Upload Fails

**Symptoms**: Image upload returns 403 or 413 error **Solution**:

```bash
# Check Supabase storage bucket permissions
# Verify file size <2MB
# Ensure supported format (JPG, PNG, PDF)
```

### Issue 3: Personnel Shifts Don't Calculate

**Symptoms**: Total staff doesn't match shift allocations **Solution**:

- Verify shift times don't overlap
- Check department allocation numbers sum correctly
- Ensure all shifts cover operating hours

### Issue 4: Context Completeness Stuck

**Symptoms**: Score doesn't reach 100% despite filling all fields **Solution**:

```bash
# Check validation rules in database
# Verify required fields marked properly
# Review completeness calculation logic
```

## Performance Benchmarks

### Response Time Targets

- Context retrieval: <100ms
- Form save operations: <200ms
- Image upload: <2s for 2MB file
- Context export: <300ms
- Real-time updates: <100ms propagation

### Load Testing

```bash
# Test concurrent context updates
# Simulate 10 businesses updating context simultaneously
# Verify RLS isolation under load
```

## Next Steps

### Integration with AI Feedback

1. Configure AI system to consume context exports
2. Test context-based question generation
3. Verify fraud detection uses context baseline

### Multi-Store Support

1. Test context configuration for businesses with multiple stores
2. Verify context isolation between stores
3. Test bulk context operations

### Advanced Features

1. Context templates for similar store types
2. AI-powered context suggestions
3. Context sharing between business locations

---

_Quickstart complete - Ready for implementation tasks_
