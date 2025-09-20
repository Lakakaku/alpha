# Vocilia Shared Infrastructure API

Core API endpoints for shared infrastructure components

**Version:** 1.0.0

**Contact:** Vocilia Development Team (dev@vocilia.se)

## Servers

- **Production server**: `https://api.vocilia.se/v1`
- **Staging server**: `https://api-staging.vocilia.se/v1`

## Endpoints

### GET /health

**Summary:** Health check

**Description:** Basic health check endpoint

**Tags:** Health

**Responses:**

- **200**: Service is healthy

---

### GET /health/detailed

**Summary:** Detailed health check

**Description:** Comprehensive health check with dependency status

**Tags:** Health

**Responses:**

- **200**: Detailed health information
- **503**: Service unhealthy

---

### GET /businesses

**Summary:** List businesses

**Description:** Get list of businesses (admin only or own business)

**Tags:** Business Management

**Authentication:** Required

**Parameters:**

- `limit` (query): Maximum number of results
- `offset` (query): Number of results to skip
- `search` (query): Search businesses by name

**Responses:**

- **200**: Businesses retrieved successfully
- **401**: undefined
- **403**: undefined

---

### POST /businesses

**Summary:** Create business

**Description:** Create new business (admin only)

**Tags:** Business Management

**Authentication:** Required

**Request Body:**

**Responses:**

- **201**: Business created successfully
- **400**: undefined
- **401**: undefined
- **403**: undefined

---

### GET /businesses/{businessId}

**Summary:** Get business details

**Description:** Get business information by ID

**Tags:** Business Management

**Authentication:** Required

**Parameters:**

- `businessId` (path) *required*: Business unique identifier

**Responses:**

- **200**: Business details retrieved successfully
- **401**: undefined
- **403**: undefined
- **404**: undefined

---

### PATCH /businesses/{businessId}

**Summary:** Update business

**Description:** Update business information

**Tags:** Business Management

**Authentication:** Required

**Parameters:**

- `businessId` (path) *required*: Business unique identifier

**Request Body:**

**Responses:**

- **200**: Business updated successfully
- **400**: undefined
- **401**: undefined
- **403**: undefined
- **404**: undefined

---

### GET /businesses/{businessId}/stores

**Summary:** List business stores

**Description:** Get stores for a specific business

**Tags:** Store Management

**Authentication:** Required

**Parameters:**

- `businessId` (path) *required*: Business unique identifier
- `active` (query): Filter by active status

**Responses:**

- **200**: Stores retrieved successfully
- **401**: undefined
- **403**: undefined
- **404**: undefined

---

### POST /businesses/{businessId}/stores

**Summary:** Create store

**Description:** Create new store for business

**Tags:** Store Management

**Authentication:** Required

**Parameters:**

- `businessId` (path) *required*: Business unique identifier

**Request Body:**

**Responses:**

- **201**: Store created successfully
- **400**: undefined
- **401**: undefined
- **403**: undefined

---

### GET /stores/{storeId}

**Summary:** Get store details

**Description:** Get store information by ID

**Tags:** Store Management

**Authentication:** Required

**Parameters:**

- `storeId` (path) *required*: Store unique identifier

**Responses:**

- **200**: Store details retrieved successfully
- **401**: undefined
- **403**: undefined
- **404**: undefined

---

### PATCH /stores/{storeId}

**Summary:** Update store

**Description:** Update store information

**Tags:** Store Management

**Authentication:** Required

**Parameters:**

- `storeId` (path) *required*: Store unique identifier

**Request Body:**

**Responses:**

- **200**: Store updated successfully
- **400**: undefined
- **401**: undefined
- **403**: undefined
- **404**: undefined

---

### GET /permissions

**Summary:** List available permissions

**Description:** Get list of available permissions in the system

**Tags:** Permission Management

**Authentication:** Required

**Parameters:**

- `category` (query): Filter by permission category

**Responses:**

- **200**: Permissions retrieved successfully
- **401**: undefined

---

