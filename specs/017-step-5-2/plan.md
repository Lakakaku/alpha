# Implementation Plan: Step 5.2: Advanced Question Logic

**Branch**: `017-step-5-2` | **Date**: 2025-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-step-5-2/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context ✓
3. Fill Constitution Check section ✓
4. Evaluate Constitution Check → Phase 0
5. Execute Phase 0 → research.md
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check
8. Plan Phase 2 approach
9. STOP - Ready for /tasks command
```

## Summary
Advanced Question Logic system that intelligently combines and triggers relevant questions for customer feedback calls based on purchase behavior, timing, and business rules. Features include a question combination engine with time optimization, topic grouping, priority balancing, and dynamic trigger system with purchase/time/amount-based activation within existing Vocilia Alpha Supabase architecture.

## Technical Context
**Language/Version**: TypeScript with Node.js 18+ (from existing Vocilia Alpha stack)
**Primary Dependencies**: Next.js 14, Supabase client, GPT-4o-mini API (existing project stack)
**Storage**: Supabase PostgreSQL with RLS policies (existing infrastructure)
**Testing**: Jest with TypeScript support (established in project)
**Target Platform**: Mobile web browsers, PWA-compatible (existing customer interface)
**Project Type**: web (extends existing monorepo: customer/business/admin apps + shared packages)
**Performance Goals**: <500ms for question combination logic, <2s for trigger processing, <1-2 minute total call duration
**Constraints**: Real-time processing during verification flow, must integrate with existing context window, maintain fraud detection compatibility
**Scale/Scope**: Handle existing customer base with multiple trigger conditions, support business configuration flexibility

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Production from Day One ✓
- Advanced question logic integrates with existing production Supabase database
- Real customer data and business rules from existing context window system
- No mock implementations - extends existing question/context infrastructure

### II. Security & Privacy First ✓
- Extends existing RLS policies for question and context data
- Business configuration access through established admin authentication
- Customer data handling follows existing privacy patterns

### III. TypeScript Strict Mode ✓
- All new logic components will be TypeScript strict mode
- Integration with existing typed Supabase client and Next.js infrastructure
- No `any` types, proper typing for all question/trigger interfaces

### IV. Real Data Only ✓
- Uses existing questions from business context windows
- Real purchase data from customer verification flow
- Actual business rules and trigger configurations

### V. Monorepo Architecture ✓
- Extends existing apps/backend services structure
- Adds to existing packages/types and packages/database
- No architectural changes to established customer/business/admin pattern

**GATE STATUS**: ✅ PASS - No constitutional violations detected

## Project Structure

### Documentation (this feature)
```
specs/017-step-5-2/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Web application structure (existing Vocilia Alpha monorepo)
apps/
├── backend/src/
│   ├── services/questions/      # NEW: Question combination logic
│   ├── services/triggers/       # NEW: Dynamic trigger system
│   ├── routes/questions/        # NEW: Question logic API endpoints
│   └── middleware/              # Extend existing with question processing
├── business/src/
│   ├── app/questions/           # NEW: Business question configuration UI
│   └── components/              # Extend existing for trigger config
└── admin/src/
    └── app/admin/               # Extend existing for system monitoring

packages/
├── database/src/
│   ├── questions/               # NEW: Question combination schemas
│   └── triggers/                # NEW: Dynamic trigger schemas
└── types/src/
    ├── questions.ts             # NEW: Question combination types
    └── triggers.ts              # NEW: Dynamic trigger types

