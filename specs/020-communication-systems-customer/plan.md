# Implementation Plan: Communication Systems

**Branch**: `020-communication-systems-customer` | **Date**: 2025-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-communication-systems-customer/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   ✓ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✓ Project Type: web (frontend+backend with existing Supabase/Vercel/Railway)
   ✓ Structure Decision: Monorepo with customer/business/admin apps + packages
3. Fill the Constitution Check section based on the content of the constitution document.
   ✓ Constitution requirements loaded
4. Evaluate Constitution Check section below
   ✓ Initial Constitution Check completed
5. Execute Phase 0 → research.md
   → In progress
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Pending
7. Re-evaluate Constitution Check section
   → Pending
8. Plan Phase 2 → Describe task generation approach
   → Pending
9. STOP - Ready for /tasks command
   → Pending
```

## Summary
Communication Systems feature provides SMS-based customer notifications (reward alerts, payment confirmations), business communications (verification requests, invoice reminders with escalation), and multi-channel support (phone, email, chat) with specific SLA requirements. Integrates with existing Supabase database, utilizes established monorepo architecture with customer/business/admin apps, and builds upon existing payment/verification workflows.

## Technical Context
**Language/Version**: TypeScript with Node.js 18+ (existing stack)
**Primary Dependencies**: Next.js 14, Supabase client, Tailwind CSS, node-cron, SMS provider API (existing + new)
**Storage**: Supabase PostgreSQL with RLS policies (existing)
**Testing**: Jest with TypeScript support (existing)
**Target Platform**: Mobile web browsers, PWA-compatible browsers (existing)
**Project Type**: web - extends existing monorepo structure
**Performance Goals**: SMS delivery <30s, support response <2h, notification processing <5min
**Constraints**: SMS-only customer notifications, 3-retry pattern, Swedish compliance required
**Scale/Scope**: Extends existing user base, integrates with payment system, 22 functional requirements

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Production from Day One**: ✓ PASS
- SMS integrations will use production SMS APIs (not mocked)
- Real support ticket system with actual response tracking
- Production notification templates with real business data

**Security & Privacy First**: ✓ PASS
- Communication logs require RLS policies for admin-only access
- Support tickets protected by user authentication
- SMS content sanitized for sensitive data

**TypeScript Strict Mode**: ✓ PASS
- All communication services strictly typed
- SMS provider interfaces defined
- Support ticket models with proper TypeScript definitions

**Real Data Only**: ✓ PASS
- Integrates with existing feedback_sessions, transactions, payment_transactions tables
- Uses real customer phone numbers and business contact information
- Actual notification content based on live system data

**Monorepo Architecture**: ✓ PASS
- Extends existing apps/backend, apps/admin structure
- New communication services in packages/communication
- Follows established patterns from payment integration

## Project Structure

### Documentation (this feature)
```
specs/020-communication-systems-customer/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
apps/backend/src/
├── services/communication/     # NEW: SMS, support, notification services
├── routes/admin/communication/ # NEW: Admin communication management API
├── jobs/                      # EXTEND: notification processing jobs
└── middleware/                # EXTEND: communication validation

apps/admin/src/
├── app/communication/         # NEW: Communication dashboard
└── components/communication/   # NEW: Support ticket UI, notification logs

apps/business/src/
├── app/communication/         # NEW: Business communication preferences
└── components/communication/  # NEW: Support contact forms

apps/customer/src/
├── app/support/               # NEW: Customer support interface
└── components/support/        # NEW: Support ticket creation

packages/communication/src/
├── sms/                       # NEW: SMS provider abstraction
├── support/                   # NEW: Support ticket models
└── notifications/             # NEW: Notification templates

packages/types/src/
└── communication.ts           # NEW: Communication interfaces

