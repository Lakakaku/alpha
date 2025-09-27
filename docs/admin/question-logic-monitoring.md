# Question Logic Monitoring Guide

## Overview

This guide provides comprehensive monitoring and administration procedures for
the Advanced Question Logic system in Vocilia Alpha. It covers system health
monitoring, performance optimization, troubleshooting, and maintenance tasks for
administrators.

## System Architecture Monitoring

### Core Components to Monitor

1. **Question Combination Engine**: Main logic for question selection and
   optimization
2. **Dynamic Trigger System**: Real-time trigger evaluation and activation
3. **Caching Layer**: Redis-based performance optimization
4. **Background Services**: Rule compilation and cache management
5. **Database Operations**: PostgreSQL performance and query optimization

### Key Performance Indicators (KPIs)

| Metric                   | Target           | Critical Threshold | Monitoring Frequency |
| ------------------------ | ---------------- | ------------------ | -------------------- |
| Question Evaluation Time | <500ms           | >1000ms            | Real-time            |
| Cache Hit Rate           | >90%             | <80%               | Every 5 minutes      |
| Trigger Processing Rate  | >100/sec         | <50/sec            | Real-time            |
| Database Query Time      | <50ms (indexed)  | >200ms             | Real-time            |
| Memory Usage             | <2GB per service | >4GB               | Every minute         |
| CPU Usage                | <70%             | >90%               | Every minute         |

## Dashboard Configuration

### Main Monitoring Dashboard

Access: Admin Portal > System Monitoring > Question Logic

#### Real-Time Metrics Panel

```
┌─ Question Evaluation Performance ─────────────────┐
│ Avg Response Time: 45ms        P95: 120ms        │
│ Current Load: 25 req/sec       Peak: 180 req/sec  │
│ Cache Hit Rate: 92%            Miss Rate: 8%      │
│ Active Businesses: 850         Active Triggers: 12.5k │
└─────────────────────────────────────────────────────┘

┌─ System Health ──────────────────────────────────────┐
│ 🟢 Question Engine    🟢 Trigger System    🟢 Cache  │
│ 🟢 Database          🟢 Background Jobs   🟢 API    │
└─────────────────────────────────────────────────────┘
```

#### Performance Trends (24h)

- Request volume over time
- Response time percentiles
- Cache performance metrics
- Error rates by component

### Business-Level Monitoring

#### Top Businesses by Activity

- Request volume ranking
- Response time by business
- Cache efficiency per business
- Trigger activation rates

#### Problem Businesses Identification

- Businesses with >1s average response time
- Low cache hit rate businesses (<80%)
- High error rate businesses (>1%)
- Unusual trigger activation patterns

## Performance Monitoring

### Real-Time Performance Queries

#### Question Evaluation Performance

```sql
-- Monitor current evaluation performance
SELECT
    business_context_id,
    COUNT(*) as evaluations_last_hour,
    AVG(processing_time_ms) as avg_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_time,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as cache_hit_rate
FROM trigger_activation_logs
WHERE activation_timestamp > NOW() - INTERVAL '1 hour'
GROUP BY business_context_id
ORDER BY avg_time DESC;
```

#### Trigger Activation Analysis

```sql
-- Identify problematic triggers
SELECT
    dt.trigger_name,
    dt.business_context_id,
    COUNT(tal.*) as activations_24h,
    AVG(EXTRACT(EPOCH FROM (tal.activation_timestamp - cv.created_at)) * 1000) as avg_processing_ms,
    SUM(CASE WHEN tal.was_asked THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
FROM dynamic_triggers dt
LEFT JOIN trigger_activation_logs tal ON dt.id = tal.trigger_id
    AND tal.activation_timestamp > NOW() - INTERVAL '24 hours'
LEFT JOIN customer_verifications cv ON tal.verification_id = cv.id
WHERE dt.is_active = true
GROUP BY dt.id, dt.trigger_name, dt.business_context_id
HAVING COUNT(tal.*) > 10
ORDER BY avg_processing_ms DESC;
```

### Cache Performance Monitoring

#### Redis Cache Metrics

```bash
# Connect to Redis monitoring
redis-cli info stats | grep -E "(keyspace_hits|keyspace_misses|used_memory|connected_clients)"

# Monitor specific cache keys
redis-cli --latency -h redis-host -p 6379

# Cache hit rate calculation
redis-cli eval "
local hits = redis.call('get', 'question_cache:hits') or 0
local misses = redis.call('get', 'question_cache:misses') or 0
local total = hits + misses
if total > 0 then
    return (hits / total) * 100
else
    return 0
end" 0
```

#### Cache Key Analysis

Monitor these cache key patterns:

