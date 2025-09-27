# Monitoring Guide - Vocilia Production Environment

## Overview

This guide covers the comprehensive monitoring system for the Vocilia customer
feedback reward platform. The monitoring infrastructure ensures 99.5% uptime,
<2s response times, and proactive alerting for all production systems.

## Monitoring Architecture

### Monitoring Stack

- **Railway**: Backend infrastructure monitoring
- **Vercel**: Frontend performance and analytics
- **Supabase**: Database monitoring and query analysis
- **Custom Dashboard**: Unified monitoring interface at `admin.vocilia.com`
- **External Tools**: Uptime monitoring and alerting services

### Key Metrics Tracked

- **Uptime**: Service availability across all platforms
- **Performance**: Response times, throughput, error rates
- **Infrastructure**: CPU, memory, disk usage
- **Business**: User engagement, conversion rates
- **Security**: Failed login attempts, suspicious activity

## Health Check System

### Health Check Endpoints

#### Basic Health Check - `/health`

**Purpose**: Quick service status verification  
**Response Time**: <100ms expected  
**Frequency**: Every 30 seconds

```bash
curl https://api.vocilia.com/health
```

**Expected Response**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "environment": "production"
}
```

#### Detailed Health Check - `/health/detailed`

**Purpose**: Comprehensive system status  
**Response Time**: <500ms expected  
**Frequency**: Every 2 minutes

```bash
curl https://api.vocilia.com/health/detailed
```

**Expected Response**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "response_time": 45,
      "details": {
        "connection_pool": "80% utilized",
        "active_connections": 8,
        "max_connections": 10
      }
    },
    {
      "name": "external_apis",
      "status": "healthy",
      "response_time": 120,
      "details": {
        "openai_api": "healthy",
        "supabase_api": "healthy"
      }
    },
    {
      "name": "background_jobs",
      "status": "healthy",
      "details": {
        "scheduler_running": true,
        "pending_jobs": 3,
        "failed_jobs": 0
      }
    }
  ],
  "performance": {
    "avg_response_time": 850,
    "p95_response_time": 1650,
    "requests_per_minute": 120,
    "error_rate": 0.1
  },
  "system": {
    "memory_usage": "65%",
    "cpu_usage": "45%",
    "disk_usage": "30%"
  }
}
```

#### Database Health Check - `/health/database`

**Purpose**: Database connectivity and performance  
**Response Time**: <200ms expected  
**Frequency**: Every minute

```bash
curl https://api.vocilia.com/health/database
```

**Expected Response**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "connection_pool": {
    "active": 8,
    "idle": 2,
    "max": 10,
    "utilization": "80%"
  },
  "query_performance": {
    "avg_query_time": 85,
    "slow_queries": 0,
    "deadlocks": 0
  },
  "backup_status": {
    "last_backup": "2024-01-15T02:00:00Z",
    "backup_age_hours": 8.5,
    "backup_size": "1.2GB",
    "backup_health": "healthy"
  },
  "replication": {
    "status": "healthy",
    "lag": "2ms"
  }
}
```

#### Jobs Health Check - `/health/jobs`

**Purpose**: Background job scheduler status  
**Response Time**: <100ms expected  
**Frequency**: Every minute

```bash
curl https://api.vocilia.com/health/jobs
```

**Expected Response**:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "scheduler_running": true,
  "job_queues": [
    {
      "name": "monitoring_aggregation",
      "status": "healthy",
      "pending": 0,
      "processing": 1,
      "failed": 0,
      "last_run": "2024-01-15T10:25:00Z"
    },
    {
      "name": "backup_verification",
      "status": "healthy",
      "pending": 0,
      "processing": 0,
      "failed": 0,
      "last_run": "2024-01-15T03:00:00Z"
    }
  ],
  "next_scheduled_jobs": [
    {
      "name": "daily_backup",
      "next_run": "2024-01-16T02:00:00Z"
    }
  ]
}
```

## Performance Monitoring

### Response Time Monitoring

#### SLA Targets

- **API Endpoints**: P95 < 2000ms
- **Frontend Pages**: Load time < 2s
- **Health Checks**: < 500ms
- **Database Queries**: Average < 100ms

#### Monitoring API

```bash
# Get performance metrics for last hour
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/performance?timeframe=1h"
```

**Response**:

