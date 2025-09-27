# Research: AI Assistant Interface (Context Builder)

**Date**: 2025-09-21 **Feature**: AI Assistant Interface for business context
building **Research Status**: Complete

## GPT-4o-mini Integration Patterns

### Decision: OpenAI API with streaming responses

**Rationale**:

- Existing project already uses GPT-4o-mini for customer feedback calls
- Streaming provides better UX for chat interface (<3s target response time)
- Native TypeScript SDK with proper error handling
- Cost-effective for conversational interactions

**Alternatives considered**:

- Azure OpenAI (more enterprise features but higher latency)
- Local LLM (offline capability but resource intensive)
- Anthropic Claude (good quality but different API patterns)

**Implementation approach**:

- Use OpenAI SDK with streaming for chat responses
- Implement conversation context management (conversation history)
- Add retry logic and error handling for API failures
- Cache common AI suggestions to reduce API costs

## Real-time Auto-save Architecture

### Decision: Optimistic updates with Supabase real-time

**Rationale**:

- Aligns with existing Supabase architecture
- Built-in conflict resolution for concurrent edits
- RLS policies ensure proper data isolation
- Real-time subscriptions for multi-session continuity

**Alternatives considered**:

- WebSocket-based custom solution (more complex, reinventing wheel)
- Periodic polling (higher latency, more server load)
- Local storage only (data loss risk)

**Implementation approach**:

- Use Supabase real-time subscriptions for conversation updates
- Implement optimistic UI updates with rollback on failure
- Debounce save operations (500ms) to reduce database writes
- Store conversation state in normalized database schema

## Context Validation Scoring Algorithm

### Decision: Weighted scoring with domain-specific rules

**Rationale**:

- Provides actionable 0-100% completeness score
- Allows for different business types (grocery vs electronics)
- Extensible rule system for new validation criteria
- Fast computation (<2s requirement)

**Alternatives considered**:

- AI-based scoring (too slow and expensive for real-time)
- Simple field counting (not nuanced enough)
- External validation service (adds complexity and latency)

**Implementation approach**:

- Define weighted scoring matrix for different context categories
- Store business type-specific validation rules in database
- Calculate score synchronously in backend API
- Return specific improvement suggestions with each score

## Conversation State Management

### Decision: Event-sourced conversation history

**Rationale**:

- Complete audit trail for debugging and improvement
- Enables conversation replay and analysis
- Supports undo/redo functionality
- Scales well for concurrent conversations

**Alternatives considered**:

- Simple message array (limited replay capabilities)
- Redux-style state snapshots (larger storage overhead)
- Server-side session storage (lost on server restart)

**Implementation approach**:

- Store conversation events (message_sent, context_updated, suggestion_accepted)
- Reconstruct current state from event stream
- Use Supabase for persistence with RLS policies
- Implement event compaction for storage efficiency

## Fraud Detection Configuration UI

### Decision: Guided wizard with AI suggestions

**Rationale**:

- Complex configuration made accessible to business users
- AI can suggest appropriate thresholds based on business type
- Step-by-step approach reduces configuration errors
- Builds on existing fraud detection system

**Alternatives considered**:

- Single form with all options (overwhelming for users)
- Preset templates only (not flexible enough)
- Expert mode only (too complex for business users)

**Implementation approach**:

- Multi-step wizard: business type → baseline facts → thresholds → validation
- AI suggests red flag keywords based on store context
- Preview mode shows how configuration affects validation
- Store configuration as structured JSON with versioning

## Performance Optimization Strategies

### Decision: Multi-level caching with background processing

**Rationale**:

- Meets <3s response time requirement
- Reduces OpenAI API costs through suggestion caching
- Background processing prevents UI blocking
- Scales to concurrent business managers

**Alternatives considered**:

- Synchronous processing only (too slow for complex validations)
- Client-side processing (limited by browser capabilities)
- Queue-based async (adds complexity for real-time features)

**Implementation approach**:

- Cache common AI suggestions by business type (Redis/Supabase)
- Background validation scoring with real-time updates
- Debounced API calls to prevent rate limiting
- Progressive loading for context sections

## Technology Integration Points

### Existing Supabase Schema Extension

- Extend existing RLS policies for conversation data
- Reuse business authentication and store context
- Leverage existing audit logging patterns

### Next.js 14 App Router Integration

- Build as new route in apps/business: `/context/ai-assistant`
- Use existing Tailwind CSS components and design system
- Integrate with existing business dashboard navigation

### Shared Package Utilization

- Extend @vocilia/types for conversation and context entities
- Use @vocilia/auth for business authentication and permissions
- Leverage @vocilia/database for data access patterns

## Research Completeness

✅ **AI Integration**: OpenAI API patterns researched and decided ✅ **Real-time
Features**: Supabase real-time architecture confirmed ✅ **Performance**:
Caching and optimization strategies defined ✅ **State Management**:
Event-sourced conversation history approach ✅ **UI/UX Patterns**: Guided wizard
and chat interface patterns ✅ **Data Architecture**: Extension of existing
Supabase schema ✅ **Testing Strategy**: Contract and integration test patterns
✅ **Security**: RLS policies and data isolation approaches

**No remaining unknowns** - Ready for Phase 1 design and contracts.
