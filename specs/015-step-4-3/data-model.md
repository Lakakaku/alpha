# Data Model: System Monitoring & Analytics

**Feature**: System Monitoring & Analytics | **Branch**: 015-step-4-3 |
**Date**: 2025-09-23

## Database Schema

### Core Monitoring Tables

#### system_metrics

Time-series table for performance metrics with 1-minute granularity.

```sql
CREATE TABLE system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  metric_type text NOT NULL, -- 'api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'
  metric_value numeric NOT NULL,
  service_name text NOT NULL, -- 'backend', 'customer_app', 'business_app', 'admin_app'
  additional_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Partitioning by month for performance
-- Indexes on timestamp, metric_type, service_name
```

#### error_logs

Application error tracking with severity classification.

```sql
CREATE TABLE error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  error_message text NOT NULL,
  stack_trace text,
  service_name text NOT NULL,
  endpoint text,
  user_context jsonb DEFAULT '{}',
  resolution_status text DEFAULT 'open' CHECK (resolution_status IN ('open', 'investigating', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### usage_analytics

Daily aggregated usage statistics.

```sql
CREATE TABLE usage_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  service_name text NOT NULL,
  daily_active_users integer NOT NULL DEFAULT 0,
  api_call_volume integer NOT NULL DEFAULT 0,
  feature_usage jsonb DEFAULT '{}', -- {'qr_scans': 150, 'feedback_calls': 89}
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on date + service_name for upsert operations
```

#### alert_rules

Configurable alert thresholds and notification preferences.

```sql
CREATE TABLE alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  metric_type text NOT NULL,
  threshold_value numeric NOT NULL,
  comparison_operator text NOT NULL CHECK (comparison_operator IN ('>', '<', '>=', '<=', '=')),
  notification_channels text[] NOT NULL, -- ['email', 'dashboard', 'sms']
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES admin_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### alert_notifications

History of sent alerts for tracking and debugging.

```sql
CREATE TABLE alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id uuid REFERENCES alert_rules(id),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  metric_value numeric NOT NULL,
  notification_channels text[] NOT NULL,
  delivery_status jsonb DEFAULT '{}', -- {'email': 'sent', 'sms': 'failed'}
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Business Intelligence Tables

#### fraud_detection_reports

Aggregated fraud analysis data updated when admins upload verification results.

```sql
CREATE TABLE fraud_detection_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  store_id uuid REFERENCES stores(id),
  verification_failure_rate numeric NOT NULL,
  suspicious_patterns jsonb DEFAULT '{}',
  blocked_transactions integer NOT NULL DEFAULT 0,
  false_positive_rate numeric,
  accuracy_metrics jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### revenue_analytics

Business performance metrics aggregated by store and time period.

```sql
CREATE TABLE revenue_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  store_id uuid REFERENCES stores(id),
  total_rewards_paid numeric NOT NULL DEFAULT 0,
  admin_fees_collected numeric NOT NULL DEFAULT 0,
  net_revenue numeric NOT NULL DEFAULT 0,
  feedback_volume integer NOT NULL DEFAULT 0,
  customer_engagement_rate numeric,
  reward_distribution jsonb DEFAULT '{}', -- grade distribution
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### business_performance_metrics

Store performance analytics for comparative analysis.

```sql
CREATE TABLE business_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  store_id uuid REFERENCES stores(id),
  business_id uuid REFERENCES businesses(id),
  feedback_volume_trend numeric, -- percentage change
  verification_rate numeric,
  customer_satisfaction_score numeric,
  operational_metrics jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Audit and Access Control

#### monitoring_access_logs

Audit trail for all monitoring system access.

```sql
CREATE TABLE monitoring_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_accounts(id),
  accessed_feature text NOT NULL, -- 'system_health', 'business_intelligence', 'data_export'
  action_type text NOT NULL, -- 'view', 'export', 'configure'
  resource_details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
```

## Entity Relationships

### Core Relationships

- `alert_rules` → `admin_accounts` (created_by foreign key)
- `alert_notifications` → `alert_rules` (alert_rule_id foreign key)
- `fraud_detection_reports` → `stores` (store_id foreign key)
- `revenue_analytics` → `stores` (store_id foreign key)
- `business_performance_metrics` → `stores` and `businesses` (foreign keys)
- `monitoring_access_logs` → `admin_accounts` (admin_user_id foreign key)

### Data Flow

1. **Metrics Collection**: Middleware writes to `system_metrics` and
   `error_logs`
2. **Analytics Aggregation**: Daily jobs aggregate data into `usage_analytics`
3. **Alert Processing**: Background service monitors `system_metrics` against
   `alert_rules`
4. **BI Updates**: Admin data uploads trigger updates to fraud/revenue analytics
   tables
5. **Access Auditing**: All monitoring access logged to `monitoring_access_logs`

## Validation Rules

### Data Integrity

- **Timestamps**: All tables require `created_at`, monitoring tables require
  `timestamp`
- **Metrics**: All numeric values must be non-negative
- **Retention**: Automated cleanup after 1 year via scheduled functions
- **Partitioning**: `system_metrics` partitioned by month for performance

### Business Rules

- **Alert Thresholds**: Must specify comparison operator and notification
  channels
- **Metrics Collection**: 1-minute minimum granularity for real-time metrics
- **Analytics Updates**: BI tables updated only when admin uploads verification
  data
- **Access Control**: All monitoring access requires admin authentication

### Performance Optimizations

- **Indexes**: Timestamp, metric_type, service_name, store_id
- **Materialized Views**: For complex analytics queries
- **Aggregation**: Pre-computed daily/weekly/monthly rollups
- **Archival**: Automated data archival after 1 year retention

## Row Level Security (RLS) Policies

### Admin Access Control

```sql
-- monitoring_access_logs: Admins can only see their own access logs
CREATE POLICY admin_own_access_logs ON monitoring_access_logs
  FOR ALL USING (admin_user_id = auth.uid());

-- system_metrics: All admins with monitoring role can read
CREATE POLICY admin_read_system_metrics ON system_metrics
  FOR SELECT USING (admin_has_monitoring_permission());

-- alert_rules: Admins can read all, only modify their own
CREATE POLICY admin_alert_rules ON alert_rules
  FOR ALL USING (admin_has_monitoring_permission())
  WITH CHECK (created_by = auth.uid() OR admin_is_super_admin());
```

### Business Data Isolation

```sql
-- fraud_detection_reports: Respect business data isolation
CREATE POLICY business_fraud_reports ON fraud_detection_reports
  FOR SELECT USING (
    admin_has_monitoring_permission() AND
    admin_can_access_business_data(
      (SELECT business_id FROM stores WHERE id = store_id)
    )
  );

-- revenue_analytics: Similar business isolation
CREATE POLICY business_revenue_analytics ON revenue_analytics
  FOR SELECT USING (
    admin_has_monitoring_permission() AND
    admin_can_access_business_data(
      (SELECT business_id FROM stores WHERE id = store_id)
    )
  );
```

## State Transitions

### Error Log Lifecycle

```
open → investigating → resolved
```

### Alert Rule States

```
active → inactive (can be toggled by admins)
```

### Data Retention Lifecycle

```
current_data → archived_data → deleted_data (after 1 year)
```

---

_Data model complete - Ready for API contracts generation_
