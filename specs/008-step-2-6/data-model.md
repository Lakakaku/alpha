# Data Model: Feedback Analysis Dashboard

**Feature**: 008-step-2-6 **Date**: 2025-09-21 **Status**: Draft

## Entity Definitions

### Feedback Record (extends existing)

**Purpose**: Individual customer feedback with analysis metadata **Storage**:
Supabase `feedback` table (existing, to be extended)

**Core Fields**:

- `id`: UUID (primary key)
- `store_id`: UUID (foreign key to stores)
- `business_id`: UUID (foreign key to businesses)
- `content`: TEXT (feedback text)
- `transaction_time`: TIMESTAMPTZ
- `transaction_value`: DECIMAL
- `phone_hash`: TEXT (anonymized)
- `created_at`: TIMESTAMPTZ
- `week_number`: INTEGER (for weekly grouping)
- `year`: INTEGER (for yearly partitioning)

**New Analysis Fields**:

- `sentiment`: ENUM('positive', 'negative', 'neutral', 'mixed')
- `department_tags`: TEXT[] (array of department references)
- `ai_summary`: TEXT (GPT-4o-mini generated summary)
- `priority_score`: INTEGER (1-10 based on business impact)
- `analysis_status`: ENUM('pending', 'processing', 'completed', 'failed')
- `processed_at`: TIMESTAMPTZ

**Relationships**:

- belongs_to: Store (via store_id)
- belongs_to: Business (via business_id)
- has_many: FeedbackInsights (via feedback_id)

**Validation Rules**:

- content: minimum 10 characters, maximum 5000 characters
- sentiment: required after analysis processing
- department_tags: extracted from content via AI analysis
- week_number: calculated from created_at timestamp
- analysis_status: defaults to 'pending' on creation

### Analysis Report

**Purpose**: AI-generated weekly summary with categorized insights **Storage**:
Supabase `analysis_reports` table (new)

**Fields**:

- `id`: UUID (primary key)
- `store_id`: UUID (foreign key to stores)
- `business_id`: UUID (foreign key to businesses)
- `week_number`: INTEGER
- `year`: INTEGER
- `positive_summary`: TEXT
- `negative_summary`: TEXT
- `general_opinions`: TEXT
- `new_critiques`: TEXT[]
- `actionable_insights`: JSONB
- `total_feedback_count`: INTEGER
- `sentiment_breakdown`: JSONB (counts by sentiment)
- `department_breakdown`: JSONB (feedback by department)
- `trend_comparison`: JSONB (week-over-week changes)
- `generated_at`: TIMESTAMPTZ
- `created_at`: TIMESTAMPTZ

**Relationships**:

- belongs_to: Store (via store_id)
- belongs_to: Business (via business_id)
- has_many: Feedback (via week_number, year, store_id)

**Validation Rules**:

- week_number: 1-53, based on ISO week calendar
- year: current year ± 5 years
- sentiment_breakdown: {"positive": int, "negative": int, "neutral": int,
  "mixed": int}
- actionable_insights: [{"title": str, "description": str, "priority": int}]

### Search Query

**Purpose**: User search history and natural language processing **Storage**:
Supabase `search_queries` table (new)

**Fields**:

- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to business users)
- `store_id`: UUID (foreign key to stores)
- `business_id`: UUID (foreign key to businesses)
- `query_text`: TEXT (original user input)
- `processed_query`: JSONB (parsed search parameters)
- `results_count`: INTEGER
- `execution_time_ms`: INTEGER
- `created_at`: TIMESTAMPTZ

**Relationships**:

- belongs_to: BusinessUser (via user_id)
- belongs_to: Store (via store_id)
- belongs_to: Business (via business_id)

**Validation Rules**:

- query_text: minimum 1 character, maximum 500 characters
- processed_query: {"departments": str[], "sentiment": str, "date_range": obj}
- execution_time_ms: positive integer

### Temporal Comparison

**Purpose**: Week-over-week analysis and trend tracking **Storage**: Computed
view `temporal_comparisons` (new)

**Fields**:

- `store_id`: UUID
- `business_id`: UUID
- `current_week`: INTEGER
- `current_year`: INTEGER
- `previous_week`: INTEGER
- `previous_year`: INTEGER
- `sentiment_change`: JSONB (current vs previous counts)
- `new_issues`: TEXT[] (issues not in previous week)
- `resolved_issues`: TEXT[] (issues from previous not in current)
- `trend_direction`: ENUM('improving', 'declining', 'stable')
- `computed_at`: TIMESTAMPTZ

**Relationships**:

- references: AnalysisReport (current week)
- references: AnalysisReport (previous week)

