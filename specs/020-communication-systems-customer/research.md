# Research: Communication Systems

**Feature**: Communication Systems for Vocilia Alpha **Date**: 2025-09-25
**Research Phase**: Technical stack and integration patterns

## SMS Provider Selection

### Decision: Twilio SMS API

**Rationale**:

- Production-ready SMS delivery with Swedish mobile operator support
- Reliable delivery tracking and webhook callbacks for retry logic
- Comprehensive API for bulk messaging and delivery status reporting
- Existing TypeScript SDK with proper typing support
- Meets constitutional requirement for production from day one

**Alternatives Considered**:

- **46elks (Swedish)**: Local provider but limited TypeScript support and
  webhook capabilities
- **Messagebird**: Good European coverage but more complex pricing model
- **AWS SNS**: Lower-level service requiring more custom delivery tracking
  implementation

**Implementation Details**:

- Use Twilio Programmable Messaging API
- Webhook endpoints for delivery status updates (delivered, failed, etc.)
- Bulk messaging for weekly summaries
- Message templates for different notification types

## Support Ticket System

### Decision: Custom Support System with Zendesk-style Architecture

**Rationale**:

- Integrates directly with existing Supabase database maintaining data
  sovereignty
- Supports multi-channel ticket creation (phone, email, web chat)
- Enables priority routing for payment/verification issues
- Custom SLA tracking aligned with 2-hour email/chat response requirement
- Full control over data retention and GDPR compliance

**Alternatives Considered**:

- **Zendesk Integration**: External dependency, data sovereignty concerns,
  monthly costs
- **Intercom**: Focus on marketing, less suitable for technical support
  workflows
- **Help Scout**: Good for email but limited phone/chat integration capabilities

**Implementation Details**:

- Support tickets stored in Supabase with RLS policies
- Real-time updates via Supabase realtime subscriptions
- Email integration via webhook processing
- Phone integration via call logging
- Web chat via WebSocket connections

## Notification Processing Architecture

### Decision: Node-cron with PostgreSQL Job Locking

**Rationale**:

- Builds on existing payment batch processing patterns (already implemented)
- PostgreSQL row-level locking prevents duplicate processing across multiple
  instances
- Reliable retry mechanism with exponential backoff (immediate, 5min, 30min)
- Integrates with existing Railway deployment infrastructure
- Constitutional compliance with real data processing

**Alternatives Considered**:

- **Bull Queue (Redis)**: Requires additional Redis infrastructure, breaks
  monorepo simplicity
- **AWS SQS**: External dependency, vendor lock-in concerns
- **Database Triggers**: Limited retry logic, harder to monitor and debug

**Implementation Details**:

- Notification processing jobs run every minute
- Batch processing for weekly summaries (Sundays 00:00 Europe/Stockholm)
- Failure tracking with automatic retry scheduling
- Dead letter queue for manual intervention after 3 failed attempts

## Communication Templates System

### Decision: Database-Stored Templates with Handlebars Syntax

**Rationale**:

- Templates stored in Supabase enable dynamic content updates without
  deployments
- Handlebars provides safe templating with XSS protection
- Multi-language support for Swedish/English communications
- Version control for template changes with audit logging
- Admin interface for business users to modify messaging

**Alternatives Considered**:

- **File-based Templates**: Requires deployments for content changes, less
  flexible
- **React Server Components**: Overkill for SMS text generation, adds complexity
- **Simple String Replacement**: No conditional logic, limited formatting
  options

**Implementation Details**:

- Template entities with content, variables, and language fields
- Handlebars helpers for date formatting, currency, phone number formatting
- Template versioning for A/B testing and rollback capabilities
- Validation rules for required variables and character limits (SMS)

## Swedish Compliance Requirements

### Decision: Follow Swedish Personal Data Act and PTS Guidelines

**Rationale**:

- SMS marketing requires opt-in consent (existing feedback system provides this)
- Support communications are transactional (exempt from marketing restrictions)
- GDPR compliance through existing Supabase data processing agreements
- Phone number validation using Swedish mobile number patterns

**Key Compliance Points**:

- Opt-out mechanisms in every SMS (reply STOP)
- Data retention aligned with existing feedback retention policies
- Clear identification of sender (business name in SMS)
- Audit logging for all communication activities

## Integration Patterns

### Decision: Event-Driven Architecture with Supabase Functions

**Rationale**:

- Feedback submission → Reward calculation → SMS notification (existing
  workflow)
- Payment processing → SMS confirmation (extends payment system)
- Verification deadline → Business notification (new workflow)
- Support ticket creation → Assignment → SLA tracking (new workflow)

**Event Triggers**:

- Database triggers for real-time notifications
- Scheduled jobs for deadline reminders and weekly summaries
- Webhook processors for SMS delivery status updates
- API endpoints for manual support interactions

## Performance Optimization

### Decision: Batch Processing with Individual Delivery Tracking

**Rationale**:

- Weekly summaries processed in batches to reduce API costs
- Individual notifications sent immediately for time-sensitive communications
- SMS delivery status tracking via webhooks for retry logic
- Database connection pooling for high-volume notification periods

**Performance Targets**:

- SMS delivery initiation: <30 seconds from trigger event
- Batch processing: <10 minutes for 10,000+ notifications
- Support ticket assignment: <5 minutes for priority issues
- Template rendering: <100ms per message

## Security Considerations

### Decision: Phone Number Encryption and RLS Policies

**Rationale**:

- Customer phone numbers encrypted at rest using Supabase Vault
- Communication logs protected by RLS (admin-only access)
- SMS content sanitized to prevent sensitive data leakage
- API rate limiting to prevent SMS flooding attacks

**Security Measures**:

- Input validation for all SMS content and phone numbers
- Rate limiting: 5 SMS per customer per hour
- Admin authentication required for communication management
- Audit logging for all communication activities and configuration changes

---

**Research Complete**: All technical unknowns resolved for Phase 1 design **Next
Phase**: Generate data model, API contracts, and integration specifications
