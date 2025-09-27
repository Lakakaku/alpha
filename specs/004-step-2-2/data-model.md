# QR Code Management System - Data Model

**Feature**: QR Code Management System (004-step-2-2)  
**Date**: 2025-09-20

## Entity Definitions

### 1. QR Code Entity (Existing Enhancement)

**Purpose**: Extends existing `stores` table to support QR code management

**Existing Fields** (stores table):

- `id` (UUID, Primary Key) - Store identifier
- `business_id` (UUID, Foreign Key) - Links to business
- `name` (VARCHAR) - Store display name
- `qr_code_data` (TEXT) - Current QR URL storage
- `created_at`, `updated_at` (TIMESTAMP)
- `verification_status` (ENUM)

**New Fields** (to be added):

- `qr_status` (ENUM: 'active', 'inactive', 'pending_regeneration') - QR code
  state
- `qr_generated_at` (TIMESTAMP) - When current QR was created
- `qr_version` (INTEGER) - Version counter for QR regenerations
- `qr_transition_until` (TIMESTAMP) - When old QR expires (24-hour grace period)

**Business Rules**:

- Each store has exactly one active QR code
- QR transitions maintain 24-hour overlap period
- QR codes are auto-generated on store creation
- Only verified stores can have active QR codes

### 2. QR Scan Events Entity (New)

**Purpose**: Real-time tracking of individual QR code scans

**Table**: `qr_scan_events`

**Fields**:

- `id` (UUID, Primary Key)
- `store_id` (UUID, Foreign Key → stores.id)
- `scanned_at` (TIMESTAMP) - Exact scan time
- `user_agent` (TEXT) - Browser/device information
- `referrer` (TEXT) - Source page if available
- `ip_address` (INET) - Anonymized IP for analytics
- `qr_version` (INTEGER) - Which QR version was scanned
- `session_id` (UUID) - Links to customer feedback session

**Indexes**:

- `idx_qr_scans_store_time` (store_id, scanned_at DESC)
- `idx_qr_scans_session` (session_id)

**Business Rules**:

- One record per QR scan
- No personal data stored (anonymous analytics)
- 90-day retention policy for performance
- RLS policy: businesses see only their store scans

### 3. QR Analytics Aggregations (New)

**Purpose**: Pre-computed analytics for dashboard performance

**Table**: `qr_analytics_5min`

**Fields**:

- `id` (UUID, Primary Key)
- `store_id` (UUID, Foreign Key → stores.id)
- `time_bucket` (TIMESTAMP) - 5-minute interval start
- `scan_count` (INTEGER) - Total scans in interval
- `unique_sessions` (INTEGER) - Distinct session count
- `peak_minute` (INTEGER) - Minute with most scans (0-4)
- `computed_at` (TIMESTAMP) - When aggregation was calculated

**Table**: `qr_analytics_hourly`

**Fields**:

- `id` (UUID, Primary Key)
- `store_id` (UUID, Foreign Key → stores.id)
- `hour_bucket` (TIMESTAMP) - Hour start (e.g., 14:00:00)
- `scan_count` (INTEGER) - Total scans in hour
- `unique_sessions` (INTEGER) - Distinct sessions
- `peak_5min` (INTEGER) - 5-minute interval with most scans
- `avg_scans_per_5min` (DECIMAL) - Average scan rate
- `computed_at` (TIMESTAMP)

**Table**: `qr_analytics_daily`

**Fields**:

- `id` (UUID, Primary Key)
- `store_id` (UUID, Foreign Key → stores.id)
- `date_bucket` (DATE) - Day (e.g., 2025-09-20)
- `scan_count` (INTEGER) - Total daily scans
- `unique_sessions` (INTEGER) - Distinct daily sessions
- `peak_hour` (INTEGER) - Hour with most scans (0-23)
- `busiest_5min` (TIMESTAMP) - Most active 5-minute period
- `avg_scans_per_hour` (DECIMAL) - Average hourly rate
- `computed_at` (TIMESTAMP)

**Indexes**:

- `idx_analytics_store_time` on each table (store_id, time_bucket DESC)
- `idx_analytics_computed` on each table (computed_at DESC)

**Business Rules**:

- 5-minute aggregations computed every 5 minutes
- Hourly aggregations computed every hour
- Daily aggregations computed at midnight
- 1-year retention for historical analysis
- RLS policy: businesses see only their store analytics

### 4. QR Code History Entity (New)

**Purpose**: Audit trail for QR code changes and regenerations

**Table**: `qr_code_history`

**Fields**:

- `id` (UUID, Primary Key)
- `store_id` (UUID, Foreign Key → stores.id)
- `action_type` (ENUM: 'generated', 'regenerated', 'activated', 'deactivated',
  'bulk_operation')
