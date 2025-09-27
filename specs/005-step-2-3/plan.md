---
description: "Implementation plan template for feature development"
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: Business Context Window (Core Feature)

**Branch**: `005-step-2-3` | **Date**: 2025-09-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/lucasjenner/alpha/specs/005-step-2-3/spec.md`

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
Business Context Window provides comprehensive store configuration interface for AI-powered feedback collection. Extends existing Supabase/Next.js monorepo with new business dashboard sections for store profile, personnel, layout, and inventory management. Uses existing authentication and database patterns.

## Technical Context
**Language/Version**: TypeScript 5.5+, Node.js 18+, React 18  
**Primary Dependencies**: Next.js 14, Express, Supabase, Tailwind CSS, Radix UI, React Query  
**Storage**: Supabase PostgreSQL with Row Level Security (RLS)  
**Testing**: Jest with ts-jest, Supertest for API testing  
**Target Platform**: Vercel (frontend), Railway (backend), existing "alpha" projects  
**Project Type**: web (extends existing apps/business + apps/backend)  
**Performance Goals**: <200ms form saves, real-time context updates, <2MB page loads  
**Constraints**: Multi-tenant RLS, existing auth patterns, monorepo structure  
**Scale/Scope**: Multi-store businesses, complex store layouts, 6 entity types, 4 major UI sections

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Production from Day One**: Using existing Supabase "alpha" instance with RLS policies  
✅ **Security & Privacy First**: Context data isolated per business, no PII exposure  
✅ **TypeScript Strict Mode**: All new code follows existing strict TypeScript patterns  
✅ **Real Data Only**: Extends existing RLS schema, no mock implementations  
✅ **Monorepo Architecture**: Extends apps/business and apps/backend with shared packages  
✅ **Stack Requirements**: Uses existing Next.js 14, Express, Supabase, Tailwind stack  
✅ **Deployment Architecture**: Follows existing Vercel/Railway deployment patterns

## Project Structure

### Documentation (this feature)
```
specs/005-step-2-3/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Existing Vocilia Monorepo Structure (Extended)
apps/
├── business/           # Next.js 14 business dashboard (EXTENDED)
│   ├── src/
│   │   ├── components/
│   │   │   └── context/     # NEW: Store context management components
│   │   ├── pages/
│   │   │   └── context/     # NEW: Context configuration pages
│   │   └── services/        # NEW: Context API integration
│   └── tests/              # NEW: Context feature tests
├── backend/               # Express API server (EXTENDED)
│   ├── src/
│   │   ├── routes/
│   │   │   └── context/     # NEW: Context management endpoints
│   │   └── services/
│   │       └── context/     # NEW: Context validation & processing
│   └── tests/              # NEW: Context API tests
└── admin/                 # Admin interface (unchanged)

packages/
├── types/                 # TypeScript definitions (EXTENDED)
│   └── src/
│       └── context/       # NEW: Context entity types
├── database/              # Database utilities (EXTENDED)
│   └── src/
│       └── context/       # NEW: Context schema & queries
└── auth/                  # Authentication (EXTENDED)
    └── src/
        └── context/       # NEW: Context access permissions
```

**Structure Decision**: Option 2 (Web application) - Extends existing Vocilia monorepo with business context functionality

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
*Prerequisites: research.md complete*

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

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


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

**Artifacts Generated**:
- [x] research.md - Existing codebase analysis and technology decisions
- [x] data-model.md - Entity relationships and database schema design
- [x] contracts/context-api.yaml - OpenAPI specification for context management
- [x] quickstart.md - Integration test scenarios and validation steps

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