- `trigger_cache:business:{id}`: Trigger evaluation cache
- `combination_cache:business:{id}`: Question combination cache
- `rules_compiled:{business_id}`: Compiled rule cache
- `optimization_cache:context:{id}`: Time constraint optimization

### Database Performance

#### Query Performance Monitoring

```sql
-- Identify slow queries
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%trigger%' OR query ILIKE '%question%'
ORDER BY mean_exec_time DESC;

-- Index usage analysis
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN ('dynamic_triggers', 'trigger_activation_logs', 'question_combination_rules')
ORDER BY idx_scan DESC;
```

#### Connection Pool Monitoring

```sql
-- Monitor connection usage
SELECT
    datname,
    numbackends,
    xact_commit,
    xact_rollback,
    blks_read,
    blks_hit,
    temp_files,
    temp_bytes
FROM pg_stat_database
WHERE datname = 'vocilia_alpha';
```

## Alerting Configuration

### Critical Alerts (Immediate Response Required)

#### Performance Degradation

- **Condition**: Average evaluation time >1000ms for 5 minutes
- **Action**: Page on-call engineer
- **Escalation**: If not resolved in 15 minutes, escalate to senior engineer

#### Cache Failure

- **Condition**: Cache hit rate <80% for 10 minutes
- **Action**: Alert DevOps team
- **Auto-remediation**: Restart Redis cluster if hit rate <50%

#### Database Issues

- **Condition**: Query time >200ms for indexed queries
- **Action**: Alert database admin
- **Check**: Connection pool exhaustion, lock contention

### Warning Alerts (Next Business Day Response)

#### Capacity Planning

- **Condition**: Request volume >80% of capacity for 1 hour
- **Action**: Email infrastructure team
- **Follow-up**: Review scaling requirements

#### Business-Specific Issues

- **Condition**: Individual business >2s average response time
- **Action**: Create support ticket
- **Investigation**: Review trigger configuration complexity

### Configuration Alerts

#### Invalid Configurations

- **Condition**: Trigger compilation failures
- **Action**: Email business support team
- **Resolution**: Contact business to fix configuration

#### Performance Warnings

- **Condition**: Business with >50 active triggers
- **Action**: Email account manager
- **Recommendation**: Suggest trigger optimization

## Troubleshooting Guide

### High Response Times (>500ms)

#### Immediate Checks

1. **Cache Status**: Verify Redis is responding
2. **Database Load**: Check for lock contention
3. **Trigger Complexity**: Identify businesses with complex triggers
4. **Background Jobs**: Ensure rule compilation is running

#### Investigation Steps

```bash
# Check cache connectivity
redis-cli -h redis-host ping

# Monitor real-time performance
curl -X GET "https://api.vocilia.com/v1/admin/monitoring/performance?timeframe=hour"

# Check background job status
curl -X GET "https://api.vocilia.com/v1/admin/monitoring/background-jobs"
```

#### Resolution Actions

1. **Scale Redis**: Add Redis replicas if cache miss rate >20%
2. **Database Optimization**: Add indexes for slow queries
3. **Trigger Simplification**: Contact businesses with >20 triggers
4. **Load Balancing**: Scale application instances if CPU >80%

### Cache Hit Rate Issues (<90%)

#### Root Cause Analysis

1. **Cache Expiration**: Check TTL settings
2. **Key Distribution**: Verify even key distribution
3. **Memory Pressure**: Monitor Redis memory usage
4. **Business Growth**: New businesses invalidating cache

#### Optimization Steps

```bash
# Analyze cache key patterns
redis-cli --scan --pattern "trigger_cache:*" | head -20

# Check memory usage by key type
redis-cli --bigkeys

# Monitor cache operations
redis-cli monitor | grep -E "(SET|GET|DEL)"
```

### Database Performance Issues

#### Query Optimization

```sql
-- Find missing indexes
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND tablename IN ('dynamic_triggers', 'trigger_conditions')
ORDER BY n_distinct DESC;

-- Analyze query plans
EXPLAIN (ANALYZE, BUFFERS)
SELECT dt.*, tc.condition_key
FROM dynamic_triggers dt
LEFT JOIN trigger_conditions tc ON dt.id = tc.trigger_id
WHERE dt.business_context_id = 'test-id' AND dt.is_active = true;
```

#### Index Recommendations

```sql
-- Create composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_triggers_business_active_priority
ON dynamic_triggers(business_context_id, is_active, priority_level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activation_logs_timestamp_business
ON trigger_activation_logs(activation_timestamp, business_context_id)
WHERE activation_timestamp > NOW() - INTERVAL '30 days';
```

## Maintenance Procedures

### Daily Maintenance Tasks

#### System Health Check (Automated)