```json
{
  "timeframe": "1h",
  "summary": {
    "total_requests": 7200,
    "avg_response_time": 850,
    "p50_response_time": 650,
    "p95_response_time": 1650,
    "p99_response_time": 2100,
    "error_rate": 0.2,
    "throughput": 120
  },
  "endpoints": [
    {
      "endpoint": "/health",
      "avg_response_time": 85,
      "p95_response_time": 150,
      "request_count": 120,
      "error_rate": 0.0
    },
    {
      "endpoint": "/api/businesses",
      "avg_response_time": 950,
      "p95_response_time": 1800,
      "request_count": 480,
      "error_rate": 0.1
    }
  ],
  "alerts": [
    {
      "endpoint": "/api/stores/upload",
      "issue": "P95 response time above threshold",
      "current_value": 2200,
      "threshold": 2000,
      "severity": "warning"
    }
  ]
}
```

### Frontend Performance Monitoring

#### Vercel Analytics Integration

Each frontend application integrates with Vercel Analytics for:

- Real User Monitoring (RUM)
- Core Web Vitals tracking
- Page load performance
- User interaction metrics

#### Key Metrics

- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Cumulative Layout Shift (CLS)**: <0.1
- **First Input Delay (FID)**: <100ms

```bash
# Check frontend performance via API
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/frontend-performance"
```

## Uptime Monitoring

### SLA Requirements

- **Monthly Uptime**: 99.5% minimum
- **Downtime Definition**:
  - HTTP 5xx errors >50% for >1 minute
  - Complete service unavailability >30 seconds
- **Scheduled Maintenance**: Excluded from SLA calculations

### Uptime Calculation API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/uptime?period=month"
```

**Response**:

```json
{
  "period": "month",
  "current_month": "2024-01",
  "uptime_percentage": 99.8,
  "sla_status": "meeting",
  "total_minutes": 44640,
  "downtime_minutes": 89,
  "incident_count": 2,
  "incidents": [
    {
      "start": "2024-01-10T14:30:00Z",
      "end": "2024-01-10T15:15:00Z",
      "duration_minutes": 45,
      "reason": "Database maintenance",
      "type": "scheduled"
    },
    {
      "start": "2024-01-15T09:22:00Z",
      "end": "2024-01-15T10:06:00Z",
      "duration_minutes": 44,
      "reason": "Application deployment issue",
      "type": "unplanned"
    }
  ],
  "availability_by_service": [
    {
      "service": "backend_api",
      "uptime_percentage": 99.9
    },
    {
      "service": "customer_frontend",
      "uptime_percentage": 99.8
    },
    {
      "service": "business_frontend",
      "uptime_percentage": 99.9
    },
    {
      "service": "admin_frontend",
      "uptime_percentage": 99.7
    }
  ]
}
```

## Backup Monitoring

### Backup Schedule

- **Daily**: 02:00 Europe/Stockholm (30-day retention)
- **Weekly**: Sunday 03:00 Europe/Stockholm (6-month retention)
- **Monthly**: 1st day 04:00 Europe/Stockholm (2-year retention)

### Backup Status API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/backups"
```

**Response**:

```json
{
  "backup_health": "healthy",
  "last_backup": {
    "backup_id": "backup-20240115-020000",
    "type": "daily",
    "status": "completed",
    "size": "1.2GB",
    "duration_minutes": 12,
    "created_at": "2024-01-15T02:00:00Z",
    "checksum": "sha256:abc123...",
    "retention_expires": "2024-02-14T02:00:00Z"
  },
  "backup_schedule": {
    "next_daily": "2024-01-16T02:00:00Z",
    "next_weekly": "2024-01-21T03:00:00Z",
    "next_monthly": "2024-02-01T04:00:00Z"
  },
  "retention_compliance": {
    "daily_backups": {
      "count": 30,
      "oldest": "2024-12-16T02:00:00Z",
      "compliance": "healthy"
    },
    "weekly_backups": {
      "count": 24,
      "oldest": "2024-07-07T03:00:00Z",
      "compliance": "healthy"
    },
    "monthly_backups": {
      "count": 12,
      "oldest": "2023-01-01T04:00:00Z",
      "compliance": "healthy"
    }
  },
  "recent_failures": [],
  "storage_usage": {
    "total_size": "45.6GB",
    "monthly_growth": "2.1GB",
    "storage_limit": "100GB",
    "utilization": "45.6%"
  }
}
```

### Backup Verification

```bash
# Verify backup integrity
curl -X POST -H "Authorization: Bearer [admin-token]" \
     -d '{"backup_id":"backup-20240115-020000"}' \
     "https://api.vocilia.com/api/admin/monitoring/backup/verify"
```

## Alert Management

### Alert Severity Levels

- **Critical**: Immediate response required (service down)
- **Warning**: Investigation needed (performance degradation)
- **Info**: Awareness notification (maintenance scheduled)

### Alert Rules

#### Response Time Alerts

- **Critical**: P95 > 2000ms for 5 minutes
- **Warning**: P95 > 1500ms for 10 minutes

