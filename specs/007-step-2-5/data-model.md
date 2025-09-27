# Data Model: AI Assistant Interface (Context Builder)

**Date**: 2025-09-21 **Feature**: AI Assistant Interface for business context
building **Database**: Supabase PostgreSQL with Row Level Security

## Core Entities

### ai_conversations

Primary entity for tracking chat sessions between business managers and AI
assistant.

```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  store_id UUID REFERENCES stores(id), -- null for multi-store conversations
  title TEXT, -- auto-generated from first few messages
  status conversation_status NOT NULL DEFAULT 'active',
  completeness_score INTEGER CHECK (completeness_score >= 0 AND completeness_score <= 100),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE conversation_status AS ENUM ('active', 'paused', 'completed', 'archived');
```

**Validation Rules**:

- business_id must exist and be verified
- completeness_score between 0-100
- store_id must belong to business if specified
- title auto-generated from conversation content

**State Transitions**:

- active → paused (manual pause)
- active → completed (validation passed)
- completed → active (reopened for updates)
- any → archived (cleanup)

### ai_conversation_messages

Event-sourced message history for complete conversation replay.

```sql
CREATE TABLE ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_type message_type NOT NULL,
  sender_type sender_type NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE message_type AS ENUM ('text', 'suggestion', 'validation', 'context_update');
CREATE TYPE sender_type AS ENUM ('user', 'assistant');

CREATE UNIQUE INDEX ai_conversation_messages_sequence
ON ai_conversation_messages(conversation_id, sequence_number);
```

**Validation Rules**:

- sequence_number must be unique per conversation
- content structure varies by message_type
- metadata contains typing indicators, API response times, etc.

### business_context_entries

Structured storage for extracted business information from conversations.

```sql
CREATE TABLE business_context_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  store_id UUID REFERENCES stores(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  category context_category NOT NULL,
  subcategory TEXT,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_type source_type NOT NULL DEFAULT 'conversation',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE context_category AS ENUM (
  'store_profile', 'personnel', 'layout', 'inventory', 'operations',
  'customer_journey', 'fraud_detection', 'seasonal_variations'
);

CREATE TYPE source_type AS ENUM ('conversation', 'ai_inference', 'manual_input', 'system_default');

CREATE UNIQUE INDEX business_context_unique_key
ON business_context_entries(business_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'), category, key);
```

**Validation Rules**:

- key must be unique per business/store/category combination
- confidence_score between 0.0-1.0
- value structure defined by category/subcategory
- store_id must belong to business if specified

### ai_suggestions

AI-generated recommendations for context improvements and question optimization.

```sql
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  store_id UUID REFERENCES stores(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  suggestion_type suggestion_type NOT NULL,
  category context_category,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_data JSONB,
  priority priority_level NOT NULL DEFAULT 'medium',
  status suggestion_status NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE suggestion_type AS ENUM (
  'context_gap', 'question_recommendation', 'fraud_improvement',
  'frequency_optimization', 'validation_enhancement'
);

CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE suggestion_status AS ENUM ('pending', 'accepted', 'rejected', 'implemented');
```

**Validation Rules**:

- title and description required for user display
- action_data contains implementation details as JSON
- status transitions: pending → (accepted|rejected) → implemented

### context_validation_results

Scoring and validation results for business context completeness.

```sql
CREATE TABLE context_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  store_id UUID REFERENCES stores(id),
  conversation_id UUID REFERENCES ai_conversations(id),
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  category_scores JSONB NOT NULL, -- scores per context_category
  missing_requirements JSONB NOT NULL, -- array of missing required fields
  improvement_suggestions JSONB NOT NULL, -- array of specific actions
  fraud_readiness_score INTEGER CHECK (fraud_readiness_score >= 0 AND fraud_readiness_score <= 100),
  validation_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Validation Rules**:

- overall_score calculated from weighted category_scores
- missing_requirements array of {category, field, importance} objects
- improvement_suggestions array of actionable recommendation objects
- fraud_readiness_score based on baseline facts completeness

## Relationships

### Primary Relationships

- ai_conversations → businesses (many-to-one)
- ai_conversations → stores (many-to-one, optional)
- ai_conversation_messages → ai_conversations (many-to-one)
- business_context_entries → businesses (many-to-one)
- business_context_entries → ai_conversations (many-to-one, optional)
- ai_suggestions → businesses (many-to-one)
- ai_suggestions → ai_conversations (many-to-one, optional)
- context_validation_results → businesses (many-to-one)
- context_validation_results → ai_conversations (many-to-one, optional)

### Cross-Feature Integration

- Extends existing businesses and stores tables
- Links to existing business authentication system
- Integrates with existing context management (from feature 006-step-2-4)

## Row Level Security (RLS) Policies

### ai_conversations

```sql
-- Business managers can only access their own business conversations
CREATE POLICY ai_conversations_business_access ON ai_conversations
  FOR ALL USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permission_type IN ('admin', 'write_context')
    )
  );
