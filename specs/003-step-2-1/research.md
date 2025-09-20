# Research: Business Authentication & Account Management

**Feature**: Business Authentication & Account Management
**Phase**: 0 - Research & Analysis
**Date**: 2025-09-20

## Research Areas

### 1. Supabase Authentication Best Practices
**Decision**: Extend existing Supabase Auth with business-specific user metadata and RLS policies
**Rationale**:
- Leverages proven authentication infrastructure already in place
- Supports custom user metadata for business verification status
- RLS policies provide secure multi-tenant data isolation
- Integration with existing @vocilia/auth package minimizes refactoring

**Alternatives considered**:
- Custom JWT authentication (rejected - increases security complexity and maintenance)
- Auth0 integration (rejected - additional cost and migration complexity)
- Firebase Auth (rejected - vendor lock-in and migration required)

**Implementation approach**:
- Extend Supabase Auth user metadata with `business_verification_status`
- Create business-specific authentication flows in @vocilia/auth package
- Implement admin approval workflow through database triggers

### 2. Next.js 14 Authentication Flow
**Decision**: Use App Router with Supabase Auth Helpers and middleware-based protection
**Rationale**:
- App Router provides better performance and developer experience
- Supabase Auth Helpers handle session management automatically
- Middleware enables route protection without client-side redirects
- Consistent with existing Next.js 14 setup in apps/business

**Alternatives considered**:
- Pages Router approach (rejected - legacy pattern, worse performance)
- Client-side only auth (rejected - security concerns, poor SEO)
- Server-side only auth (rejected - poor user experience)

**Implementation approach**:
- Use `@supabase/auth-helpers-nextjs` for session management
- Implement middleware.ts for protected route enforcement
- Create reusable auth components in @vocilia/ui package

### 3. Multi-Store Permission Models
**Decision**: Junction table approach with granular permissions and RLS enforcement
**Rationale**:
- Flexible business-store relationships (1:many, many:many support)
- Granular permission system (read, write, admin per store)
- RLS policies ensure data isolation at database level
- Scalable to enterprise multi-location businesses

**Alternatives considered**:
- Single store per business (rejected - limits business growth)
- Store-level user accounts (rejected - poor UX, complex management)
- Flat permission model (rejected - insufficient granularity)

**Database design**:
```sql
-- business_stores junction table
business_id UUID REFERENCES auth.users(id)
store_id UUID REFERENCES stores(id)
permissions JSONB (read, write, admin flags)
created_at TIMESTAMPTZ
```

### 4. Admin Verification Workflows
**Decision**: Database-driven approval with real-time notifications and audit trails
**Rationale**:
- Integrates with existing admin dashboard infrastructure
- Provides complete audit trail for compliance
- Real-time notifications enable prompt business onboarding
- Scalable to multiple admin users

**Alternatives considered**:
- Email-based approval (rejected - no audit trail, poor UX)
- Automatic approval (rejected - security risk, fraud potential)
- Third-party verification service (rejected - cost, complexity)

**Implementation approach**:
- Database trigger on business registration
- Real-time subscription in admin dashboard
- Email notifications through existing notification service
- Admin action logging for audit compliance

### 5. Session Management
**Decision**: Supabase session with custom store context switching
**Rationale**:
- Leverages Supabase's secure session management
- Custom store context stored in session metadata
- Seamless store switching without re-authentication
- Secure against session hijacking and CSRF

**Alternatives considered**:
- Client-side store context (rejected - security risk)
- Separate sessions per store (rejected - poor UX)
- URL-based store selection (rejected - bookmarking issues)

**Implementation approach**:
- Store current_store_id in session metadata
- Middleware validates store access permissions
- Client-side store switching updates session context
- RLS policies filter data by current store context

## Technology Stack Decisions

### Frontend Authentication
- **Framework**: Next.js 14 App Router
- **Authentication**: @supabase/auth-helpers-nextjs v0.8.7+
- **UI Components**: Extend @vocilia/ui with auth components
- **Styling**: Tailwind CSS (existing standard)
- **Form Handling**: React Hook Form with Zod validation

### Backend Services
- **Database**: Supabase PostgreSQL with RLS
- **Authentication**: Supabase Auth with custom metadata
- **Admin Notifications**: Railway backend service
- **Email**: Existing email service integration

### Security Considerations
- **Password Requirements**: Minimum 8 characters, complexity rules
- **Rate Limiting**: Supabase built-in + custom middleware
- **Session Security**: HTTPOnly cookies, secure flags
- **CSRF Protection**: Built into Supabase Auth Helpers
- **Data Encryption**: Database-level encryption for sensitive fields

## Performance Requirements
- **Authentication Response**: <200ms for login/logout
- **Dashboard Load**: <100ms initial page load
- **Store Switching**: <50ms context change
- **Session Validation**: <10ms middleware check

## Integration Points
- **Existing Packages**: @vocilia/auth, @vocilia/ui, @vocilia/types
- **Database**: Extend existing Supabase schema
- **Deployment**: Vercel (frontend), Railway (backend services)
- **Monitoring**: Extend existing observability setup

## Risk Assessment
- **Low Risk**: Supabase Auth integration (proven technology)
- **Medium Risk**: Multi-store permission complexity (mitigated by thorough testing)
- **Medium Risk**: Admin approval workflow timing (mitigated by notifications)
- **Low Risk**: Session management (leverages Supabase security)

## Development Approach
1. **Database First**: Create schema and RLS policies
2. **API Contracts**: Define and test authentication endpoints
3. **Package Extensions**: Enhance @vocilia/auth with business features
4. **UI Implementation**: Build authentication pages and components
5. **Integration Testing**: End-to-end authentication flows
6. **Admin Interface**: Verification and approval workflows

This research phase resolves all technical uncertainties and provides clear implementation guidance for the Business Authentication & Account Management feature.