```bash
#!/bin/bash
# Daily health check script

echo "=== Question Logic Health Check ==="
echo "Date: $(date)"

# Check API health
api_health=$(curl -s "https://api.vocilia.com/v1/health/question-logic" | jq -r '.status')
echo "API Health: $api_health"

# Check cache performance
cache_hit_rate=$(redis-cli eval "return redis.call('get', 'stats:cache_hit_rate')" 0)
echo "Cache Hit Rate: $cache_hit_rate%"

# Check database connections
db_connections=$(psql -h db-host -c "SELECT count(*) FROM pg_stat_activity;" -t)
echo "Database Connections: $db_connections"

# Check recent errors
error_count=$(curl -s "https://api.vocilia.com/v1/admin/monitoring/errors?timeframe=24h" | jq '.total_errors')
echo "24h Error Count: $error_count"

echo "=== End Health Check ==="
```

#### Performance Report Generation

```sql
-- Generate daily performance summary
SELECT
    DATE(activation_timestamp) as date,
    COUNT(*) as total_evaluations,
    AVG(processing_time_ms) as avg_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_response_time,
    COUNT(DISTINCT business_context_id) as active_businesses,
    SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as cache_hit_rate
FROM trigger_activation_logs
WHERE activation_timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(activation_timestamp)
ORDER BY date DESC;
```

### Weekly Maintenance Tasks

#### Cache Optimization Review

1. **Analyze Cache Patterns**: Identify frequently missed cache keys
2. **Update TTL Settings**: Adjust cache expiration based on usage patterns
3. **Clean Stale Keys**: Remove unused cache entries

```bash
# Weekly cache cleanup script
redis-cli eval "
local keys = redis.call('keys', 'trigger_cache:*')
local expired = 0
for i=1,#keys do
    local ttl = redis.call('ttl', keys[i])
    if ttl == -1 then  -- No expiration set
        redis.call('expire', keys[i], 3600)  -- Set 1 hour expiration
        expired = expired + 1
    end
end
return expired
" 0
```

#### Database Maintenance

```sql
-- Weekly statistics update
ANALYZE dynamic_triggers;
ANALYZE trigger_activation_logs;
ANALYZE question_combination_rules;

-- Clean old activation logs (>90 days)
DELETE FROM trigger_activation_logs
WHERE activation_timestamp < NOW() - INTERVAL '90 days';

-- Update table statistics
VACUUM ANALYZE trigger_activation_logs;
```

### Monthly Maintenance Tasks

#### Performance Trend Analysis

1. **Monthly Performance Report**: Generate comprehensive performance trends
2. **Capacity Planning**: Analyze growth trends and plan scaling
3. **Business Configuration Review**: Identify optimization opportunities

#### System Optimization

```sql
-- Monthly optimization report
WITH monthly_stats AS (
    SELECT
        DATE_TRUNC('month', activation_timestamp) as month,
        business_context_id,
        COUNT(*) as evaluations,
        AVG(processing_time_ms) as avg_time,
        COUNT(DISTINCT DATE(activation_timestamp)) as active_days
    FROM trigger_activation_logs
    WHERE activation_timestamp >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY month, business_context_id
)
SELECT
    month,
    COUNT(DISTINCT business_context_id) as active_businesses,
    SUM(evaluations) as total_evaluations,
    AVG(avg_time) as system_avg_time,
    MAX(avg_time) as max_business_time
FROM monthly_stats
GROUP BY month
ORDER BY month DESC;
```

## Business Configuration Management

### Configuration Validation

#### Automated Configuration Checks

```sql
-- Find businesses with potentially problematic configurations
SELECT
    bc.id as business_context_id,
    bc.business_name,
    COUNT(dt.*) as trigger_count,
    AVG(dt.sensitivity_threshold) as avg_sensitivity,
    COUNT(CASE WHEN dt.priority_level >= 4 THEN 1 END) as high_priority_triggers
FROM business_contexts bc
LEFT JOIN dynamic_triggers dt ON bc.id = dt.business_context_id AND dt.is_active = true
GROUP BY bc.id, bc.business_name
HAVING COUNT(dt.*) > 30 OR AVG(dt.sensitivity_threshold) < 5
ORDER BY trigger_count DESC;
```

#### Configuration Recommendations

1. **Trigger Limit**: Recommend maximum 20 active triggers per business
2. **Sensitivity Balance**: Suggest sensitivity between 5-20 for most triggers
3. **Priority Distribution**: Ensure <20% of triggers are high/critical priority

### Business Performance Analysis

#### Business-Specific Monitoring