**Validation Rules**:

- current_week/previous_week: valid ISO week numbers
- sentiment_change: percentage changes between weeks
- trend_direction: calculated based on overall sentiment shift

### Insight

**Purpose**: Actionable recommendations derived from feedback analysis
**Storage**: Supabase `feedback_insights` table (new)

**Fields**:

- `id`: UUID (primary key)
- `store_id`: UUID (foreign key to stores)
- `business_id`: UUID (foreign key to businesses)
- `feedback_id`: UUID (foreign key to feedback)
- `insight_type`: ENUM('improvement', 'issue', 'opportunity', 'trend')
- `title`: VARCHAR(200)
- `description`: TEXT
- `priority_level`: ENUM('low', 'medium', 'high', 'critical')
- `department`: VARCHAR(100)
- `suggested_actions`: TEXT[]
- `confidence_score`: DECIMAL(3,2) (0.00-1.00)
- `status`: ENUM('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed')
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

**Relationships**:

- belongs_to: Store (via store_id)
- belongs_to: Business (via business_id)
- belongs_to: Feedback (via feedback_id)

**Validation Rules**:

- title: required, minimum 5 characters
- confidence_score: between 0.00 and 1.00
- suggested_actions: array of actionable text items
- priority_level: determined by confidence_score and business impact

## Database Schema Changes

### New Tables

```sql
-- Analysis Reports table
CREATE TABLE analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  positive_summary TEXT,
  negative_summary TEXT,
  general_opinions TEXT,
  new_critiques TEXT[],
  actionable_insights JSONB DEFAULT '[]'::jsonb,
  total_feedback_count INTEGER DEFAULT 0,
  sentiment_breakdown JSONB DEFAULT '{}'::jsonb,
  department_breakdown JSONB DEFAULT '{}'::jsonb,
  trend_comparison JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, week_number, year)
);

-- Search Queries table
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  processed_query JSONB DEFAULT '{}'::jsonb,
  results_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback Insights table
CREATE TABLE feedback_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  insight_type insight_type_enum NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority_level priority_level_enum NOT NULL,
  department VARCHAR(100),
  suggested_actions TEXT[],
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  status insight_status_enum DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Extended Tables

```sql
-- Add analysis fields to existing feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS sentiment sentiment_enum;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS department_tags TEXT[];
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 5;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS analysis_status analysis_status_enum DEFAULT 'pending';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS year INTEGER;
```

### Indexes for Performance

```sql
-- Analysis Reports indexes
CREATE INDEX idx_analysis_reports_store_week ON analysis_reports(store_id, week_number, year);
CREATE INDEX idx_analysis_reports_business ON analysis_reports(business_id);

-- Feedback analysis indexes
CREATE INDEX idx_feedback_analysis_status ON feedback(analysis_status);
CREATE INDEX idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX idx_feedback_week ON feedback(week_number, year);
CREATE INDEX idx_feedback_department_tags ON feedback USING GIN(department_tags);

-- Search Queries indexes
CREATE INDEX idx_search_queries_user_store ON search_queries(user_id, store_id);
CREATE INDEX idx_search_queries_created ON search_queries(created_at);

-- Feedback Insights indexes
CREATE INDEX idx_insights_store_priority ON feedback_insights(store_id, priority_level);
CREATE INDEX idx_insights_status ON feedback_insights(status);
```

### Row Level Security (RLS) Policies

```sql
-- Analysis Reports RLS
ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysis_reports_business_access" ON analysis_reports
  FOR ALL USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()));

-- Search Queries RLS
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_queries_user_access" ON search_queries
  FOR ALL USING (user_id = auth.uid());

-- Feedback Insights RLS
ALTER TABLE feedback_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights_business_access" ON feedback_insights
  FOR ALL USING (business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid()));
```

## State Transitions

### Feedback Analysis Lifecycle

1. **pending** → **processing**: When AI analysis job starts
2. **processing** → **completed**: When analysis finishes successfully
3. **processing** → **failed**: When analysis encounters errors
4. **failed** → **pending**: When retry is requested

### Insight Status Lifecycle

1. **new** → **acknowledged**: Business user views insight
2. **acknowledged** → **in_progress**: Business takes action
3. **in_progress** → **resolved**: Issue is addressed
4. **new/acknowledged** → **dismissed**: Business rejects insight

### Report Generation Lifecycle

1. Weekly cron job triggers analysis for completed week
2. Aggregate all feedback for store/week combination
3. Generate AI summaries for each sentiment category
4. Identify new critiques by comparing with previous week
5. Calculate trend comparisons and sentiment changes
6. Store complete analysis report with metadata
