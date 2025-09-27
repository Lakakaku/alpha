---
description: 'Implementation plan template for feature development'
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: QR Code Landing & Verification System

**Branch**: `009-step-3-1` | **Date**: 2025-09-22 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/009-step-3-1/spec.md`

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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by
other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Mobile-optimized customer landing page for QR code verification system with
transaction validation (±2 min time, ±2 SEK amount) and Swedish phone number
input. Built as customer-facing frontend with backend API for verification
processing.

## Technical Context

**Language/Version**: TypeScript 5.5.4, Node.js 18+  
**Primary Dependencies**: Next.js 14, React 18, Express.js, Supabase client,
Tailwind CSS  
**Storage**: Supabase PostgreSQL with Row Level Security (RLS)  
**Testing**: Jest with ts-jest, contract testing for API endpoints  
**Target Platform**: Mobile web browsers, deployed to Vercel (frontend) +
Railway (backend) **Project Type**: web - existing monorepo with apps/customer
(Next.js) + apps/backend (Express API)  
**Performance Goals**: <2s page load, <500ms API response, mobile-first
responsive design  
**Constraints**: Mobile-optimized UI, Swedish phone validation, real-time form
validation  
**Scale/Scope**: Single landing page + verification form, 3 API endpoints,
Swedish market focus

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Production from Day One**: ✅ PASS

- No mock data or prototypes - using real Supabase database
- Real transaction validation with actual tolerances (±2 min, ±2 SEK)
- Production-ready phone number validation for Swish integration

**Security & Privacy First**: ✅ PASS

- RLS policies required for all database operations
- Phone numbers secured, not shared with businesses during verification
- Proper input validation and sanitization

**TypeScript Strict Mode**: ✅ PASS

- All code must pass TypeScript 5.5.4 strict compilation
- No `any` types except documented external APIs
- Type safety from database to frontend

**Real Data Only**: ✅ PASS

- Using actual Supabase PostgreSQL with RLS
- Real transaction data processing
- No local databases or mock implementations

**Monorepo Architecture**: ✅ PASS

- Leveraging existing apps/customer (Next.js) + apps/backend (Express)
- Frontend to Vercel, backend to Railway deployment
- Shared packages for types and utilities

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Using existing
apps/customer (Next.js frontend) + apps/backend (Express API)

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `{SCRIPT}` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md,
agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Database tasks: Create migrations for verification_sessions,
  customer_verifications, fraud_detection_logs tables
- API contract tasks: Implement 3 endpoints (/qr/verify, /verification/submit,
  /verification/session) [P]
- Frontend tasks: QR landing page, verification form, error handling components
  [P]
- Integration tasks: End-to-end user story validation from quickstart.md

**Ordering Strategy**:

- Database first: Migrations and RLS policies before API implementation
- TDD order: Contract tests before endpoint implementation
- Frontend after API: Components depend on working backend endpoints
- Parallel execution for independent components marked [P]
- Integration tests last: Validate complete user flows

**Specific Task Categories**:

1. **Database Setup** (3-4 tasks): Table migrations, RLS policies, indexes
2. **Backend API** (8-10 tasks): Contract tests, endpoint implementation,
   validation logic
3. **Frontend Components** (6-8 tasks): Landing page, form components, error
   handling
4. **Integration** (4-5 tasks): User story validation, performance testing
5. **Security & Validation** (3-4 tasks): Input sanitization, rate limiting,
   fraud detection

**Estimated Output**: 24-31 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional
principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance
validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

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

**Deliverables Created**:

- [x] research.md - QR handling, Swedish phone validation, mobile UX patterns
- [x] data-model.md - Database schema with RLS policies for verification
      entities
- [x] contracts/qr-verification.openapi.yaml - API specification for 3 endpoints
- [x] quickstart.md - User story validation tests and performance criteria
- [x] CLAUDE.md - Updated agent context with feature technology stack

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
