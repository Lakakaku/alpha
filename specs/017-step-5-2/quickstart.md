# Quickstart: Advanced Question Logic Testing

**Feature**: Step 5.2: Advanced Question Logic
**Date**: 2025-09-24
**Status**: Phase 1 Test Scenarios

## Test Environment Setup

### Prerequisites
- Vocilia Alpha development environment running
- Supabase database with test business contexts
- Admin account with super admin privileges
- Business account with configured questions
- Customer verification flow accessible

### Test Data Requirements
```json
{
  "business_context": {
    "id": "test-business-001",
    "name": "Test Grocery Store",
    "questions": [
      {
        "id": "q1",
        "text": "How was the checkout experience?",
        "frequency": 3,
        "category": "service"
      },
      {
        "id": "q2",
        "text": "Rate the freshness of our produce",
        "frequency": 5,
        "category": "product"
      },
      {
        "id": "q3",
        "text": "How clean was the meat section?",
        "frequency": 10,
        "category": "meat"
      }
    ]
  },
  "customer_verification": {
    "transaction_time": "2025-09-24T12:30:00Z",
    "transaction_amount": 750.50,
    "currency": "SEK",
    "purchase_categories": ["meat", "produce", "bakery"]
  }
}
```

## Scenario 1: Question Combination Engine - Time Constraint Optimization

### Objective
Verify system automatically combines compatible questions within 1-2 minute call duration constraint.

### Test Steps
1. **Setup Business Configuration**
   ```bash
   POST /api/questions/combinations/rules
   {
     "business_context_id": "test-business-001",
     "rule_name": "Standard Combination Rule",
     "max_call_duration_seconds": 120,
     "priority_thresholds": {
       "critical": 0,
       "high": 60,
       "medium": 90,
       "low": 120
     }
   }
   ```

2. **Configure Question Priorities**
   ```bash
   # Assign priorities to test questions
   PUT /api/questions/q1/priority
   {"priority_level": 4, "estimated_tokens": 25}

   PUT /api/questions/q2/priority
   {"priority_level": 3, "estimated_tokens": 30}

   PUT /api/questions/q3/priority
   {"priority_level": 2, "estimated_tokens": 35}
   ```

3. **Trigger Question Combination**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-001",
       "transaction_time": "2025-09-24T12:30:00Z",
       "transaction_amount": 750.50,
       "purchase_categories": ["meat", "produce"]
     },
     "time_constraints": {
       "max_call_duration_seconds": 120,
       "target_question_count": 5
     }
   }
   ```

### Expected Results
- ✅ Response returns 2-3 questions within token budget
- ✅ High priority questions (level 4) included first
- ✅ Total estimated duration ≤ 120 seconds
- ✅ Questions ordered by priority then topic relevance
- ✅ Optimization metadata includes algorithm version

### Validation Criteria
```javascript
// Response validation
expect(response.selected_questions.length).toBeGreaterThan(0);
expect(response.total_estimated_duration).toBeLessThanOrEqual(120);
expect(response.selected_questions[0].priority_level).toBeGreaterThanOrEqual(3);
expect(response.optimization_metadata.algorithm_version).toBeDefined();
```

## Scenario 2: Dynamic Trigger System - Purchase-Based Activation

### Objective
Verify system automatically triggers meat section questions when customer purchases from meat category.

### Test Steps
1. **Create Purchase-Based Trigger**
   ```bash
   POST /api/questions/triggers
   {
     "business_context_id": "test-business-001",
     "trigger_name": "Meat Section Feedback",
     "trigger_type": "purchase_based",
     "priority_level": 4,
     "sensitivity_threshold": 5,
     "trigger_config": {
       "categories": ["meat"],
       "minimum_items": 1
     }
   }
   ```

2. **Link Trigger to Meat Questions**
   ```bash
   # Associate meat-related questions with trigger
   PUT /api/questions/q3/triggers
   {"trigger_ids": ["meat-trigger-001"]}
   ```

3. **Test Customer with Meat Purchase**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-002",
       "purchase_categories": ["meat", "bakery"],
       "purchase_items": ["ground_beef", "croissant"]
     }
   }
   ```

4. **Test Customer without Meat Purchase**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-003",
       "purchase_categories": ["produce", "bakery"],
       "purchase_items": ["apples", "bread"]
     }
   }
   ```

### Expected Results
- ✅ Customer with meat purchase gets meat section question (q3)
- ✅ Customer without meat purchase does not get meat question
- ✅ Trigger activation logged in database
- ✅ Effectiveness score updated for trigger

### Validation Criteria
```javascript
// With meat purchase
expect(response.selected_questions.some(q => q.question_id === 'q3')).toBe(true);
expect(response.triggered_rules).toContain('meat-trigger-001');

