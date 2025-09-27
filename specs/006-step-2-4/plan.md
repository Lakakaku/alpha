# Implementation Plan: Custom Questions Configuration Panel

**Branch**: `006-step-2-4` | **Date**: 2025-09-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/lucasjenner/alpha/specs/006-step-2-4/spec.md`

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
A comprehensive custom questions configuration panel that allows business managers to create, organize, and manage dynamic feedback questions with rich formatting, advanced trigger conditions, and real-time preview capabilities. The system integrates with existing Supabase infrastructure using Next.js 14 frontend and Node.js backend services.

## Technical Context
**Language/Version**: TypeScript 5.5+ with Next.js 14, Node.js
**Primary Dependencies**: Next.js 14, React 18, Supabase PostgreSQL, Tailwind CSS, Railway (backend)
**Storage**: Supabase PostgreSQL with Row Level Security (RLS)
**Testing**: Jest with integration tests and contract validation
**Target Platform**: Web application (Vercel frontend, Railway backend)
**Project Type**: web - existing monorepo structure with apps/business frontend and apps/backend services
**Performance Goals**: <200ms question configuration updates, real-time preview rendering
**Constraints**: Must integrate with existing business authentication, RLS policies mandatory, TypeScript strict mode
**Scale/Scope**: Support for unlimited questions per business, complex trigger logic, multi-store management

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Production from Day One**: Using existing Supabase instance with real data and RLS policies
✅ **TypeScript Strict Mode**: All code must pass strict TypeScript compilation
✅ **Real Data Only**: Integrating with actual Supabase database, no mock implementations
✅ **Monorepo Architecture**: Extending existing apps/business and apps/backend structure
✅ **Technology Stack**: Next.js 14 frontend (Vercel), Node.js backend (Railway), Tailwind CSS
✅ **Security First**: RLS policies for multi-tenant question management

No constitutional violations detected - feature aligns with existing architecture and requirements.

## Project Structure

### Documentation (this feature)
```
specs/006-step-2-4/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 2: Web application (existing monorepo structure)
apps/backend/
├── src/
│   ├── routes/questions/     # Question management API endpoints
│   ├── services/questions/   # Question logic and trigger processing
│   ├── middleware/          # Question validation and RLS
│   └── models/              # Question data models
└── tests/

apps/business/
├── src/
│   ├── app/questions/       # Question management pages
│   ├── components/questions/ # Question UI components
│   ├── hooks/               # Question-specific React hooks
│   └── services/            # Question API client
└── tests/

packages/
├── types/src/questions/     # Question TypeScript definitions
└── database/src/questions/  # Question database utilities
```

**Structure Decision**: Option 2 - Extending existing web application monorepo structure

## Phase 0: Outline & Research

**Research tasks resolved through existing codebase analysis:**

1. **Rich text formatting approach**: React-based text editor integration with Next.js 14
   - Decision: Use existing UI components pattern with Tailwind CSS
   - Rationale: Consistency with current business app design system
   - Alternatives considered: Third-party editors (rejected for simplicity)

2. **Trigger condition processing**: Real-time evaluation system
   - Decision: Node.js backend service with cached trigger rules
   - Rationale: Existing backend pattern for business logic
   - Alternatives considered: Client-side processing (rejected for security)

3. **Question frequency management**: Database-driven frequency tracking
   - Decision: Supabase tables with RLS policies for frequency counters
   - Rationale: Leverages existing RLS infrastructure
   - Alternatives considered: Redis caching (rejected for consistency)

4. **Preview functionality**: Server-side rendering simulation
   - Decision: Shared component library between business and customer apps
   - Rationale: Ensures preview accuracy with actual customer interface
   - Alternatives considered: Mock preview (rejected for accuracy)

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

**Data Model Entities**:
- Custom Question: Text content, formatting, metadata, status, business association
- Question Category: Organizational grouping with business scope
- Question Trigger: Conditional logic for question presentation
- Question Schedule: Active periods and frequency management
- Question Analytics: Usage tracking and response metrics

**API Contract Generation**:
- POST /api/questions - Create new question
- GET /api/questions - List questions with filtering
- PUT /api/questions/:id - Update question configuration
- DELETE /api/questions/:id - Soft delete question
- POST /api/questions/:id/preview - Generate question preview
- GET/POST/PUT/DELETE /api/questions/categories - Category management
- POST /api/questions/triggers - Configure trigger conditions

**Contract Tests**: One test file per endpoint validating request/response schemas

**Integration Tests**: User story validation covering complete question lifecycle

**Agent Context Update**: Incremental update to existing CLAUDE.md with question management context

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md update

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each API contract → contract test task [P]
- Each data entity → database migration and model task [P]
- Each user story → integration test task
- Implementation tasks to make contract tests pass
- Frontend component tasks for question management UI
- Backend service tasks for trigger processing logic

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Database migrations → models → services → API → UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 28-32 numbered, ordered tasks in tasks.md

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
- [x] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*