tests/
├── contract/                    # API contract tests
├── integration/                 # End-to-end question flow tests
└── unit/                       # Question logic unit tests
```

**Structure Decision**: Option 2 (Web application) - extends existing Vocilia Alpha monorepo structure

## Phase 0: Outline & Research

### Research Tasks Identified:
1. **Question Time Estimation**: Research optimal time allocation algorithms for 1-2 minute constraint
2. **Topic Grouping Algorithms**: Best practices for semantic question grouping in conversational AI
3. **Priority System Integration**: How to integrate 5-level priority system with existing context window
4. **Real-time Trigger Processing**: Performance patterns for sub-500ms trigger evaluation
5. **Supabase RLS for Question Logic**: Extend existing RLS patterns for new question entities

### Research Execution:

**Decision 1: Time Constraint Optimization**
- **Decision**: Token-based time budgeting with empirical call duration data
- **Rationale**: GPT-4o-mini calls have predictable token→time ratios, allowing precise duration prediction
- **Alternatives considered**: Fixed question counts (too rigid), machine learning prediction (overkill for scope)

**Decision 2: Topic Grouping Algorithm**
- **Decision**: Semantic similarity using existing GPT-4o-mini embeddings with business-defined topic categories
- **Rationale**: Leverages existing AI infrastructure, allows business control over groupings
- **Alternatives considered**: Rule-based grouping (too brittle), separate ML model (adds complexity)

**Decision 3: Priority Balancing System**
- **Decision**: Weighted queue with time-remaining thresholds triggering higher-priority questions
- **Rationale**: Ensures critical questions asked first while allowing optimization when time permits
- **Alternatives considered**: Simple priority ordering (wastes available time), complex scheduling (over-engineered)

**Decision 4: Frequency Harmonization**
- **Decision**: Business-configurable conflict resolution matrix with LCM fallback
- **Rationale**: Gives businesses control while providing intelligent defaults
- **Alternatives considered**: Always LCM (inflexible), always business override (may cause conflicts)

**Decision 5: Real-time Processing Architecture**
- **Decision**: In-memory trigger evaluation cache with background rule compilation
- **Rationale**: Sub-500ms response requirement needs cached evaluation, background compilation prevents blocking
- **Alternatives considered**: Database lookup per request (too slow), complex event sourcing (over-engineered)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

**Status**: ✅ COMPLETE

### 1. Data Model Design ✅
- **Output**: `data-model.md`
- **Entities**: 8 core entities with full schema definitions
- **Relationships**: Complete ERD with foreign key constraints
- **Security**: RLS policies for all new tables
- **Performance**: Optimized indexes and caching strategy

### 2. API Contract Generation ✅
- **Output**: `contracts/question-combination-api.yaml`
- **Endpoints**: 12 RESTful endpoints with OpenAPI 3.0.3 spec
- **Schemas**: Complete request/response validation
- **Security**: Bearer token authentication with role-based access

### 3. Test Scenario Extraction ✅
- **Output**: `quickstart.md`
- **Scenarios**: 8 comprehensive integration test scenarios
- **Coverage**: All user stories and acceptance criteria
- **Performance**: Load testing and rollback procedures

### 4. Agent Context Update ✅
- **Output**: Updated `CLAUDE.md`
- **Stack**: TypeScript/Node.js + Next.js 14 + Supabase
- **Architecture**: Extends existing Vocilia Alpha monorepo

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Database schema tasks: 8 new tables + 2 table extensions
- Contract test tasks: 12 API endpoints requiring validation
- Service implementation tasks: question combination engine, trigger system
- UI extension tasks: business configuration interface
- Integration test tasks: 8 quickstart scenarios

**Ordering Strategy**:
- TDD order: Tests before implementation
- Database first: Schema → Models → Services → APIs → UI
- Parallel execution: Independent services marked [P]
- Critical path: Core combination engine before trigger system

**Estimated Output**: 35-40 numbered, ordered tasks in tasks.md

**Key Task Categories**:
1. Database Migration Tasks (8 tasks)
2. Model Creation Tasks (8 tasks) [P]
3. Contract Test Tasks (12 tasks) [P]
4. Service Implementation Tasks (10 tasks)
5. API Endpoint Tasks (6 tasks)
6. UI Extension Tasks (4 tasks)
7. Integration Test Tasks (8 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Progress Tracking

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
- [ ] Complexity deviations documented (none required)

**Generated Artifacts**:
- [x] `/specs/017-step-5-2/plan.md` (this file)
- [x] `/specs/017-step-5-2/research.md`
- [x] `/specs/017-step-5-2/data-model.md`
- [x] `/specs/017-step-5-2/contracts/question-combination-api.yaml`
- [x] `/specs/017-step-5-2/quickstart.md`
- [x] Updated `/CLAUDE.md`

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
