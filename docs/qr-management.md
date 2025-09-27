# QR Code Management System Documentation

## Overview

The QR Code Management System provides comprehensive QR code generation, management, and analytics for Vocilia's customer feedback platform. This system enables businesses to create, customize, and track QR codes for their physical stores.

## Architecture

### Core Components

1. **QR Generator Service** (`qr-generator.service.ts`)
   - QR code generation with caching
   - Version management and transitions
   - Performance optimized (<200ms generation)

2. **PDF Template Service** (`pdf-template.service.ts`)
   - Customizable PDF templates for printing
   - Size optimized (<2MB files)
   - Multiple page formats and styles

3. **QR Analytics Service** (`qr-analytics.service.ts`)
   - Real-time scan tracking
   - 5-minute, hourly, and daily aggregation
   - Trend analysis and comparisons

4. **Scan Tracker Service** (`scan-tracker.service.ts`)
   - Individual scan event recording
   - Fraud detection and rate limiting
   - Real-time notifications

5. **QR Management Service** (`qr-management.service.ts`)
   - Unified coordinator for all QR operations
   - Permission validation and error handling
   - Comprehensive logging and monitoring

### Database Schema

#### Enhanced Stores Table
```sql
-- QR-related columns added to existing stores table
ALTER TABLE stores ADD COLUMN qr_version INTEGER DEFAULT 1;
ALTER TABLE stores ADD COLUMN qr_status VARCHAR(50) DEFAULT 'active';
ALTER TABLE stores ADD COLUMN qr_code_data TEXT;
ALTER TABLE stores ADD COLUMN qr_generated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stores ADD COLUMN qr_transition_until TIMESTAMPTZ;
```

#### QR Scan Events Table
```sql
CREATE TABLE qr_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    location_data JSONB,
    metadata JSONB
);
```

#### QR Analytics Tables
```sql
-- 5-minute aggregation
CREATE TABLE qr_analytics_5min (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    time_bucket TIMESTAMPTZ,
    scan_count INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly aggregation
CREATE TABLE qr_analytics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    hour_bucket TIMESTAMPTZ,
    scan_count INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    peak_5min_scans INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily aggregation
CREATE TABLE qr_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    date_bucket DATE,
    scan_count INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    peak_hour_scans INTEGER DEFAULT 0,
    avg_scans_per_hour DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### QR Code History Table
```sql
CREATE TABLE qr_code_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'generated', 'regenerated', 'activated', 'deactivated'
    old_qr_data TEXT,
    new_qr_data TEXT,
    old_version INTEGER,
    new_version INTEGER,
    reason TEXT,
    changed_by UUID REFERENCES auth.users(id),
    batch_operation_id UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### QR Print Templates Table
