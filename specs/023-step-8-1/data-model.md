# Data Model: Production Deployment

## Deployment Configuration Entities

### Environment Configuration
**Purpose**: Stores environment-specific deployment settings for each platform and environment.

**Attributes**:
- `environment_id`: String (primary key) - Unique identifier (e.g., "prod-backend", "staging-customer")
- `platform`: Enum - Railway, Vercel, Supabase
- `app_name`: String - Application identifier (backend, customer, business, admin)
- `environment_type`: Enum - production, staging, development
- `config_data`: JSON - Platform-specific configuration
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `is_active`: Boolean

**Relationships**:
- One-to-many with Environment Variables
- One-to-many with SSL Certificates

### Environment Variables
**Purpose**: Manages secure storage and versioning of environment variables across platforms.

**Attributes**:
- `variable_id`: String (primary key)
- `environment_id`: String (foreign key)
- `key_name`: String - Variable name
- `value_encrypted`: String - Encrypted variable value
- `is_secret`: Boolean - Whether value should be masked in logs
- `platform_synced`: Boolean - Whether synced to deployment platform
- `created_at`: Timestamp
- `updated_at`: Timestamp

**Validation Rules**:
- Key names must follow platform naming conventions
- Secret values must be encrypted at rest
- Required variables per environment type must be present

### SSL Certificate Management
**Purpose**: Tracks SSL certificate status and renewal schedules for custom domains.

**Attributes**:
- `certificate_id`: String (primary key)
- `domain`: String - Domain name (e.g., "api.vocilia.com")
- `platform`: Enum - Railway, Vercel
- `certificate_authority`: String - Let's Encrypt, Custom
- `status`: Enum - active, pending, expired, failed
- `issued_at`: Timestamp
- `expires_at`: Timestamp
- `auto_renewal`: Boolean
- `last_renewal_attempt`: Timestamp
- `certificate_hash`: String - For verification

**Relationships**:
- Belongs to Environment Configuration

### Deployment Status
**Purpose**: Tracks deployment history and current status for rollback capabilities.

**Attributes**:
- `deployment_id`: String (primary key)
- `environment_id`: String (foreign key)
- `commit_sha`: String - Git commit hash
- `branch`: String - Git branch name
- `status`: Enum - pending, building, deploying, success, failed, rolled_back
- `platform_deployment_id`: String - Platform-specific deployment ID
- `started_at`: Timestamp
- `completed_at`: Timestamp
- `rollback_target`: Boolean - Whether this deployment can be used for rollback
- `artifacts_url`: String - Link to deployment artifacts
- `logs_url`: String - Link to deployment logs

**State Transitions**:
- pending → building → deploying → success/failed
- success → rolled_back (manual intervention)

### Monitoring Data
**Purpose**: Stores health check results and performance metrics for uptime tracking.

**Attributes**:
- `metric_id`: String (primary key)
- `environment_id`: String (foreign key)
- `metric_type`: Enum - health_check, performance, error_rate, uptime
- `metric_value`: Float - Measured value
- `unit`: String - Metric unit (ms, %, count)
- `threshold_warning`: Float
- `threshold_critical`: Float
- `status`: Enum - healthy, warning, critical
- `timestamp`: Timestamp
- `source`: String - Monitoring service identifier

**Aggregation Rules**:
- Health checks: Latest status per endpoint
- Performance: 5-minute rolling averages
- Uptime: Monthly percentage calculations
- Error rates: Hourly aggregations

### Backup Records
**Purpose**: Tracks database backup status and retention schedules.

**Attributes**:
- `backup_id`: String (primary key)
- `database_name`: String - Supabase database identifier
- `backup_type`: Enum - daily, weekly, monthly, manual
- `backup_size`: Integer - Size in bytes
- `backup_location`: String - Storage location identifier
- `backup_status`: Enum - in_progress, completed, failed, expired
- `created_at`: Timestamp
- `expires_at`: Timestamp - Based on retention policy
- `restore_point`: Boolean - Whether backup can be used for point-in-time recovery
- `checksum`: String - Backup integrity verification

**Retention Rules**:
- Daily backups: 30 days
- Weekly backups: 6 months
- Monthly backups: 2 years
- Manual backups: 1 year (unless manually deleted)

## Domain Configuration

### Domain Registry
**Purpose**: Manages custom domain configuration and DNS settings.

**Attributes**:
- `domain_id`: String (primary key)
- `domain_name`: String - Full domain (e.g., "api.vocilia.com")
- `subdomain`: String - Subdomain part (e.g., "api")
- `root_domain`: String - Root domain (e.g., "vocilia.com")
- `app_target`: String - Target application (backend, customer, business, admin)
- `platform_target`: Enum - Railway, Vercel
- `dns_status`: Enum - pending, configured, verified, failed
- `cdn_enabled`: Boolean
- `ssl_certificate_id`: String (foreign key)
- `created_at`: Timestamp
- `verified_at`: Timestamp

**DNS Validation**:
- CNAME records must point to correct platform endpoints
- DNS propagation verification required before SSL issuance

## Performance Metrics Schema

### Response Time Tracking
**Purpose**: Monitors API and page load performance against <2s targets.

**Attributes**:
- `endpoint`: String - API endpoint or page route
- `response_time_ms`: Integer
- `timestamp`: Timestamp
- `user_location`: String - Geographic region
- `cache_status`: Enum - hit, miss, bypass

**Aggregation Targets**:
- P95 response time <2000ms
- Average response time <1000ms
- Error rate <1%

### Uptime Calculation
**Purpose**: Tracks system availability for 99.5% uptime target.

**Calculation Method**:
- Total minutes in month - Downtime minutes = Uptime minutes
- (Uptime minutes / Total minutes) × 100 = Uptime percentage
- Alert threshold: <99.5% monthly

**Downtime Definition**:
- HTTP 5xx responses >50% for >1 minute
- Complete service unavailability >30 seconds
- Scheduled maintenance (excluded from SLA calculation)