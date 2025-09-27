# Data Model: Custom Questions Configuration Panel

**Phase 1 Design** | **Date**: 2025-09-21

## Database Schema Design

### Core Tables

#### 1. custom_questions

Primary table for storing business-created feedback questions.

```sql
CREATE TABLE custom_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- Optional store-specific questions

  -- Question Content
  question_text TEXT NOT NULL CHECK (length(question_text) >= 10 AND length(question_text) <= 500),
  question_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (question_type IN ('text', 'rating', 'multiple_choice', 'yes_no')),
  formatting_options JSONB DEFAULT '{}', -- Rich text formatting metadata

  -- Organization
  category_id UUID REFERENCES question_categories(id) ON DELETE SET NULL,
  department VARCHAR(100), -- Store department/area tag
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Status & Lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  is_active BOOLEAN NOT NULL DEFAULT false,

  -- Frequency Management
  frequency_target INTEGER NOT NULL CHECK (frequency_target >= 1 AND frequency_target <= 100),
  frequency_window VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency_window IN ('hourly', 'daily', 'weekly')),
  frequency_current INTEGER NOT NULL DEFAULT 0,
  frequency_reset_at TIMESTAMPTZ,

  -- Scheduling
  active_start_date DATE,
  active_end_date DATE,
  active_hours_start TIME,
  active_hours_end TIME,
  active_days_of_week INTEGER[], -- Array of day numbers (0=Sunday, 6=Saturday)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (active_start_date IS NULL OR active_end_date IS NULL OR active_start_date <= active_end_date),
  CONSTRAINT valid_frequency_reset CHECK (frequency_reset_at > NOW() - INTERVAL '7 days')
);

-- Indexes
CREATE INDEX idx_custom_questions_business_active ON custom_questions(business_id, is_active);
CREATE INDEX idx_custom_questions_store_priority ON custom_questions(store_id, priority) WHERE is_active = true;
CREATE INDEX idx_custom_questions_frequency_reset ON custom_questions(frequency_reset_at) WHERE frequency_current > 0;
CREATE INDEX idx_custom_questions_category ON custom_questions(category_id);
```

#### 2. question_categories

Organizational grouping for questions within a business.

```sql
CREATE TABLE question_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Category Details
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code
  icon VARCHAR(50), -- Icon identifier

  -- Organization
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_business_category_name UNIQUE(business_id, name),
  CONSTRAINT valid_color_code CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Indexes
CREATE INDEX idx_question_categories_business_sort ON question_categories(business_id, sort_order);
```

#### 3. question_triggers

Conditional logic for when questions should be presented.

```sql
CREATE TABLE question_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES custom_questions(id) ON DELETE CASCADE,

  -- Trigger Definition
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('purchase_amount', 'time_based', 'customer_visit', 'product_category', 'combination')),
  trigger_config JSONB NOT NULL, -- Flexible trigger configuration

  -- Conditions
  operator VARCHAR(20) NOT NULL DEFAULT 'and' CHECK (operator IN ('and', 'or')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_question_triggers_question ON question_triggers(question_id);
CREATE INDEX idx_question_triggers_type_enabled ON question_triggers(trigger_type, is_enabled);
```

#### 4. question_responses

Store customer responses to custom questions (for analytics).

```sql
CREATE TABLE question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES custom_questions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- Response Data
  response_text TEXT,
  response_rating INTEGER CHECK (response_rating >= 1 AND response_rating <= 10),
  response_value JSONB, -- Flexible response storage

  -- Context
  customer_session_id UUID, -- Anonymous session tracking
  trigger_context JSONB, -- What triggered this question

  -- Timing
  presented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,

  -- Status
  was_answered BOOLEAN NOT NULL DEFAULT false,
  was_skipped BOOLEAN NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX idx_question_responses_question_date ON question_responses(question_id, presented_at DESC);
CREATE INDEX idx_question_responses_business_store ON question_responses(business_id, store_id, presented_at DESC);
```

#### 5. question_analytics_summary

Aggregated analytics for question performance.