```sql
CREATE TABLE qr_print_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    page_size VARCHAR(20) DEFAULT 'A4', -- 'A4', 'letter', 'business_card', 'label_sheet'
    qr_size INTEGER DEFAULT 200, -- pixels
    include_logo BOOLEAN DEFAULT false,
    logo_url TEXT,
    custom_text TEXT,
    text_color VARCHAR(7) DEFAULT '#000000', -- hex color
    background_color VARCHAR(7) DEFAULT '#FFFFFF', -- hex color
    border_style VARCHAR(20) DEFAULT 'none', -- 'none', 'thin', 'thick', 'dashed'
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Store QR Management

#### GET /qr/stores/{storeId}
Get QR code information for a store.

**Response:**
```json
{
  "store": {
    "id": "uuid",
    "name": "Store Name",
    "business_id": "uuid",
    "qr_version": 3,
    "qr_status": "active",
    "qr_code_data": "data:image/png;base64,...",
    "qr_generated_at": "2025-09-21T10:00:00Z",
    "qr_transition_until": null
  },
  "qr_stats": {
    "current_version": 3,
    "total_regenerations": 2,
    "last_regenerated": "2025-09-20T15:30:00Z",
    "qr_data_size": 8192,
    "status": "active",
    "transition_active": false,
    "transition_until": null
  },
  "analytics_summary": {
    "today_scans": 45,
    "week_scans": 312,
    "unique_sessions_week": 156,
    "trend": "up"
  }
}
```

#### POST /qr/stores/{storeId}/regenerate
Regenerate QR code with transition period.

**Request:**
```json
{
  "reason": "Store layout changed",
  "transition_hours": 24
}
```

**Response:**
```json
{
  "success": true,
  "old_qr_version": 2,
  "new_qr_version": 3,
  "new_qr_data": "data:image/png;base64,...",
  "transition_until": "2025-09-22T10:00:00Z",
  "message": "QR code regenerated successfully"
}
```

### QR Downloads

#### GET /qr/stores/{storeId}/download
Download printable PDF with QR code.

**Query Parameters:**
- `template_id` (optional): Custom template ID
- `page_size` (optional): 'A4', 'letter', 'business_card', 'label_sheet'
- `format` (optional): 'pdf', 'png', 'svg'

**Response:**
```json
{
  "success": true,
  "download_url": "https://temp-storage/qr-store-name-2025-09-21.pdf",
  "file_name": "qr-store-name-2025-09-21.pdf",
  "file_size": 1048576,
  "expires_at": "2025-09-21T11:00:00Z"
}
```

### Analytics

#### GET /qr/analytics/{storeId}
Get scan analytics for a store.

**Query Parameters:**
- `period`: 'hour', 'day', 'week', 'month'
- `start_date` (optional): ISO date string
- `end_date` (optional): ISO date string
- `timezone` (optional): Timezone for aggregation

**Response:**
```json
{
  "period": "day",
  "start_date": "2025-09-21",
  "end_date": "2025-09-21",
  "total_scans": 45,
  "unique_sessions": 32,
  "unique_ips": 28,
  "peak_hour": {
    "hour": "2025-09-21T14:00:00Z",
    "scans": 12
  },
  "hourly_breakdown": [
    {
      "hour": "2025-09-21T09:00:00Z",
      "scans": 3,
      "unique_sessions": 3,
      "unique_ips": 3
    }
  ],
  "trend": {
    "direction": "up",
    "percentage": 15.2,
    "compared_to": "previous_period"
  }
}
```

### Bulk Operations

#### POST /qr/bulk/regenerate
Bulk regenerate QR codes for multiple stores.

**Request:**
```json
{
  "store_ids": ["uuid1", "uuid2", "uuid3"],
  "operation": "regenerate",
  "reason": "Bulk update for rebranding",
  "transition_hours": 24
}
```

**Response:**
```json
{
  "success": true,
  "total_stores": 3,
  "successful_operations": 3,
  "failed_operations": 0,
  "batch_operation_id": "uuid",
  "results": [
    {
      "store_id": "uuid1",
      "success": true,
      "new_version": 4
    }
  ],
  "message": "Bulk regeneration completed: 3 successful, 0 failed"
}
```

### Scan Tracking

#### POST /qr/scan
Track a QR code scan event.

**Request:**
```json
{
  "store_id": "uuid",
  "qr_version": 3,
  "session_id": "session_uuid",
  "location_data": {
    "country": "US",
    "region": "CA",
    "city": "San Francisco"
  },
  "metadata": {
    "source": "mobile_app",
    "campaign": "summer_2025"
  }
}
```

**Response:**
```json
{
  "success": true,
  "scan_recorded": true,
  "scan_id": "uuid",
  "message": "Scan tracked successfully"
}
```

## Performance Specifications

### QR Generation Performance
- **Target**: <200ms generation time
- **Implementation**: In-memory caching with 5-minute TTL
- **Cache Strategy**: Store-version based keys
- **Monitoring**: Performance logging for requests >200ms

### PDF Generation Performance
- **Target**: <2MB file size
- **Implementation**: Image compression and optimization
- **Techniques**:
  - JPEG compression at 0.7 quality for logos
  - Optimal QR size (256px) for quality vs size
  - Vector graphics for text and borders
  - PDF compression enabled

### Analytics Performance
- **Real-time**: 5-minute aggregation batches
- **Historical**: Pre-aggregated hourly and daily tables
- **Queries**: Indexed time-bucket columns for fast retrieval
- **Monitoring**: Query performance tracking

## Security and Privacy

### Row Level Security (RLS)
All QR tables implement RLS policies ensuring businesses can only access their own data:

```sql
-- Example RLS policy for qr_scan_events
CREATE POLICY qr_scan_events_business_isolation ON qr_scan_events
FOR ALL TO authenticated
USING (
  store_id IN (
    SELECT s.id FROM stores s
    JOIN business_stores bs ON s.id = bs.store_id
    JOIN businesses b ON bs.business_id = b.id
    WHERE b.user_id = auth.uid()
  )
);
```

### Data Protection
- **IP Address Hashing**: IP addresses are hashed for privacy
- **Session Anonymization**: Session IDs are rotated regularly
- **Data Retention**: Scan events older than 2 years are archived
- **GDPR Compliance**: Data deletion endpoints available

## Error Handling and Logging

### Error Types
1. **QRValidationError**: Input validation failures
2. **QRPermissionError**: Access control violations
3. **QRGenerationError**: QR code creation failures
4. **QRAnalyticsError**: Analytics processing failures

### Logging Levels
- **INFO**: Successful operations and metrics
- **WARN**: Recoverable errors and performance issues
- **ERROR**: Critical failures requiring attention
- **DEBUG**: Detailed troubleshooting information

### Log Format
```json
{
  "level": "info",
  "service": "qr-management",
  "operation": "regenerate_qr",
  "storeId": "uuid",
  "businessId": "uuid",
  "userId": "uuid",
  "duration": 150,
  "metadata": {
    "qrVersion": 3,
    "transitionHours": 24
  },
  "timestamp": "2025-09-21T10:30:00.000Z"
}
```

## Monitoring and Health Checks

### Health Check Endpoint
#### GET /qr/health
System-wide health check for all QR services.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": {
      "status": "healthy",
      "errors": []
    },
    "qr_generator": {
      "status": "healthy",
      "database_connected": true,
      "qr_generation_working": true,
      "base_url": "https://customer.vocilia.com",
      "errors": []
    },
    "pdf_template": {
      "status": "healthy",
      "pdf_generation_working": true,
      "canvas_available": true,
      "errors": []
    },
    "analytics": {
      "status": "healthy",
      "aggregation_current": true,
      "last_5min_run": "2025-09-21T10:25:00Z",
      "errors": []
    },
    "scan_tracker": {
      "status": "healthy",
      "realtime_connected": true,
      "fraud_detection_active": true,
      "errors": []
    }
  },
  "overall_errors": []
}
```

