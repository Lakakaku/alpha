# Deployment Guide - Vocilia Production Environment

## Overview

This guide covers the complete deployment process for the Vocilia customer
feedback reward system across Railway (backend), Vercel (frontends), and
Supabase (database). The system is designed for production from day one with
99.5% uptime targets and <2s response times.

## Architecture Overview

### Platform Distribution

- **Railway**: Backend API services (`apps/backend/`)
- **Vercel**: Three frontend applications
  - Customer App: `customer.vocilia.com`
  - Business App: `business.vocilia.com`
  - Admin App: `admin.vocilia.com`
- **Supabase**: PostgreSQL database with RLS policies

### Domain Configuration

- `api.vocilia.com` → Railway backend
- `customer.vocilia.com` → Vercel customer app
- `business.vocilia.com` → Vercel business app
- `admin.vocilia.com` → Vercel admin app

## Prerequisites

### Required Tools

```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI
npm install -g supabase
```

### Authentication Setup

```bash
# Railway authentication
railway login

# Vercel authentication
vercel login

# Supabase authentication
supabase login
```

### Environment Variables

Ensure the following environment variables are configured:

#### Backend (Railway)

```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NODE_ENV=production
PORT=3000
JWT_SECRET=[secure-jwt-secret]
OPENAI_API_KEY=[openai-key]
```

#### Frontend Applications (Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_API_URL=https://api.vocilia.com
NEXT_PUBLIC_APP_ENV=production
```

## Deployment Process

### Phase 1: Database Setup

1. **Apply Database Migrations**

   ```bash
   cd supabase
   supabase db push --project-ref [project-ref]
   ```

2. **Verify RLS Policies**

   ```bash
   supabase test db
   ```

3. **Seed Initial Data** (if required)
   ```bash
   supabase db seed
   ```

### Phase 2: Backend Deployment (Railway)

1. **Link Project to Railway**

   ```bash
   cd apps/backend
   railway link [project-id]
   ```

2. **Set Environment Variables**

   ```bash
   railway variables set DATABASE_URL="[production-database-url]"
   railway variables set SUPABASE_URL="[supabase-url]"
   railway variables set NODE_ENV="production"
   # ... additional variables
   ```

3. **Deploy Backend**

   ```bash
   railway deploy
   ```

4. **Configure Custom Domain**

   ```bash
   railway domain add api.vocilia.com
   ```

5. **Verify Deployment**
   ```bash
   curl https://api.vocilia.com/health
   # Expected: {"status":"healthy","timestamp":"...","uptime":...}
   ```

### Phase 3: Frontend Deployments (Vercel)

#### Customer Application

```bash
cd apps/customer
vercel --prod
vercel domains add customer.vocilia.com
```

#### Business Application

```bash
cd apps/business
vercel --prod
vercel domains add business.vocilia.com
```

#### Admin Application

```bash
cd apps/admin
vercel --prod
vercel domains add admin.vocilia.com
```

### Phase 4: SSL Certificate Configuration

SSL certificates are automatically managed by Railway and Vercel. Verify SSL
status:

```bash
# Check SSL certificate status
curl -I https://api.vocilia.com
curl -I https://customer.vocilia.com
curl -I https://business.vocilia.com
curl -I https://admin.vocilia.com
```

All responses should include valid SSL certificates with no warnings.

### Phase 5: DNS Configuration

Configure DNS records with your domain provider:

```dns
# A/CNAME records (replace with actual platform endpoints)
api.vocilia.com     CNAME  [railway-endpoint]
customer.vocilia.com CNAME  [vercel-endpoint]
business.vocilia.com CNAME  [vercel-endpoint]
admin.vocilia.com   CNAME  [vercel-endpoint]
```

## Health Checks and Monitoring

### Health Check Endpoints

The backend provides comprehensive health monitoring:

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system health
- `GET /health/database` - Database connectivity and performance
- `GET /health/jobs` - Background job scheduler status

### Expected Health Check Responses

#### Basic Health Check

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "version": "1.0.0"
}
```

#### Detailed Health Check

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "response_time": 45
    },
    {
      "name": "external_apis",
      "status": "healthy",
      "response_time": 120
    }
  ],
  "performance": {
    "avg_response_time": 850,
    "p95_response_time": 1650
  }
}
```

### Monitoring Dashboard

Access the admin monitoring dashboard at:
`https://admin.vocilia.com/admin/monitoring`

Features include:

- Real-time uptime tracking
- Performance metrics (response times, error rates)
- Backup status and history
- SSL certificate monitoring
- Deployment status tracking

## Backup and Recovery

### Backup Schedule

- **Daily**: Automated at 02:00 Europe/Stockholm
- **Weekly**: Sundays at 03:00 Europe/Stockholm
- **Monthly**: First day of month at 04:00 Europe/Stockholm

### Manual Backup

```bash
# Trigger manual backup via API
curl -X POST -H "Authorization: Bearer [admin-token]" \
     -H "Content-Type: application/json" \
     -d '{"type":"manual","reason":"Pre-deployment backup"}' \
     https://api.vocilia.com/api/admin/monitoring/backup
```

### Recovery Process

1. **List Available Backups**

   ```bash
   curl -H "Authorization: Bearer [admin-token]" \
        https://api.vocilia.com/api/admin/monitoring/backups
   ```

2. **Initiate Restore** (to staging first)
   ```bash
   curl -X POST -H "Authorization: Bearer [admin-token]" \
        -H "Content-Type: application/json" \
        -d '{"backup_id":"[backup-id]","target_environment":"staging"}' \
        https://api.vocilia.com/api/admin/monitoring/backup/restore
   ```

## Rollback Procedures