```

### ai_conversation_messages

```sql
-- Access through conversation ownership
CREATE POLICY ai_conversation_messages_access ON ai_conversation_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM ai_conversations c
      WHERE c.business_id IN (
        SELECT bs.business_id
        FROM business_stores bs
        WHERE bs.user_id = auth.uid()
        AND bs.permission_type IN ('admin', 'write_context')
      )
    )
  );
```

### business_context_entries

```sql
-- Business managers can manage context for their businesses
CREATE POLICY business_context_entries_access ON business_context_entries
  FOR ALL USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permission_type IN ('admin', 'write_context')
    )
  );
```

### ai_suggestions

```sql
-- Suggestions visible to business with context permissions
CREATE POLICY ai_suggestions_access ON ai_suggestions
  FOR ALL USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permission_type IN ('admin', 'write_context')
    )
  );
```

### context_validation_results

```sql
-- Validation results accessible to business managers
CREATE POLICY context_validation_results_access ON context_validation_results
  FOR ALL USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permission_type IN ('admin', 'write_context')
    )
  );
```

## Data Consistency Rules

### Conversation Integrity

- Messages must maintain sequential ordering within conversation
- Conversation completeness_score auto-updates on context changes
- Store-specific conversations require store ownership validation

### Context Entry Consistency

- Duplicate key prevention within business/store/category scope
- Confidence score updates when AI re-evaluates information
- Verification status tracked for manual confirmations

### Validation Synchronization

- Validation results invalidate when context entries change
- Background re-scoring triggers on significant context updates
- Category scores aggregate to overall completeness score

## Performance Considerations

### Indexing Strategy

```sql
-- Conversation lookup by business
CREATE INDEX ai_conversations_business_active
ON ai_conversations(business_id, status, last_message_at DESC);

-- Message ordering for conversation replay
CREATE INDEX ai_conversation_messages_sequence_order
ON ai_conversation_messages(conversation_id, sequence_number);

-- Context entry lookup by category
CREATE INDEX business_context_entries_category
ON business_context_entries(business_id, store_id, category, updated_at DESC);

-- Suggestion prioritization
CREATE INDEX ai_suggestions_priority
ON ai_suggestions(business_id, status, priority, created_at DESC);
```

### Query Optimization

- Conversation messages paginated (50 messages per request)
- Context entries loaded by category to reduce payload
- Suggestions filtered by status and priority
- Validation results cached with TTL

## Migration Strategy

### Phase 1: Core Tables

1. Create enum types
2. Create ai_conversations table with RLS
3. Create ai_conversation_messages with event sourcing
4. Create indexes for conversation queries

### Phase 2: Context Storage

1. Create business_context_entries with categories
2. Create ai_suggestions with recommendation types
3. Create context_validation_results for scoring
4. Establish foreign key relationships

### Phase 3: Data Population

1. Migrate existing context data (if any)
2. Create default validation rules
3. Set up background scoring jobs
4. Validate RLS policy effectiveness

## Testing Data Requirements

### Contract Test Data

- Sample conversations with various message types
- Context entries covering all categories
- Suggestions with different priorities and statuses
- Validation results with realistic scores

### Integration Test Scenarios

- Multi-session conversation continuity
- Concurrent context updates by multiple users
- RLS policy enforcement across all entities
- Data consistency during conversation replay
