# Data Model: Shared Infrastructure

**Generated**: 2025-09-20
**For Feature**: Shared Infrastructure (002-step-1-3)

## Entity Overview

This document defines the data model for shared infrastructure components supporting authentication, user management, and API access across Vocilia's three applications.

## Core Entities

### 1. User Profile
**Purpose**: Extended user information beyond Supabase Auth base user
**Storage**: `user_profiles` table with RLS policies

**Attributes**:
- `id` (UUID, Primary Key): Links to `auth.users.id`
- `role` (Enum): User role type - business_account | admin_account
- `business_id` (UUID, Foreign Key): References business entity (nullable for admins)
- `email` (Text, Unique): User email address
- `full_name` (Text): User's full name
- `avatar_url` (Text): Profile picture URL
- `created_at` (Timestamp): Account creation time
- `updated_at` (Timestamp): Last profile update

**Validation Rules**:
- Email must be valid format
- Role must be one of defined enum values
- Business users must have valid business_id
- Admin users must have business_id as null

**Relationships**:
- One-to-one with `auth.users`
- Many-to-one with `businesses` (if business_account)
- One-to-many with `user_permissions`

### 2. Business
**Purpose**: Business entity for customer organizations using feedback platform
**Storage**: `businesses` table with RLS policies

**Attributes**:
- `id` (UUID, Primary Key): Unique business identifier
- `name` (Text, Required): Business/company name
- `organization_number` (Text, Unique): Swedish organization number
- `contact_email` (Text): Primary business contact email
- `phone_number` (Text): Business phone number
- `address` (JSONB): Business address information
- `subscription_status` (Enum): active | inactive | suspended
- `created_at` (Timestamp): Business registration time
- `updated_at` (Timestamp): Last business update

**Validation Rules**:
- Name must be 2-100 characters
- Organization number must be valid Swedish format
- Contact email must be valid format
- Subscription status required for access control

**Relationships**:
- One-to-many with `user_profiles` (business accounts)
- One-to-many with `stores` (business locations)
- One-to-many with `business_settings`

### 3. Store
**Purpose**: Individual business locations for multi-location businesses
**Storage**: `stores` table with RLS policies

**Attributes**:
- `id` (UUID, Primary Key): Unique store identifier
- `business_id` (UUID, Foreign Key): References parent business
- `name` (Text, Required): Store name/location identifier
- `address` (JSONB): Store physical address
- `store_code` (Text, Unique): Internal store identifier
- `qr_code_data` (Text): QR code content for customer entry
- `active` (Boolean): Store operational status
- `created_at` (Timestamp): Store creation time
- `updated_at` (Timestamp): Last store update

**Validation Rules**:
- Name must be 1-100 characters
- Store code must be unique within business
- QR code data must be valid format
- Business_id must reference existing business

**Relationships**:
- Many-to-one with `businesses`
- One-to-many with `feedback` entries

### 4. Permission
**Purpose**: Granular permissions for role-based access control
**Storage**: `permissions` table

**Attributes**:
- `id` (UUID, Primary Key): Unique permission identifier
- `name` (Text, Unique): Permission identifier (e.g., 'business.read')
- `description` (Text): Human-readable permission description
- `category` (Text): Permission grouping (business, customer, admin)
- `created_at` (Timestamp): Permission creation time

**Predefined Permissions**:
```
business.read - View business information
business.write - Update business information
business.delete - Delete business
customers.read - View customer data
customers.write - Update customer data
feedback.read - View feedback
feedback.moderate - Moderate feedback
admin.users - Manage users
admin.businesses - Manage all businesses
admin.system - System administration
```

### 5. User Permission
**Purpose**: Junction table for user-specific permissions
**Storage**: `user_permissions` table with RLS policies

**Attributes**:
- `id` (UUID, Primary Key): Unique assignment identifier
- `user_id` (UUID, Foreign Key): References user_profiles.id
- `permission` (Text, Foreign Key): References permissions.name
- `granted_by` (UUID, Foreign Key): User who granted permission
- `granted_at` (Timestamp): When permission was granted
- `expires_at` (Timestamp, Nullable): Permission expiration time

**Validation Rules**:
- User and permission combination must be unique
- Granted_by must reference valid user with admin privileges
- Expires_at must be in the future if specified

### 6. API Key
**Purpose**: Service-to-service authentication tokens
**Storage**: `api_keys` table with RLS policies

**Attributes**:
- `id` (UUID, Primary Key): Unique key identifier
- `name` (Text): Human-readable key name
- `key_hash` (Text): Hashed API key value
- `business_id` (UUID, Foreign Key): Associated business (nullable)
- `permissions` (Text[]): Array of permitted actions
- `last_used_at` (Timestamp): Last usage timestamp
- `expires_at` (Timestamp): Key expiration time
- `active` (Boolean): Key status
- `created_by` (UUID, Foreign Key): User who created key
- `created_at` (Timestamp): Key creation time

**Validation Rules**:
- Name must be 1-100 characters
- Key hash must be securely generated
- Permissions must be valid permission names
- Expires_at must be in the future

## State Transitions

### User Role Transitions
```
Initial State: No profile
└─ Registration → business_account OR admin_account
   ├─ business_account → [no role changes allowed]
   └─ admin_account → [can modify other users]
```

### Business Subscription States
```
Initial State: active (upon creation)
├─ active → inactive (non-payment)
├─ active → suspended (policy violation)
├─ inactive → active (payment resolved)
├─ suspended → active (admin reinstatement)
└─ Any state → deleted (business removal)
```

### Permission Grant States
```
Initial State: No permissions
├─ Grant → active permission
├─ Active → expired (time-based)
├─ Active → revoked (manual removal)
└─ Expired/Revoked → re-granted (new assignment)
```

## Security Model

### Row Level Security (RLS) Policies

**User Profiles**:
- Users can read/update their own profile
- Business admins can read profiles in their business
- System admins can read all profiles

**Businesses**:
- Business users can read/update their own business
- System admins can read/update all businesses

**Stores**:
- Business users can manage stores in their business
- System admins can manage all stores

**Permissions**:
- All authenticated users can read permission definitions
- Only system admins can create/modify permissions

**User Permissions**:
- Users can read their own permissions
- Business admins can read permissions for their business users
- System admins can read/modify all user permissions

### Data Encryption
- API keys stored as secure hashes (bcrypt)
- Sensitive personal data encrypted at rest
- All database connections use SSL/TLS
- Environment variables for secrets management

### Access Patterns
- Read operations through RLS policies
- Write operations through server-side functions
- API authentication via JWT tokens
- Service authentication via API keys

## Database Schema Implementation

### Core Tables Structure
```sql
-- User profiles extending auth.users
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'business_account',
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business entities
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_number TEXT UNIQUE,
  contact_email TEXT,
  phone_number TEXT,
  address JSONB,
  subscription_status subscription_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store locations
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address JSONB,
  store_code TEXT,
  qr_code_data TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, store_code)
);
```

### Indexes for Performance
```sql
-- User profile lookups
CREATE INDEX idx_user_profiles_business_id ON user_profiles(business_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Business lookups
CREATE INDEX idx_businesses_subscription_status ON businesses(subscription_status);
CREATE INDEX idx_businesses_organization_number ON businesses(organization_number);

-- Store lookups
CREATE INDEX idx_stores_business_id ON stores(business_id);
CREATE INDEX idx_stores_active ON stores(active);
```

This data model provides the foundation for secure, scalable shared infrastructure while maintaining compliance with constitutional requirements for production-ready implementation and TypeScript strict mode compatibility.