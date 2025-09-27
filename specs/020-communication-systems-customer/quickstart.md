# Quickstart: Communication Systems

**Feature**: Communication Systems for Vocilia Alpha
**Date**: 2025-09-25
**Purpose**: Integration test scenarios for validating communication workflows

## Prerequisites

### Database Setup
1. Apply communication schema migration:
   ```sql
   -- Located in supabase/migrations/communication_schema.sql
   -- Creates: communication_notifications, communication_templates,
   --          communication_preferences, support_tickets, etc.
   ```

2. Seed initial templates:
   ```sql
   INSERT INTO communication_templates (name, notification_type, channel, language, content_template, required_variables)
   VALUES
   ('reward_earned_sms_sv', 'reward_earned', 'sms', 'sv',
    'Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK för din feedback. Betalning {{payment_date}}. /STOP',
    ARRAY['customer_name', 'reward_amount', 'payment_date']);
   ```

### Environment Configuration
1. Set SMS provider credentials:
   ```bash
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+46812345678
   ```

2. Configure webhook URL for SMS delivery status:
   ```bash
   WEBHOOK_BASE_URL=https://your-app.railway.app
   ```

## Test Scenario 1: Customer Reward Notification

### Setup
1. Ensure test customer exists:
   ```json
   {
     "id": "test-customer-uuid",
     "phone_number": "+46701234567",
     "name": "Test Customer"
   }
   ```

2. Complete feedback submission that earns reward

### Expected Flow
1. **Reward Calculation Triggers Notification**:
   ```bash
   curl -X POST https://your-app.railway.app/api/notifications/send \
   -H "Authorization: Bearer $ADMIN_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "recipient_type": "customer",
     "recipient_id": "test-customer-uuid",
     "notification_type": "reward_earned",
     "channel": "sms",
     "template_variables": {
       "customer_name": "Test Customer",
       "reward_amount": "85.50",
       "payment_date": "inom 7 dagar"
     }
   }'
   ```

