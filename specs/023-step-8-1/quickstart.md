# Quickstart: Production Deployment Validation

## Overview
This quickstart guide validates the production deployment of the Vocilia system across Railway (backend), Vercel (frontends), and custom domains. Each scenario tests critical deployment functionality against the 99.5% uptime and <2s performance requirements.

## Prerequisites
- Railway CLI installed and authenticated
- Vercel CLI installed and authenticated
- Access to Supabase production database
- Admin authentication credentials
- Domain management access

## Test Scenarios

### Scenario 1: Backend Deployment Health (Railway)
**Objective**: Validate backend API deployment and health checks

**Steps**:
1. **Deploy backend to staging**:
   ```bash
   cd apps/backend
   railway login
   railway link
   railway deploy --environment staging
   ```

2. **Verify health endpoints**:
   ```bash
   curl -H "Accept: application/json" https://staging-api.vocilia.com/health
   # Expected: {"status":"healthy","timestamp":"...","uptime":...}

   curl -H "Accept: application/json" https://staging-api.vocilia.com/health/detailed
   # Expected: {"status":"healthy","checks":[...],"performance":{...}}
   ```

3. **Test database connectivity**:
   ```bash
   curl -H "Accept: application/json" https://staging-api.vocilia.com/health/database
   # Expected: {"status":"healthy","connection_pool":{...},"last_backup":"..."}
   ```

4. **Validate background jobs**:
   ```bash
   curl -H "Accept: application/json" https://staging-api.vocilia.com/health/jobs
   # Expected: {"status":"healthy","scheduler_running":true,...}
   ```

**Success Criteria**:
- All health checks return 200 status
- Response times <500ms for health endpoints
- Database connection pool utilization <80%
- Background job scheduler running

### Scenario 2: Frontend Deployment Validation (Vercel)
**Objective**: Validate all three frontend applications deploy correctly

**Steps**:
1. **Deploy customer app**:
   ```bash
   cd apps/customer
   vercel --prod
   # Expected: Deployment successful with preview URL
   ```

2. **Deploy business app**:
   ```bash
   cd apps/business
   vercel --prod
   # Expected: Deployment successful with preview URL
   ```

3. **Deploy admin app**:
   ```bash
   cd apps/admin
   vercel --prod
   # Expected: Deployment successful with preview URL
   ```

4. **Verify build performance**:
   ```bash
   # Check build times in Vercel dashboard
   # Expected: <3 minutes per app
   ```

**Success Criteria**:
- All three apps deploy without errors
- Build times under 3 minutes each
- Preview URLs accessible and responsive
- Environment variables properly injected

### Scenario 3: Custom Domain and SSL Configuration
**Objective**: Validate domain setup and SSL certificate functionality

**Steps**:
1. **Configure production domains**:
   ```bash
   # Railway domain setup
   railway domain add api.vocilia.com --environment production

   # Vercel domain setup
   vercel domains add customer.vocilia.com
   vercel domains add business.vocilia.com
   vercel domains add admin.vocilia.com
   ```

2. **Verify SSL certificates**:
   ```bash
   # Check SSL status for all domains
   curl -I https://api.vocilia.com
   curl -I https://customer.vocilia.com
   curl -I https://business.vocilia.com
   curl -I https://admin.vocilia.com
   # Expected: All return valid SSL certificates
   ```

3. **Test domain accessibility**:
   ```bash
   # Test each domain responds correctly
   curl -o /dev/null -s -w "%{http_code}\n" https://api.vocilia.com/health
   curl -o /dev/null -s -w "%{http_code}\n" https://customer.vocilia.com
   curl -o /dev/null -s -w "%{http_code}\n" https://business.vocilia.com
   curl -o /dev/null -s -w "%{http_code}\n" https://admin.vocilia.com
   # Expected: All return 200 status codes
   ```

**Success Criteria**:
- All domains resolve correctly
- SSL certificates valid and trusted
- HTTPS redirects working
- No certificate warnings in browsers

### Scenario 4: Performance and Load Testing
**Objective**: Validate system meets <2s response time requirements under load

**Steps**:
1. **Baseline performance test**:
   ```bash
   # Test API response times
   curl -w "@curl-format.txt" -o /dev/null -s https://api.vocilia.com/health/detailed
   # Expected: Total time <2000ms
   ```

2. **Frontend page load test**:
   ```bash
   # Test customer app page load
   lighthouse https://customer.vocilia.com --only-categories=performance --chrome-flags="--headless"
   # Expected: Performance score >90, FCP <1.5s
   ```

3. **Concurrent user simulation**:
   ```bash
   # Load test with 100 concurrent users for 5 minutes
   artillery run load-test-config.yml
   # Expected: 95th percentile response time <2000ms
   ```

4. **Database performance check**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/performance?timeframe=1h
   # Expected: Average response time <1000ms, P95 <2000ms
   ```

**Success Criteria**:
- API endpoints respond in <2s under normal load
- Frontend pages load in <2s on 3G connection
- System handles 500 concurrent users
- Database queries average <100ms

### Scenario 5: Backup and Recovery Validation
**Objective**: Validate backup system and recovery procedures

**Steps**:
1. **Check backup status**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/backups
   # Expected: Daily backups completed, retention policy active
   ```