```sql
-- Business performance dashboard query
SELECT
    bc.business_name,
    COUNT(tal.*) as evaluations_30d,
    AVG(tal.processing_time_ms) as avg_response_time,
    COUNT(DISTINCT tal.trigger_id) as unique_triggers_used,
    SUM(CASE WHEN tal.was_asked THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
FROM business_contexts bc
LEFT JOIN trigger_activation_logs tal ON bc.id = tal.business_context_id
    AND tal.activation_timestamp > NOW() - INTERVAL '30 days'
WHERE bc.is_active = true
GROUP BY bc.id, bc.business_name
HAVING COUNT(tal.*) > 0
ORDER BY avg_response_time DESC;
```

## Security Monitoring

### Access Control Monitoring

#### Admin Access Audit

```sql
-- Monitor admin access to question logic system
SELECT
    aa.username,
    al.action,
    al.resource_type,
    al.resource_id,
    COUNT(*) as action_count,
    MAX(al.timestamp) as last_action
FROM audit_logs al
JOIN admin_accounts aa ON al.admin_id = aa.id
WHERE al.resource_type IN ('question_logic', 'dynamic_trigger', 'combination_rule')
    AND al.timestamp > NOW() - INTERVAL '7 days'
GROUP BY aa.username, al.action, al.resource_type, al.resource_id
ORDER BY last_action DESC;
```

#### Data Access Patterns

```sql
-- Monitor unusual data access patterns
SELECT
    business_context_id,
    DATE(activation_timestamp) as access_date,
    COUNT(*) as evaluations,
    COUNT(DISTINCT customer_verification_id) as unique_customers,
    AVG(processing_time_ms) as avg_processing_time
FROM trigger_activation_logs
WHERE activation_timestamp > NOW() - INTERVAL '7 days'
GROUP BY business_context_id, DATE(activation_timestamp)
HAVING COUNT(*) > (
    SELECT AVG(daily_count) * 3
    FROM (
        SELECT COUNT(*) as daily_count
        FROM trigger_activation_logs
        WHERE activation_timestamp > NOW() - INTERVAL '30 days'
        GROUP BY business_context_id, DATE(activation_timestamp)
    ) daily_stats
)
ORDER BY evaluations DESC;
```

## Disaster Recovery

### Backup Procedures

#### Configuration Backup

```bash
#!/bin/bash
# Backup question logic configurations

backup_date=$(date +%Y%m%d_%H%M%S)
backup_dir="/backups/question-logic/$backup_date"
mkdir -p "$backup_dir"

# Backup database configurations
pg_dump -h db-host -t dynamic_triggers -t trigger_conditions -t question_combination_rules \
    -t frequency_harmonizers -t priority_weights vocilia_alpha > "$backup_dir/configurations.sql"

# Backup Redis cache keys (for structure reference)
redis-cli --rdb "$backup_dir/cache_snapshot.rdb"

# Create backup manifest
echo "Question Logic Backup - $backup_date" > "$backup_dir/manifest.txt"
echo "Database: configurations.sql" >> "$backup_dir/manifest.txt"
echo "Cache: cache_snapshot.rdb" >> "$backup_dir/manifest.txt"
```

#### Cache Warm-up Procedure

```bash
#!/bin/bash
# Cache warm-up after disaster recovery

echo "Starting cache warm-up process..."

# Pre-load active business triggers
curl -X POST "https://api.vocilia.com/v1/admin/cache/warmup" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"type": "triggers", "scope": "active_businesses"}'

# Pre-load combination rules
curl -X POST "https://api.vocilia.com/v1/admin/cache/warmup" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"type": "combinations", "scope": "all_rules"}'

echo "Cache warm-up completed"
```

### Recovery Testing

#### Monthly Recovery Drill

1. **Backup Validation**: Restore configurations to staging environment
2. **Performance Test**: Run load tests on restored system
3. **Cache Rebuild**: Verify cache warm-up procedures
4. **Monitoring Verification**: Confirm all monitoring works post-recovery

## Contact Information

### Escalation Contacts

**Level 1 - System Issues**

- On-call Engineer: +46-xxx-xxx-xxxx
- Slack: #question-logic-alerts
- Email: oncall-engineering@vocilia.com

**Level 2 - Database Issues**

- Database Admin: +46-xxx-xxx-xxxx
- Slack: #database-alerts
- Email: dba@vocilia.com

**Level 3 - Business Impact**

- Engineering Manager: +46-xxx-xxx-xxxx
- Slack: #engineering-management
- Email: eng-manager@vocilia.com

### External Vendors

**Redis Cloud Support**

- Support Portal: https://support.redis.com
- Phone: +1-xxx-xxx-xxxx
- SLA: 4-hour response for P1 issues

**Supabase Support**

- Support Portal: https://supabase.com/support
- Email: support@supabase.com
- SLA: 8-hour response for production issues

This monitoring guide should be reviewed and updated quarterly to ensure it
remains current with system changes and operational requirements.
