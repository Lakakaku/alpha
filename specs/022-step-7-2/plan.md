---
description: 'Implementation plan template for feature development'
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: Security & Privacy Testing

**Branch**: `022-step-7-2` | **Date**: 2025-09-27 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/022-step-7-2/spec.md`

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

Comprehensive security and privacy testing framework for the Vocilia customer
feedback system. Testing includes penetration testing for
authentication/authorization, data privacy protection validation, GDPR
compliance verification, vulnerability assessment, and fraud detection security.
Framework provides 72-hour GDPR deletion validation, full AI model security
testing, weekly automated vulnerability scans, and supports up to 10%
performance degradation during testing operations.

## Technical Context

**Language/Version**: TypeScript 5.5.4, Node.js 18+ **Primary Dependencies**:
Jest 29.7+, Playwright 1.55+, Supertest 6.3+, Express 4.18+, Supabase client
2.39+, OWASP ZAP, Artillery 2.0+ **Storage**: Supabase PostgreSQL with RLS
policies, Redis for session management **Testing**: Jest for unit/integration
tests, Playwright for e2e security tests, Supertest for API security testing
**Target Platform**: Linux servers (Railway backend), Web browsers (Vercel
frontend), Supabase cloud database **Project Type**: web - monorepo with backend
API + three frontend apps (admin, business, customer) **Performance Goals**:
≤10% performance degradation during security testing, weekly automated scans
**Constraints**: 72-hour GDPR deletion response time, full admin access for
security testers, Swedish data protection compliance **Scale/Scope**:
Multi-tenant system with admin/business/customer roles, AI feedback processing
security, payment system testing

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Production from Day One**: ✅ PASS - Security testing framework tests real
production authentication, authorization, and data flows **Security & Privacy
First**: ✅ PASS - Feature explicitly implements security testing for RLS
policies, authentication, and privacy compliance **TypeScript Strict Mode**: ✅
PASS - All security test code will use TypeScript 5.5.4 with strict mode enabled
**Real Data Only**: ✅ PASS - Tests validate real customer data protection,
actual session management, and live GDPR compliance **Monorepo Architecture**:
✅ PASS - Security tests integrate with existing apps/backend, apps/admin
structure without breaking changes

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

**Structure Decision**: Option 2 (Web application) - Backend security testing in
apps/backend/src/testing/, Frontend security testing in apps/\*/tests/, Admin
security dashboard in apps/admin/src/app/security/

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
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Security test infrastructure setup tasks [P]
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Security Testing Task Categories**:

1. **Infrastructure Setup** [P]: OWASP ZAP, Playwright security testing, Jest
   configuration
2. **Contract Tests** [P]: API security endpoint testing, privacy compliance
   endpoint testing
3. **Entity Models** [P]: SecurityTestCase, PrivacyAssessment,
   GDPRComplianceRecord, etc.
4. **Authentication Security**: Brute force protection, session management,
   password reset security
5. **Authorization Testing**: Business data isolation, admin privilege
   boundaries, RLS policy testing
6. **Privacy Protection**: Phone number protection, feedback anonymization,
   transaction data security
7. **GDPR Compliance**: 72-hour deletion testing, data export validation,
   consent management
8. **AI Model Security**: Prompt injection protection, training data security,
   model boundary testing
9. **Vulnerability Assessment**: OWASP Top 10 scanning, SQL injection testing,
   file upload security
10. **Performance Monitoring**: ≤10% impact validation, weekly scan automation

**Ordering Strategy**:

- TDD order: Security tests before implementation
- Infrastructure setup before functional tests
- Model creation before service implementation
- Core security before specialized testing (AI, GDPR)
- Mark [P] for parallel execution (independent test files)

**Estimated Output**: 42 numbered, ordered tasks in tasks.md

**Constitutional Compliance Tasks**:

- All security test code in TypeScript strict mode
- Real production data validation (no mocks)
- Integration with existing monorepo structure
- Supabase RLS policy testing
- Performance validation for production readiness

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
- [ ] Complexity deviations documented

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