2. **Verify backup integrity**:
   ```bash
   # Check latest backup checksum
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/backups | jq '.last_backup.checksum'
   # Expected: Valid checksum returned
   ```

3. **Test restore to staging** (non-destructive):
   ```bash
   # Initiate restore to staging environment
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"backup_id":"latest","target_environment":"staging","reason":"validation test"}' \
        https://api.vocilia.com/api/admin/monitoring/backup/restore
   # Expected: Restore initiated successfully
   ```

**Success Criteria**:
- Daily backups running on schedule
- Backup retention policy enforced (30 days)
- Restore process completes successfully
- Data integrity maintained after restore

### Scenario 6: Monitoring and Alerting Validation
**Objective**: Validate monitoring system and alert mechanisms

**Steps**:
1. **Check uptime metrics**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/uptime?period=day
   # Expected: Uptime >99.5%, SLA status "meeting"
   ```

2. **Verify alert system**:
   ```bash
   # Check active alerts
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/alerts
   # Expected: No critical alerts, system healthy
   ```

3. **Test alert triggers** (controlled):
   ```bash
   # Temporarily stop a service to trigger alert
   railway service stop --environment staging
   # Wait 2 minutes, then check alerts
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
        https://api.vocilia.com/api/admin/monitoring/alerts?severity=critical
   # Expected: Alert generated for service outage

   # Restore service
   railway service start --environment staging
   ```

**Success Criteria**:
- Uptime monitoring shows >99.5%
- Alerts trigger within 2 minutes of issues
- Alert resolution tracked properly
- No false positive alerts

### Scenario 7: Rollback Capability Testing
**Objective**: Validate 15-minute rollback capability

**Steps**:
1. **Prepare rollback test**:
   ```bash
   # Note current deployment ID
   CURRENT_DEPLOYMENT=$(curl -H "Authorization: Bearer $ADMIN_TOKEN" \
                          https://api.vocilia.com/api/admin/deployment/status | \
                          jq -r '.environments[0].apps[0].deployment_id')
   ```

2. **Deploy test version**:
   ```bash
   # Deploy a marked test version to staging
   cd apps/backend
   git checkout test-deployment-branch
   railway deploy --environment staging
   ```

3. **Initiate rollback**:
   ```bash
   # Start timer and initiate rollback
   START_TIME=$(date +%s)
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"target_deployment_id\":\"$CURRENT_DEPLOYMENT\",\"environment\":\"staging\",\"app\":\"backend\",\"reason\":\"rollback test\"}" \
        https://api.vocilia.com/api/admin/deployment/rollback
   ```

4. **Monitor rollback progress**:
   ```bash
   # Check rollback status every minute
   ROLLBACK_ID=$(curl -X POST ... | jq -r '.rollback_id')
   while true; do
     STATUS=$(curl -H "Authorization: Bearer $ADMIN_TOKEN" \
                  https://api.vocilia.com/api/admin/deployment/rollback/$ROLLBACK_ID/status | \
                  jq -r '.status')
     if [ "$STATUS" = "completed" ]; then
       END_TIME=$(date +%s)
       DURATION=$((END_TIME - START_TIME))
       echo "Rollback completed in $DURATION seconds"
       break
     fi
     sleep 30
   done
   ```

**Success Criteria**:
- Rollback completes within 15 minutes (900 seconds)
- Service remains available during rollback
- Previous version restored successfully
- No data loss during rollback process

## Validation Checklist

### Pre-Production Deployment
- [ ] All contract tests passing
- [ ] SSL certificates configured for all domains
- [ ] Environment variables set in both Railway and Vercel
- [ ] Database connection pooling configured
- [ ] Backup schedule activated
- [ ] Monitoring alerts configured

### Post-Deployment Validation
- [ ] All health checks returning healthy status
- [ ] Response times <2s for all endpoints
- [ ] SSL certificates valid and trusted
- [ ] Backup system creating daily backups
- [ ] Monitoring showing >99.5% uptime
- [ ] Rollback capability tested and working

### Performance Benchmarks
- [ ] API response time P95 <2000ms
- [ ] Frontend page load <2s on 3G
- [ ] Database queries average <100ms
- [ ] System handles 500 concurrent users
- [ ] CDN cache hit rate >80%

### Security Validation
- [ ] All domains enforce HTTPS
- [ ] Security headers properly configured
- [ ] Environment variables encrypted
- [ ] Database connections use SSL
- [ ] Admin API requires authentication

## Emergency Procedures

### Rollback Instructions
1. Identify target deployment: `GET /api/admin/deployment/history`
2. Initiate rollback: `POST /api/admin/deployment/rollback`
3. Monitor progress: `GET /api/admin/deployment/rollback/{id}/status`
4. Validate post-rollback: Run health check scenarios

### Backup Recovery
1. List available backups: `GET /api/admin/monitoring/backups`
2. Initiate restore: `POST /api/admin/monitoring/backup/restore`
3. Monitor restore progress via logs
4. Validate data integrity after restore

### Contact Information
- DevOps Team: devops@vocilia.com
- Emergency Escalation: +46-xxx-xxx-xxxx
- Status Page: status.vocilia.com