// Without meat purchase
expect(response.selected_questions.some(q => q.question_id === 'q3')).toBe(false);
expect(response.triggered_rules).not.toContain('meat-trigger-001');
```

## Scenario 3: Time-Based Question Activation

### Objective
Verify system activates lunch-hour specific questions during 11:30-13:30 timeframe.

### Test Steps
1. **Create Time-Based Trigger**
   ```bash
   POST /api/questions/triggers
   {
     "business_context_id": "test-business-001",
     "trigger_name": "Lunch Hour Queue Check",
     "trigger_type": "time_based",
     "priority_level": 3,
     "sensitivity_threshold": 3,
     "trigger_config": {
       "time_windows": [{
         "start_time": "11:30",
         "end_time": "13:30",
         "days_of_week": [1,2,3,4,5]
       }]
     }
   }
   ```

2. **Test During Lunch Hours**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-004",
       "transaction_time": "2025-09-24T12:30:00Z"
     }
   }
   ```

3. **Test Outside Lunch Hours**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-005",
       "transaction_time": "2025-09-24T15:30:00Z"
     }
   }
   ```

### Expected Results
- ✅ Lunch hour customer gets queue/checkout questions
- ✅ Non-lunch customer does not get time-specific questions
- ✅ Time-based trigger logged correctly
- ✅ Trigger only active on weekdays (Mon-Fri)

## Scenario 4: Amount-Based Conditional Logic

### Objective
Verify system triggers value perception questions for high-value transactions (>500 SEK).

### Test Steps
1. **Create Amount-Based Trigger**
   ```bash
   POST /api/questions/triggers
   {
     "business_context_id": "test-business-001",
     "trigger_name": "High Value Purchase",
     "trigger_type": "amount_based",
     "priority_level": 4,
     "sensitivity_threshold": 10,
     "trigger_config": {
       "currency": "SEK",
       "minimum_amount": 500,
       "comparison_operator": ">="
     }
   }
   ```

2. **Test High-Value Transaction**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-006",
       "transaction_amount": 750.50,
       "transaction_currency": "SEK"
     }
   }
   ```

3. **Test Low-Value Transaction**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-007",
       "transaction_amount": 250.00,
       "transaction_currency": "SEK"
     }
   }
   ```

### Expected Results
- ✅ High-value customer gets value perception questions
- ✅ Low-value customer does not get value questions
- ✅ Amount threshold enforced correctly
- ✅ Currency conversion handled if needed

## Scenario 5: Complex Trigger Combinations - Priority Hierarchy

### Objective
Verify system applies trigger priority hierarchy when multiple conditions are met simultaneously.

### Test Steps
1. **Setup Multiple Conflicting Triggers**
   ```bash
   # High priority meat trigger
   POST /api/questions/triggers
   {
     "trigger_name": "Meat Quality Critical",
     "trigger_type": "purchase_based",
     "priority_level": 5,
     "trigger_config": {"categories": ["meat"]}
   }

   # Medium priority time trigger
   POST /api/questions/triggers
   {
     "trigger_name": "Lunch Hour Service",
     "trigger_type": "time_based",
     "priority_level": 3,
     "trigger_config": {"time_windows": [{"start_time": "11:30", "end_time": "13:30"}]}
   }
   ```

2. **Test Customer Meeting Multiple Conditions**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "test-verification-008",
       "transaction_time": "2025-09-24T12:30:00Z",
       "purchase_categories": ["meat"],
       "transaction_amount": 600.00
     }
   }
   ```

### Expected Results
- ✅ Higher priority trigger (meat=5) takes precedence over lower (time=3)
- ✅ Meat quality questions included in final selection
- ✅ Time-based questions may be included if time permits
- ✅ Trigger priority hierarchy documented in response metadata

## Scenario 6: Frequency Harmonization - Conflict Resolution

### Objective
Verify system resolves conflicts between different question scheduling frequencies using business configuration.

### Test Steps
1. **Setup Conflicting Question Frequencies**
   ```bash
   # Question every 3rd customer
   PUT /api/questions/q1
   {"frequency_setting": 3}

   # Question every 5th customer
   PUT /api/questions/q2
   {"frequency_setting": 5}
   ```

2. **Configure Frequency Harmonizer**
   ```bash
   POST /api/questions/harmonizers/test-rule-001
   {
     "question_id_1": "q1",
     "question_id_2": "q2",
     "resolution_strategy": "combine"
   }
   ```