- `old_qr_data` (TEXT) - Previous QR URL (if applicable)
- `new_qr_data` (TEXT) - New QR URL
- `old_version` (INTEGER) - Previous QR version
- `new_version` (INTEGER) - New QR version
- `reason` (TEXT) - Why change was made
- `changed_by` (UUID, Foreign Key → auth.users.id) - User who made change
- `changed_at` (TIMESTAMP) - When change occurred
- `batch_operation_id` (UUID) - Groups bulk operations

**Indexes**:

- `idx_qr_history_store` (store_id, changed_at DESC)
- `idx_qr_history_user` (changed_by, changed_at DESC)
- `idx_qr_history_batch` (batch_operation_id)

**Business Rules**:

- Immutable audit log (no updates/deletes)
- All QR changes must create history record
- Bulk operations share batch_operation_id
- Permanent retention for compliance
- RLS policy: businesses see only their store history

### 5. Print Template Configuration (New)

**Purpose**: Customizable PDF template settings per business

**Table**: `qr_print_templates`

**Fields**:

- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key → businesses.id)
- `template_name` (VARCHAR) - User-defined name
- `page_size` (ENUM: 'A4', 'letter', 'business_card', 'label_sheet')
- `qr_size` (INTEGER) - QR code size in pixels
- `include_logo` (BOOLEAN) - Whether to show business logo
- `logo_url` (TEXT) - URL to business logo image
- `custom_text` (TEXT) - Call-to-action text
- `text_color` (VARCHAR) - Hex color code
- `background_color` (VARCHAR) - Hex color code
- `border_style` (ENUM: 'none', 'thin', 'thick', 'dashed')
- `is_default` (BOOLEAN) - Default template for business
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes**:

- `idx_templates_business` (business_id, is_default DESC)
- `unique_default_per_business` (business_id) WHERE is_default = true

**Business Rules**:

- Each business has one default template
- Multiple custom templates allowed per business
- Logo files must be <2MB and web formats (PNG, JPG, SVG)
- Templates validated for print quality
- RLS policy: businesses manage only their templates

## Entity Relationships

```
businesses (existing)
    ↓ (1:many)
stores (existing + enhanced)
    ↓ (1:many)
qr_scan_events
    ↓ (aggregated into)
qr_analytics_5min/hourly/daily

stores
    ↓ (1:many)
qr_code_history (audit trail)

businesses
    ↓ (1:many)
qr_print_templates (customization)
```

## Data Flow & State Transitions

### QR Code Lifecycle

```
1. Store Created → QR Auto-Generated (active)
2. Regeneration Request → New QR Generated (pending_regeneration)
3. Transition Period → Both QRs Active (24-hour overlap)
4. Transition Complete → Old QR Inactive, New QR Active
5. Deactivation → QR Inactive (store closed/suspended)
```

### Analytics Data Flow

```
1. Customer Scans QR → Event Recorded (qr_scan_events)
2. Every 5 Minutes → Aggregation Job (qr_analytics_5min)
3. Every Hour → Hourly Aggregation (qr_analytics_hourly)
4. Daily at Midnight → Daily Aggregation (qr_analytics_daily)
5. Dashboard Queries → Pre-computed Analytics Tables
```

## Validation Rules

### Store QR Fields

- `qr_status` must be valid enum value
- `qr_generated_at` cannot be future date
- `qr_version` must increment sequentially
- `qr_transition_until` must be 24 hours after `qr_generated_at`

### Scan Events

- `scanned_at` cannot be future date
- `store_id` must exist and be verified
- `qr_version` must match valid store QR version
- `ip_address` must be anonymized (last octet zeroed)

### Analytics Aggregations

- `scan_count` must be >= 0
- `time_bucket` must align to interval boundaries
- `computed_at` must be after `time_bucket`
- No duplicate time buckets per store

### Print Templates

- `page_size` must be valid print format
- `qr_size` must be 64-512 pixels
- Color codes must be valid hex format
- Only one default template per business

## Performance Considerations

### Query Optimization

- Time-series indexes on analytics tables
- Composite indexes for dashboard queries
- Partitioning by month for large analytics tables
- Materialized views for complex trend calculations

### Storage Efficiency

- 90-day retention for raw scan events
- 1-year retention for aggregated analytics
- Compression for historical data
- Archive old data to cold storage

### Real-time Requirements

- 5-minute aggregation jobs via cron
- WebSocket notifications for real-time scan counts
- Optimistic updates for QR regeneration
- Cached dashboard queries with 1-minute TTL

---

**Next**: API Contracts design based on these entities
