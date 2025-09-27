# Research: Step 5.1 GPT-4o-mini Integration

**Date**: 2025-09-23  
**Feature**: AI-powered phone call system for customer feedback collection  
**Status**: Phase 0 Complete

## Research Areas

### 1. OpenAI GPT-4o-mini Voice Integration

**Decision**: Use OpenAI Realtime API with GPT-4o-mini for Swedish voice
conversations **Rationale**:

- Native Swedish language support with natural conversation flow
- Real-time audio processing eliminates transcription latency
- Proven reliability for 1-2 minute call duration requirements
- Built-in conversation management and context retention

**Alternatives Considered**:

- Text-to-speech + Chat API: Rejected due to latency and complexity
- Third-party Swedish voice AI: Rejected due to integration complexity
- Pre-recorded responses: Rejected due to lack of natural dialogue

**Implementation Pattern**:

- WebSocket connection to OpenAI Realtime API
- Express.js middleware for call session management
- Async queue for concurrent call handling

### 2. Phone System Integration Architecture

**Decision**: Integrate with 46elks (Swedish telephony) via existing
fortysixelks-node package **Rationale**:

- Already present in apps/backend dependencies
- Swedish market focus aligns with business requirements
- Proven integration with existing verification system
- Cost-effective for unlimited concurrent calls per store

**Alternatives Considered**:

- Twilio: Rejected due to higher cost and non-Swedish focus
- Custom VoIP: Rejected due to complexity and reliability concerns
- WebRTC direct: Rejected due to mobile compatibility issues

**Implementation Pattern**:

- Extend existing phone number validation utilities
- Queue-based retry mechanism (3 attempts max per clarification)
- Integration with existing audit logging system

### 3. Conversation Flow Management

**Decision**: State machine pattern with Redis-backed session storage
**Rationale**:

- Maintains conversation context across connection interruptions
- Supports dynamic question generation based on business context
- Enables proper failure handling and retry logic
- Scales with unlimited concurrent calls requirement

**Alternatives Considered**:

- In-memory sessions: Rejected due to Railway container restarts
- Database sessions: Rejected due to latency concerns for real-time calls
- Stateless approach: Rejected due to conversation quality requirements

**Implementation Pattern**:

- Session state stored in Redis with 90-day TTL (per clarification)
- Event-driven conversation flow with context injection
- Graceful degradation for session recovery

### 4. AI Feedback Analysis System

**Decision**: Multi-stage OpenAI Chat API pipeline with JSON-mode responses
**Rationale**:

- Structured output for consistent grading (2-15% scale)
- Separate analysis steps for legitimacy, depth, usefulness
- Deterministic fraud detection using business context validation
- Full automation capability (no manual review per clarification)

**Alternatives Considered**:

- Single-prompt analysis: Rejected due to inconsistent scoring
- Rule-based scoring: Rejected due to limited adaptability
- External ML models: Rejected due to Swedish language requirements

**Implementation Pattern**:

- Pipeline: transcription → legitimacy check → quality analysis → grading
- JSON schema validation for structured responses
- Automatic summarization for qualifying feedback

### 5. Integration with Existing Verification Workflow

**Decision**: Event-driven integration using existing Supabase triggers and
services **Rationale**:

- Minimal disruption to existing customer verification flow
- Immediate call initiation (per clarification) via database triggers
- Maintains existing RLS policies and security patterns
- Leverages established audit logging and monitoring

**Alternatives Considered**:

- Polling-based integration: Rejected due to latency requirements
- Direct API calls: Rejected due to coupling concerns
- Message queue: Rejected due to infrastructure complexity

**Implementation Pattern**:

- Supabase function triggers on verification completion
- Webhook endpoint in apps/backend for call initiation
- Integration with existing @vocilia/database patterns

### 6. Business Analysis and Reporting

**Decision**: Scheduled weekly analysis jobs using existing job scheduler
pattern **Rationale**:

- Aligns with existing weekly verification cycle
- Batch processing efficiency for large feedback volumes
- Integration with existing business dashboard in apps/business
- Natural language query support via OpenAI embeddings

**Alternatives Considered**:

- Real-time analysis: Rejected due to cost and complexity
- Manual report generation: Rejected due to automation requirements
- Third-party analytics: Rejected due to data privacy concerns

**Implementation Pattern**:

- Extend existing job scheduler for weekly analysis
- Vector embeddings for searchable feedback archive
- Integration with existing business analytics dashboard

## Technical Architecture Summary

```
Customer Verification (Existing)
    ↓ (immediate trigger)
AI Call Initiation (New)
    ↓ (46elks + OpenAI Realtime)
Conversation Management (New)
    ↓ (session completion)
Feedback Analysis Pipeline (New)
    ↓ (quality score + summary)
Weekly Business Analysis (New)
    ↓ (integration)
Business Dashboard (Enhanced)
```

## Dependencies Required

### New Dependencies

- `redis`: Session storage for conversation state
- `ioredis`: Redis client with TypeScript support
- `@openai/realtime-api-beta`: OpenAI Realtime API integration

### Existing Dependencies (Leverage)

- `openai`: Already present for chat-based analysis
- `fortysixelks-node`: Already present for phone integration
- `@supabase/supabase-js`: Database and trigger integration
- `@vocilia/*` packages: Types, database queries, shared utilities

## Performance Considerations

- **Call Concurrency**: Unlimited per store (per clarification)
- **Response Time**: <500ms for API endpoints, immediate call initiation
- **Data Retention**: 90 days for call transcripts and assessments
- **Retry Logic**: Maximum 3 total attempts (2 retries) per customer

## Security & Privacy Alignment

- **Phone Number Privacy**: Maintained through existing RLS policies
- **AI Data Processing**: Encrypted at rest, 90-day automatic deletion
- **Conversation Privacy**: No business access to raw transcripts
- **Audit Trail**: Full integration with existing audit logging system

---

**Research Complete**: All technical unknowns resolved and architecture
decisions documented. **Next Phase**: Design & Contracts (data model, API
contracts, test scenarios)
