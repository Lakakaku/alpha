# Research: Production Deployment

## Railway Backend Deployment

### Decision: Enhanced Railway Configuration with Auto-scaling
**Rationale**: Railway provides zero-config deployment with built-in scaling, ideal for the TypeScript/Node.js backend. The existing `railway.json` already shows proper configuration with health checks and environment management.

**Configuration Enhancements**:
- **Scaling**: 2-8 replicas with CPU/memory thresholds at 70%/75%
- **Resources**: 2Gi memory, 1500m CPU for medium traffic handling
- **Background Jobs**: Native cron support for weekly payment batches
- **Environment Isolation**: Separate staging and production environments

**Alternatives Considered**:
- AWS ECS: Rejected due to complex setup and higher operational overhead
- Google Cloud Run: Good alternative but Railway provides better developer experience
- DigitalOcean App Platform: Less mature auto-scaling capabilities

## Vercel Frontend Deployment

### Decision: Monorepo Deployment with Edge Optimization
**Rationale**: Vercel's native Next.js support and global CDN provide optimal performance for the three frontend applications. Smart build ignoring prevents unnecessary rebuilds when only one app changes.

**Configuration Strategy**:
- **Per-App Deployment**: Individual vercel.json for customer, business, admin apps
- **Smart Builds**: Git diff checking to avoid rebuilding unchanged apps
- **Edge Functions**: Geolocation-based routing for Swedish users
- **Security Headers**: X-Frame-Options, X-Content-Type-Options for all apps

**Alternatives Considered**:
- Netlify: Good alternative but less optimal for Next.js edge features
- AWS Amplify: More complex monorepo configuration
- CloudFlare Pages: Limited dynamic functionality for admin dashboard

## Domain and SSL Strategy

### Decision: Separate Domain Architecture with Single Certificates
**Rationale**: Security isolation and easier compliance with separate domains. Platform-native SSL management reduces operational complexity.

**Domain Structure**:
```
Production:
├── api.vocilia.com          (Railway)
├── customer.vocilia.com     (Vercel)
├── business.vocilia.com     (Vercel)
└── admin.vocilia.com        (Vercel)

Staging:
├── staging-api.vocilia.com
├── staging-customer.vocilia.com
├── staging-business.vocilia.com
└── staging-admin.vocilia.com
```

**SSL Strategy**: Single domain certificates per subdomain for security isolation and easier automation.

**Alternatives Considered**:
- Wildcard certificates: Rejected due to security concerns (single point of failure)
- Subdomain approach (api.vocilia.se): Rejected per user requirement for separate domains
- Path-based routing: Rejected due to complexity and security isolation needs

## Backup and Monitoring

### Decision: Multi-Layer Monitoring with Daily Backups
**Rationale**: 99.5% uptime target requires comprehensive monitoring and reliable backup strategy. Daily backups with 30-day retention balances data protection with storage costs.

**Backup Strategy**:
- **Frequency**: Daily automated backups at 2 AM Stockholm time
- **Retention**: 30 days for daily, 6 months for weekly, 2 years for monthly
- **Monitoring**: Automated backup health checks with 25-hour alert threshold
- **Recovery**: Point-in-time recovery capability for critical data loss scenarios

**Monitoring Stack**:
- **Primary**: UptimeRobot for external uptime monitoring (5-minute intervals)
- **APM**: Application performance monitoring for response times and error rates
- **Logs**: Centralized log aggregation with 30-day retention
- **Database**: PostgreSQL performance monitoring for connection usage and slow queries

**Alert Configuration**:
- Response time >2s for 5 minutes (warning)
- Error rate >5% for 3 minutes (critical)
- Database connections >80% for 5 minutes (warning)
- Backup age >25 hours (critical)

**Alternatives Considered**:
- Hourly backups: Rejected due to storage costs and unnecessary frequency for medium traffic
- Real-time replication: Deferred as over-engineering for current scale
- Weekly backups: Rejected as insufficient for 99.5% uptime requirement

## Performance Optimization

### Decision: CDN and Connection Pooling
**Rationale**: <2 second page load requirement necessitates global CDN and optimized database connections for 100-500 concurrent users.

**CDN Strategy**:
- Vercel Edge Network for automatic global distribution
- Image optimization with WebP conversion
- Service worker caching for PWA functionality
- Static asset optimization with compression

**Database Optimization**:
- Connection pooling to handle concurrent users efficiently
- Read replica consideration for future scaling
- Query performance monitoring for slow query detection

## Cost Analysis

**Estimated Monthly Cost for Medium Traffic**:
- Railway (Backend): $100-200
- Vercel (3 Frontends): $100-200
- Monitoring Services: $50-100
- **Total**: $250-500 per month

**Scaling Considerations**:
- Auto-scaling prevents over-provisioning
- Pay-per-use pricing models align with traffic growth
- Monitoring costs scale with usage, not fixed infrastructure