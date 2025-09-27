# Quickstart: System Monitoring & Analytics

**Feature**: System Monitoring & Analytics | **Branch**: 015-step-4-3 | **Date**: 2025-09-23

## Overview
This quickstart guide validates the System Monitoring & Analytics feature through end-to-end testing scenarios. All tests use real data and production-ready components.

## Prerequisites

### Database Setup
1. **Supabase Tables Created**: All monitoring tables from data-model.md exist with RLS policies
2. **Admin Account**: Test admin account with monitoring permissions exists
3. **Test Data**: Basic system metrics and sample business data available

### Environment Setup
```bash
# Backend (Railway)
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_KEY="your-service-key"
export MONITORING_ENABLED=true

# Frontend (Vercel) 
export NEXT_PUBLIC_SUPABASE_URL="your-project-url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### Authentication
```bash
# Login as admin with monitoring permissions
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vocilia.com","password":"test-password"}'

# Save returned token for subsequent requests
export ADMIN_TOKEN="eyJ..."
```

## Test Scenarios

### Scenario 1: System Health Monitoring Dashboard

**Objective**: Verify real-time performance metrics display with 1-minute granularity

#### Steps:
1. **Access Monitoring Dashboard**
   ```bash
   # Navigate to admin monitoring dashboard
   open https://alpha-admin.vercel.app/monitoring/system-health
   ```

2. **Verify Metrics Collection**
   ```bash
   # Check API metrics endpoint
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3001/api/monitoring/metrics?service=backend&metric_type=api_response_time&granularity=minute"
   
   # Expected: Returns last 60 minutes of API response time data
   ```

3. **Test Dashboard Components**
   - Real-time metrics charts display current system performance
   - Service selector filters metrics by backend/customer_app/business_app/admin_app
   - Time range picker shows last hour/day/week data
   - Alert indicators show current system status (green/yellow/red)

4. **Verify Performance Targets**
   - Dashboard loads in <2 seconds
   - Metrics API responds in <500ms
   - Charts update automatically every minute

#### Expected Results:
- ✅ Dashboard displays real system metrics from Supabase
- ✅ Multiple services (backend, apps) show separate metric streams
- ✅ Charts show API response times, CPU usage, memory usage, error rates
- ✅ Performance meets constitutional requirements (<2s load, <500ms API)

### Scenario 2: Error Tracking and Resolution

**Objective**: Verify error logging with severity classification and resolution workflow

#### Steps:
1. **Generate Test Error**
   ```bash
   # Trigger a test error in backend
   curl -X POST http://localhost:3001/api/test/error \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"severity":"warning","message":"Test error for monitoring"}'
   ```

2. **Search Error Logs**
   ```bash
   # Query error logs API
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3001/api/monitoring/errors?severity=warning&search=test"
   
   # Expected: Returns the generated test error
   ```

3. **Update Error Status**
   ```bash
   # Mark error as investigating
   curl -X PATCH http://localhost:3001/api/monitoring/errors \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"error_id":"uuid-from-previous-response","resolution_status":"investigating"}'
   ```

4. **Verify Error Dashboard**
   - Navigate to error tracking section in admin dashboard
   - Search functionality finds errors by message content
   - Severity filtering (critical/warning/info) works correctly
   - Resolution status can be updated through UI

#### Expected Results:
- ✅ Errors are logged with timestamp, severity, stack trace
- ✅ Search finds errors by message content
- ✅ Resolution status updates successfully
- ✅ Error dashboard provides searchable interface

### Scenario 3: Alert System Configuration

**Objective**: Verify configurable alert thresholds and notification delivery

#### Steps:
1. **Create Alert Rule**
   ```bash
   # Create alert rule for high error rate
   curl -X POST http://localhost:3001/api/monitoring/alerts/rules \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "rule_name": "High Error Rate Alert",
       "metric_type": "error_rate",
       "threshold_value": 2.0,
       "comparison_operator": ">",
       "notification_channels": ["email", "dashboard"]
     }'
   ```

2. **Test Alert Trigger**
   ```bash
   # Generate multiple errors to exceed 2% threshold
   for i in {1..5}; do
     curl -X POST http://localhost:3001/api/test/error \
       -H "Authorization: Bearer $ADMIN_TOKEN" \
       -d '{"severity":"critical","message":"Load test error '$i'"}'
   done
   ```

3. **Verify Alert Notification**
   - Check email for alert notification (if configured)
   - Dashboard shows alert indicator
   - Alert history logs the triggered event

4. **Test Alert Configuration UI**
   - Navigate to alert rules section in admin dashboard
   - Create/edit/delete alert rules through interface
   - Configure notification preferences (email/dashboard/SMS)

#### Expected Results:
- ✅ Alert rule created successfully with medium thresholds (2% error rate, 5s response time, 80% CPU)
- ✅ Alerts trigger when thresholds are exceeded
- ✅ Notifications sent via configured channels
- ✅ Alert configuration UI allows rule management

### Scenario 4: Business Intelligence Dashboard

**Objective**: Verify fraud detection reporting and revenue analytics

#### Steps:
1. **Upload Verification Data** (simulates admin weekly upload)
   ```bash
   # Upload CSV with verification results
   curl -X POST http://localhost:3001/api/admin/stores/upload \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -F "file=@test-verification-data.csv"
   ```

2. **Check Fraud Detection Reports**
   ```bash
   # Query fraud detection analytics
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3001/api/monitoring/fraud-reports?start_date=2025-09-01&end_date=2025-09-23"
   
   # Expected: Returns verification failure rates and fraud patterns
   ```

3. **Verify Revenue Analytics**
   ```bash
   # Query revenue metrics
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3001/api/monitoring/revenue-analytics?group_by=day&start_date=2025-09-01"
   
   # Expected: Returns rewards paid, admin fees, net revenue by day
   ```

4. **Test BI Dashboard**
   - Navigate to business intelligence section
   - Filter analytics by store, region, time period
   - Verify comparative store performance charts
   - Check fraud detection accuracy metrics

#### Expected Results:
- ✅ BI data updates when admin uploads verification data
- ✅ Fraud reports show verification failure rates and suspicious patterns
- ✅ Revenue analytics display rewards paid, admin fees, net revenue
- ✅ Filtering by store, region, time period works correctly

### Scenario 5: Data Export Functionality

**Objective**: Verify multi-format data export (CSV, PDF, JSON) with large datasets

#### Steps:
1. **Request CSV Export**
   ```bash
   # Export revenue analytics as CSV
   curl -X POST http://localhost:3001/api/monitoring/export \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "data_type": "revenue_analytics",
       "format": "csv",
       "date_range": {"start_date": "2025-09-01", "end_date": "2025-09-23"}
     }'
   
   # Expected: Returns download_url and expiration time
   ```

2. **Download and Verify CSV**
   ```bash
   # Download the exported file
   curl -o revenue-export.csv "https://download-url-from-response"
   
   # Verify CSV format and content
   head -5 revenue-export.csv
   ```

3. **Test PDF Export**
   ```bash
   # Export fraud detection report as PDF
   curl -X POST http://localhost:3001/api/monitoring/export \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "data_type": "fraud_reports",
       "format": "pdf",
       "date_range": {"start_date": "2025-09-01", "end_date": "2025-09-23"}
     }'
   ```

4. **Test JSON Export**
   ```bash
   # Export system metrics as JSON for API integration
   curl -X POST http://localhost:3001/api/monitoring/export \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "data_type": "system_metrics",
       "format": "json",
       "date_range": {"start_date": "2025-09-23", "end_date": "2025-09-23"}
     }'
   ```

#### Expected Results:
- ✅ CSV export contains properly formatted spreadsheet data
- ✅ PDF export provides formatted report suitable for presentation
- ✅ JSON export provides structured data for API integration
- ✅ Large datasets export without timeout (streaming approach)

### Scenario 6: System Health Check

**Objective**: Verify health check endpoints for external monitoring services

#### Steps:
1. **Basic Health Check**
   ```bash
   # Check system health endpoint
   curl http://localhost:3001/api/monitoring/health
   
   # Expected: Returns 200 with system status
   ```

2. **Verify Health Response**
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-09-23T10:30:00Z",
     "services": {
       "database": "healthy",
       "api": "healthy", 
       "monitoring": "healthy"
     },
     "metrics": {
       "uptime_seconds": 86400,
       "response_time_ms": 45.2,
       "error_rate": 0.1
     }
   }
   ```

