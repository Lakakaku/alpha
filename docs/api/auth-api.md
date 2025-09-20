# Vocilia Authentication API

Shared authentication API for Vocilia applications

**Version:** 1.0.0

**Contact:** Vocilia Development Team (dev@vocilia.se)

## Servers

- **Production server**: `https://api.vocilia.se/v1`
- **Staging server**: `https://api-staging.vocilia.se/v1`

## Endpoints

### POST /auth/login

**Summary:** Authenticate user

**Description:** Authenticate user with email and password

**Tags:** Authentication

**Request Body:**

**Responses:**

- **200**: Authentication successful
- **400**: undefined
- **401**: undefined
- **429**: undefined

---

### POST /auth/logout

**Summary:** Sign out user

**Description:** Invalidate user session and clear authentication tokens

**Tags:** Authentication

**Authentication:** Required

**Responses:**

- **200**: Logout successful
- **401**: undefined

---

### POST /auth/refresh

**Summary:** Refresh authentication token

**Description:** Refresh expired access token using refresh token

**Tags:** Authentication

**Request Body:**

**Responses:**

- **200**: Token refreshed successfully
- **400**: undefined
- **401**: undefined

---

### GET /auth/profile

**Summary:** Get user profile

**Description:** Retrieve current user's profile information

**Tags:** Authentication

**Authentication:** Required

**Responses:**

- **200**: User profile retrieved successfully
- **401**: undefined

---

### PATCH /auth/profile

**Summary:** Update user profile

**Description:** Update current user's profile information

**Tags:** Authentication

**Authentication:** Required

**Request Body:**

**Responses:**

- **200**: Profile updated successfully
- **400**: undefined
- **401**: undefined

---

### GET /auth/permissions

**Summary:** Get user permissions

**Description:** Retrieve current user's permissions and roles

**Tags:** Authentication

**Authentication:** Required

**Responses:**

- **200**: Permissions retrieved successfully
- **401**: undefined

---