#### Error Rate Alerts

- **Critical**: Error rate > 5% for 2 minutes
- **Warning**: Error rate > 2% for 5 minutes

#### Uptime Alerts

- **Critical**: Service unavailable for > 1 minute
- **Warning**: Multiple 5xx errors detected

#### Backup Alerts

- **Critical**: Backup failed for 2 consecutive days
- **Warning**: Backup took >60 minutes to complete

### Active Alerts API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/alerts?status=active"
```

**Response**:

```json
{
  "active_alerts": [
    {
      "alert_id": "alert-20240115-103000",
      "severity": "warning",
      "type": "performance_degradation",
      "message": "API response time above warning threshold",
      "environment": "production",
      "service": "backend_api",
      "endpoint": "/api/stores/upload",
      "current_value": 1750,
      "threshold": 1500,
      "duration_minutes": 15,
      "created_at": "2024-01-15T10:15:00Z",
      "acknowledged": false,
      "assigned_to": null
    }
  ],
  "summary": {
    "critical": 0,
    "warning": 1,
    "info": 0,
    "total": 1
  },
  "recent_resolved": [
    {
      "alert_id": "alert-20240115-090000",
      "severity": "critical",
      "type": "service_unavailable",
      "resolved_at": "2024-01-15T09:45:00Z",
      "resolution_time_minutes": 45,
      "resolved_by": "admin-user-123"
    }
  ]
}
```

### Alert Acknowledgment

```bash
# Acknowledge alert
curl -X POST -H "Authorization: Bearer [admin-token]" \
     -d '{"alert_id":"alert-20240115-103000","acknowledged_by":"admin-user-123","notes":"Investigating database query performance"}' \
     "https://api.vocilia.com/api/admin/monitoring/alerts/acknowledge"
```

### Alert Resolution

```bash
# Resolve alert
curl -X POST -H "Authorization: Bearer [admin-token]" \
     -d '{"alert_id":"alert-20240115-103000","resolved_by":"admin-user-123","resolution_notes":"Optimized database query, performance restored"}' \
     "https://api.vocilia.com/api/admin/monitoring/alerts/resolve"
```

## SSL Certificate Monitoring

### Certificate Status API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/ssl-certificates"
```

**Response**:

```json
{
  "certificates": [
    {
      "domain": "api.vocilia.com",
      "status": "active",
      "issuer": "Let's Encrypt",
      "issued_at": "2024-01-01T00:00:00Z",
      "expires_at": "2024-04-01T00:00:00Z",
      "days_until_expiry": 76,
      "auto_renewal": true,
      "last_renewal_check": "2024-01-15T06:00:00Z",
      "certificate_health": "healthy"
    },
    {
      "domain": "customer.vocilia.com",
      "status": "expiring_soon",
      "issuer": "Let's Encrypt",
      "issued_at": "2023-12-01T00:00:00Z",
      "expires_at": "2024-01-30T00:00:00Z",
      "days_until_expiry": 15,
      "auto_renewal": true,
      "last_renewal_check": "2024-01-15T06:00:00Z",
      "certificate_health": "warning"
    }
  ],
  "summary": {
    "total_certificates": 4,
    "active": 3,
    "expiring_soon": 1,
    "expired": 0,
    "renewal_failures": 0
  },
  "alerts": [
    {
      "domain": "customer.vocilia.com",
      "issue": "Certificate expires in 15 days",
      "severity": "warning",
      "auto_renewal_scheduled": "2024-01-16T06:00:00Z"
    }
  ]
}
```

### Certificate Renewal

```bash
# Force certificate renewal
curl -X POST -H "Authorization: Bearer [admin-token]" \
     -d '{"domain":"customer.vocilia.com","reason":"Manual renewal requested"}' \
     "https://api.vocilia.com/api/admin/ssl/renew"
```

## Deployment Monitoring

### Deployment Status API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/deployment/status?include_history=true"
```

**Response**:

```json
{
  "current_deployments": [
    {
      "environment": "production",
      "services": [
        {
          "service": "backend",
          "platform": "railway",
          "deployment_id": "deploy-20240115-100000",
          "status": "success",
          "version": "1.2.5",
          "deployed_at": "2024-01-15T10:00:00Z",
          "commit_sha": "abc123def456",
          "health_status": "healthy"
        },
        {
          "service": "customer_frontend",
          "platform": "vercel",
          "deployment_id": "vercel-deploy-789",
          "status": "success",
          "version": "1.2.5",
          "deployed_at": "2024-01-15T10:05:00Z",
          "commit_sha": "abc123def456",
          "health_status": "healthy"
        }
      ]
    }
  ],
  "deployment_history": [
    {
      "deployment_id": "deploy-20240115-100000",
      "environment": "production",
      "status": "success",
      "started_at": "2024-01-15T09:55:00Z",
      "completed_at": "2024-01-15T10:00:00Z",
      "duration_minutes": 5,
      "rollback_available": true
    }
  ],
  "rollback_capability": {
    "available": true,
    "target_deployment": "deploy-20240114-150000",
    "estimated_rollback_time": "8 minutes"
  }
}
```

## Custom Dashboards

### Admin Monitoring Dashboard

Access: `https://admin.vocilia.com/admin/monitoring`