### Performance Metrics
- QR generation response times
- PDF file sizes and generation times
- Analytics query performance
- Scan tracking throughput
- Cache hit rates

## Testing Strategy

### Contract Tests
Located in `apps/backend/tests/contract/`:
- `qr-store-get.test.ts` - Store QR retrieval
- `qr-regenerate.test.ts` - QR regeneration
- `qr-download.test.ts` - PDF downloads
- `qr-analytics.test.ts` - Analytics queries
- `qr-bulk.test.ts` - Bulk operations
- `qr-scan.test.ts` - Scan tracking
- `qr-templates.test.ts` - Template management

### Integration Tests
Located in `apps/business/tests/integration/`:
- `qr-regeneration.test.ts` - Complete regeneration workflow
- `qr-analytics.test.ts` - Analytics tracking
- `qr-bulk-operations.test.ts` - Bulk operations
- `qr-templates.test.ts` - Template system
- `qr-scan-tracking.test.ts` - Scan tracking
- `qr-transitions.test.ts` - QR transition periods

### Unit Tests
Located in `apps/backend/tests/unit/`:
- `qr-generation.test.ts` - QR generation logic
- `pdf-templates.test.ts` - PDF rendering
- `analytics-aggregation.test.ts` - Analytics processing

## Deployment and Configuration

### Environment Variables
```bash
# QR Service Configuration
CUSTOMER_APP_URL=https://customer.vocilia.com
QR_CACHE_TTL_MINUTES=5
PDF_MAX_SIZE_MB=2
ANALYTICS_AGGREGATION_INTERVAL_MINUTES=5

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Logging Configuration
LOG_LEVEL=info
EXTERNAL_LOGGER_URL=https://your-logging-service.com
```

