# Implementation Plan: Database Foundation for Customer Feedback System

**Branch**: `001-step-1-2` | **Date**: 2025-09-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/lucasjenner/alpha/specs/001-step-1-2/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Establish a secure, production-ready database foundation for the Vocilia customer feedback system using Supabase PostgreSQL with strict Row Level Security (RLS) policies. The system must support multi-business data isolation, real-time feedback collection, weekly verification workflows, and fraud detection while maintaining customer privacy and business data separation.

## Technical Context
**Language/Version**: TypeScript 5.0+ with strict mode, Node.js 18+ for backend APIs
**Primary Dependencies**: Supabase client library, Next.js 14, PostgreSQL with RLS, Railway Node.js deployment
**Storage**: Supabase PostgreSQL with Row Level Security, real-time subscriptions, authentication
**Testing**: Jest/Vitest for unit tests, Playwright for integration tests, Supabase local development
**Target Platform**: Web application (Next.js on Vercel frontend, Node.js APIs on Railway backend)
**Project Type**: web - determines monorepo structure with frontend and backend separation
**Performance Goals**: Sub-200ms API responses, support for concurrent feedback sessions, real-time data sync
**Constraints**: GDPR compliance, Swedish market focus, production-from-day-one requirement, strict RLS enforcement
**Scale/Scope**: Multi-business system, weekly verification cycles, AI-powered analysis integration, secure data isolation

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Production from Day One**: Using real Supabase project (wtdckfgdcryjvbllcajq), no mock data or prototypes
✅ **Security & Privacy First**: RLS policies mandatory, customer phone privacy enforced, business data isolation
✅ **TypeScript Strict Mode**: All database utilities and types will be strictly typed
✅ **Real Data Only**: Using production Supabase instance, no local/mock databases
✅ **Monorepo Architecture**: Database utilities shared between Customer, Business, Admin applications
✅ **Technology Stack Compliance**: Supabase PostgreSQL, Next.js 14, Node.js for Railway backend
✅ **Deployment Architecture**: Database accessible from both Vercel (frontend) and Railway (backend)
✅ **Weekly Verification Workflow**: Database schema supports POS cross-reference verification
✅ **AI Integration Standards**: Schema supports context window storage and feedback analysis

No constitutional violations detected. All requirements align with established principles.

## Project Structure

### Documentation (this feature)
```
specs/001-step-1-2/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (frontend + backend detected)
packages/
├── database/            # Shared database utilities
│   ├── src/
│   │   ├── client/      # Supabase client configuration
│   │   ├── types/       # Database type definitions
│   │   ├── queries/     # Type-safe query builders
│   │   └── migrations/  # Schema migrations
│   └── tests/

apps/
├── customer/            # Next.js customer app (Vercel)
├── business/            # Next.js business app (Vercel)
├── admin/               # Next.js admin app (Vercel)
└── api/                 # Node.js backend (Railway)
    ├── src/
    │   ├── routes/      # API endpoints
    │   ├── services/    # Business logic
    │   ├── middleware/  # Auth, CORS, validation
    │   └── utils/       # Shared utilities
    └── tests/
```

**Structure Decision**: Option 2 (Web application) - monorepo with shared database package and separate frontend/backend deployment targets

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Supabase RLS best practices for multi-tenant architecture
   - Database schema patterns for transaction verification workflows
   - Real-time subscription patterns for feedback collection
   - Supabase client library optimization for monorepo sharing

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Supabase RLS multi-tenant patterns for business data isolation"
   Task: "Find best practices for Supabase client sharing in Next.js monorepo"
   Task: "Research transaction verification database patterns with tolerance matching"
   Task: "Find optimal database indexing strategies for real-time feedback collection"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Business, Store, Feedback Session, Transaction, User Account, Verification Record, Context Window
   - RLS policies for each entity ensuring business data isolation
   - Relationships and foreign key constraints
   - Weekly verification workflow state transitions

2. **Generate API contracts** from functional requirements:
   - Database connection and authentication endpoints
   - CRUD operations for each entity with RLS enforcement
   - Real-time subscription endpoints for feedback collection
   - Weekly verification workflow APIs
   - Output PostgreSQL schemas and TypeScript types to `/contracts/`

3. **Generate contract tests** from contracts:
   - RLS policy enforcement tests (business cannot access other business data)
   - Database connection and authentication tests
   - Entity CRUD operation tests with proper error handling
   - Real-time subscription connection tests
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Business registration with data isolation verification
   - Multi-store setup within single business account
   - Feedback session creation linked to store and transaction
   - Weekly verification data preparation and processing
   - Quickstart test = database setup and basic operations

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for Claude Code
   - Add Supabase database foundation context
   - Update with RLS policies and security model
   - Include database utility patterns
   - Keep under 150 lines for token efficiency

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate database setup and configuration tasks
- Each entity → schema creation task [P]
- Each RLS policy → policy implementation task [P]
- Each integration point → connection utility task
- Supabase client setup and type generation tasks
- Real-time subscription setup tasks

**Ordering Strategy**:
- Database connection setup first
- Schema and type generation before RLS policies
- RLS policies before any data operations
- Shared utilities before app-specific integrations
- Mark [P] for parallel execution (independent schemas/policies)

**Estimated Output**: 15-20 numbered, ordered tasks focusing on database foundation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, verify RLS policies, performance validation)

## Complexity Tracking
*No constitutional violations detected - section left empty*

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
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*