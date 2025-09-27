# Weekly Verification Workflow API Documentation

## Overview

The Weekly Verification Workflow API enables secure management of transaction verification cycles for businesses using the Vocilia feedback system. This API supports weekly database preparation, verification tracking, and payment processing workflows.

## Base URL
```
https://api.vocilia.com/v1
```

## Authentication

All verification endpoints require business authentication via JWT tokens obtained through the standard authentication flow.

```http
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Verification Cycles

#### GET /verification/cycles
Retrieve verification cycles for the authenticated business.

**Query Parameters:**
- `status` (optional): Filter by cycle status (`pending`, `active`, `verification_pending`, `completed`, `expired`)
- `limit` (optional): Number of cycles to return (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "cycle_start": "2025-09-23T00:00:00Z",
      "cycle_end": "2025-09-29T23:59:59Z",
      "verification_deadline": "2025-10-04T17:00:00Z",
      "status": "active",
      "total_transactions": 150,
      "verified_count": 0,
      "estimated_rewards": 750.00,
      "created_at": "2025-09-23T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

#### GET /verification/cycles/{cycle_id}
Retrieve specific verification cycle details.

**Path Parameters:**
- `cycle_id` (required): Unique cycle identifier

**Response:**
```json
{
  "id": "uuid",
  "cycle_start": "2025-09-23T00:00:00Z",
  "cycle_end": "2025-09-29T23:59:59Z",
  "verification_deadline": "2025-10-04T17:00:00Z",
  "status": "active",
  "total_transactions": 150,
  "verified_count": 0,
  "estimated_rewards": 750.00,
  "database_prepared": true,
  "payment_required": false,
  "created_at": "2025-09-23T08:00:00Z",
  "updated_at": "2025-09-23T08:30:00Z"
}
```

### Database Export

#### GET /verification/cycles/{cycle_id}/export
Download verification database for a specific cycle.

**Path Parameters:**
- `cycle_id` (required): Unique cycle identifier

**Query Parameters:**
- `format` (optional): Export format (`csv`, `excel`, `json`) (default: `csv`)

**Response:**
- Content-Type: `application/octet-stream` (CSV/Excel) or `application/json` (JSON)
- Content-Disposition: `attachment; filename="verification_database_{cycle_id}.{format}"`

**CSV Format Example:**
```csv
transaction_id,timestamp,amount,pos_reference
txn_001,2025-09-23T14:30:00Z,50.00,REF123
txn_002,2025-09-23T15:45:00Z,25.50,REF124
```

**JSON Format Example:**
```json
{
  "cycle_id": "uuid",
  "export_timestamp": "2025-09-23T16:00:00Z",
  "transactions": [
    {
      "transaction_id": "txn_001",
      "timestamp": "2025-09-23T14:30:00Z",
      "amount": 50.00,
      "pos_reference": "REF123"
    }
  ]
}
```

### Verification Submission

#### POST /verification/cycles/{cycle_id}/submit
Submit verification results for a cycle.

**Path Parameters:**
- `cycle_id` (required): Unique cycle identifier

**Request Body:**
```json
{
  "verification_results": [
    {
      "transaction_id": "txn_001",
      "status": "verified"
    },
    {
      "transaction_id": "txn_002",
      "status": "fake"
    }
  ],
  "confirmation": true,
  "submission_notes": "All transactions verified against POS system"
}
```

**Response:**
```json
{
  "success": true,
  "cycle_id": "uuid",
  "verified_count": 1,
  "fake_count": 1,
  "total_rewards": 25.00,
  "invoice_amount": 30.00,
  "submission_timestamp": "2025-09-23T16:30:00Z"
}
```

### Payment Processing

#### GET /verification/cycles/{cycle_id}/invoice
Retrieve payment invoice for verified cycle.

**Path Parameters:**
- `cycle_id` (required): Unique cycle identifier

**Response:**
```json
{
  "invoice_id": "uuid",
  "cycle_id": "uuid",
  "rewards_total": 750.00,
  "admin_fee": 150.00,
  "total_amount": 900.00,
  "currency": "SEK",
  "due_date": "2025-10-11T17:00:00Z",
  "status": "pending",
  "payment_methods": ["bank_transfer", "card"],
  "created_at": "2025-10-04T18:00:00Z"
}
```

#### POST /verification/cycles/{cycle_id}/payment
Process payment for verification cycle.

**Path Parameters:**
- `cycle_id` (required): Unique cycle identifier

**Request Body:**
```json
{
  "payment_method": "bank_transfer",
  "reference_number": "PAY123456",
  "amount": 900.00
}
```

**Response:**
```json
{
  "success": true,
  "payment_id": "uuid",
  "status": "processing",
  "confirmation_email_sent": true,
  "estimated_processing_time": "2-3 business days"
}
```

## Status Codes

### Success Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `204 No Content`: Request successful, no content returned

### Error Codes
- `400 Bad Request`: Invalid request format or parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Requested resource not found
- `409 Conflict`: Resource conflict (e.g., cycle already submitted)
- `422 Unprocessable Entity`: Validation errors
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid verification status",
    "details": {
      "field": "status",
      "allowed_values": ["verified", "fake"]
    }
  }
}
```

## Rate Limits

- **General API**: 100 requests per minute per business
- **Export Downloads**: 10 requests per hour per business
- **Submission Endpoint**: 5 requests per minute per business

## Data Models

### Verification Cycle
```typescript
interface VerificationCycle {
  id: string;
  business_id: string;
  cycle_start: string; // ISO 8601
  cycle_end: string; // ISO 8601
  verification_deadline: string; // ISO 8601
  status: 'pending' | 'active' | 'verification_pending' | 'completed' | 'expired';
  total_transactions: number;
  verified_count: number;
  estimated_rewards: number;
  database_prepared: boolean;
  payment_required: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}
```

### Verification Record
```typescript
interface VerificationRecord {
  id: string;
  cycle_id: string;
  transaction_id: string;
  original_feedback_id: string;
  timestamp: string; // ISO 8601
  amount: number;
  pos_reference?: string;
  verification_status: 'pending' | 'verified' | 'fake';
  verified_at?: string; // ISO 8601
  created_at: string; // ISO 8601
}
```

### Payment Invoice
```typescript
interface PaymentInvoice {
  id: string;
  cycle_id: string;
  business_id: string;
  rewards_total: number;
  admin_fee: number;
  total_amount: number;
  currency: string;
  due_date: string; // ISO 8601
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  payment_methods: string[];
  created_at: string; // ISO 8601
  paid_at?: string; // ISO 8601
}
```

## Security Considerations

- All data is protected by Row-Level Security (RLS) policies
- Businesses can only access their own verification cycles and data
- Sensitive customer information (phone numbers, feedback content) is never included in verification databases
- All API requests are logged for audit purposes
- File downloads are temporary and expire after 24 hours

## Business Rules

1. **Cycle Creation**: Only occurs on Mondays for the previous week
2. **Verification Deadline**: 5 business days from cycle creation
3. **Payment Terms**: Due within 7 days of verification submission
4. **Data Retention**: Verification databases are purged after payment completion
5. **Reward Calculations**: Based on verified transactions only
6. **Admin Fee**: 20% of total rewards (minimum 5 SEK)

## Support

For API support and technical questions:
- Email: api-support@vocilia.com
- Documentation: https://docs.vocilia.com/api
- Status Page: https://status.vocilia.com