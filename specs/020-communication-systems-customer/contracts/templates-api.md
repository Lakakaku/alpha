# Templates API Contract

**Version**: 1.0.0
**Base Path**: `/api/admin/communication/templates`
**Authentication**: Required (Admin JWT token)
**Authorization**: Admin users only

## GET /api/admin/communication/templates
List all communication templates

**Query Parameters**:
- `notification_type`: Filter by notification type
- `channel`: Filter by channel (sms, email)
- `language`: Filter by language (default: all)
- `is_active`: Filter by active status (default: true)
- `limit`: Results per page (default 50, max 100)
- `offset`: Pagination offset

**Response (200 OK)**:
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "reward_earned_sms_sv",
      "notification_type": "reward_earned",
      "channel": "sms",
      "language": "sv",
      "subject_template": null,
      "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK för din feedback. Betalning sker {{payment_date}}. /STOP för att avsluta",
      "required_variables": ["customer_name", "reward_amount", "payment_date"],
      "is_active": true,
      "version": 2,
      "created_at": "2025-09-25T10:00:00Z",
      "updated_at": "2025-09-25T14:30:00Z"
    }
  ],
  "total_count": 15,
  "has_more": false
}
```

## GET /api/admin/communication/templates/{id}
Get specific template details

**Path Parameters**:
- `id`: Template UUID

**Response (200 OK)**:
```json
{
  "id": "uuid",
  "name": "reward_earned_sms_sv",
  "notification_type": "reward_earned",
  "channel": "sms",
  "language": "sv",
  "subject_template": null,
  "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK för din feedback. Betalning sker {{payment_date}}. /STOP för att avsluta",
  "required_variables": ["customer_name", "reward_amount", "payment_date"],
  "is_active": true,
  "version": 2,
  "created_by": {
    "id": "uuid",
    "name": "Admin User",
    "email": "admin@vocilia.se"
  },
  "created_at": "2025-09-25T10:00:00Z",
  "updated_at": "2025-09-25T14:30:00Z",
  "usage_stats": {
    "total_sent": 1247,
    "last_used": "2025-09-25T15:22:00Z",
    "success_rate": 96.8
  }
}
```

## POST /api/admin/communication/templates
Create new communication template

**Request Body**:
```json
{
  "name": "payment_confirmed_sms_sv",
  "notification_type": "payment_confirmed",
  "channel": "sms",
  "language": "sv",
  "subject_template": null, // null for SMS, required for email
  "content_template": "Betalning mottagen! {{amount}} SEK har skickats till {{phone_number}} för din feedback från {{store_name}}. Tack! /STOP för att avsluta",
  "required_variables": ["amount", "phone_number", "store_name"]
}
```

**Response (201 Created)**:
```json
{
  "id": "uuid",
  "name": "payment_confirmed_sms_sv",
  "notification_type": "payment_confirmed",
  "channel": "sms",
  "language": "sv",
  "content_template": "Betalning mottagen! {{amount}} SEK har skickats till {{phone_number}} för din feedback från {{store_name}}. Tack! /STOP för att avsluta",
  "required_variables": ["amount", "phone_number", "store_name"],
  "is_active": true,
  "version": 1,
  "created_at": "2025-09-25T16:00:00Z"
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "content_template",
      "message": "SMS template exceeds 1600 character limit when rendered"
    },
    {
      "field": "required_variables",
      "message": "Variable 'customer_name' used in template but not declared as required"
    }
  ]
}
```

## PUT /api/admin/communication/templates/{id}
Update existing template (creates new version)

**Path Parameters**:
- `id`: Template UUID

**Request Body**:
```json
{
  "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK ({{feedback_score}}% kvalitet). Betalning {{payment_date}}. /STOP",
  "required_variables": ["customer_name", "reward_amount", "feedback_score", "payment_date"],
  "is_active": true
}
```

**Response (200 OK)**:
```json
{
  "id": "uuid",
  "version": 3,
  "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK ({{feedback_score}}% kvalitet). Betalning {{payment_date}}. /STOP",
  "updated_at": "2025-09-25T16:30:00Z",
  "previous_version": 2
}
```

## POST /api/admin/communication/templates/{id}/preview
Preview template with sample data

**Path Parameters**:
- `id`: Template UUID

**Request Body**:
```json
{
  "template_variables": {
    "customer_name": "Anna Andersson",
    "reward_amount": "125.50",
    "feedback_score": "87",
    "payment_date": "inom 7 dagar"
  }
}
```

**Response (200 OK)**:
```json
{
  "rendered_content": "Grattis Anna Andersson! Du har tjänat 125.50 SEK (87% kvalitet). Betalning inom 7 dagar. /STOP",
  "character_count": 89,
  "sms_segments": 1,
  "estimated_cost": "0.45 SEK",
  "validation": {
    "valid": true,
    "warnings": []
  }
}
```

**Response (400 Bad Request)**:
```json
{
  "error": "template_error",
  "rendered_content": null,
  "validation": {
    "valid": false,
    "warnings": [
      "Missing required variable: customer_name",
      "Template exceeds SMS length limit (1650 characters)"
    ]
  }
}
```

## GET /api/admin/communication/templates/{id}/versions
Get template version history

**Path Parameters**:
- `id`: Template UUID

**Response (200 OK)**:
```json
{
  "template_id": "uuid",
  "current_version": 3,
  "versions": [
    {
      "version": 3,
      "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK ({{feedback_score}}% kvalitet). Betalning {{payment_date}}. /STOP",
      "is_active": true,
      "created_at": "2025-09-25T16:30:00Z",
      "created_by": "Admin User"
    },
    {
      "version": 2,
      "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK för din feedback. Betalning sker {{payment_date}}. /STOP för att avsluta",
      "is_active": false,
      "created_at": "2025-09-25T14:30:00Z",
      "created_by": "Admin User"
    }
  ]
}
```

## POST /api/admin/communication/templates/{id}/rollback
Rollback to previous template version

**Path Parameters**:
- `id`: Template UUID

**Request Body**:
```json
{
  "target_version": 2,
  "reason": "New version causing delivery issues"
}
```

**Response (200 OK)**:
```json
{
  "id": "uuid",
  "version": 4,
  "content_template": "Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK för din feedback. Betalning sker {{payment_date}}. /STOP för att avsluta",
  "is_active": true,
  "rollback_reason": "New version causing delivery issues",
  "updated_at": "2025-09-25T17:00:00Z"
}
```

## DELETE /api/admin/communication/templates/{id}
Deactivate template (soft delete)

**Path Parameters**:
- `id`: Template UUID

**Response (200 OK)**:
```json
{
  "id": "uuid",
  "is_active": false,
  "deactivated_at": "2025-09-25T17:30:00Z",
  "message": "Template deactivated successfully. Existing scheduled notifications will continue to use this template."
}
```

**Response (409 Conflict)**:
```json
{
  "error": "template_in_use",
  "message": "Cannot delete template with pending notifications",
  "pending_notifications": 23
}
```

## GET /api/admin/communication/templates/variables
Get available template variables by notification type

**Query Parameters**:
- `notification_type`: Required notification type

**Response (200 OK)**:
```json
{
  "notification_type": "reward_earned",
  "available_variables": {
    "customer_name": {
      "description": "Customer's full name",
      "type": "string",
      "example": "Anna Andersson"
    },
    "reward_amount": {
      "description": "Reward amount in SEK",
      "type": "currency",
      "example": "125.50"
    },
    "feedback_score": {
      "description": "Feedback quality score (0-100)",
      "type": "number",
      "example": "87"
    },
    "payment_date": {
      "description": "Expected payment date or description",
      "type": "string",
      "example": "inom 7 dagar"
    },
    "store_name": {
      "description": "Name of the store where feedback was given",
      "type": "string",
      "example": "ICA Maxi Malmö"
    }
  }
}
```

## POST /api/admin/communication/templates/validate
Validate template syntax and variables

**Request Body**:
```json
{
  "content_template": "Hej {{customer_name}}! Du har fått {{invalid_variable}} från {{store_name}}.",
  "required_variables": ["customer_name", "store_name"],
  "notification_type": "reward_earned",
  "channel": "sms"
}
```

**Response (200 OK)**:
```json
{
  "valid": false,
  "errors": [
    {
      "type": "undefined_variable",
      "variable": "invalid_variable",
      "message": "Variable 'invalid_variable' is used in template but not available for notification type 'reward_earned'"
    }
  ],
  "warnings": [
    {
      "type": "missing_unsubscribe",
      "message": "SMS template should include /STOP unsubscribe option"
    }
  ],
  "character_count": 65,
  "sms_segments": 1
}
```

## Error Responses

**401 Unauthorized**:
```json
{
  "error": "unauthorized",
  "message": "Admin authentication required"
}
```

**403 Forbidden**:
```json
{
  "error": "forbidden",
  "message": "Admin privileges required for template management"
}
```

**404 Not Found**:
```json
{
  "error": "template_not_found",
  "message": "Communication template not found"
}
```

**409 Conflict**:
```json
{
  "error": "template_name_exists",
  "message": "Template name already exists for this notification type and channel"
}
```