# Data Model - Admin Dashboard Foundation

**Date**: 2025-09-23  
**Feature**: Admin Dashboard Foundation  
**Database**: Supabase PostgreSQL with RLS policies

## Entities Overview

This feature extends the existing Vocilia database schema with admin-specific
entities while maintaining compatibility with existing business and customer
data structures.

## Core Entities

### 1. admin_accounts

**Purpose**: Represents system administrators with credentials and access
permissions

| Field         | Type        | Constraints                                | Description                     |
| ------------- | ----------- | ------------------------------------------ | ------------------------------- |
| id            | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4()    | Unique admin account identifier |
| user_id       | uuid        | FOREIGN KEY (auth.users), UNIQUE, NOT NULL | Links to Supabase Auth user     |
| username      | text        | UNIQUE, NOT NULL                           | Admin username for login        |
| full_name     | text        | NOT NULL                                   | Admin's full name               |
| email         | text        | UNIQUE, NOT NULL                           | Admin email address             |
| is_active     | boolean     | DEFAULT true                               | Whether admin account is active |
| created_at    | timestamptz | DEFAULT now()                              | Account creation timestamp      |
| updated_at    | timestamptz | DEFAULT now()                              | Last update timestamp           |
| last_login_at | timestamptz | NULL                                       | Last successful login           |

**Relationships**:

- Links to `auth.users` (Supabase Auth)
- One-to-many with `admin_sessions`
- One-to-many with `audit_logs`

**Validation Rules**:

- Username must be 3-50 characters, alphanumeric and underscore only
- Email must be valid format
- Full name must be 2-100 characters

### 2. admin_sessions

**Purpose**: Tracks authenticated admin sessions with security tokens and
activity

| Field            | Type        | Constraints                             | Description                                |
| ---------------- | ----------- | --------------------------------------- | ------------------------------------------ |
| id               | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique session identifier                  |
| admin_id         | uuid        | FOREIGN KEY (admin_accounts), NOT NULL  | Admin account reference                    |
| session_token    | text        | UNIQUE, NOT NULL                        | Supabase Auth session token                |
| ip_address       | inet        | NOT NULL                                | Client IP address                          |
| user_agent       | text        | NOT NULL                                | Client user agent string                   |
| created_at       | timestamptz | DEFAULT now()                           | Session start time                         |
| last_activity_at | timestamptz | DEFAULT now()                           | Last activity timestamp                    |
| expires_at       | timestamptz | NOT NULL                                | Session expiration (2 hours from creation) |
| is_active        | boolean     | DEFAULT true                            | Whether session is active                  |
| ended_at         | timestamptz | NULL                                    | Session end timestamp                      |

**Relationships**:

- Belongs to `admin_accounts`

**Validation Rules**:

- Expires_at must be exactly 2 hours from created_at
- Last_activity_at cannot be after expires_at
- IP address must be valid IPv4 or IPv6

### 3. stores (Enhanced)

**Purpose**: Existing store entity enhanced with comprehensive monitoring fields

**New Fields Added**: | Field | Type | Constraints | Description |
|-------|------|-------------|-------------| | phone_number | text | NOT NULL |
Business phone number | | physical_address | text | NOT NULL | Store physical
address | | business_registration_number | text | UNIQUE, NOT NULL | Swedish
business registration | | last_sync_at | timestamptz | NULL | Last database sync
timestamp | | sync_status | text | DEFAULT 'pending' | Sync status:
pending/success/failed | | error_count | integer | DEFAULT 0 | Count of recent
errors | | performance_score | numeric(3,2) | NULL | Performance rating
0.00-10.00 | | online_status | boolean | DEFAULT false | Whether store is
currently online | | monitoring_enabled | boolean | DEFAULT true | Whether
monitoring is active |

**Existing Fields** (maintained for compatibility):

- id, name, business_email, created_at, updated_at, etc.

**Validation Rules**:

- Phone number must be valid Swedish format
- Business registration must be valid Swedish org number format
- Performance score between 0.00 and 10.00
- Physical address minimum 10 characters

### 4. store_status_metrics

**Purpose**: Tracks comprehensive store performance and health metrics

| Field        | Type        | Constraints                             | Description                               |
| ------------ | ----------- | --------------------------------------- | ----------------------------------------- |
| id           | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique metric record                      |
| store_id     | uuid        | FOREIGN KEY (stores), NOT NULL          | Store reference                           |
| metric_type  | text        | NOT NULL                                | Type: sync/error/performance/availability |
| metric_value | numeric     | NOT NULL                                | Numeric value of metric                   |
| metric_unit  | text        | NOT NULL                                | Unit: count/ms/percentage/score           |
| recorded_at  | timestamptz | DEFAULT now()                           | When metric was recorded                  |
| metadata     | jsonb       | NULL                                    | Additional metric context                 |

