# Research: Custom Questions Configuration Panel

**Phase 0 Research Results** | **Date**: 2025-09-21

## Research Overview
Investigation of technical approaches for implementing a custom questions configuration panel within the existing Vocilia monorepo architecture, focusing on integration with Supabase backend and Next.js 14 frontend.

## Key Research Areas

### 1. Rich Text Formatting Integration

**Decision**: React-based text input with Tailwind CSS styling
**Rationale**:
- Maintains consistency with existing Vocilia UI components
- Leverages existing Tailwind design system
- Avoids additional bundle size from third-party editors
- Provides adequate formatting capabilities for business questions

**Alternatives Considered**:
- Third-party rich text editors (Quill, TinyMCE, Draft.js)
  - Rejected: Adds complexity and bundle size
- Markdown-based approach
  - Rejected: Too technical for business users
- Plain text only
  - Rejected: Insufficient for question formatting needs

**Implementation Approach**:
- Build on existing UI component patterns from packages/ui
- Use Tailwind utility classes for text formatting options
- Support basic formatting: bold, italic, lists, paragraph breaks

### 2. Question Trigger Processing Architecture

**Decision**: Node.js backend service with real-time trigger evaluation
**Rationale**:
- Follows existing backend pattern for business logic
- Enables server-side validation and security
- Allows complex trigger conditions processing
- Integrates with existing authentication and RLS

**Alternatives Considered**:
- Client-side trigger processing
  - Rejected: Security concerns, business logic exposure
- Queue-based processing
  - Rejected: Adds complexity for real-time requirements
- Lambda/serverless functions
  - Rejected: Not aligned with current Railway deployment

**Implementation Approach**:
- Extend apps/backend with question trigger service
- Use existing middleware patterns for validation
- Cache trigger rules for performance optimization
- Real-time evaluation during customer interactions

### 3. Frequency Management System

**Decision**: Supabase PostgreSQL tables with RLS policies for frequency tracking
**Rationale**:
- Leverages existing RLS infrastructure for multi-tenant isolation
- Provides ACID guarantees for frequency counters
- Integrates seamlessly with current database architecture
- Enables real-time frequency updates

**Alternatives Considered**:
- Redis caching for frequency counters
  - Rejected: Adds infrastructure complexity
- In-memory frequency tracking
  - Rejected: Data loss risk, scaling issues
- Event-driven frequency processing
  - Rejected: Over-engineering for current requirements

**Implementation Approach**:
- Create dedicated tables for question frequency tracking
- Implement RLS policies for business-scoped access
- Use atomic database operations for counter updates
- Background cleanup for expired frequency windows

### 4. Question Preview Functionality

**Decision**: Shared component library between business and customer apps
**Rationale**:
- Ensures preview accuracy matches actual customer experience
- Leverages existing monorepo package sharing
- Maintains single source of truth for question rendering
- Enables consistent styling and behavior

**Alternatives Considered**:
- Mock preview implementation
  - Rejected: Risk of preview/reality mismatch
- Screenshot-based preview
  - Rejected: Performance and complexity concerns
- Iframe-based customer app embedding
  - Rejected: Security and styling complications

**Implementation Approach**:
- Extract question rendering components to packages/ui
- Import shared components in both business and customer apps
- Implement preview mode flags for business app context
- Maintain consistent styling across both interfaces

### 5. Database Schema Design

**Decision**: Normalized schema with separate tables for questions, categories, triggers, and schedules
**Rationale**:
- Follows existing database design patterns
- Enables efficient querying and indexing
- Supports complex relationships between entities
- Allows independent scaling of different aspects

**Key Tables**:
- `custom_questions`: Core question data with business association
- `question_categories`: Organizational grouping
- `question_triggers`: Conditional logic definitions
- `question_schedules`: Active periods and frequency constraints
- `question_analytics`: Usage tracking and metrics

**RLS Policies**:
- Business-scoped access for all question-related tables
- Role-based permissions within business organizations
- Audit trail for question modifications and usage

### 6. Performance Considerations

**Target Metrics**:
- Question configuration updates: <200ms response time
- Preview generation: <100ms rendering time
- Trigger evaluation: <50ms per question check
- Frequency counter updates: <10ms atomic operations

**Optimization Strategies**:
- Database indexing on frequently queried fields
- Caching of trigger rules and question configurations
- Lazy loading of question lists with pagination
- Optimistic UI updates for immediate feedback

## Technology Integration Points

### Existing Infrastructure Alignment
- **Supabase Integration**: Extends current RLS and authentication patterns
- **Next.js 14 App Router**: Uses existing routing and page structure
- **Railway Backend**: Follows current API endpoint and service patterns
- **Tailwind CSS**: Maintains design system consistency
- **TypeScript**: Strict mode compliance with existing type definitions

### Package Dependencies
- Extends packages/types with question-specific definitions
- Enhances packages/database with question data utilities
- Leverages packages/ui for shared component library
- Uses packages/auth for business authentication context

## Risk Assessment

### Low Risk
- UI component development (existing patterns)
- Database schema design (standard RLS approach)
- API endpoint creation (following current conventions)

### Medium Risk
- Trigger condition complexity (mitigated by thorough testing)
- Preview accuracy maintenance (addressed by shared components)
- Performance at scale (addressed by optimization strategies)

### High Risk
- None identified within scope of current requirements

## Research Conclusions

All technical approaches align with existing Vocilia architecture and constitutional requirements. No blockers identified for implementation. The proposed solution leverages proven patterns and technologies already in use within the monorepo.

**Next Phase**: Proceed to Phase 1 design and contract generation with confidence in technical approach.

---
**Research Complete**: All NEEDS CLARIFICATION items resolved