3. **Test Unhealthy State** (if database is unavailable)
   ```bash
   # Should return 503 when system is unhealthy
   # Response includes degraded service indicators
   ```

#### Expected Results:
- ✅ Health endpoint returns 200 when system is healthy
- ✅ Health endpoint returns 503 when system has issues
- ✅ Response includes service status and key metrics
- ✅ External monitoring can parse health status

## Performance Validation

### Dashboard Load Performance
- **Target**: <2 seconds initial load on standard connection
- **Test**: Use lighthouse audit on monitoring dashboard
- **Measurement**: Time to interactive, largest contentful paint

### API Response Performance  
- **Target**: <500ms for CRUD operations, <1s for analytics queries
- **Test**: Automated API response time measurement
- **Measurement**: Average response time over 100 requests

### Data Export Performance
- **Target**: <30 seconds for 10,000 records export
- **Test**: Export large dataset and measure completion time
- **Measurement**: Time from request to download URL generation

## Security Validation

### Access Control
- **Test**: Non-admin users cannot access monitoring endpoints
- **Test**: Admin users without monitoring permissions are rejected
- **Test**: RLS policies enforce business data isolation

### Audit Logging
- **Test**: All monitoring access is logged with user ID and timestamp
- **Test**: Sensitive operations (alert rule changes) are audited
- **Test**: Audit logs are queryable and secure

## Data Retention Validation

### 1-Year Retention Policy
- **Test**: Data older than 1 year is automatically cleaned up
- **Test**: Recent data (within 1 year) remains accessible
- **Test**: Cleanup process doesn't impact system performance

## Constitutional Compliance Checklist

- ✅ **Production from Day One**: All tests use real Supabase database
- ✅ **Security First**: RLS policies enforced, admin-only access verified
- ✅ **TypeScript Strict**: All monitoring code uses strict TypeScript
- ✅ **Real Data Only**: No mock data, uses actual system metrics
- ✅ **Monorepo Architecture**: Extends existing admin app structure

## Troubleshooting

### Common Issues
1. **Metrics not appearing**: Check middleware is installed and MONITORING_ENABLED=true
2. **Alert notifications not sent**: Verify email configuration and notification service
3. **Export timeouts**: Ensure streaming approach is implemented for large datasets
4. **Permission errors**: Confirm admin user has monitoring role assigned

### Debug Commands
```bash
# Check monitoring data exists
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/monitoring/metrics?limit=1"

# Verify alert rules
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/monitoring/alerts/rules"

# Test health endpoint
curl -v http://localhost:3001/api/monitoring/health
```

---
*Quickstart complete - Ready for task generation*