```sql
CREATE TABLE question_analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES custom_questions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- Time Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly')),

  -- Metrics
  presentations_count INTEGER NOT NULL DEFAULT 0,
  responses_count INTEGER NOT NULL DEFAULT 0,
  skips_count INTEGER NOT NULL DEFAULT 0,
  avg_response_time_seconds INTEGER,
  avg_rating DECIMAL(3,2),

  -- Calculated Fields
  response_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN presentations_count > 0
    THEN responses_count::DECIMAL / presentations_count
    ELSE 0 END
  ) STORED,

  -- Audit
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_period CHECK (period_start < period_end),
  CONSTRAINT valid_counts CHECK (presentations_count >= responses_count + skips_count)
);

-- Indexes
CREATE INDEX idx_question_analytics_question_period ON question_analytics_summary(question_id, period_start DESC);
CREATE INDEX idx_question_analytics_business_period ON question_analytics_summary(business_id, period_type, period_start DESC);
```

## Row Level Security (RLS) Policies

### custom_questions

```sql
-- Enable RLS
ALTER TABLE custom_questions ENABLE ROW LEVEL SECURITY;

-- Business users can manage their own questions
CREATE POLICY "business_questions_access" ON custom_questions
  FOR ALL
  USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permissions ? 'write_context'
    )
  );

-- Store-specific access for multi-store businesses
CREATE POLICY "store_questions_access" ON custom_questions
  FOR ALL
  USING (
    store_id IS NULL OR store_id IN (
      SELECT bs.store_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
    )
  );
```

### question_categories

```sql
ALTER TABLE question_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_categories_access" ON question_categories
  FOR ALL
  USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
    )
  );
```

### question_triggers

```sql
ALTER TABLE question_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_triggers_access" ON question_triggers
  FOR ALL
  USING (
    question_id IN (
      SELECT q.id FROM custom_questions q
      WHERE q.business_id IN (
        SELECT bs.business_id
        FROM business_stores bs
        WHERE bs.user_id = auth.uid()
      )
    )
  );
```

### question_responses

```sql
ALTER TABLE question_responses ENABLE ROW LEVEL SECURITY;

-- Business analytics access
CREATE POLICY "business_responses_read" ON question_responses
  FOR SELECT
  USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permissions ? 'view_analytics'
    )
  );

-- Customer app can insert responses
CREATE POLICY "customer_responses_insert" ON question_responses
  FOR INSERT
  WITH CHECK (true); -- Controlled by application logic
```

### question_analytics_summary

```sql
ALTER TABLE question_analytics_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_analytics_access" ON question_analytics_summary
  FOR SELECT
  USING (
    business_id IN (
      SELECT bs.business_id
      FROM business_stores bs
      WHERE bs.user_id = auth.uid()
      AND bs.permissions ? 'view_analytics'
    )
  );
```

## Data Relationships

### Entity Relationships

- **Business (1) → (N) Custom Questions**: Business ownership
- **Store (1) → (N) Custom Questions**: Optional store-specific questions
- **Question Category (1) → (N) Custom Questions**: Organizational grouping
- **Custom Question (1) → (N) Question Triggers**: Multiple trigger conditions
- **Custom Question (1) → (N) Question Responses**: Response tracking
- **Custom Question (1) → (N) Analytics Summary**: Performance metrics

### Key Constraints

- Questions must belong to authenticated business
- Store-specific questions inherit business permissions
- Triggers must have valid JSON configuration
- Frequency limits enforced at application level
- Analytics calculated from response data

## Validation Rules

### Question Content

- Text length: 10-500 characters
- Question types: text, rating, multiple_choice, yes_no
- Status progression: draft → active → inactive/archived

### Frequency Management

- Target frequency: 1-100 customers per window
- Window types: hourly, daily, weekly
- Automatic reset based on window type

### Scheduling

- Date ranges must be valid (start ≤ end)
- Time ranges optional for daily scheduling
- Days of week as integer array (0-6)

### Trigger Configuration

Examples of trigger_config JSONB:

```json
// Purchase amount trigger
{
  "type": "purchase_amount",
  "operator": ">=",
  "value": 100,
  "currency": "SEK"
}

// Time-based trigger
{
  "type": "time_based",
  "days_of_week": [1, 2, 3, 4, 5],
  "time_start": "09:00",
  "time_end": "17:00"
}

// Combination trigger
{
  "type": "combination",
  "conditions": [
    {"type": "purchase_amount", "operator": ">=", "value": 50},
    {"type": "customer_visit", "operator": ">=", "value": 3}
  ],
  "logic": "and"
}
```

---

**Data Model Complete**: Ready for contract generation
