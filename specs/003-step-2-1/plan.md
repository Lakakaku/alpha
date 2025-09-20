# Implementation Plan: Business Authentication & Account Management

**Branch**: `003-step-2-1` | **Date**: 2025-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-step-2-1/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   ✓ COMPLETE: Feature spec loaded and analyzed
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✓ COMPLETE: Project Type identified as web application with monorepo
   ✓ COMPLETE: Structure Decision set based on existing architecture
3. Fill the Constitution Check section based on the content of the constitution document.
   ✓ COMPLETE: Constitution requirements analyzed and documented
4. Evaluate Constitution Check section below
   ✓ COMPLETE: No constitutional violations detected
   ✓ COMPLETE: Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   ✓ COMPLETE: Research phase executed
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   ✓ COMPLETE: Design phase executed
7. Re-evaluate Constitution Check section
   ✓ COMPLETE: Post-design constitution check PASS
   ✓ COMPLETE: Progress Tracking: Post-Design Constitution Check PASS
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   ✓ COMPLETE: Task generation approach described
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Business Authentication & Account Management system for the Vocilia customer feedback platform. Provides secure email/password authentication, multi-store support, and admin-managed account verification for business users accessing their feedback dashboards. Built using Next.js 14 frontend with Supabase authentication and PostgreSQL database, deployed on Vercel with Railway backend services.

## Technical Context
**Language/Version**: TypeScript 5.5+ with Next.js 14
**Primary Dependencies**: @supabase/auth-helpers-nextjs, @supabase/supabase-js, React 18, Tailwind CSS
**Storage**: Supabase PostgreSQL with Row Level Security (RLS) policies
**Testing**: Jest with @types/jest, integration tests for authentication flows
**Target Platform**: Web application (business.vocilia.com) deployed on Vercel
**Project Type**: web - monorepo with separate frontend apps and shared packages
**Performance Goals**: <200ms authentication response, <100ms dashboard load time
**Constraints**: TypeScript strict mode, production-ready from day one, RLS mandatory
**Scale/Scope**: Support for 1000+ businesses with multiple stores each, admin verification workflow
**Integration**: Utilize existing Supabase, Vercel, and Railway infrastructure with established @vocilia/* packages

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Production from Day One**: All authentication integrations use real Supabase instance with production RLS policies
✅ **Security & Privacy First**: Business data isolation enforced through RLS, secure session management implemented
✅ **TypeScript Strict Mode**: All code must pass strict mode compilation, no `any` types except documented external APIs
✅ **Real Data Only**: Development uses actual Supabase database with proper RLS policies
✅ **Monorepo Architecture**: Extends existing apps/business application and @vocilia/auth package
✅ **Stack Requirements**: Next.js 14 + TypeScript frontend, Supabase auth backend, Tailwind CSS styling
✅ **Deployment Architecture**: Frontend to Vercel, leverages existing Railway backend for admin workflows

## Project Structure

### Documentation (this feature)
```
specs/003-step-2-1/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Existing monorepo structure (extends current architecture)
apps/
├── business/            # Primary implementation target
│   ├── src/
│   │   ├── pages/       # Auth pages (login, register, reset)
│   │   ├── components/  # Auth components and dashboard shell
│   │   └── lib/         # Business-specific auth utilities
│   └── tests/
├── admin/               # Admin verification interface
│   ├── src/
│   │   ├── pages/       # Business approval workflows
│   │   └── components/  # Admin verification components
└── backend/             # Admin notification services

packages/
├── auth/                # Extended authentication package
│   ├── src/
│   │   ├── business/    # Business-specific auth hooks
│   │   ├── admin/       # Admin verification utilities
│   │   └── types/       # Extended auth types
├── database/            # Database utilities and types
└── types/               # Shared TypeScript definitions
```

**Structure Decision**: Web application (Option 2) - extends existing monorepo with business authentication features

## Phase 0: Outline & Research

### Research Areas Identified
1. **Supabase Authentication Best Practices**: Row Level Security patterns for multi-tenant business authentication
2. **Next.js 14 Authentication Flow**: App Router authentication patterns with Supabase Auth Helpers
3. **Multi-Store Permission Models**: Database design for business-store relationships with RLS
4. **Admin Verification Workflows**: Real-time notifications and approval processes
5. **Session Management**: Secure session handling with store context switching

### Research Findings Consolidated

**Decision**: Use Supabase Auth with custom business registration flow and admin approval
**Rationale**: Leverages existing infrastructure while adding business-specific verification layer
**Alternatives considered**: Custom JWT auth (rejected - increases complexity), Auth0 (rejected - cost and migration complexity)

**Decision**: Implement multi-store support through business_stores junction table with RLS
**Rationale**: Maintains data isolation while allowing flexible store ownership
**Alternatives considered**: Separate tenant databases (rejected - operational complexity), store-level auth (rejected - poor UX)

**Decision**: Admin verification through real-time database triggers and email notifications
**Rationale**: Integrates with existing admin infrastructure, provides audit trail
**Alternatives considered**: Manual email approval (rejected - no audit trail), automatic approval (rejected - security concerns)

**Output**: research.md complete with technical decisions documented

## Phase 1: Design & Contracts

### Data Model Extracted
From feature specification entities:
- **Business Account**: email, encrypted_password, verification_status, created_at, updated_at
- **Store**: business_id, name, address, qr_code_id, permissions, created_at
- **Session**: business_id, current_store_id, expires_at, metadata

### API Contracts Generated
REST endpoints following existing patterns:
- POST /auth/business/register - Business registration with admin notification
- POST /auth/business/login - Email/password authentication with store context
- POST /auth/business/logout - Session termination
- POST /auth/business/reset-password - Password reset flow
- GET /business/stores - List authorized stores for current business
- PUT /business/current-store - Switch active store context
- POST /admin/business/approve - Admin approval endpoint

### Contract Tests Generated
One test file per endpoint asserting request/response schemas - tests must fail initially

### Test Scenarios Extracted
From user stories:
- Business registration with email verification
- Login flow with dashboard redirect
- Password reset functionality
- Multi-store switching workflow
- Admin approval process
- Security isolation testing

### Agent File Updated
CLAUDE.md updated with business authentication context and technical decisions

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → Supabase migration + RLS policy task [P]
- Each user story → integration test task
- Implementation tasks to make authentication flow work end-to-end

**Ordering Strategy**:
- TDD order: Tests before implementation
- Database first: Migrations and RLS before application code
- Dependencies: Auth package extensions before application implementation
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md covering:
1. Database schema and RLS policies (5-7 tasks)
2. Contract tests for all endpoints (8-10 tasks)
3. Authentication package extensions (6-8 tasks)
4. Business app authentication pages (8-10 tasks)
5. Admin verification interface (3-5 tasks)
6. Integration tests and validation (3-4 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations detected - section not needed*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*