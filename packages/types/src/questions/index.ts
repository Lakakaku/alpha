// Custom Questions Configuration Panel Types
// Feature: 006-step-2-4

export type QuestionType = 'text' | 'rating' | 'multiple_choice' | 'yes_no';

export type QuestionStatus = 'draft' | 'active' | 'inactive' | 'archived';

export type QuestionPriority = 'high' | 'medium' | 'low';

export type FrequencyWindow = 'hourly' | 'daily' | 'weekly';

export type TriggerType =
  | 'purchase_amount'
  | 'time_based'
  | 'customer_visit'
  | 'product_category'
  | 'combination';

export type TriggerOperator = 'and' | 'or';

export type AnalyticsPeriodType = 'hourly' | 'daily' | 'weekly';

// Base interfaces
export interface QuestionCategory {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  color?: string; // Hex color code
  icon?: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomQuestion {
  id: string;
  business_id: string;
  store_id?: string;

  // Question Content
  question_text: string;
  question_type: QuestionType;
  formatting_options: Record<string, any>;

  // Organization
  category_id?: string;
  department?: string;
  priority: QuestionPriority;

  // Status & Lifecycle
  status: QuestionStatus;
  is_active: boolean;

  // Frequency Management
  frequency_target: number; // 1-100
  frequency_window: FrequencyWindow;
  frequency_current: number;
  frequency_reset_at?: string;

  // Scheduling
  active_start_date?: string; // Date string
  active_end_date?: string; // Date string
  active_hours_start?: string; // Time string
  active_hours_end?: string; // Time string
  active_days_of_week?: number[]; // Array of day numbers (0=Sunday, 6=Saturday)

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Relations (optional for populated queries)
  category?: QuestionCategory;
}

export interface QuestionTrigger {
  id: string;
  question_id: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>; // Flexible trigger configuration
  operator: TriggerOperator;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionResponse {
  id: string;
  question_id: string;
  business_id: string;
  store_id?: string;

  // Response Data
  response_text?: string;
  response_rating?: number; // 1-10
  response_value?: Record<string, any>;

  // Context
  customer_session_id?: string;
  trigger_context?: Record<string, any>;

  // Timing
  presented_at: string;
  responded_at?: string;

  // Status
  was_answered: boolean;
  was_skipped: boolean;
}

export interface QuestionAnalyticsSummary {
  id: string;
  question_id: string;
  business_id: string;
  store_id?: string;

  // Time Period
  period_start: string;
  period_end: string;
  period_type: AnalyticsPeriodType;

  // Metrics
  presentations_count: number;
  responses_count: number;
  skips_count: number;
  avg_response_time_seconds?: number;
  avg_rating?: number;
  response_rate: number; // Calculated field

  // Audit
  calculated_at: string;
}

// API Request/Response types
export interface CreateQuestionRequest {
  question_text: string;
  question_type: QuestionType;
  formatting_options?: Record<string, any>;
  category_id?: string;
  department?: string;
  priority: QuestionPriority;
  frequency_target: number;
  frequency_window?: FrequencyWindow;
  active_start_date?: string;
  active_end_date?: string;
  active_hours_start?: string;
  active_hours_end?: string;
  active_days_of_week?: number[];
  store_id?: string;
}

export interface UpdateQuestionRequest {
  question_text?: string;
  formatting_options?: Record<string, any>;
  category_id?: string;
  department?: string;
  priority?: QuestionPriority;
  status?: QuestionStatus;
  frequency_target?: number;
  frequency_window?: FrequencyWindow;
  active_start_date?: string;
  active_end_date?: string;
  active_hours_start?: string;
  active_hours_end?: string;
  active_days_of_week?: number[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CreateTriggerRequest {
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  operator?: TriggerOperator;
}

export interface QuestionPreview {
  html: string;
  estimated_completion_time: number; // seconds
  trigger_examples?: Array<{
    scenario: string;
    would_trigger: boolean;
  }>;
}

// List response types
export interface QuestionsListResponse {
  data: CustomQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CategoriesListResponse {
  data: QuestionCategory[];
}

export interface TriggersListResponse {
  data: QuestionTrigger[];
}

// Query parameters for API endpoints
export interface QuestionsListParams {
  store_id?: string;
  category_id?: string;
  status?: QuestionStatus;
  priority?: QuestionPriority;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'priority' | 'question_text';
  sort_order?: 'asc' | 'desc';
}

// Error types
export interface QuestionValidationError {
  field: string;
  message: string;
  code: string;
}

export interface QuestionApiError {
  error: string;
  message: string;
  details?: Record<string, any>;
  validation_errors?: QuestionValidationError[];
}

// Trigger configuration examples
export interface PurchaseAmountTrigger {
  type: 'purchase_amount';
  operator: '>=' | '>' | '<=' | '<' | '=';
  value: number;
  currency: string;
}

export interface TimeBasedTrigger {
  type: 'time_based';
  days_of_week: number[];
  time_start: string;
  time_end: string;
}

export interface CustomerVisitTrigger {
  type: 'customer_visit';
  operator: '>=' | '>' | '<=' | '<' | '=';
  value: number; // number of visits
}

export interface CombinationTrigger {
  type: 'combination';
  conditions: Array<PurchaseAmountTrigger | TimeBasedTrigger | CustomerVisitTrigger>;
  logic: 'and' | 'or';
}

// Utility types
export type AnyTriggerConfig =
  | PurchaseAmountTrigger
  | TimeBasedTrigger
  | CustomerVisitTrigger
  | CombinationTrigger;

// Advanced Question Logic Types (Step 5.2)
export * from './combination-rules';
export * from './dynamic-triggers';
export * from './activation-logs';
export * from './frequency-harmonizers';