**Relationships**:

- Belongs to `stores`

**Validation Rules**:

- Metric_type must be one of: sync, error, performance, availability
- Metric_value must be non-negative
- Recorded_at cannot be in the future

### 5. audit_logs

**Purpose**: Records all admin actions for security and compliance tracking

| Field          | Type        | Constraints                             | Description                 |
| -------------- | ----------- | --------------------------------------- | --------------------------- |
| id             | uuid        | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique log entry            |
| admin_id       | uuid        | FOREIGN KEY (admin_accounts), NOT NULL  | Admin who performed action  |
| action_type    | text        | NOT NULL                                | Type of action performed    |
| resource_type  | text        | NOT NULL                                | Type of resource affected   |
| resource_id    | uuid        | NULL                                    | ID of affected resource     |
| action_details | jsonb       | NOT NULL                                | Detailed action information |
| ip_address     | inet        | NOT NULL                                | Admin's IP address          |
| user_agent     | text        | NOT NULL                                | Admin's user agent          |
| performed_at   | timestamptz | DEFAULT now()                           | When action was performed   |
| success        | boolean     | NOT NULL                                | Whether action succeeded    |
| error_message  | text        | NULL                                    | Error message if failed     |

**Relationships**:

- Belongs to `admin_accounts`

**Validation Rules**:

- Action_type from: login, logout, create, update, delete, upload, view
- Resource_type from: store, admin, session, upload, system
- Action_details must contain at least 'description' field

## Database Indexes

### Performance Indexes

```sql
-- Admin session lookups
CREATE INDEX idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_admin_active ON admin_sessions(admin_id, is_active, expires_at);

-- Store monitoring queries
CREATE INDEX idx_stores_online_status ON stores(online_status, monitoring_enabled);
CREATE INDEX idx_stores_sync_status ON stores(sync_status, last_sync_at);

-- Store metrics time-series queries
CREATE INDEX idx_store_metrics_store_time ON store_status_metrics(store_id, recorded_at);
CREATE INDEX idx_store_metrics_type_time ON store_status_metrics(metric_type, recorded_at);

-- Audit log queries
CREATE INDEX idx_audit_logs_admin_time ON audit_logs(admin_id, performed_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action_time ON audit_logs(action_type, performed_at);
```

## Row Level Security (RLS) Policies

### Admin Access Control

```sql
-- Admin accounts: Only accessible by authenticated admins
CREATE POLICY admin_accounts_policy ON admin_accounts
    FOR ALL USING (is_admin(auth.uid()));

-- Admin sessions: Only admin's own sessions
CREATE POLICY admin_sessions_policy ON admin_sessions
    FOR ALL USING (is_admin(auth.uid()));

-- Stores: Full admin access
CREATE POLICY stores_admin_policy ON stores
    FOR ALL USING (is_admin(auth.uid()));

-- Store metrics: Full admin access
CREATE POLICY store_metrics_admin_policy ON store_status_metrics
    FOR ALL USING (is_admin(auth.uid()));

-- Audit logs: Read-only admin access
CREATE POLICY audit_logs_admin_policy ON audit_logs
    FOR SELECT USING (is_admin(auth.uid()));
```

### Helper Functions

```sql
-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_accounts
        WHERE user_id = $1 AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## State Transitions

### Admin Session Lifecycle

1. **Created** (login) → is_active=true, expires_at set to +2 hours
2. **Active** → last_activity_at updated on each request
3. **Expired** → is_active=false when expires_at passed
4. **Ended** (logout) → is_active=false, ended_at set

### Store Sync Status Flow

1. **pending** → Initial state or sync requested
2. **success** → Database sync completed successfully
3. **failed** → Sync encountered errors
4. **pending** → Retry after failed sync

### Store Online Status

- **true** → Store responding to health checks
- **false** → Store not responding or manually disabled

## Migration Strategy

### Phase 1: Core Admin Tables

1. Create `admin_accounts` table with RLS
2. Create `admin_sessions` table with RLS
3. Add helper functions for admin checks
4. Create initial admin user account

### Phase 2: Store Enhancements

1. Add monitoring fields to existing `stores` table
2. Create `store_status_metrics` table
3. Update store RLS policies for admin access
4. Migrate existing store data with default values

### Phase 3: Audit Infrastructure

1. Create `audit_logs` table with RLS
2. Add audit triggers for admin actions
3. Create audit helper functions
4. Set up log retention policies

## Compatibility Notes

- All existing business and customer functionality remains unchanged
- New admin fields in `stores` table have sensible defaults
- RLS policies maintain strict separation between admin and business access
- Existing API endpoints continue to work without modification
- Database schema is backward compatible with existing applications