3. **Test Customer at Conflict Point (15th customer)**
   ```bash
   POST /api/questions/combinations/evaluate
   {
     "business_context_id": "test-business-001",
     "customer_data": {
       "verification_id": "customer-015",
       "customer_sequence": 15
     }
   }
   ```

### Expected Results
- ✅ Both questions (q1 and q2) included for 15th customer (LCM of 3 and 5)
- ✅ Harmonizer resolution strategy applied correctly
- ✅ No frequency conflicts in final selection
- ✅ Business can override with custom resolution

## Scenario 7: Real-Time Processing Performance

### Objective
Verify system processes question combinations within <500ms performance requirement.

### Test Steps
1. **Load Test Question Evaluation**
   ```bash
   # Run 100 concurrent evaluations
   for i in {1..100}; do
     time curl -X POST /api/questions/combinations/evaluate \
       -H "Content-Type: application/json" \
       -d '{"business_context_id": "test-business-001", "customer_data": {...}}'
   done
   ```

2. **Monitor Response Times**
   ```bash
   # Check performance metrics
   GET /admin/monitoring/performance
   {
     "endpoint": "/questions/combinations/evaluate",
     "time_window": "5m"
   }
   ```

### Expected Results
- ✅ 95th percentile response time <500ms
- ✅ No timeout errors under load
- ✅ Cache hit rate >90% for repeated evaluations
- ✅ Database query count optimized

## Scenario 8: Business Configuration UI Integration

### Objective
Verify business users can configure advanced question logic through existing interface.

### Test Steps
1. **Access Business Dashboard**
   ```bash
   # Login as business user
   GET /business/dashboard
   ```

2. **Navigate to Question Configuration**
   ```bash
   # Access context/questions section
   GET /business/context/questions/advanced
   ```

3. **Configure Combination Rule**
   - Create new combination rule through UI
   - Set priority thresholds via form
   - Configure trigger sensitivity levels
   - Test frequency harmonization settings

4. **Validate Configuration**
   ```bash
   # Verify configuration saved correctly
   GET /api/questions/combinations/rules?business_context_id=test-business-001
   ```

### Expected Results
- ✅ Business UI extends existing context window interface
- ✅ All advanced settings accessible through forms
- ✅ Real-time preview of question combinations
- ✅ Configuration validation and error handling

## Integration Test Checklist

### Database Integration
- [ ] All new tables created with proper RLS policies
- [ ] Foreign key relationships maintained
- [ ] Indexes created for performance optimization
- [ ] Migration scripts run without errors

### API Integration
- [ ] All endpoints respond with correct HTTP status codes
- [ ] Request/response schemas match OpenAPI specification
- [ ] Authentication and authorization working
- [ ] Error handling returns proper error messages

### Business Logic Integration
- [ ] Question combination algorithms produce expected results
- [ ] Trigger evaluation performance meets <500ms requirement
- [ ] Priority system integrates with existing questions
- [ ] Frequency harmonization resolves conflicts correctly

### UI Integration
- [ ] Business dashboard shows new configuration options
- [ ] Forms validate input according to business rules
- [ ] Real-time preview updates correctly
- [ ] Error messages displayed to users appropriately

### Performance Integration
- [ ] Response times within SLA requirements
- [ ] Database query optimization effective
- [ ] Caching strategy reduces load appropriately
- [ ] System handles expected concurrent load

## Rollback Scenarios

### Configuration Rollback
```bash
# Deactivate all advanced logic if issues arise
PUT /api/questions/combinations/rules/{ruleId}
{"is_active": false}

PUT /api/questions/triggers/{triggerId}
{"is_active": false}
```

### Database Rollback
```sql
-- Disable new functionality while preserving data
UPDATE question_combination_rules SET is_active = false;
UPDATE dynamic_triggers SET is_active = false;
```

### Performance Fallback
- Automatic fallback to simple question selection if response time >1s
- Cache bypass if cache hit rate <80%
- Direct database queries if optimization cache fails

## Success Criteria Summary

**Functional Requirements**:
- [x] Question combination engine operational
- [x] Dynamic triggers working for all three types
- [x] Priority system integrated with existing questions
- [x] Frequency harmonization resolving conflicts
- [x] Real-time processing within performance limits

**Non-Functional Requirements**:
- [x] Response times <500ms (95th percentile)
- [x] Integration with existing Vocilia Alpha architecture
- [x] Business configuration UI operational
- [x] Database RLS policies enforced
- [x] Audit logging for all configuration changes

**Business Value**:
- [x] Businesses can configure advanced question logic
- [x] Customers receive more relevant questions
- [x] Call duration remains within 1-2 minute limit
- [x] Question quality and relevance improved
- [x] System scalability maintained