### 15-Minute Rollback Capability

The system supports rapid rollback to previous deployments within 15 minutes.

1. **Identify Target Deployment**

   ```bash
   curl -H "Authorization: Bearer [admin-token]" \
        https://api.vocilia.com/api/admin/deployment/status?include_history=true
   ```

2. **Initiate Rollback**

   ```bash
   curl -X POST -H "Authorization: Bearer [admin-token]" \
        -H "Content-Type: application/json" \
        -d '{"target_deployment_id":"[deployment-id]","environment":"production","reason":"Critical bug fix"}' \
        https://api.vocilia.com/api/admin/deployment/rollback
   ```

3. **Monitor Rollback Progress**
   ```bash
   curl -H "Authorization: Bearer [admin-token]" \
        https://api.vocilia.com/api/admin/deployment/rollback/[rollback-id]/status
   ```

### Emergency Procedures

#### Complete Service Rollback

If all services need rollback:

1. **Backend Rollback (Railway)**

   ```bash
   cd apps/backend
   railway rollback [previous-deployment-id]
   ```

2. **Frontend Rollback (Vercel)**

   ```bash
   cd apps/customer && vercel rollback [previous-deployment-url]
   cd apps/business && vercel rollback [previous-deployment-url]
   cd apps/admin && vercel rollback [previous-deployment-url]
   ```

3. **Database Rollback** (if necessary)
   ```bash
   # Restore from latest backup
   supabase db restore [backup-id]
   ```

## Performance Optimization

### Response Time Targets

- **API Endpoints**: <2s (95th percentile)
- **Frontend Pages**: <2s load time
- **Health Checks**: <500ms
- **Database Queries**: <100ms average

### Monitoring Performance

```bash
# Check current performance metrics
curl -H "Authorization: Bearer [admin-token]" \
     https://api.vocilia.com/api/admin/monitoring/performance?timeframe=1h
```

### Load Testing

Run performance tests before deployment:

```bash
# Run load tests
cd tests/performance
artillery run load-test-config.yml
```

## Security Considerations

### SSL/TLS Configuration

- All domains enforce HTTPS
- TLS 1.2+ required
- HSTS headers enabled
- Certificate auto-renewal enabled

### Environment Variable Security

- All secrets encrypted at rest
- No secrets in code or logs
- Regular secret rotation (quarterly)

### Database Security

- RLS policies enforced
- Connection pooling with SSL
- Backup encryption enabled
- Admin access logging

## Troubleshooting

### Common Issues

#### 1. Health Check Failures

```bash
# Check backend logs
railway logs --tail

# Check database connectivity
curl https://api.vocilia.com/health/database
```

#### 2. Frontend Build Failures

```bash
# Check Vercel deployment logs
vercel logs [deployment-url]

# Rebuild with verbose output
vercel --force --debug
```

#### 3. SSL Certificate Issues

```bash
# Check certificate status
curl -I https://[domain]

# Force certificate renewal
curl -X POST -H "Authorization: Bearer [admin-token]" \
     https://api.vocilia.com/api/admin/ssl/renew/[certificate-id]
```

#### 4. Database Connection Issues

```bash
# Test database connection
supabase test db

# Check connection pool status
curl -H "Authorization: Bearer [admin-token]" \
     https://api.vocilia.com/health/database
```

### Performance Issues

#### High Response Times

1. Check monitoring dashboard for bottlenecks
2. Review database query performance
3. Verify CDN cache hit rates
4. Scale infrastructure if needed

#### Memory/CPU Issues

1. Monitor resource usage in Railway dashboard
2. Check for memory leaks in application logs
3. Scale vertically or horizontally as needed

### Emergency Contacts

- **DevOps Team**: devops@vocilia.com
- **Emergency Escalation**: +46-xxx-xxx-xxxx
- **Status Page**: status.vocilia.com

## Maintenance Windows

### Scheduled Maintenance

- **Weekly**: Sunday 02:00-04:00 Europe/Stockholm
- **Monthly**: First Sunday 01:00-05:00 Europe/Stockholm

### Maintenance Procedures

1. Announce maintenance window 48 hours in advance
2. Deploy to staging environment first
3. Run full test suite
4. Deploy to production during maintenance window
5. Monitor for 2 hours post-deployment

## Monitoring and Alerting

### SLA Targets

- **Uptime**: 99.5% monthly
- **Response Time**: P95 < 2000ms
- **Error Rate**: <1%
- **Recovery Time**: <15 minutes for rollbacks

### Alert Thresholds

- **Critical**: Response time >2000ms for 5 minutes
- **Warning**: Response time >1500ms for 10 minutes
- **Critical**: Error rate >5% for 2 minutes
- **Warning**: Uptime <99.8% for current month

### Monitoring Tools

- **Railway**: Built-in monitoring and logging
- **Vercel**: Analytics and Real User Monitoring
- **Supabase**: Database monitoring and query analysis
- **Admin Dashboard**: Custom monitoring interface

## Best Practices

### Deployment Best Practices

1. Always deploy to staging first
2. Run automated tests before production deployment
3. Monitor for 30 minutes post-deployment
4. Keep previous deployment ready for quick rollback
5. Document all changes and deployment notes

### Security Best Practices

1. Regular security audits (quarterly)
2. Update dependencies monthly
3. Rotate secrets quarterly
4. Monitor for suspicious activity
5. Maintain audit logs for compliance

### Performance Best Practices

1. Monitor response times continuously
2. Optimize database queries regularly
3. Use CDN for static assets
4. Implement proper caching strategies
5. Load test before major releases

---

_Last Updated: 2024-01-15_  
_Version: 1.0.0_  
_Contact: devops@vocilia.com_
