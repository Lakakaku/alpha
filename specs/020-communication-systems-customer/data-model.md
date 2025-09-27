# Data Model: Communication Systems

**Feature**: Communication Systems **Date**: 2025-09-25 **Phase**: 1 - Database
Design

## Core Entities

### communication_notifications

Primary entity for all system notifications (SMS, email, internal)

**Fields**:

- `id` (uuid, primary key)
- `recipient_type` (enum: 'customer', 'business', 'admin')
- `recipient_id` (uuid, references customers.id, businesses.id, or
  admin_accounts.id)
- `recipient_phone` (text, encrypted via Supabase Vault)
- `recipient_email` (text, for business notifications)
- `notification_type` (enum: 'reward_earned', 'payment_confirmed',
  'verification_request', 'payment_overdue', 'support_response')
- `channel` (enum: 'sms', 'email', 'internal')
- `template_id` (uuid, references communication_templates.id)
- `content` (text, rendered message content)
- `status` (enum: 'pending', 'sent', 'delivered', 'failed', 'cancelled')
- `retry_count` (integer, default 0, max 3)
- `scheduled_at` (timestamptz, when to send)
- `sent_at` (timestamptz, when actually sent)
- `delivered_at` (timestamptz, when delivery confirmed)
- `failed_reason` (text, error details if failed)
- `metadata` (jsonb, notification-specific data like reward amounts, deadlines)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relationships**:

- Belongs to customers, businesses, or admin_accounts
- Belongs to communication_templates
- Has many communication_retry_attempts

**Validation Rules**:

- Either recipient_phone OR recipient_email required based on channel
- SMS notifications require recipient_phone
- Email notifications require recipient_email
- Content length <= 1600 chars for SMS (multiple message support)
- Scheduled_at cannot be in the past
- Retry_count automatically managed by retry service

### communication_templates

Reusable message templates for different notification types

**Fields**:

- `id` (uuid, primary key)
- `name` (text, unique)
- `notification_type` (enum, matches
  communication_notifications.notification_type)
- `channel` (enum: 'sms', 'email', 'internal')
- `language` (text, default 'sv')
- `subject_template` (text, for emails)
- `content_template` (text, Handlebars syntax)
- `required_variables` (text[], variables that must be provided)
- `is_active` (boolean, default true)
- `version` (integer, for template versioning)
- `created_by` (uuid, references admin_accounts.id)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relationships**:

- Has many communication_notifications
- Belongs to admin_accounts (created_by)

**Validation Rules**:

- Content_template must contain all required_variables
- SMS templates limited to 1600 chars when fully rendered
- Subject_template required for email channel, null for SMS
- Template name must be unique per language/channel combination

### communication_preferences

User preferences for notification frequency and channels

**Fields**:

- `id` (uuid, primary key)
- `user_type` (enum: 'customer', 'business')
- `user_id` (uuid, references customers.id or businesses.id)
- `notification_type` (enum, matches
  communication_notifications.notification_type)
- `channel_preference` (enum: 'sms', 'email', 'both', 'none')
- `frequency_limit` (integer, max notifications per day, default 10)
- `language_preference` (text, default 'sv')
- `quiet_hours_start` (time, default '22:00')
- `quiet_hours_end` (time, default '08:00')
- `is_active` (boolean, default true)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relationships**:

- Belongs to customers or businesses
- Unique constraint on (user_type, user_id, notification_type)

**Validation Rules**:

- Frequency_limit between 0 and 50
- Quiet hours must be valid time ranges
- Language must be supported (sv, en)

### support_tickets

Customer and business support request management

**Fields**:

- `id` (uuid, primary key)
- `ticket_number` (text, unique, auto-generated like "SUP-2025-001234")
- `requester_type` (enum: 'customer', 'business')
- `requester_id` (uuid, references customers.id or businesses.id)
- `requester_contact` (text, phone or email for follow-up)
- `category` (enum: 'payment', 'verification', 'technical', 'feedback',
  'general')
- `priority` (enum: 'low', 'normal', 'high', 'urgent')
- `status` (enum: 'open', 'in_progress', 'pending_customer', 'resolved',
  'closed')
- `subject` (text)
- `description` (text)
- `assigned_to` (uuid, references admin_accounts.id)
- `channel` (enum: 'phone', 'email', 'web_chat', 'internal')
- `sla_deadline` (timestamptz, 2 hours for email/chat, immediate for phone)
- `first_response_at` (timestamptz)
- `resolved_at` (timestamptz)
- `satisfaction_rating` (integer, 1-5, optional)
- `internal_notes` (text, admin-only)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**Relationships**:

- Belongs to customers or businesses (requester)
- Belongs to admin_accounts (assigned_to)
- Has many support_ticket_messages