supabase/migrations/
└── communication_schema.sql   # NEW: Communication tables + RLS
```

**Structure Decision**: Web application (Option 2) - extends existing monorepo with customer/business/admin apps and shared packages

## Phase 0: Outline & Research ✓ COMPLETE

**Research Unknowns Resolved**:
1. ✓ SMS Provider Selection → Twilio SMS API with Swedish operator support
2. ✓ Support Ticket System → Custom system with Zendesk-style architecture in Supabase
3. ✓ Notification Processing → Node-cron with PostgreSQL job locking (existing pattern)
4. ✓ Template System → Database-stored templates with Handlebars syntax
5. ✓ Swedish Compliance → Personal Data Act and PTS guidelines compliance
6. ✓ Performance Optimization → Batch processing with individual delivery tracking

**Output**: research.md complete with all technical decisions documented

## Phase 1: Design & Contracts ✓ COMPLETE

**Data Model Generated**:
- ✓ 7 core entities designed with relationships and validation rules
- ✓ State transitions defined for notifications and support tickets
- ✓ RLS policies specified for security compliance
- ✓ Performance indexing strategy documented

**API Contracts Generated**:
- ✓ Notifications API (12 endpoints for SMS/email management)
- ✓ Support API (10 endpoints for ticket lifecycle management)
- ✓ Templates API (12 endpoints for admin template management)

**Testing Framework**:
- ✓ Integration test scenarios for all user journeys
- ✓ Performance validation targets specified
- ✓ Load testing and monitoring setup documented

**Agent Context Updated**:
- ✓ CLAUDE.md updated with communication systems technical stack
- ✓ Preserved existing payment integration context
- ✓ Added SMS provider and support system integration points

**Post-Design Constitution Check ✓ PASS**:
- Production from Day One: ✓ Twilio production API, real support system
- Security & Privacy First: ✓ RLS policies, encrypted phone numbers, admin-only access
- TypeScript Strict Mode: ✓ All APIs and models strictly typed
- Real Data Only: ✓ Integrates with existing customer/business tables
- Monorepo Architecture: ✓ Extends existing apps/backend structure

**Output**: data-model.md, contracts/*.md, quickstart.md, updated CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base structure
- Generate tasks from Phase 1 design artifacts (data-model.md, contracts/*.md, quickstart.md)
- Create TDD-ordered task sequence from integration scenarios

**Database Tasks** (from data-model.md):
- Migration creation: communication_schema.sql with all 7 entities
- RLS policy implementation: admin-only access for audit tables
- Seed data: communication templates for Swedish/English

**API Contract Tasks** (from contracts/*.md):
- Contract tests for 34 endpoints across 3 API modules
- Model creation: TypeScript interfaces for all entities
- Service implementation: SMS, support ticket, template management
- Middleware: authentication, rate limiting, validation

**Integration Test Tasks** (from quickstart.md):
- Customer reward notification end-to-end test
- Business verification request workflow test
- Support ticket lifecycle test
- Payment overdue escalation test
- Weekly summary batch processing test

**UI Component Tasks** (from monorepo structure):
- Admin dashboard: communication logs, template management
- Customer interface: support ticket creation
- Business interface: communication preferences

**Infrastructure Tasks**:
- Twilio SMS integration with webhook handling
- Node-cron job setup for scheduled notifications
- Performance monitoring and alerting setup

**Ordering Strategy**:
- Phase A: Database migration and models [P]
- Phase B: Contract tests (failing) [P]
- Phase C: Core services implementation (SMS, support, templates)
- Phase D: API endpoint implementation
- Phase E: UI components [P]
- Phase F: Integration tests and performance validation

**Estimated Output**: 35-40 numbered, dependency-ordered tasks in tasks.md

**Parallel Execution Opportunities**:
- Database models can be created independently [P]
- Contract tests can be written in parallel [P]
- UI components independent across apps [P]
- Template creation and validation testing [P]

**Constitutional Compliance Tasks**:
- All TypeScript strict mode validation
- RLS policy testing for all entities
- Production SMS provider integration testing
- Real data integration with existing payment system

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified - all requirements met within established patterns*

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