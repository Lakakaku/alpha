# Implementation Plan: QR Code Management System

**Branch**: `004-step-2-2` | **Date**: 2025-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-step-2-2/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

## Summary
QR Code Management System for Vocilia Alpha businesses to generate, download, monitor, and manage unique QR codes for each store location. Includes analytics tracking, bulk operations for multi-location businesses, and printable formats for physical display.

## Technical Context
**Language/Version**: TypeScript 5.5+ (Next.js 14, Node.js 18+)  
**Primary Dependencies**: React 18, Supabase Client, @supabase/auth-helpers-nextjs, Tailwind CSS, qrcode, jspdf, canvas, react-qr-code  
**Storage**: Supabase PostgreSQL with existing stores table and new qr_analytics, qr_history tables  
**Testing**: Jest with React Testing Library, Playwright for E2E  
**Target Platform**: Vercel (frontend), Railway (backend), Supabase (database)  
**Project Type**: web - monorepo with apps/business frontend and apps/backend services  
**Performance Goals**: <200ms QR generation, 5-minute analytics updates, <2MB PDF downloads  
**Constraints**: Real-time scan tracking, 24-hour transition grace period, RLS compliance  
**Scale/Scope**: 1000+ stores, 10k+ QR scans/day, bulk operations for 50+ stores

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ **Production from Day One**: Real Supabase database with RLS policies, actual QR code generation
- ✅ **Security & Privacy First**: RLS for multi-tenant QR access, no customer data in QR analytics
- ✅ **TypeScript Strict Mode**: All new code with strict TypeScript, no any types
- ✅ **Real Data Only**: Extending existing stores table, real QR scan tracking
- ✅ **Monorepo Architecture**: Extends existing apps/business and packages structure

## Project Structure

### Documentation (this feature)
```
specs/004-step-2-2/
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
apps/backend/
├── src/
│   ├── services/qr/     # QR generation and analytics services
│   ├── routes/qr/       # QR management API endpoints
│   └── utils/pdf/       # PDF template generation
└── tests/

apps/business/
├── src/
│   ├── components/qr/   # QR display and management components
│   ├── pages/qr/        # QR management pages
│   └── services/qr/     # Frontend QR service layer
└── tests/

packages/
├── database/src/qr/     # QR-related database utilities
├── types/src/qr/        # QR-related TypeScript types
└── ui/src/qr/          # Shared QR UI components
```

**Structure Decision**: Option 2 (Web application) - extends existing monorepo apps/business and apps/backend

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - QR code transition periods (RESOLVED: 24-hour grace period)
   - Analytics update frequency (RESOLVED: 5-minute intervals)
   - Print format specifications (RESOLVED: PDF primary format)
   - Template customization options (RESOLVED: Store info + business branding)

2. **Generate and dispatch research agents**:
   - Research QR code generation best practices for Node.js/React
   - Find PDF generation patterns for printable QR templates
   - Analyze analytics aggregation strategies for real-time dashboards
   - Investigate bulk operation patterns for multi-store management

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - QR Code entity with store linking and status tracking
   - QR Analytics for scan tracking and aggregation
   - QR History for audit trail
   - Print Template configurations

2. **Generate API contracts** from functional requirements:
   - GET /api/qr/stores/{storeId} - Retrieve QR code for store
   - POST /api/qr/stores/{storeId}/regenerate - Generate new QR code
   - GET /api/qr/stores/{storeId}/download - Download printable PDF
   - GET /api/qr/analytics/{storeId} - Get scan analytics
   - POST /api/qr/bulk/regenerate - Bulk QR operations
   - POST /api/qr/scan - Track QR code scan

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each acceptance scenario → integration test
   - QR generation and download workflow validation

5. **Update CLAUDE.md incrementally**:
   - Add QR management feature context
   - Include new libraries and dependencies
   - Document QR-specific development patterns

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Database schema tasks: QR analytics and history tables with RLS
- Backend API tasks: QR generation, analytics aggregation, PDF creation
- Frontend component tasks: QR display, management dashboard, bulk operations
- Integration tasks: QR scan tracking, analytics updates, PDF downloads
- Testing tasks: Contract tests, integration tests, E2E workflows

**Ordering Strategy**:
- Database schema and migrations first
- Backend QR services before frontend components
- Contract tests before implementation
- Analytics aggregation after basic QR management
- Bulk operations after single-store functionality

**Estimated Output**: 30-35 numbered, ordered tasks covering full QR management system

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation following TDD approach with real Supabase integration  
**Phase 5**: Validation with QR generation testing and analytics verification

## Complexity Tracking
*No constitutional violations identified*

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