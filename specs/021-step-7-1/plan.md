---
description: 'Implementation plan template for feature development'
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: Comprehensive Testing System

**Branch**: `021-step-7-1` | **Date**: 2025-09-26 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/021-step-7-1/spec.md`

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

Implement comprehensive testing infrastructure across three levels: unit testing
for individual components, integration testing for end-to-end workflows, and
performance testing for load scenarios. System must validate all components of
the Vocilia Alpha customer feedback reward system including QR scanning,
AI-powered feedback calls, payment processing, and admin operations with
synthetic test data, automated execution on every commit, and deployment
blocking on any test failure.

## Technical Context

**Language/Version**: TypeScript 5.0+ with Node.js 18+ (backend), Next.js 14
(frontend) **Primary Dependencies**: Jest, Playwright, Lighthouse, Artillery
(load testing), existing Supabase/Railway/Vercel infrastructure **Storage**:
Supabase PostgreSQL with existing RLS policies **Testing**: Jest for
unit/integration, Playwright for E2E, Artillery for performance testing **Target
Platform**: Railway (backend services), Vercel (frontend apps), mobile web
browsers **Project Type**: web - existing monorepo with customer/business/admin
apps + shared packages **Performance Goals**: API responses <1s, page loads <3s,
risk-based test coverage **Constraints**: Tests run on every commit, block
deployments on failures, synthetic test data only **Scale/Scope**: Existing
3-app monorepo, comprehensive coverage of QR→AI call→payment flow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**✅ Production from Day One**: Testing infrastructure uses real project
structure and existing environments (Supabase/Railway/Vercel) **✅ Security &
Privacy First**: Tests validate existing RLS policies and authentication, no new
security vulnerabilities introduced **✅ TypeScript Strict Mode**: All test code
written in TypeScript with strict mode, existing codebase standards maintained
**✅ Real Data Only**: Tests use synthetic data generators but validate against
real database schemas and API contracts **✅ Monorepo Architecture**: Testing
extends existing three-app structure (customer/business/admin) + shared packages
**✅ Testing Requirements**: Implements TDD principles with contract tests,
integration tests, unit tests as required **✅ Performance Standards**:
Validates constitutional performance targets (API <500ms upgraded to <1s, pages
<3s) **✅ Deployment Standards**: Integrates with existing
Railway/Vercel/Supabase deployment pipeline

**Status**: PASS - No constitutional violations detected

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

**Structure Decision**: Option 2 (Web application) - Existing monorepo with
backend/, customer/, business/, admin/ apps + shared packages/

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
   - Run `{SCRIPT}` **IMPORTANT**: Execute it exactly as specified above. Do not
     add or remove any arguments.
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
- Generate tasks from Phase 1 design docs (data-model.md, contracts/,
  quickstart.md)
- Testing infrastructure setup tasks (Jest, Playwright, Artillery configuration)
- Test data generation setup (Faker.js generators for Swedish locale)
- Contract test tasks for each API endpoint [P]
- Unit test creation for core testing components [P]
- Integration test setup for test execution pipeline
- E2E test scenarios from quickstart validation steps
- Performance testing configuration and benchmark setup
- CI/CD integration for automated test execution on commits

**Ordering Strategy**:

- TDD order: Test infrastructure → Contract tests → Implementation → Integration
- Infrastructure first: Test frameworks before test code
- Data layer: Test data generators before tests that use them
- API layer: Contract tests before integration tests
- Frontend layer: Component tests before E2E workflows
- Performance layer: Benchmarks before load testing scenarios
- Mark [P] for parallel execution (independent test suites)

**Component-Specific Tasks**:

- **Shared packages**: Testing types, data generators, test utilities
- **Backend API**: Contract tests, unit tests for services, integration tests
- **Customer app**: Component tests, E2E workflows, PWA performance tests
- **Business app**: Dashboard testing, context window validation
- **Admin app**: Security testing, admin workflow validation

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md covering all
testing layers

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

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