2. **Verify Notification Created**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_JWT" \
   https://your-app.railway.app/api/notifications/{notification_id}
   ```
   Expected: `status: "pending"` → `status: "sent"` → `status: "delivered"`

3. **Check Customer Receives SMS**:
   - SMS content: "Grattis Test Customer! Du har tjänat 85.50 SEK för din feedback. Betalning inom 7 dagar. /STOP"
   - Delivery time: <30 seconds from API call

4. **Verify Retry Logic** (if delivery fails):
   - Immediate retry attempt
   - 5-minute retry if first fails
   - 30-minute retry if second fails
   - Manual intervention required after 3 failures

### Validation Checklist
- [ ] SMS notification sent within 30 seconds
- [ ] Content matches template with correct variables
- [ ] Delivery status updated via webhook
- [ ] Communication log entry created
- [ ] Customer preferences respected (if any)

## Test Scenario 2: Business Verification Request

### Setup
1. Ensure test business exists:
   ```json
   {
     "id": "test-business-uuid",
     "email": "test@business.se",
     "name": "Test Business AB"
   }
   ```

2. Generate weekly verification database (admin action)

### Expected Flow
1. **Weekly Verification Job Triggers**:
   - Cron job runs Sundays 00:00 Europe/Stockholm
   - Creates verification database for business review
   - Triggers business notification

2. **Business Notification Sent**:
   ```bash
   curl -X POST https://your-app.railway.app/api/notifications/send \
   -H "Authorization: Bearer $ADMIN_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "recipient_type": "business",
     "recipient_id": "test-business-uuid",
     "notification_type": "verification_request",
     "channel": "email",
     "template_variables": {
       "business_name": "Test Business AB",
       "deadline": "2025-10-02T17:00:00Z",
       "verification_url": "https://business.vocilia.se/verification/batch-123"
     }
   }'
   ```

3. **Deadline Reminder System**:
   - Day 3: Reminder notification
   - Day 1: Final warning notification
   - After deadline: Escalation notification

### Validation Checklist
- [ ] Verification request email sent immediately
- [ ] Email contains deadline (5 business days)
- [ ] Reminder notifications sent on schedule
- [ ] Business can access verification interface
- [ ] Overdue escalation triggers correctly

## Test Scenario 3: Support Ticket Creation and Response

### Setup
1. Authenticated customer or business user
2. Support agent available for assignment

### Expected Flow
1. **Customer Creates Support Ticket**:
   ```bash
   curl -X POST https://your-app.railway.app/api/support/tickets \
   -H "Authorization: Bearer $CUSTOMER_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "category": "payment",
     "subject": "Payment not received",
     "description": "I submitted feedback 3 days ago but have not received payment",
     "contact_method": "email",
     "contact_details": "customer@example.com"
   }'
   ```

2. **Ticket Auto-Assignment and SLA Setup**:
   - Ticket assigned to available support agent
   - SLA deadline set (2 hours for email contact)
   - Priority calculated (payment issues = high priority)

3. **Support Agent Response**:
   ```bash
   curl -X POST https://your-app.railway.app/api/support/tickets/{ticket_id}/messages \
   -H "Authorization: Bearer $ADMIN_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "message_content": "Thank you for contacting support. I am investigating your payment status and will have an update within 1 hour."
   }'
   ```

4. **Customer Notification of Response**:
   - Email notification to customer about agent response
   - Ticket status updated to "in_progress"

### Validation Checklist
- [ ] Support ticket created with correct SLA deadline
- [ ] High priority assigned for payment category
- [ ] Ticket assigned to available agent within 5 minutes
- [ ] Customer notified of agent response via email
- [ ] SLA tracking accurate (2-hour deadline for email)
- [ ] Internal notes visible only to admin users

## Test Scenario 4: Payment Overdue Escalation

### Setup
1. Business with overdue payment (simulate by backdating invoice)
2. Business contact information available

### Expected Flow
1. **Day 1 After Due Date**:
   ```bash
   # Automated job detects overdue payment
   curl -X POST https://your-app.railway.app/api/notifications/send \
   -H "Authorization: Bearer $SYSTEM_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "recipient_type": "business",
     "recipient_id": "business-uuid",
     "notification_type": "payment_overdue",
     "channel": "email",
     "template_variables": {
       "business_name": "Test Business",
       "overdue_amount": "2450.75",
       "days_overdue": "1",
       "payment_url": "https://business.vocilia.se/payments/invoice-123"
     }
   }'
   ```

2. **Day 7 Escalation**:
   - Warning notification sent
   - Escalation to senior support team

3. **Day 14 Final Notice**:
   - Service suspension warning
   - Requires manual intervention

### Validation Checklist
- [ ] Day 1 reminder sent automatically
- [ ] Day 7 warning includes escalation notice
- [ ] Day 14 suspension warning sent
- [ ] Each escalation level has appropriate tone
- [ ] Payment URL included in all notifications
- [ ] Admin dashboard shows overdue payment alerts

## Test Scenario 5: Weekly Summary Batch Processing

### Setup
1. Multiple customers with rewards earned during week
2. Various stores and reward amounts

### Expected Flow
1. **Weekly Batch Job** (Sundays 06:00):
   ```bash
   curl -X POST https://your-app.railway.app/api/notifications/batch \
   -H "Authorization: Bearer $SYSTEM_JWT" \
   -H "Content-Type: application/json" \
   -d '{
     "notification_type": "weekly_summary",
     "template_id": "weekly-summary-template-uuid",
     "recipients": [
       {
         "recipient_type": "customer",
         "recipient_id": "customer-1",
         "template_variables": {
           "customer_name": "Anna Andersson",
           "total_rewards": "285.50",
           "store_count": "3",
           "week_period": "16-22 september"
         }
       }
     ],
     "scheduled_at": "2025-09-29T06:00:00Z"
   }'
   ```

2. **Batch Processing Monitoring**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_JWT" \
   https://your-app.railway.app/api/notifications/batch/{batch_id}
   ```

### Validation Checklist
- [ ] Batch processing completes within 10 minutes for 1000+ customers
- [ ] All SMS notifications sent successfully
- [ ] Failed notifications automatically retried
- [ ] Batch status accurately reported
- [ ] Individual delivery tracking maintained

## Performance Validation

### Load Testing Targets
1. **SMS Delivery**: <30 seconds from trigger to delivery
2. **Support Ticket Assignment**: <5 minutes for high priority
3. **Batch Processing**: <10 minutes for 10,000 customers
4. **API Response Times**: <500ms for CRUD operations
5. **Retry Processing**: Immediate, 5min, 30min intervals

### Monitoring Setup
1. **SMS Delivery Metrics**:
   - Delivery success rate (target: >95%)
   - Average delivery time (target: <30 seconds)
   - Retry success rate by attempt

2. **Support SLA Metrics**:
   - First response time (target: <2 hours)
   - Resolution time by category
   - Customer satisfaction ratings

3. **Template Performance**:
   - Template rendering time
   - Variable substitution accuracy
   - A/B test results (if applicable)

## Troubleshooting Common Issues

### SMS Delivery Failures
1. Check Twilio webhook configuration
2. Verify phone number format (+46XXXXXXXXX)
3. Review rate limiting settings
4. Check template character limits

### Support Ticket Assignment Issues
1. Verify admin user availability
2. Check SLA calculation logic
3. Review priority escalation rules
4. Confirm email notification delivery

### Template Rendering Errors
1. Validate required variables provided
2. Check Handlebars syntax
3. Verify character limits for SMS
4. Review template versioning

---

**Quickstart Complete**: All critical user journeys validated
**Next Phase**: Generate implementation tasks from these integration scenarios