**Features**:

- Real-time system status overview
- Performance metrics visualization
- Alert management interface
- Backup status and history
- SSL certificate monitoring
- Deployment tracking

### Dashboard Widgets

#### System Overview Widget

- Current uptime percentage
- Active alerts count
- Average response time (last hour)
- Recent deployment status

#### Performance Chart Widget

- Response time trends (24 hours)
- Error rate trends
- Throughput metrics
- Resource utilization

#### Backup Status Widget

- Last backup status
- Backup schedule progress
- Storage utilization
- Retention compliance

#### SSL Certificate Widget

- Certificate expiry timeline
- Renewal status
- Certificate health scores
- Domain coverage

## Log Aggregation

### Log Sources

- **Railway**: Backend application logs
- **Vercel**: Frontend build and runtime logs
- **Supabase**: Database query logs
- **Admin Dashboard**: Audit and security logs

### Log Levels

- **ERROR**: Application errors requiring attention
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Detailed debug information

### Log Retention

- **Error logs**: 90 days
- **Warning logs**: 60 days
- **Info logs**: 30 days
- **Debug logs**: 7 days

### Log Search API

```bash
curl -H "Authorization: Bearer [admin-token]" \
     "https://api.vocilia.com/api/admin/monitoring/logs?level=error&since=1h"
```

## Monitoring Best Practices

### Alert Fatigue Prevention

1. **Intelligent Thresholds**: Adjust based on historical data
2. **Alert Grouping**: Combine related alerts
3. **Escalation Policies**: Progressive notification levels
4. **Regular Review**: Monthly alert effectiveness review

### Performance Optimization

1. **Continuous Monitoring**: Track all critical metrics
2. **Trend Analysis**: Identify performance patterns
3. **Proactive Scaling**: Scale before hitting limits
4. **Regular Optimization**: Monthly performance reviews

### Security Monitoring

1. **Failed Login Tracking**: Monitor authentication attempts
2. **Anomaly Detection**: Identify unusual access patterns
3. **Compliance Logging**: Maintain audit trails
4. **Regular Security Reviews**: Quarterly security assessments

## Troubleshooting Common Issues

### High Response Times

1. Check database query performance
2. Review recent deployments
3. Analyze traffic patterns
4. Check resource utilization

### Backup Failures

1. Verify storage availability
2. Check database connectivity
3. Review backup process logs
4. Validate retention policies

### SSL Certificate Issues

1. Check certificate expiry dates
2. Verify auto-renewal settings
3. Test certificate validation
4. Review DNS configuration

### Alert Management Issues

1. Review alert thresholds
2. Check notification delivery
3. Validate escalation policies
4. Update contact information

## Emergency Procedures

### System Down Scenario

1. **Immediate Response**: Check system status dashboard
2. **Impact Assessment**: Determine affected services
3. **Communication**: Update status page and notify stakeholders
4. **Investigation**: Review logs and metrics
5. **Resolution**: Implement fix or initiate rollback
6. **Post-Incident**: Conduct review and update procedures

### Performance Degradation

1. **Detection**: Automated alerts or manual observation
2. **Assessment**: Determine severity and impact
3. **Mitigation**: Scale resources or optimize performance
4. **Monitoring**: Track improvement metrics
5. **Root Cause**: Identify and address underlying issues

### Data Backup Emergency

1. **Verification**: Confirm backup integrity
2. **Recovery Planning**: Determine restore strategy
3. **Execution**: Restore from latest healthy backup
4. **Validation**: Verify data integrity post-restore
5. **Communication**: Update stakeholders on progress

## Contact Information

### On-Call Rotation

- **Primary**: DevOps Engineer (alerts@vocilia.com)
- **Secondary**: Backend Developer (backend@vocilia.com)
- **Escalation**: Technical Lead (tech-lead@vocilia.com)

### Emergency Contacts

- **Immediate Response**: +46-xxx-xxx-xxxx
- **Business Hours**: devops@vocilia.com
- **Status Updates**: status.vocilia.com

---

_Last Updated: 2024-01-15_  
_Version: 1.0.0_  
_Contact: devops@vocilia.com_