### Database Migrations
Migrations are located in `supabase/migrations/`:
- `20250920000001_qr_management.sql` - Core QR tables
- `20250921000003_qr_rls_policies_update.sql` - RLS policies

### Deployment Steps
1. Apply database migrations
2. Deploy backend services with QR endpoints
3. Deploy frontend components
4. Configure environment variables
5. Run health checks
6. Execute validation workflows

## Usage Examples

### Frontend Integration

```typescript
// apps/business/src/services/qr/qr-client.service.ts
import { QRClientService } from '@/services/qr/qr-client.service';

const qrService = new QRClientService();

// Get store QR information
const storeQR = await qrService.getStoreQR(storeId);

// Regenerate QR code
const result = await qrService.regenerateQR(storeId, {
  reason: 'Store renovation',
  transition_hours: 48
});

// Download QR PDF
const download = await qrService.downloadQR(storeId, {
  page_size: 'A4',
  template_id: 'custom-template-id'
});

// Get analytics
const analytics = await qrService.getAnalytics(storeId, {
  period: 'week'
});
```

### Backend Service Usage

```typescript
// Direct service usage
import { createQRManagementService } from '@/services/qr/qr-management.service';

const qrManager = createQRManagementService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.CUSTOMER_APP_URL
);

// System health check
const health = await qrManager.systemHealthCheck();

// Get business stores overview
const stores = await qrManager.getBusinessStores(businessId);
```

## Best Practices

### Performance Optimization
1. **Cache QR codes** for repeated requests
2. **Use SVG format** for high-quality printing
3. **Compress PDF images** to stay under 2MB limit
4. **Pre-aggregate analytics** for fast queries
5. **Index time-bucket columns** for analytics tables

### Error Handling
1. **Use specific error types** for different failure modes
2. **Log all errors** with full context
3. **Provide graceful degradation** for non-critical features
4. **Return partial data** when possible instead of complete failure

### Security
1. **Validate all inputs** before processing
2. **Check permissions** for every operation
3. **Use RLS policies** for data isolation
4. **Hash sensitive data** like IP addresses
5. **Rotate session identifiers** regularly

### Monitoring
1. **Track performance metrics** for all operations
2. **Set up alerts** for error rates and response times
3. **Monitor cache hit rates** and memory usage
4. **Log business metrics** like QR usage patterns
5. **Create dashboards** for operational visibility

## Troubleshooting

### Common Issues

1. **QR Generation Slow (>200ms)**
   - Check cache hit rates
   - Monitor database connection pool
   - Review QR service logs

2. **PDF Files Too Large (>2MB)**
   - Verify image compression settings
   - Check logo file sizes
   - Review PDF optimization configuration

3. **Analytics Missing/Delayed**
   - Check aggregation job status
   - Verify time-bucket indexing
   - Review scan event ingestion

4. **Permission Errors**
   - Verify RLS policies
   - Check business-store associations
   - Review user authentication tokens

### Debug Commands

```bash
# Check QR service health
curl /api/qr/health

# View recent QR operations
grep "QR_INFO" /var/log/app.log | tail -20

# Check analytics aggregation
SELECT * FROM qr_analytics_5min 
WHERE time_bucket > NOW() - INTERVAL '1 hour' 
ORDER BY time_bucket DESC LIMIT 10;

# Monitor cache performance
# (Check application metrics for cache hit rates)
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Clean expired cache entries** (automated)
2. **Archive old scan events** (monthly)
3. **Update analytics aggregations** (automated)
4. **Monitor storage usage** (weekly)
5. **Review error logs** (daily)

### Backup and Recovery
- **Database**: Automated Supabase backups
- **Generated QR codes**: Regenerable from store data
- **PDF templates**: Stored in database with backups
- **Analytics**: Recoverable from scan events

---

*Last Updated: 2025-09-21*
*Version: 1.0.0*
*System: QR Code Management (Feature 004-step-2-2)*