---
description: "Implementation plan template for feature development"
scripts:
  sh: scripts/bash/update-agent-context.sh __AGENT__
  ps: scripts/powershell/update-agent-context.ps1 -AgentType __AGENT__
---

# Implementation Plan: Fraud Detection & Security

**Branch**: `018-step-5-3` | **Date**: 2025-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-step-5-3/spec.md`

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
Advanced fraud detection system with context-based legitimacy analysis, red flag keyword detection, and behavioral pattern monitoring. Security hardening includes comprehensive RLS policies, audit logging, intrusion detection, and data encryption at rest. System prevents reward processing for fraudulent feedback while maintaining real-time security monitoring and alerting.

## Technical Context
**Language/Version**: TypeScript with Node.js 18+  
**Primary Dependencies**: Next.js 14, Supabase client, Tailwind CSS, GPT-4o-mini API  
**Storage**: Supabase PostgreSQL with RLS policies  
**Testing**: Jest with TypeScript support  
**Target Platform**: Mobile web browsers, PWA-compatible browsers  
**Project Type**: web - determines source structure  
**Performance Goals**: Fraud detection <500ms, real-time monitoring <100ms, system alerts <2s  
**Constraints**: Real-time fraud scoring, encrypted data at rest, admin-only fraud settings  
**Scale/Scope**: Multi-tenant system, thousands of daily feedback submissions, comprehensive security audit trails
**Deployment**: Railway (backend), Vercel (frontend)
**Existing Architecture**: Monorepo with three apps (customer, business, admin) + shared packages

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Production from Day One**: Real fraud detection system with live scoring, actual RLS policies, production security monitoring  
✅ **Security & Privacy First**: Feature implements comprehensive security hardening - audit logging, intrusion detection, data encryption  
✅ **TypeScript Strict Mode**: All fraud detection and security services written in TypeScript with strict mode  
✅ **Real Data Only**: Integrates with existing Supabase database, real customer feedback, actual business context data  
✅ **Monorepo Architecture**: Extends existing customer/business/admin apps structure with fraud detection services  

**Gate Status**: PASS - All constitutional requirements satisfied

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
# Existing Vocilia Monorepo Structure (Option 2: Web application)
apps/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── fraud/          # NEW: Fraud detection services
│   │   │   └── security/       # NEW: Security hardening services
│   │   ├── routes/
│   │   │   ├── fraud/          # NEW: Fraud detection endpoints
│   │   │   └── security/       # NEW: Security endpoints
│   │   └── middleware/
│   │       └── fraud/          # NEW: Fraud detection middleware
│   └── tests/
├── customer/                   # Existing customer PWA
├── business/                   # Existing business dashboard
└── admin/                      # Existing admin interface
    ├── src/components/
    │   ├── fraud/              # NEW: Fraud monitoring UI
    │   └── security/           # NEW: Security dashboard UI
    └── tests/

packages/
├── database/
│   └── src/
│       ├── fraud/              # NEW: Fraud detection models
│       └── security/           # NEW: Security audit models
├── types/
│   └── src/
│       ├── fraud.ts            # NEW: Fraud detection types
│       └── security.ts         # NEW: Security types
└── ui/                         # Shared components

supabase/
└── migrations/
    ├── fraud_schema.sql        # NEW: Fraud detection tables
    └── security_policies.sql   # NEW: Enhanced RLS policies
```

**Structure Decision**: Option 2 (Web application) - Extends existing monorepo with fraud detection and security modules

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
   - Run `{SCRIPT}`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
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
- Each entity in data-model.md → Supabase migration task [P]
- Each API endpoint in contracts/ → contract test task [P]
- Each fraud detection component → service implementation task
- Each security component → middleware/service task
- Each user story in spec → integration test task
- Admin UI components for monitoring fraud/security events

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Database migrations → Models → Services → API routes → UI components
- Mark [P] for parallel execution (independent files)
- Security tasks have priority due to production security requirements

**Key Task Categories**:
1. **Database Foundation**: Migrations for fraud_scores, behavioral_patterns, audit_logs, etc.
2. **Contract Tests**: API endpoint validation for fraud analysis and security monitoring
3. **Fraud Detection Services**: Context analysis, keyword detection, behavioral pattern analysis
4. **Security Services**: Audit logging, intrusion detection, RLS policy implementation
5. **Integration Tests**: End-to-end fraud detection and security validation scenarios
6. **Admin Interface**: Fraud monitoring dashboard, security alert management

**Estimated Output**: 80 numbered, ordered tasks in tasks.md

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


## Post-Design Constitution Check
*GATE: Re-check after Phase 1 design complete*

✅ **Production from Day One**: Fraud detection system uses real Supabase database, actual customer feedback, production GPT-4o-mini API  
✅ **Security & Privacy First**: Enhanced RLS policies, comprehensive audit logging, intrusion detection, data encryption at rest  
✅ **TypeScript Strict Mode**: All fraud and security services strictly typed with proper interfaces  
✅ **Real Data Only**: Integrates with existing feedback submissions, stores, customers - no mock data  
✅ **Monorepo Architecture**: Extends existing apps/backend and apps/admin structure with new fraud/security modules  

**Gate Status**: PASS - All constitutional requirements maintained through design phase

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
- [x] Complexity deviations documented (N/A - no violations)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
