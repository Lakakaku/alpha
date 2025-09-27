# Question Logic API Documentation

## Overview

The Question Logic API provides endpoints for managing advanced question combination rules and dynamic trigger systems in Vocilia Alpha. This system intelligently combines and triggers relevant questions for customer feedback calls based on purchase behavior, timing, and business rules within 1-2 minute call duration constraints.

## Base URL

- **Production**: `https://api.vocilia.com/v1`
- **Staging**: `https://staging-api.vocilia.com/v1`

## Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer <your_access_token>
```

## Question Combination Rules

### GET /questions/combinations/rules

Get question combination rules for a business.

**Parameters:**
- `business_context_id` (required, UUID): Business context identifier

**Response (200):**
```json
[
  {
    "id": "uuid",
    "business_context_id": "uuid",
    "rule_name": "Default Rule",
    "max_call_duration_seconds": 120,
    "priority_threshold_critical": 0,
    "priority_threshold_high": 60,
    "priority_threshold_medium": 90,
    "priority_threshold_low": 120,
    "is_active": true,
    "created_at": "2025-09-24T10:00:00Z",
    "updated_at": "2025-09-24T10:00:00Z"
  }
]
```

### POST /questions/combinations/rules

Create a new question combination rule.

**Request Body:**
```json
{
  "business_context_id": "uuid",
  "rule_name": "New Rule",
  "max_call_duration_seconds": 120,
  "priority_threshold_critical": 0,
  "priority_threshold_high": 60,
  "priority_threshold_medium": 90,
  "priority_threshold_low": 120
}
```

**Response (201):** Returns created rule object.

### PUT /questions/combinations/rules/{rule_id}

Update an existing question combination rule.

**Parameters:**
- `rule_id` (required, UUID): Rule identifier

**Request Body:** Same as POST request.

**Response (200):** Returns updated rule object.

### DELETE /questions/combinations/rules/{rule_id}

Delete a question combination rule.

**Parameters:**
- `rule_id` (required, UUID): Rule identifier

**Response (204):** No content.

## Dynamic Triggers

### GET /questions/triggers

Get dynamic triggers for a business.

**Parameters:**
- `business_context_id` (required, UUID): Business context identifier
- `trigger_type` (optional): Filter by trigger type (`purchase_based`, `time_based`, `amount_based`)
- `is_active` (optional, boolean): Filter by active status

**Response (200):**
```json
[
  {
    "id": "uuid",
    "business_context_id": "uuid",
    "trigger_name": "High Value Purchase",
    "trigger_type": "amount_based",
    "priority_level": 4,
    "sensitivity_threshold": 10,
    "is_active": true,
    "trigger_config": {
      "currency": "SEK",
      "minimum_amount": 500,
      "comparison_operator": ">="
    },
    "effectiveness_score": 0.85,
    "created_at": "2025-09-24T10:00:00Z",
    "updated_at": "2025-09-24T10:00:00Z"
  }
]
```

### POST /questions/triggers

Create a new dynamic trigger.

**Request Body:**
```json
{
  "business_context_id": "uuid",
  "trigger_name": "Meat Department Purchase",
  "trigger_type": "purchase_based",
  "priority_level": 3,
  "sensitivity_threshold": 5,
  "trigger_config": {
    "categories": ["meat"],
    "minimum_items": 1
  }
}
```

**Response (201):** Returns created trigger object.

### PUT /questions/triggers/{trigger_id}

Update an existing dynamic trigger.

**Parameters:**
- `trigger_id` (required, UUID): Trigger identifier

**Request Body:** Same as POST request.

**Response (200):** Returns updated trigger object.

### DELETE /questions/triggers/{trigger_id}

Delete a dynamic trigger.

**Parameters:**
- `trigger_id` (required, UUID): Trigger identifier

**Response (204):** No content.

## Question Groups

### GET /questions/groups

Get question groups for a combination rule.

**Parameters:**
- `rule_id` (required, UUID): Combination rule identifier

**Response (200):**
```json
[
  {
    "id": "uuid",
    "rule_id": "uuid",
    "group_name": "Service Quality",
    "topic_category": "service",
    "estimated_tokens": 150,
    "display_order": 1,
    "is_active": true,
    "created_at": "2025-09-24T10:00:00Z"
  }
]
```

### POST /questions/groups

Create a new question group.

**Request Body:**
```json
{
  "rule_id": "uuid",
  "group_name": "Product Quality",
  "topic_category": "product",
  "estimated_tokens": 120,
  "display_order": 2
}
```

**Response (201):** Returns created group object.

## Question Evaluation

### POST /questions/evaluate

Evaluate and select optimal questions for a customer.

**Request Body:**
```json
{
  "business_context_id": "uuid",
  "customer_verification_id": "uuid",
  "customer_data": {
    "purchase_categories": ["meat", "bakery"],
    "transaction_amount": 750,
    "purchase_time": "2025-09-24T12:30:00Z",
    "store_location": "stockholm_center"
  }
}
```

**Response (200):**
```json
{
  "selected_questions": [
    {
      "question_id": "uuid",
      "question_text": "How was the meat quality today?",
      "estimated_tokens": 25,
      "priority_level": 4,
      "trigger_reasons": ["purchase_based_meat", "high_value_purchase"]
    }
  ],
  "total_estimated_duration": 95,
  "optimization_algorithm": "time_balanced",
  "cache_hit": true,
  "processing_time_ms": 45
}
```

## Priority Weights

### GET /questions/priorities

Get priority weights for questions.

**Parameters:**
- `business_context_id` (required, UUID): Business context identifier
- `question_id` (optional, UUID): Filter by specific question

**Response (200):**
```json
[
  {
    "id": "uuid",
    "question_id": "uuid",
    "priority_level": 4,
    "weight_multiplier": 1.2,
    "effective_priority": 4.8,
    "assigned_by": "uuid",
    "assigned_at": "2025-09-24T10:00:00Z",
    "is_system_assigned": false
  }
]
```

### PUT /questions/priorities/{priority_id}

Update question priority weight.

**Parameters:**
- `priority_id` (required, UUID): Priority weight identifier

**Request Body:**
```json
{
  "priority_level": 5,
  "weight_multiplier": 1.0
}
```

**Response (200):** Returns updated priority weight object.

## Frequency Harmonizers

### GET /questions/harmonizers

Get frequency harmonizers for resolving question conflicts.

**Parameters:**
- `rule_id` (required, UUID): Combination rule identifier

**Response (200):**
```json
[
  {
    "id": "uuid",
    "rule_id": "uuid",
    "question_pair_hash": "hash_value",
    "question_id_1": "uuid",
    "question_id_2": "uuid",
    "resolution_strategy": "combine",
    "custom_frequency": null,
    "priority_question_id": null,
    "created_at": "2025-09-24T10:00:00Z",
    "updated_at": "2025-09-24T10:00:00Z"
  }
]
```

### POST /questions/harmonizers

Create a new frequency harmonizer.

**Request Body:**
```json
{
  "rule_id": "uuid",
  "question_id_1": "uuid",
  "question_id_2": "uuid",
  "resolution_strategy": "priority",
  "priority_question_id": "uuid"
}
```

**Response (201):** Returns created harmonizer object.

## Analytics & Monitoring

### GET /questions/analytics/triggers

Get trigger activation analytics.

**Parameters:**
- `business_context_id` (required, UUID): Business context identifier
- `start_date` (optional): Filter from date (ISO 8601)
- `end_date` (optional): Filter to date (ISO 8601)
- `trigger_id` (optional, UUID): Filter by specific trigger

**Response (200):**
```json
{
  "total_activations": 1250,
  "average_questions_per_call": 3.2,
  "cache_hit_rate": 0.92,
  "average_processing_time_ms": 48,
  "trigger_effectiveness": [
    {
      "trigger_id": "uuid",
      "trigger_name": "High Value Purchase",
      "activation_count": 420,
      "effectiveness_score": 0.85,
      "average_feedback_quality": 4.2
    }
  ]
}
```

### GET /questions/analytics/performance

Get question logic performance metrics.

**Parameters:**
- `business_context_id` (optional, UUID): Filter by business
- `timeframe` (optional): `hour`, `day`, `week`, `month` (default: `day`)

**Response (200):**
```json
{
  "average_evaluation_time_ms": 45,
  "p95_evaluation_time_ms": 120,
  "cache_hit_rate": 0.92,
  "total_evaluations": 50000,
  "error_rate": 0.001,
  "optimization_algorithm_usage": {
    "greedy": 0.45,
    "time_balanced": 0.35,
    "dynamic_programming": 0.15,
    "token_estimation": 0.05
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "validation_error",
  "message": "Invalid request parameters",
  "details": [
    {
      "field": "priority_level",
      "message": "Must be between 1 and 5"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "forbidden",
  "message": "Insufficient permissions to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please retry after 60 seconds.",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An internal server error occurred",
  "request_id": "uuid"
}
```

## Rate Limits

- **Standard requests**: 1000 requests per hour per API key
- **Question evaluation**: 500 requests per hour per business
- **Analytics requests**: 100 requests per hour per API key

## Data Types Reference

### Priority Levels
- `1`: Optional
- `2`: Low
- `3`: Medium
- `4`: High
- `5`: Critical

### Trigger Types
- `purchase_based`: Triggered by specific purchase categories or items
- `time_based`: Triggered by purchase timing (hour, day of week)
- `amount_based`: Triggered by transaction amount thresholds

### Resolution Strategies
- `combine`: Ask both questions in same call when possible
- `priority`: Always prioritize one question over the other
- `alternate`: Alternate between questions over time
- `custom`: Use custom frequency interval

### Optimization Algorithms
- `greedy`: Prioritize highest value questions first
- `time_balanced`: Balance high priority with time utilization
- `dynamic_programming`: Optimal solution for complex scenarios
- `token_estimation`: Precise time prediction based on tokens

## Best Practices

1. **Cache Management**: Question evaluation results are cached for 1 hour. Use the `cache_hit` flag to monitor cache effectiveness.

2. **Performance**: Keep trigger configurations simple for sub-500ms evaluation times.

3. **Priority Management**: Use the 5-level priority system consistently across your question set.

4. **Frequency Conflicts**: Configure harmonizers proactively for questions with different frequency settings.

5. **Monitoring**: Regularly check analytics endpoints for trigger effectiveness and system performance.

6. **Testing**: Use staging environment for testing new trigger configurations before production deployment.