**Validation Rules**:

- SLA deadline calculated based on channel (phone: now, email/chat: +2 hours)
- Priority escalation rules (payment/verification issues = high priority)
- Satisfaction rating only allowed when status = 'resolved'

### support_ticket_messages

Conversation history for support tickets

**Fields**:

- `id` (uuid, primary key)
- `ticket_id` (uuid, references support_tickets.id)
- `sender_type` (enum: 'customer', 'business', 'admin', 'system')
- `sender_id` (uuid, references appropriate user table)
- `message_content` (text)
- `is_internal` (boolean, default false, internal admin notes)
- `attachments` (text[], file URLs if any)
- `created_at` (timestamptz, default now())

**Relationships**:

- Belongs to support_tickets
- Belongs to customers, businesses, or admin_accounts (sender)

**Validation Rules**:

- Message content required and non-empty
- Internal messages only visible to admin users
- Attachments must be valid URLs or null

### communication_logs

Audit trail for all communication activities

**Fields**:

- `id` (uuid, primary key)
- `action` (enum: 'sent', 'delivered', 'failed', 'retry', 'cancelled')
- `notification_id` (uuid, references communication_notifications.id)
- `admin_user_id` (uuid, references admin_accounts.id, for manual actions)
- `details` (jsonb, action-specific information)
- `ip_address` (inet, for manual actions)
- `user_agent` (text, for web-based actions)
- `created_at` (timestamptz, default now())

**Relationships**:

- Belongs to communication_notifications
- Optionally belongs to admin_accounts

**Validation Rules**:

- Automatic system actions have null admin_user_id
- Manual actions require admin_user_id and ip_address
- Details must contain relevant action information

### communication_retry_schedules

Retry scheduling for failed notifications

**Fields**:

- `id` (uuid, primary key)
- `notification_id` (uuid, references communication_notifications.id)
- `attempt_number` (integer, 1-3)
- `scheduled_at` (timestamptz, when to retry)
- `attempted_at` (timestamptz, when retry was executed)
- `status` (enum: 'scheduled', 'attempted', 'succeeded', 'failed', 'cancelled')
- `failure_reason` (text, if retry failed)
- `created_at` (timestamptz, default now())

**Relationships**:

- Belongs to communication_notifications

**Validation Rules**:

- Attempt_number between 1 and 3
- Retry intervals: immediate, +5min, +30min from original failure
- Cannot schedule retry if notification succeeded

## Entity Relationships

```
communication_notifications (1) ←→ (1) communication_retry_schedules
communication_notifications (N) ←→ (1) communication_templates
communication_notifications (N) ←→ (1) customers/businesses/admin_accounts

communication_preferences (N) ←→ (1) customers/businesses

support_tickets (1) ←→ (N) support_ticket_messages
support_tickets (N) ←→ (1) customers/businesses (requester)
support_tickets (N) ←→ (1) admin_accounts (assigned_to)

communication_logs (N) ←→ (1) communication_notifications
communication_logs (N) ←→ (1) admin_accounts (optional)
```

## State Transitions

### Notification Lifecycle

1. **pending** → **sent** (SMS/email dispatched)
2. **sent** → **delivered** (delivery confirmed via webhook)
3. **sent** → **failed** (delivery failed, schedule retry)
4. **failed** → **pending** (retry scheduled)
5. **pending/sent/failed** → **cancelled** (manual cancellation)

### Support Ticket Lifecycle

1. **open** → **in_progress** (admin picks up ticket)
2. **in_progress** → **pending_customer** (waiting for customer response)
3. **pending_customer** → **in_progress** (customer responds)
4. **in_progress** → **resolved** (issue fixed)
5. **resolved** → **closed** (customer satisfied or auto-close after 7 days)

## Performance Considerations

**Indexing Strategy**:

- `communication_notifications`: Index on (status, scheduled_at) for retry
  processing
- `communication_notifications`: Index on (recipient_type, recipient_id) for
  user queries
- `support_tickets`: Index on (status, sla_deadline) for SLA monitoring
- `support_tickets`: Index on (requester_type, requester_id) for user support
  history

**Partitioning Strategy**:

- `communication_logs`: Consider monthly partitions for long-term audit
  retention
- `communication_notifications`: Archive delivered notifications after 90 days

**RLS (Row Level Security) Policies**:

- Customers can only see their own notifications and support tickets
- Businesses can only see their own notifications and support tickets
- Admin users can see all data
- Communication templates and preferences require appropriate user access
- Audit logs (communication_logs) are admin-only

---

**Data Model Complete**: 7 entities designed with relationships, validation
rules, and security policies **Next Step**: Generate API contracts for
communication workflows
