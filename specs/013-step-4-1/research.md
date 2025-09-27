# Phase 0: Research - Admin Dashboard Foundation

**Date**: 2025-09-23  
**Feature**: Admin Dashboard Foundation  
**Research Areas**: Supabase admin authentication, admin dashboard UI patterns,
session management, admin roles in RLS

## Research Findings

### 1. Supabase Admin Authentication Patterns for Monorepo

**Decision**: Use separate admin auth table with Supabase Auth integration and
custom RLS policies

**Rationale**:

- Existing monorepo already has business user authentication via Supabase Auth
- Admin users need completely separate access patterns and permissions
- Custom `admin_accounts` table with foreign key to `auth.users` provides
  flexibility
- RLS policies can distinguish admin vs business user access patterns
- Leverages existing Supabase infrastructure while maintaining separation

**Alternatives considered**:

- Separate Supabase project for admin: Rejected due to increased complexity and
  data isolation issues
- Role-based within existing auth: Rejected due to security concerns mixing
  admin and business users
- External auth provider: Rejected to maintain consistency with existing
  architecture

**Implementation approach**:

- Create `admin_accounts` table linking to `auth.users`
- Custom RLS policies for admin-only access
- Admin-specific authentication middleware in backend
- Separate admin app with protected routes

### 2. Admin Dashboard UI Patterns with Store Management

**Decision**: Next.js admin app with server-side rendering and optimistic
updates

**Rationale**:

- Consistent with existing customer and business apps using Next.js 14
- Server-side rendering provides better SEO and initial load performance
- Optimistic updates improve perceived performance for admin operations
- Tailwind CSS maintains design consistency across all three apps
- Component library can be shared via packages/ui

**Alternatives considered**:

- SPA with client-side rendering: Rejected due to slower initial loads for admin
  workflows
- Admin routes within business app: Rejected due to security separation
  requirements
- External admin tool (e.g., Retool): Rejected to maintain full control and
  consistency

**Implementation approach**:

- New `apps/admin` Next.js application
- Shared components in `packages/ui` for consistency
- Store listing with HTML blocks as specified in requirements
- Real-time status updates via Supabase realtime subscriptions
- Responsive design optimized for desktop/tablet admin workflows

### 3. Session Management for Admin Interfaces

**Decision**: Supabase Auth sessions with custom 2-hour timeout and activity
tracking

**Rationale**:

- Leverages existing Supabase Auth session management
- Custom timeout matches clarified requirement for 2-hour idle timeout
- Activity tracking enables audit logging for security compliance
- Automatic logout on timeout enhances security posture
- Consistent with existing session patterns in customer/business apps

**Alternatives considered**:

- JWT with custom refresh logic: Rejected due to added complexity
- Database-stored sessions: Rejected as Supabase Auth is more robust
- Shorter timeout (30 min): Rejected based on clarification (2 hours chosen)
- No timeout: Rejected due to security requirements

**Implementation approach**:

- Supabase Auth with custom session tracking table
- Middleware to enforce 2-hour idle timeout
- Activity monitoring for audit trail
- Graceful logout with redirect to login page
- Session refresh on user activity

### 4. Admin Role Implementation in Existing RLS Architecture

**Decision**: Single admin role with comprehensive permissions via RLS policy
functions

**Rationale**:

- Clarification specified single admin role (all permissions)
- Existing RLS architecture can be extended with admin-specific policies
- Function-based policies provide flexibility for future role expansion
- Clear separation between admin and business user data access
- Maintains principle of least privilege while providing full admin access

**Alternatives considered**:

- Multiple admin roles: Rejected based on clarification (single role specified)
- Service account pattern: Rejected as it bypasses audit logging
- Database-level superuser: Rejected due to security concerns

**Implementation approach**:

- RLS policies with `is_admin(auth.uid())` function
- Admin-specific policies on all tables requiring admin access
- Audit logging for all admin operations
- Clear separation from business user policies
- Comprehensive permissions for store management, monitoring, and uploads

## Technical Architecture Summary

**Frontend**: New Next.js 14 admin app in `apps/admin/` **Backend**: Enhanced
existing backend with admin routes in `apps/backend/src/routes/admin/`
**Database**: Extended Supabase schema with admin tables and RLS policies
**Authentication**: Supabase Auth with custom admin account integration
**Session Management**: 2-hour timeout with activity tracking **Monitoring**:
Real-time store status via Supabase subscriptions **Security**: Comprehensive
RLS policies and audit logging

**Constitutional Compliance**: ✅ All requirements satisfied

- Production from day one: Real Supabase integration
- Security first: RLS policies and admin separation
- TypeScript strict: All code in strict mode
- Real data only: Existing Supabase database
- Monorepo architecture: New admin app in existing structure

## Implementation Readiness

All research questions resolved. Technical approach defined and validated
against constitutional requirements. Ready for Phase 1 design and contract
generation.
