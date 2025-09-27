# Research: Advanced Question Logic Implementation

**Feature**: Step 5.2: Advanced Question Logic **Date**: 2025-09-24 **Status**:
Phase 0 Complete

## Research Findings

### 1. Question Time Estimation for Call Duration Optimization

**Decision**: Token-based time budgeting with empirical call duration data
**Rationale**:

- GPT-4o-mini has predictable token-to-time ratios in Swedish language calls
- Question complexity correlates with token usage (simple questions ~20-30
  tokens, complex ~50-80 tokens)
- 1-2 minute constraint translates to approximately 150-300 tokens total
  including responses
- Empirical data from existing calls shows ~2 tokens per second average speaking
  rate

**Implementation Approach**:

- Pre-calculate token estimates for all business questions
- Dynamic time budget allocation: start with priority questions, fill remaining
  time optimally
- Real-time adjustment based on customer response length patterns

**Alternatives Considered**:

- Fixed question counts: Too rigid, doesn't account for question complexity
  variation
- Machine learning prediction: Over-engineered for current scope, requires
  extensive training data

### 2. Topic Grouping Algorithms for Natural Conversation Flow

**Decision**: Semantic similarity using GPT-4o-mini embeddings with
business-defined topic categories **Rationale**:

- Leverages existing GPT-4o-mini infrastructure already in use for feedback
  analysis
- Allows businesses to define topic categories that match their store
  layout/operations
- Semantic embeddings handle synonym and related concept grouping automatically
- Cost-effective using batch embedding API calls during question setup

**Implementation Approach**:

- Embed all questions during business configuration
- Pre-compute similarity matrix for efficient runtime grouping
- Business-defined topic categories (e.g., "Service Quality", "Product
  Feedback", "Store Environment")
- Group questions by semantic similarity + business category for optimal flow

**Alternatives Considered**:

- Rule-based grouping: Too brittle, requires extensive manual configuration
- Separate ML model: Adds infrastructure complexity, licensing costs, latency

### 3. Priority System Integration with Existing Context Window

**Decision**: Weighted priority queue with time-remaining thresholds
**Rationale**:

- Integrates cleanly with existing question frequency system in context window
- 5-level priority scale (Critical=5, High=4, Medium=3, Low=2, Optional=1) maps
  to time thresholds
- Ensures critical questions always asked while optimizing remaining time
- Backwards compatible with existing business question configurations

**Implementation Approach**:

- Time threshold system: Critical questions (always ask), High (>60s remaining),
  Medium (>90s remaining), Low (>120s remaining)
- Priority weights influence question selection within time constraints
- Existing context window questions get default priority based on frequency
  setting
- Business can override priorities for specific questions

**Alternatives Considered**:

- Simple priority ordering: Wastes available call time by not filling optimally
- Complex scheduling algorithms: Over-engineered, difficult for businesses to
  understand

### 4. Dynamic Trigger System Performance Requirements

**Decision**: In-memory trigger evaluation cache with background rule
compilation **Rationale**:

- Sub-500ms requirement for real-time verification flow needs cached evaluation
- Purchase data, timing, and amount triggers have predictable patterns
- Background compilation allows complex trigger rules without blocking customer
  flow
- Cache invalidation on business rule changes maintains consistency

**Implementation Approach**:

- Compile trigger rules into JavaScript functions stored in Redis cache
- Evaluate triggers against customer data using cached functions
- Background service recompiles rules on business configuration changes
- Fallback to database rules if cache miss (with performance monitoring)

**Performance Targets**:

- Trigger evaluation: <100ms for complex multi-condition triggers
- Rule compilation: <5s background process
- Cache hit rate: >95% during normal operations

**Alternatives Considered**:

- Database lookup per request: Too slow for real-time requirement
- Complex event sourcing: Over-engineered, adds unnecessary complexity

### 5. Frequency Harmonization for Question Scheduling Conflicts

**Decision**: Business-configurable conflict resolution matrix with LCM fallback
**Rationale**:

- Businesses understand their customer flow patterns better than automated
  systems
- Provides intelligent defaults (Least Common Multiple) when no explicit
  configuration exists
- Allows granular control for important question pairs
- Maintains existing frequency settings while resolving conflicts

**Implementation Approach**:

- Configuration UI for businesses to set conflict resolution per question pair
- Default resolution using LCM (every 3rd + every 5th = every 15th with both
  questions)
- Conflict detection during question setup with business notification
- Runtime harmonization using configured rules

**Resolution Options for Businesses**:

- **Combine**: Ask both questions at LCM interval
- **Priority**: Always prioritize one question over another
- **Alternate**: Rotate between questions at conflicting intervals
- **Custom**: Business-defined interval for combined questions

**Alternatives Considered**:

- Always LCM: Inflexible, may create very long intervals (every 30th, every
  60th)
- Always business override: May cause conflicts if not properly configured

## Integration with Existing Vocilia Alpha Infrastructure

### Database Integration

- Extends existing Supabase schema with new tables for question logic
- Maintains existing RLS policies for security
- Uses existing business context window data as foundation

### API Integration

- New endpoints in existing apps/backend structure
- Integrates with current verification flow
- Maintains existing authentication and audit logging patterns

### Business Interface Integration

- Extends existing business dashboard with question logic configuration
- Uses established UI patterns and components
- Maintains consistency with current context window interface

### Performance Integration

- Leverages existing Redis infrastructure for caching
- Uses established monitoring and logging patterns
- Maintains existing performance SLA requirements

## Risk Assessment

### Technical Risks

- **Cache invalidation complexity**: Mitigated by background compilation and
  fallback mechanisms
- **Token estimation accuracy**: Mitigated by empirical data collection and
  adjustment algorithms
- **Trigger evaluation performance**: Mitigated by in-memory compilation and
  performance monitoring

### Business Risks

- **Configuration complexity**: Mitigated by intelligent defaults and guided
  setup UI
- **Question quality degradation**: Mitigated by priority system ensuring
  critical questions
- **Customer experience impact**: Mitigated by maintaining existing call
  duration limits

### Mitigation Strategies

- Extensive integration testing with existing question system
- Gradual rollout with business-by-business activation
- Performance monitoring with automatic fallback to simple question selection
- Business feedback integration for configuration refinement

## Success Metrics

### Technical Metrics

- Question combination processing: <500ms (95th percentile)
- Trigger evaluation: <100ms per customer
- Cache hit rate: >95%
- System availability: >99.9% (matches existing SLA)

### Business Metrics

- Average questions per call: Increase by 20-30% without extending call duration
- Question relevance score: >4.0/5.0 (business feedback)
- Business configuration adoption: >80% of businesses use advanced triggers
  within 30 days
- Customer satisfaction: No degradation from current baseline

### Operational Metrics

- Configuration error rate: <5% of business setups
- Support ticket volume: No increase from current question-related issues
- System resource usage: <20% increase in existing infrastructure costs

## Next Phase Readiness

**Phase 0 Status**: ✅ COMPLETE

- All technical unknowns resolved
- Architecture decisions documented
- Performance targets established
- Integration patterns identified

**Ready for Phase 1**: Design & Contracts

- Entity relationships clear from research
- API patterns identified for contract generation
- Database schema extensions planned
- Business interface requirements understood
