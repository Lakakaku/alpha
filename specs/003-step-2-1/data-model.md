# Data Model: Business Authentication & Account Management

**Feature**: Business Authentication & Account Management
**Phase**: 1 - Design & Contracts
**Date**: 2025-09-20

## Entity Definitions

### Business Account (auth.users extension)
Extends Supabase Auth users table with business-specific metadata.

**Core Attributes**:
- `id`: UUID (Primary Key, from auth.users)
- `email`: VARCHAR (Unique, business email address)
- `encrypted_password`: VARCHAR (Supabase managed)
- `email_confirmed_at`: TIMESTAMPTZ (Email verification)
- `created_at`: TIMESTAMPTZ (Account creation)
- `updated_at`: TIMESTAMPTZ (Last modification)

**Business Metadata** (in user_metadata JSONB):
```json
{
  "business_name": "string",
  "contact_person": "string",
  "phone_number": "string",
  "verification_status": "pending|approved|rejected",
  "verification_requested_at": "timestamptz",
  "verification_notes": "string"
}
```

**Validation Rules**:
- Email must be valid business domain (no gmail, hotmail, etc.)
- Business name required and 2-100 characters
- Phone number must be valid Swedish format
- Verification status enum enforced at application level

**Relationships**:
- One-to-Many with business_stores (via business_id)
- One-to-Many with business_sessions (via user_id)

### Store
Represents individual store locations associated with businesses.

**Attributes**:
- `id`: UUID (Primary Key)
- `name`: VARCHAR(255) NOT NULL (Store display name)
- `address`: TEXT (Physical store address)
- `qr_code_id`: UUID UNIQUE (Links to QR code system)
- `business_registration_number`: VARCHAR(50) (Swedish org number)
- `created_at`: TIMESTAMPTZ DEFAULT NOW()
- `updated_at`: TIMESTAMPTZ DEFAULT NOW()
- `is_active`: BOOLEAN DEFAULT true

**Validation Rules**:
- Name required, 2-255 characters
- Address required for physical verification
- QR code ID must be unique across system
- Business registration number validates Swedish format

**Relationships**:
- Many-to-Many with auth.users via business_stores
- One-to-Many with feedback_sessions (future feature)

### Business Stores (Junction Table)
Manages business-store relationships with granular permissions.

**Attributes**:
- `id`: UUID (Primary Key)
- `business_id`: UUID NOT NULL REFERENCES auth.users(id)
- `store_id`: UUID NOT NULL REFERENCES stores(id)
- `permissions`: JSONB NOT NULL (Permission flags)
- `role`: VARCHAR(50) DEFAULT 'owner' (owner|manager|viewer)
- `created_at`: TIMESTAMPTZ DEFAULT NOW()
- `created_by`: UUID REFERENCES auth.users(id)

**Permission Structure** (JSONB):
```json
{
  "read_feedback": boolean,
  "write_context": boolean,
  "manage_qr": boolean,
  "view_analytics": boolean,
  "admin": boolean
}
```

**Validation Rules**:
- Unique constraint on (business_id, store_id)
- At least one permission must be true
- Role enum enforced: owner|manager|viewer
- Owner role must have all permissions

**Relationships**:
- Many-to-One with auth.users (business_id)
- Many-to-One with stores (store_id)

### Business Session (Extension)
Manages authenticated business sessions with store context.

**Attributes**:
- `id`: UUID (Primary Key)
- `user_id`: UUID NOT NULL REFERENCES auth.users(id)
- `current_store_id`: UUID REFERENCES stores(id)
- `session_token`: VARCHAR(255) UNIQUE (Supabase managed)
- `expires_at`: TIMESTAMPTZ NOT NULL
- `created_at`: TIMESTAMPTZ DEFAULT NOW()
- `last_activity`: TIMESTAMPTZ DEFAULT NOW()
- `ip_address`: INET (For security auditing)
- `user_agent`: TEXT (For security auditing)

**Validation Rules**:
- Session token must be unique and cryptographically secure
- Expires_at must be future timestamp
- Current_store_id must be valid for business_id
- IP address and user agent logged for security

**Relationships**:
- Many-to-One with auth.users (user_id)
- Many-to-One with stores (current_store_id)

