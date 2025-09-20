# Research: Shared Infrastructure

**Generated**: 2025-09-20
**For Feature**: Shared Infrastructure (002-step-1-3)

## Research Summary

This document consolidates research findings for implementing shared infrastructure across Vocilia's three applications (customer, business, admin) with existing Supabase, Vercel, and Railway projects.

## Technology Decisions

### 1. Supabase Auth Integration
**Decision**: Use `@supabase/ssr` package with multi-app authentication pattern
**Rationale**:
- Latest Supabase Auth v2 best practices (2024)
- Proper SSR support for Next.js App Router
- Cookie-based session management with edge compatibility
- Type-safe integration with generated database types

**Alternatives considered**:
- `@supabase/auth-helpers` (deprecated in 2024)
- Custom JWT implementation (unnecessary complexity)
- NextAuth.js (incompatible with existing Supabase project)

**Implementation pattern**:
- Shared auth package in `/packages/auth/`
- Browser, server component, and middleware clients
- Role-based permissions with RLS policies
- TypeScript strict mode compliance

### 2. Monorepo Package Architecture
**Decision**: Extend existing PNPM workspace structure
**Rationale**:
- Already established in project with workspaces
- Maintains clear separation between apps and shared packages
- Type safety across package boundaries
- Constitutional compliance with monorepo architecture

**Structure**:
```
packages/
├── auth/           # Authentication utilities (NEW)
├── database/       # Database client (EXISTING - enhance)
├── ui/            # UI components (EXISTING - enhance)
├── shared/        # Utilities (EXISTING - enhance)
└── types/         # TypeScript definitions (NEW)
```

### 3. Railway Backend Setup
**Decision**: Node.js/Express with production-ready configuration
**Rationale**:
- Existing Railway project ready for deployment
- Express.js provides mature ecosystem for API development
- Direct integration with Supabase PostgreSQL
- Health checks and monitoring built-in

**Key patterns**:
- Environment-specific configuration
- Connection pooling for Supabase
- CORS for multiple frontend domains
- Rate limiting and security middleware
- Graceful shutdown handling

### 4. Environment Strategy
**Decision**: Development, staging, production environments
**Rationale**:
- Production-from-day-one constitutional requirement
- Separate testing environment for RLS policy validation
- Staging environment for integration testing
- CI/CD pipeline with automated deployments

**Environment mapping**:
- Development: Local development with production Supabase
- Staging: Railway staging environment (preview branches)
- Production: Railway production environment (main branch)

### 5. Type Safety Implementation
**Decision**: Generated Supabase types with strict TypeScript
**Rationale**:
- Constitutional requirement for TypeScript strict mode
- Auto-generated types from database schema
- Type safety across all package boundaries
- No `any` types except documented external APIs

**Type generation workflow**:
```bash
# In packages/database
pnpm generate-types
```

## Integration Requirements

### Existing Projects Integration
- **Vercel Project**: https://vercel.com/lakakas-projects-b9fec40c/alpha
- **Railway Project**: https://railway.com/project/5b587bbc-f3b2-4550-97b6-fd906ff5ead1
- **Supabase Project**: https://supabase.com/dashboard/project/wtdckfgdcryjvbllcajq

### Authentication Roles
Based on specification feedback:
- `business_account`: Customer businesses using feedback platform
- `admin_account`: System administrators managing platform
- Business accounts can manage multiple stores (franchise model)

### Performance Requirements
- API response times: <200ms
- Initial page load: <3s
- Database queries: Optimized with RLS policies
- Real-time updates: Supabase real-time subscriptions

## Security Considerations

### Row Level Security (RLS)
- Mandatory for all database operations (constitutional requirement)
- Business isolation: Business accounts only access their data
- Admin access: System admins have controlled elevated access
- Customer data protection: Phone numbers never shared with businesses

### Authentication Security
- JWT tokens with secure httpOnly cookies
- Session refresh patterns for long-lived sessions
- Rate limiting on authentication endpoints
- CORS configuration for approved domains only

### API Security
- Request validation middleware
- SQL injection prevention with prepared statements
- Rate limiting per endpoint and user type
- Comprehensive error handling without information leakage

## Dependencies and Constraints

### Required Dependencies
```json
{
  "@supabase/ssr": "^0.5.1",
  "@supabase/supabase-js": "^2.57.4",
  "express": "^4.18.2",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5",
  "cors": "^2.8.5",
  "winston": "^3.11.0"
}
```

### Constitutional Constraints
- No mock data or prototypes
- TypeScript strict mode required
- Production-ready from first commit
- Monorepo architecture maintained
- RLS policies mandatory for all data access

### Performance Constraints
- <200ms p95 API response times
- Database connection pooling for Railway environment
- Efficient type generation workflow
- Minimal bundle size impact for shared packages

## Implementation Approach

### Phase 1: Shared Packages
1. Create authentication package with Supabase Auth v2
2. Enhance database package with typed queries
3. Expand UI package with base components
4. Create types package for shared definitions
5. Enhance shared utilities package

### Phase 2: Backend API Foundation
1. Set up Express.js structure on Railway
2. Implement authentication middleware
3. Configure CORS for multiple domains
4. Set up health checks and monitoring
5. Implement deployment automation

### Phase 3: Integration Testing
1. Test authentication across all three apps
2. Validate RLS policies with different user roles
3. Performance testing for API endpoints
4. End-to-end testing of shared components
5. Security audit of authentication flow

This research provides the foundation for implementing production-ready shared infrastructure that meets all constitutional requirements while leveraging existing project infrastructure.