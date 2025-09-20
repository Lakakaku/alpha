# Vocilia API Documentation

Welcome to the Vocilia API documentation. This comprehensive guide covers all API endpoints for the Vocilia customer feedback reward system.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Reference](#api-reference)
  - [Authentication API](#authentication-api)
  - [Shared Infrastructure API](#shared-infrastructure-api)
- [SDKs and Examples](#sdks-and-examples)
- [Postman Collection](#postman-collection)

## Overview

The Vocilia API is organized around REST principles. It has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.

### API Features

- **RESTful Design**: Clean, resource-oriented URLs
- **JSON Responses**: All responses are in JSON format
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse
- **Comprehensive Error Handling**: Detailed error responses
- **OpenAPI 3.0 Specification**: Complete API documentation

## Authentication

The Vocilia API uses JWT (JSON Web Token) for authentication. Include your access token in the Authorization header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Getting an Access Token

1. **Login**: POST to `/auth/login` with email and password
2. **Refresh**: Use refresh token to get new access token via `/auth/refresh`

### Token Expiration

- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- Always check for 401 responses and refresh tokens when needed

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Production  | `https://api.vocilia.se/v1` |
| Staging     | `https://api-staging.vocilia.se/v1` |

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional error details"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 422  | Validation Error |
| 429  | Rate Limited |
| 500  | Internal Server Error |

### Common Error Codes

| Error Code | Description |
|------------|-------------|
| `VALIDATION_ERROR` | Request data validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute per IP
- **General endpoints**: 1000 requests per hour per user
- **Health checks**: Unlimited

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## API Reference

### Authentication API

The Authentication API handles user authentication, session management, and user profile operations.

#### Base Endpoint: `/auth`

---

#### POST /auth/login

Authenticate a user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_value",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "business_account",
    "business_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_at": "2025-09-20T10:00:00Z",
    "updated_at": "2025-09-20T10:00:00Z"
  }
}
```

**Errors:**
- `400`: Invalid email or password format
- `401`: Invalid credentials
- `429`: Too many login attempts

---

#### POST /auth/logout

Sign out the current user and invalidate the session.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "message": "Successfully logged out"
}
```

---

#### POST /auth/refresh

Refresh an expired access token using a refresh token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token_value"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "new_refresh_token_value",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { /* user object */ }
}
```

---

#### GET /auth/profile

Get the current user's profile information.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "role": "business_account",
  "business_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2025-09-20T10:00:00Z",
  "updated_at": "2025-09-20T10:00:00Z"
}
```

---

#### PATCH /auth/profile

Update the current user's profile information.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Request Body:**
```json
{
  "full_name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "full_name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.jpg",
  "role": "business_account",
  "business_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2025-09-20T10:00:00Z",
  "updated_at": "2025-09-20T12:00:00Z"
}
```

---

#### GET /auth/permissions

Get the current user's permissions and roles.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "role": "business_account",
  "permissions": [
    "business.read",
    "business.write",
    "feedback.read",
    "customers.read",
    "stores.read",
    "stores.write"
  ],
  "business_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Shared Infrastructure API

The Shared Infrastructure API provides core functionality including health checks, business management, and store operations.

#### Health Endpoints

---

#### GET /health

Basic health check endpoint for monitoring service availability.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-20T10:00:00Z",
  "uptime": 86400
}
```

---

#### GET /health/detailed

Comprehensive health check with dependency status.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-20T10:00:00Z",
  "uptime": 86400,
  "dependencies": {
    "database": {
      "status": "healthy",
      "response_time": 15,
      "last_check": "2025-09-20T10:00:00Z"
    },
    "supabase": {
      "status": "healthy",
      "response_time": 45,
      "last_check": "2025-09-20T10:00:00Z"
    }
  },
  "memory": {
    "used": 128,
    "total": 512,
    "usage_percent": 25
  },
  "disk": {
    "used": 2048,
    "total": 10240,
    "usage_percent": 20
  }
}
```

#### Business Management Endpoints

---

#### GET /businesses

List businesses (admin users see all, business users see their own).

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Query Parameters:**
- `limit` (integer, 1-100): Maximum number of results (default: 20)
- `offset` (integer, ≥0): Number of results to skip (default: 0)
- `search` (string): Search businesses by name

**Response (200):**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Café Stockholm",
      "description": "Cozy café in downtown Stockholm",
      "contact_email": "info@cafestockholm.se",
      "phone": "+46-8-123-4567",
      "website": "https://cafestockholm.se",
      "created_at": "2025-09-20T10:00:00Z",
      "updated_at": "2025-09-20T10:00:00Z",
      "store_count": 3,
      "active_stores": 2
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

---

#### POST /businesses

Create a new business (admin only).

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Request Body:**
```json
{
  "name": "New Café",
  "description": "A wonderful new café",
  "contact_email": "info@newcafe.se",
  "phone": "+46-8-987-6543",
  "website": "https://newcafe.se"
}
```

**Response (201):**
```json
{
  "id": "456e7890-e12b-34d5-a678-912345678000",
  "name": "New Café",
  "description": "A wonderful new café",
  "contact_email": "info@newcafe.se",
  "phone": "+46-8-987-6543",
  "website": "https://newcafe.se",
  "created_at": "2025-09-20T12:00:00Z",
  "updated_at": "2025-09-20T12:00:00Z",
  "store_count": 0,
  "active_stores": 0
}
```

## SDKs and Examples

### JavaScript/TypeScript SDK

```bash
npm install @vocilia/api-client
```

```typescript
import { VociliaClient } from '@vocilia/api-client';

const client = new VociliaClient({
  baseUrl: 'https://api.vocilia.se/v1',
  accessToken: 'your_access_token'
});

// Login
const authResponse = await client.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

// Get businesses
const businesses = await client.businesses.list({
  limit: 10,
  search: 'café'
});
```

### cURL Examples

```bash
# Login
curl -X POST https://api.vocilia.se/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Get businesses
curl -X GET https://api.vocilia.se/v1/businesses \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Health check
curl -X GET https://api.vocilia.se/v1/health
```

## Postman Collection

Import our complete Postman collection for easy API testing:

```json
{
  "info": {
    "name": "Vocilia API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://api.vocilia.se/v1"
    },
    {
      "key": "access_token",
      "value": "",
      "type": "string"
    }
  ]
}
```

## Support

For API support, please contact:

- **Email**: dev@vocilia.se
- **Documentation**: [https://docs.vocilia.se](https://docs.vocilia.se)
- **Status Page**: [https://status.vocilia.se](https://status.vocilia.se)

## Changelog

### Version 1.0.0 (2025-09-20)
- Initial API release
- Authentication endpoints
- Business management endpoints
- Health check endpoints
- Comprehensive error handling
- Rate limiting implementation