### Admin Notification
Tracks admin notifications for business verification requests.

**Attributes**:
- `id`: UUID (Primary Key)
- `business_id`: UUID NOT NULL REFERENCES auth.users(id)
- `notification_type`: VARCHAR(50) NOT NULL (registration|verification)
- `status`: VARCHAR(50) DEFAULT 'pending' (pending|sent|acknowledged)
- `message`: TEXT (Notification content)
- `sent_at`: TIMESTAMPTZ
- `acknowledged_at`: TIMESTAMPTZ
- `acknowledged_by`: UUID REFERENCES auth.users(id)
- `created_at`: TIMESTAMPTZ DEFAULT NOW()

**Validation Rules**:
- Notification type enum enforced
- Status progression: pending → sent → acknowledged
- Acknowledged_by required when status = acknowledged
- Message required for manual notifications

## State Transitions

### Business Account Verification
```
pending → approved → active
pending → rejected → inactive
approved → suspended → inactive (admin action)
```

### Session Lifecycle
```
created → active → expired → deleted
created → active → revoked → deleted (logout)
```

### Admin Notification Flow
```
pending → sent → acknowledged → resolved
pending → failed → retry → sent
```

## Row Level Security (RLS) Policies

### Business Data Isolation
```sql
-- Business can only access their own data
CREATE POLICY business_isolation ON business_stores
FOR ALL USING (business_id = auth.uid());

-- Store data filtered by business association
CREATE POLICY store_access ON stores
FOR SELECT USING (id IN (
  SELECT store_id FROM business_stores
  WHERE business_id = auth.uid()
));
```

### Admin Access Control
```sql
-- Admin users can access all business data
CREATE POLICY admin_full_access ON business_stores
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND user_metadata->>'role' = 'admin'
  )
);
```

### Session Security
```sql
-- Users can only access their own sessions
CREATE POLICY session_ownership ON business_sessions
FOR ALL USING (user_id = auth.uid());
```

## Indexes and Performance

### Query Optimization
```sql
-- Business store lookup optimization
CREATE INDEX idx_business_stores_business_id ON business_stores(business_id);
CREATE INDEX idx_business_stores_store_id ON business_stores(store_id);

-- Session management optimization
CREATE INDEX idx_business_sessions_user_id ON business_sessions(user_id);
CREATE INDEX idx_business_sessions_expires_at ON business_sessions(expires_at);

-- Admin notification lookup
CREATE INDEX idx_admin_notifications_business_id ON admin_notifications(business_id);
CREATE INDEX idx_admin_notifications_status ON admin_notifications(status);
```

### Composite Indexes
```sql
-- Store switching optimization
CREATE INDEX idx_business_stores_composite
ON business_stores(business_id, store_id, permissions);

-- Active session lookup
CREATE INDEX idx_active_sessions
ON business_sessions(user_id, expires_at)
WHERE expires_at > NOW();
```

## Data Integrity Constraints

### Foreign Key Constraints
- All business_id references validate against auth.users(id)
- Store_id references validate against stores(id)
- Cascade deletes configured for data cleanup

### Check Constraints
```sql
-- Ensure valid verification status
ALTER TABLE auth.users ADD CONSTRAINT valid_verification_status
CHECK (user_metadata->>'verification_status' IN ('pending', 'approved', 'rejected'));

-- Ensure valid permissions structure
ALTER TABLE business_stores ADD CONSTRAINT valid_permissions
CHECK (jsonb_typeof(permissions) = 'object');

-- Ensure future expiration
ALTER TABLE business_sessions ADD CONSTRAINT future_expiration
CHECK (expires_at > created_at);
```

## Migration Strategy

### Phase 1: Core Schema
1. Extend auth.users with business metadata
2. Create stores table with basic attributes
3. Create business_stores junction table
4. Implement basic RLS policies

### Phase 2: Enhanced Features
1. Add business_sessions table
2. Create admin_notifications table
3. Add performance indexes
4. Implement advanced RLS policies

### Phase 3: Data Migration
1. Migrate existing demo data (if any)
2. Validate data integrity
3. Performance test with sample load
4. Enable monitoring and alerts

This data model provides the foundation for secure, scalable business authentication with proper multi-tenancy and admin oversight.