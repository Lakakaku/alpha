// Dynamic Trigger Types
// Feature: Step 5.2: Advanced Question Logic

export type TriggerType = 'purchase_based' | 'time_based' | 'amount_based';

export type ComparisonOperator = '>=' | '<=' | '==' | '>' | '<' | 'between';

export interface DynamicTrigger {
  id: string;
  business_context_id: string;
  trigger_name: string;
  trigger_type: TriggerType;
  priority_level: number; // 1-5 (1=Optional, 5=Critical)
  sensitivity_threshold: number; // Every Nth customer (1-100)
  is_active: boolean;
  trigger_config: PurchaseBasedConfig | TimeBasedConfig | AmountBasedConfig;
  effectiveness_score: number; // 0.0-1.0
  created_at: string;
  updated_at: string;
}

export interface TriggerCondition {
  id: string;
  trigger_id: string;
  condition_key: string;
  condition_operator: string;
  condition_value: string;
  is_required: boolean;
  created_at: string;
}

// Trigger Configuration Types

export interface PurchaseBasedConfig {
  type: 'purchase_based';
  categories: string[]; // e.g., ["meat", "bakery", "produce"]
  required_items?: string[]; // Specific item names
  minimum_items?: number; // Minimum items from category
}

export interface TimeBasedConfig {
  type: 'time_based';
  time_windows: Array<{
    start_time: string; // "HH:MM" format
    end_time: string; // "HH:MM" format
    days_of_week: number[]; // [0-6] Sunday=0
  }>;
}

export interface AmountBasedConfig {
  type: 'amount_based';
  currency: string; // "SEK"
  minimum_amount: number;
  maximum_amount?: number;
  comparison_operator: ComparisonOperator;
}

// Union type for all trigger configurations
export type TriggerConfig = PurchaseBasedConfig | TimeBasedConfig | AmountBasedConfig;

// API Request/Response Types

export interface CreateDynamicTriggerRequest {
  business_context_id: string;
  trigger_name: string;
  trigger_type: TriggerType;
  priority_level: number;
  sensitivity_threshold?: number;
  trigger_config: TriggerConfig;
}

export interface UpdateDynamicTriggerRequest {
  trigger_name?: string;
  priority_level?: number;
  sensitivity_threshold?: number;
  trigger_config?: TriggerConfig;
  is_active?: boolean;
}

export interface CreateTriggerConditionRequest {
  trigger_id: string;
  condition_key: string;
  condition_operator: string;
  condition_value: string;
  is_required?: boolean;
}

export interface UpdateTriggerConditionRequest {
  condition_key?: string;
  condition_operator?: string;
  condition_value?: string;
  is_required?: boolean;
}

// Trigger Evaluation Types

export interface TriggerEvaluationContext {
  customer_id: string;
  verification_id: string;
  purchase_data?: {
    items: Array<{
      name: string;
      category: string;
      price: number;
      quantity: number;
    }>;
    total_amount: number;
    currency: string;
    timestamp: string;
  };
  timing_data: {
    current_time: string;
    day_of_week: number;
    timezone: string;
  };
  customer_history?: {
    visit_count: number;
    last_visit: string;
    avg_purchase_amount: number;
  };
}

export interface TriggerEvaluationResult {
  trigger_id: string;
  matched: boolean;
  confidence_score: number; // 0.0-1.0
  matching_conditions: string[];
  failed_conditions: string[];
  question_ids: string[];
  evaluation_time_ms: number;
}

export interface BulkTriggerEvaluationResult {
  verification_id: string;
  triggered_questions: Array<{
    question_id: string;
    trigger_id: string;
    confidence_score: number;
    priority_level: number;
  }>;
  evaluation_summary: {
    total_triggers_evaluated: number;
    triggers_matched: number;
    total_questions_selected: number;
    evaluation_time_ms: number;
  };
}

// List Response Types

export interface DynamicTriggersListResponse {
  data: DynamicTrigger[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TriggerConditionsListResponse {
  data: TriggerCondition[];
}

// Query Parameters

export interface DynamicTriggersListParams {
  business_context_id?: string;
  trigger_type?: TriggerType;
  priority_level?: number;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'trigger_name' | 'priority_level' | 'effectiveness_score';
  sort_order?: 'asc' | 'desc';
}

export interface TriggerConditionsListParams {
  trigger_id?: string;
  is_required?: boolean;
  sort_by?: 'created_at' | 'condition_key';
  sort_order?: 'asc' | 'desc';
}

// Analytics and Effectiveness Types

export interface TriggerEffectivenessMetrics {
  trigger_id: string;
  trigger_name: string;
  period_start: string;
  period_end: string;
  total_evaluations: number;
  successful_matches: number;
  questions_triggered: number;
  questions_answered: number;
  avg_customer_satisfaction: number;
  effectiveness_score: number;
  match_rate: number; // successful_matches / total_evaluations
  conversion_rate: number; // questions_answered / questions_triggered
}

export interface TriggerEffectivenessReport {
  business_context_id: string;
  report_period: {
    start: string;
    end: string;
  };
  triggers: TriggerEffectivenessMetrics[];
  summary: {
    total_triggers: number;
    avg_effectiveness: number;
    top_performing_trigger_id: string;
    recommendations: string[];
  };
}

// Validation Types

export interface TriggerValidationResult {
  isValid: boolean;
  errors: {
    trigger_name?: string;
    trigger_type?: string;
    priority_level?: string;
    sensitivity_threshold?: string;
    trigger_config?: string;
    conditions?: Array<{
      condition_key?: string;
      condition_operator?: string;
      condition_value?: string;
    }>;
  };
}

// Test and Preview Types

export interface TriggerTestScenario {
  scenario_name: string;
  test_data: TriggerEvaluationContext;
  expected_result: boolean;
  expected_questions: string[];
}

export interface TriggerTestResult {
  scenario_name: string;
  passed: boolean;
  actual_result: TriggerEvaluationResult;
  discrepancies: string[];
}

export interface TriggerPreviewResponse {
  trigger_summary: {
    name: string;
    type: TriggerType;
    estimated_match_rate: number;
    affected_questions: number;
  };
  example_scenarios: Array<{
    scenario_description: string;
    would_trigger: boolean;
    confidence_score: number;
  }>;
  performance_impact: {
    evaluation_time_estimate: number; // milliseconds
    resource_usage: 'low' | 'medium' | 'high';
  };
}

// Utility Types

export type TriggerPriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface TimeWindow {
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

export interface PurchaseItem {
  name: string;
  category: string;
  price: number;
  quantity: number;
}