# Quickstart: Custom Questions Configuration Panel

**Validation Guide** | **Date**: 2025-09-21

## Overview

This quickstart guide provides step-by-step validation scenarios to verify the
Custom Questions Configuration Panel implementation. Each scenario corresponds
to acceptance criteria from the feature specification.

## Prerequisites

- Running Vocilia development environment (`pnpm dev`)
- Business account authenticated in apps/business
- Supabase instance with question schema deployed
- Test business with at least one store configured

## Setup Verification

### 1. Environment Check

```bash
# Verify development environment
pnpm dev

# Check database schema
npx supabase db pull
npx supabase gen types

# Verify backend services
curl http://localhost:3001/health
```

**Expected**: All services running, database schema includes question tables

### 2. Authentication Test

```bash
# Business app accessible
open http://localhost:3000/login

# Login with test business account
# Navigate to dashboard
```

**Expected**: Successful login, dashboard loads with navigation menu

## User Scenario Validation

### Scenario 1: Create New Question

**Story**: Business manager creates a custom feedback question

#### Steps:

1. Navigate to `/questions` in business dashboard
2. Click "Create New Question" button
3. Fill question form:
   - Question text: "How satisfied were you with our customer service today?"
   - Type: "rating"
   - Priority: "high"
   - Frequency: "Every 5 customers"
   - Department: "Customer Service"
4. Save question as draft

#### Validation Points:

- [ ] Questions page loads without errors
- [ ] Create form validates input (min 10 chars, max 500)
- [ ] Question saves successfully
- [ ] Question appears in list with "draft" status
- [ ] Form resets after successful save

#### API Contract Test:

```bash
curl -X POST http://localhost:3001/api/questions \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "question_text": "How satisfied were you with our customer service today?",
    "question_type": "rating",
    "priority": "high",
    "frequency_target": 5,
    "frequency_window": "daily",
    "department": "Customer Service"
  }'
```

**Expected Response**: 201 Created with question object

### Scenario 2: Question Category Management

**Story**: Business manager organizes questions into categories

#### Steps:

1. Navigate to "Categories" section
2. Create new category:
   - Name: "Service Quality"
   - Description: "Questions about customer service experience"
   - Color: "#3B82F6"
3. Assign existing question to category
4. Verify category appears in question filters

#### Validation Points:

- [ ] Category creation form works
- [ ] Category saves with validation
- [ ] Questions can be assigned to categories
- [ ] Filter by category functions correctly
- [ ] Category color displays in UI

#### API Contract Test:

```bash
curl -X POST http://localhost:3001/api/questions/categories \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Service Quality",
    "description": "Questions about customer service experience",
    "color": "#3B82F6"
  }'
```

### Scenario 3: Question Preview Functionality

**Story**: Manager previews how question appears to customers

#### Steps:

1. Open existing question in edit mode
2. Click "Preview" button
3. Verify preview shows exact customer interface
4. Test with different question types (text, rating, multiple choice)
5. Check preview updates with question changes

#### Validation Points:

- [ ] Preview button generates preview without errors
- [ ] Preview HTML matches customer interface design
- [ ] Rating questions show star/number interface
- [ ] Text questions show input field
- [ ] Preview updates when question text changes

#### API Contract Test:

```bash
curl -X POST http://localhost:3001/api/questions/$QUESTION_ID/preview \
  -H "Authorization: Bearer $SUPABASE_JWT"
```

**Expected Response**: HTML preview and completion time estimate

### Scenario 4: Question Activation/Deactivation

**Story**: Manager controls when questions are presented

#### Steps:

1. Select draft question from list
2. Click "Activate" button
3. Verify status changes to "active"
4. Test deactivation process
5. Verify immediate effect on customer experience

#### Validation Points:

- [ ] Activation changes status from draft to active
- [ ] Deactivation stops question presentation immediately
- [ ] Status indicators update in real-time
- [ ] Only valid questions can be activated
- [ ] Warning for incomplete question setup

#### API Contract Test:

```bash
# Activate question
curl -X POST http://localhost:3001/api/questions/$QUESTION_ID/activate \
  -H "Authorization: Bearer $SUPABASE_JWT"

# Deactivate question
curl -X POST http://localhost:3001/api/questions/$QUESTION_ID/deactivate \
  -H "Authorization: Bearer $SUPABASE_JWT"
```

### Scenario 5: Trigger Configuration

**Story**: Manager sets up advanced question triggers

#### Steps:

1. Open question trigger configuration
2. Add purchase amount trigger: "Show for purchases >100 SEK"
3. Add time-based trigger: "Only during business hours"
4. Test combination trigger logic
5. Save trigger configuration

#### Validation Points:

- [ ] Trigger form loads with available options
- [ ] Purchase amount trigger accepts valid values
- [ ] Time-based trigger allows hour selection
- [ ] Combination logic (AND/OR) works correctly
- [ ] Trigger validation prevents invalid configurations

#### API Contract Test:

```bash
curl -X POST http://localhost:3001/api/questions/$QUESTION_ID/triggers \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_type": "purchase_amount",
    "trigger_config": {
      "operator": ">=",
      "value": 100,
      "currency": "SEK"
    }
  }'
```

