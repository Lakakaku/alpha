# Support API Contract

**Version**: 1.0.0 **Base Path**: `/api/support` **Authentication**: Required
(JWT token in Authorization header)

## POST /api/support/tickets

Create new support ticket

**Request Body**:

```json
{
  "category": "payment" | "verification" | "technical" | "feedback" | "general",
  "subject": "string",
  "description": "string",
  "contact_method": "phone" | "email" | "web_chat",
  "contact_details": "+46701234567", // phone number or email
  "priority": "low" | "normal" | "high" | "urgent" // optional, auto-calculated based on category
}
```

**Response (201 Created)**:

```json
{
  "id": "uuid",
  "ticket_number": "SUP-2025-001234",
  "status": "open",
  "priority": "high",
  "sla_deadline": "2025-09-25T12:00:00Z",
  "created_at": "2025-09-25T10:00:00Z",
  "estimated_response_time": "2 hours"
}
```

**Response (400 Bad Request)**:

```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "contact_details",
      "message": "Valid phone number or email required"
    }
  ]
}
```

## GET /api/support/tickets/{id}

Get support ticket details and conversation history

**Path Parameters**:

- `id`: Ticket UUID or ticket_number

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "ticket_number": "SUP-2025-001234",
  "requester_type": "customer",
  "category": "payment",
  "priority": "high",
  "status": "in_progress",
  "subject": "Payment not received for feedback",
  "description": "I submitted feedback 3 days ago but haven't received my payment yet.",
  "assigned_to": {
    "id": "uuid",
    "name": "Support Agent",
    "email": "agent@vocilia.se"
  },
  "sla_deadline": "2025-09-25T12:00:00Z",
  "first_response_at": "2025-09-25T10:15:00Z",
  "created_at": "2025-09-25T10:00:00Z",
  "updated_at": "2025-09-25T10:15:00Z",
  "messages": [
    {
      "id": "uuid",
      "sender_type": "customer",
      "sender_name": "Customer Name",
      "message_content": "I submitted feedback 3 days ago but haven't received my payment yet.",
      "is_internal": false,
      "created_at": "2025-09-25T10:00:00Z"
    },
    {
      "id": "uuid",
      "sender_type": "admin",
      "sender_name": "Support Agent",
      "message_content": "Thank you for contacting us. I'm looking into your payment status now.",
      "is_internal": false,
      "created_at": "2025-09-25T10:15:00Z"
    }
  ]
}
```

## GET /api/support/tickets

List support tickets with filtering

**Query Parameters**:

- `status`: Filter by ticket status
- `category`: Filter by category
- `priority`: Filter by priority
- `assigned_to`: Filter by assigned admin (Admin only)
- `requester_id`: Filter by requester (Admin only, or current user)
- `limit`: Results per page (default 20, max 100)
- `offset`: Pagination offset

**Response (200 OK)**:

```json
{
  "tickets": [
    {
      "id": "uuid",
      "ticket_number": "SUP-2025-001234",
      "category": "payment",
      "priority": "high",
      "status": "in_progress",
      "subject": "Payment not received for feedback",
      "sla_deadline": "2025-09-25T12:00:00Z",
      "created_at": "2025-09-25T10:00:00Z",
      "last_message_at": "2025-09-25T10:15:00Z"
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

## POST /api/support/tickets/{id}/messages

Add message to support ticket

**Path Parameters**:

- `id`: Ticket UUID

**Request Body**:

```json
{
  "message_content": "string",
  "is_internal": false, // Admin only, for internal notes
  "attachments": ["https://example.com/file1.pdf"] // optional
}
```

**Response (201 Created)**:

```json
{
  "id": "uuid",
  "message_content": "Thank you for the update. I've processed your refund.",
  "sender_type": "admin",
  "sender_name": "Support Agent",
  "is_internal": false,
  "created_at": "2025-09-25T10:30:00Z"
}
```

## PUT /api/support/tickets/{id}/status

Update ticket status (Admin only)

**Path Parameters**:

- `id`: Ticket UUID

**Request Body**:

```json
{
  "status": "in_progress" | "pending_customer" | "resolved" | "closed",
  "internal_notes": "Customer issue resolved, refund processed" // optional
}
```

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "status": "resolved",
  "resolved_at": "2025-09-25T10:30:00Z",
  "updated_at": "2025-09-25T10:30:00Z"
}
```

## PUT /api/support/tickets/{id}/assign

Assign ticket to admin user (Admin only)

**Path Parameters**:

- `id`: Ticket UUID

**Request Body**:

```json
{
  "assigned_to": "uuid" // Admin user ID, null to unassign
}
```

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "assigned_to": {
    "id": "uuid",
    "name": "Support Agent",
    "email": "agent@vocilia.se"
  },
  "status": "in_progress",
  "updated_at": "2025-09-25T10:15:00Z"
}
```

## PUT /api/support/tickets/{id}/priority

Update ticket priority (Admin only)

**Path Parameters**:

- `id`: Ticket UUID

**Request Body**:

```json
{
  "priority": "low" | "normal" | "high" | "urgent",
  "reason": "Customer is VIP business partner" // optional
}
```

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "priority": "urgent",
  "sla_deadline": "2025-09-25T10:30:00Z", // Updated based on new priority
  "updated_at": "2025-09-25T10:20:00Z"
}
```

## POST /api/support/tickets/{id}/satisfaction

Submit customer satisfaction rating

**Path Parameters**:

- `id`: Ticket UUID

**Request Body**:

```json
{
  "rating": 5, // 1-5 scale
  "feedback": "Great support, quick resolution!" // optional
}
```

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "satisfaction_rating": 5,
  "satisfaction_feedback": "Great support, quick resolution!",
  "updated_at": "2025-09-25T11:00:00Z"
}
```

**Response (409 Conflict)**:

```json
{
  "error": "invalid_status",
  "message": "Can only rate resolved tickets"
}
```

## GET /api/support/sla-report

Get SLA performance report (Admin only)

**Query Parameters**:

- `start_date`: Filter from date (ISO 8601)
- `end_date`: Filter to date (ISO 8601)
- `category`: Filter by category

**Response (200 OK)**:

```json
{
  "period": {
    "start_date": "2025-09-01T00:00:00Z",
    "end_date": "2025-09-25T23:59:59Z"
  },
  "total_tickets": 1247,
  "sla_performance": {
    "within_sla": 1089,
    "breached_sla": 158,
    "sla_percentage": 87.3
  },
  "average_response_time": "1.2 hours",
  "average_resolution_time": "4.8 hours",
  "by_category": [
    {
      "category": "payment",
      "total": 425,
      "sla_percentage": 92.1,
      "avg_response_time": "0.8 hours"
    },
    {
      "category": "verification",
      "total": 312,
      "sla_percentage": 89.7,
      "avg_response_time": "1.1 hours"
    }
  ]
}
```

## GET /api/support/templates

Get support response templates (Admin only)

**Response (200 OK)**:

```json
{
  "templates": [
    {
      "id": "uuid",
      "category": "payment",
      "title": "Payment Investigation Response",
      "content": "Thank you for contacting us about your payment. I'm investigating your account and will have an update within 2 hours.",
      "variables": ["customer_name", "ticket_number"]
    }
  ]
}
```

## Error Responses

**400 Bad Request**:

```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "subject",
      "message": "Subject is required"
    }
  ]
}
```

**403 Forbidden**:

```json
{
  "error": "forbidden",
  "message": "Cannot access tickets for other users"
}
```

**404 Not Found**:

```json
{
  "error": "ticket_not_found",
  "message": "Support ticket not found"
}
```

**409 Conflict**:

```json
{
  "error": "invalid_status_transition",
  "message": "Cannot change status from resolved to open"
}
```
