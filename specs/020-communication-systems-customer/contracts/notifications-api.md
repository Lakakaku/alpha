# Notifications API Contract

**Version**: 1.0.0 **Base Path**: `/api/notifications` **Authentication**:
Required (JWT token in Authorization header)

## POST /api/notifications/send

Send individual notification to customer or business

**Request Body**:

```json
{
  "recipient_type": "customer" | "business",
  "recipient_id": "uuid",
  "notification_type": "reward_earned" | "payment_confirmed" | "verification_request" | "payment_overdue" | "support_response",
  "channel": "sms" | "email",
  "template_variables": {
    "reward_amount": "100.50",
    "feedback_score": "85",
    "payment_date": "2025-09-30",
    "deadline": "2025-10-05T17:00:00Z"
  },
  "scheduled_at": "2025-09-25T10:00:00Z" // optional, immediate if not provided
}
```

**Response (201 Created)**:

```json
{
  "id": "uuid",
  "status": "pending",
  "scheduled_at": "2025-09-25T10:00:00Z",
  "estimated_delivery": "2025-09-25T10:00:30Z"
}
```

**Response (400 Bad Request)**:

```json
{
  "error": "validation_error",
  "details": [
    {
      "field": "recipient_id",
      "message": "Customer not found"
    }
  ]
}
```

## GET /api/notifications/{id}

Get notification status and delivery details

**Path Parameters**:

- `id`: Notification UUID

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "recipient_type": "customer",
  "notification_type": "reward_earned",
  "channel": "sms",
  "status": "delivered",
  "content": "Grattis! Du har tjänat 85 SEK för din feedback. Betalning sker inom 7 dagar.",
  "sent_at": "2025-09-25T10:00:15Z",
  "delivered_at": "2025-09-25T10:00:22Z",
  "retry_count": 0
}
```

## GET /api/notifications

List notifications with filtering and pagination

**Query Parameters**:

- `recipient_type`: Filter by customer/business
- `recipient_id`: Filter by specific user
- `status`: Filter by notification status
- `notification_type`: Filter by notification type
- `limit`: Results per page (default 20, max 100)
- `offset`: Pagination offset

**Response (200 OK)**:

```json
{
  "notifications": [
    {
      "id": "uuid",
      "recipient_type": "customer",
      "notification_type": "reward_earned",
      "status": "delivered",
      "sent_at": "2025-09-25T10:00:15Z",
      "retry_count": 0
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

## POST /api/notifications/{id}/retry

Manually retry failed notification (Admin only)

**Path Parameters**:

- `id`: Notification UUID

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "status": "pending",
  "retry_count": 2,
  "next_attempt_at": "2025-09-25T10:35:00Z"
}
```

**Response (409 Conflict)**:

```json
{
  "error": "retry_limit_exceeded",
  "message": "Notification has already reached maximum retry attempts"
}
```

## DELETE /api/notifications/{id}

Cancel pending notification (Admin only)

**Path Parameters**:

- `id`: Notification UUID

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "status": "cancelled",
  "cancelled_at": "2025-09-25T10:15:00Z"
}
```

**Response (409 Conflict)**:

```json
{
  "error": "cannot_cancel",
  "message": "Notification has already been sent"
}
```

## POST /api/notifications/batch

Send batch notifications (Admin only, for weekly summaries)

**Request Body**:

```json
{
  "notification_type": "weekly_summary",
  "template_id": "uuid",
  "recipients": [
    {
      "recipient_type": "customer",
      "recipient_id": "uuid",
      "template_variables": {
        "total_rewards": "425.75",
        "store_count": 3,
        "week_period": "2025-09-16 till 2025-09-22"
      }
    }
  ],
  "scheduled_at": "2025-09-29T06:00:00Z"
}
```

**Response (202 Accepted)**:

```json
{
  "batch_id": "uuid",
  "total_notifications": 1247,
  "scheduled_at": "2025-09-29T06:00:00Z",
  "estimated_completion": "2025-09-29T06:15:00Z"
}
```

## GET /api/notifications/batch/{batch_id}

Get batch processing status (Admin only)

**Response (200 OK)**:

```json
{
  "batch_id": "uuid",
  "status": "processing",
  "total_notifications": 1247,
  "sent": 856,
  "delivered": 720,
  "failed": 12,
  "pending": 391,
  "started_at": "2025-09-29T06:00:05Z",
  "estimated_completion": "2025-09-29T06:12:00Z"
}
```

## Webhook: POST /api/notifications/webhooks/delivery-status

SMS delivery status updates from provider (Twilio)

**Request Body** (from Twilio):

```json
{
  "MessageSid": "twilio-message-id",
  "MessageStatus": "delivered" | "undelivered" | "failed",
  "ErrorCode": "30008", // optional, if failed
  "To": "+46701234567",
  "From": "+46812345678"
}
```

**Response (200 OK)**:

```json
{
  "status": "processed"
}
```

## Error Responses

**401 Unauthorized**:

```json
{
  "error": "unauthorized",
  "message": "Valid authentication required"
}
```

**403 Forbidden**:

```json
{
  "error": "forbidden",
  "message": "Insufficient permissions for this operation"
}
```

**404 Not Found**:

```json
{
  "error": "not_found",
  "message": "Notification not found"
}
```

**429 Too Many Requests**:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many notification requests. Try again later.",
  "retry_after": 60
}
```

**500 Internal Server Error**:

```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```