### Scenario 6: Frequency Management

**Story**: Manager controls question frequency limits

#### Steps:

1. Configure question frequency: "Show to every 10 customers"
2. Set frequency window: "Daily"
3. Monitor frequency counter in dashboard
4. Verify limit enforcement
5. Test frequency reset behavior

#### Validation Points:

- [ ] Frequency settings save correctly
- [ ] Counter increments with question presentations
- [ ] Question stops appearing when limit reached
- [ ] Daily reset works automatically
- [ ] Frequency display updates in real-time

## Edge Case Testing

### 1. Active Period Expiration

**Test**: Question active period expires during customer session

#### Steps:

1. Set question with short active period (next 5 minutes)
2. Start customer feedback session
3. Wait for expiration during session
4. Verify question behavior

**Expected**: Question continues for current session, stops for new sessions

### 2. Conflicting Triggers

**Test**: Multiple questions match same trigger conditions

#### Steps:

1. Create multiple questions with overlapping triggers
2. Trigger customer interaction matching all conditions
3. Verify priority-based question selection
4. Check that only appropriate number of questions shown

**Expected**: Highest priority question selected, frequency limits respected

### 3. Frequency Limit Edge Cases

**Test**: Frequency limit reached exactly

#### Steps:

1. Set question frequency to 1 customer
2. Present question to customer
3. Attempt to present to second customer immediately
4. Verify proper blocking behavior

**Expected**: Second customer does not see question until frequency resets

## Performance Validation

### 1. Response Time Testing

```bash
# Measure question list loading
time curl http://localhost:3001/api/questions \
  -H "Authorization: Bearer $SUPABASE_JWT"

# Measure question creation
time curl -X POST http://localhost:3001/api/questions \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '$QUESTION_DATA'

# Measure preview generation
time curl -X POST http://localhost:3001/api/questions/$ID/preview \
  -H "Authorization: Bearer $SUPABASE_JWT"
```

**Target Metrics**:

- Question list: <200ms
- Question creation: <200ms
- Preview generation: <100ms
- Trigger evaluation: <50ms

### 2. Concurrent User Testing

```bash
# Simulate multiple users creating questions
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/questions \
    -H "Authorization: Bearer $SUPABASE_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"question_text\":\"Test question $i\", ...}" &
done
wait
```

**Expected**: All requests succeed without conflicts

## Security Validation

### 1. RLS Policy Testing

```bash
# Test cross-business access (should fail)
curl http://localhost:3001/api/questions \
  -H "Authorization: Bearer $OTHER_BUSINESS_JWT"

# Test unauthorized access (should fail)
curl http://localhost:3001/api/questions
```

**Expected**: 401/403 responses for unauthorized access

### 2. Input Validation

```bash
# Test SQL injection attempt
curl -X POST http://localhost:3001/api/questions \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -d '{"question_text": "'; DROP TABLE custom_questions; --"}'

# Test XSS attempt
curl -X POST http://localhost:3001/api/questions \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -d '{"question_text": "<script>alert(\"xss\")</script>"}'
```

**Expected**: Proper sanitization and validation, no code execution

## Completion Checklist

### Functional Requirements

- [ ] FR-001: Rich text formatting works
- [ ] FR-002: Frequency settings (1-100) validated
- [ ] FR-003: Department tagging functional
- [ ] FR-004: Priority levels implemented
- [ ] FR-005: Category organization works
- [ ] FR-006: Active period selection functional
- [ ] FR-007: Preview functionality accurate
- [ ] FR-008: Activation/deactivation immediate
- [ ] FR-009: Purchase-based triggers work
- [ ] FR-010: Time-based triggers functional
- [ ] FR-011: Amount-based triggers implemented
- [ ] FR-012: Conditional logic operational
- [ ] FR-013: Frequency limits enforced
- [ ] FR-014: Priority-based selection works
- [ ] FR-015: Configuration persistence verified

### Technical Requirements

- [ ] TypeScript strict mode compliance
- [ ] RLS policies protect data access
- [ ] API contracts match OpenAPI specification
- [ ] Performance targets achieved
- [ ] Error handling implemented
- [ ] Input validation comprehensive
- [ ] Real-time updates functional

### Integration Requirements

- [ ] Integrates with existing business authentication
- [ ] Shares components with customer interface
- [ ] Database migrations successful
- [ ] Backend services operational
- [ ] Frontend routing functional

## Troubleshooting

### Common Issues

1. **Question creation fails**: Check RLS policies and business association
2. **Preview not loading**: Verify shared component library
3. **Triggers not working**: Check trigger configuration JSON format
4. **Frequency not resetting**: Verify cron job or scheduled reset
5. **Performance issues**: Check database indexes and query optimization

### Debug Commands

```bash
# Check database connections
npx supabase status

# View logs
pnpm logs:backend
pnpm logs:business

# Test API endpoints
curl -v http://localhost:3001/api/questions/health
```

---

**Quickstart Complete**: Ready for implementation and testing
