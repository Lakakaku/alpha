// Question Combination Rules Types
// Feature: Step 5.2: Advanced Question Logic

export interface QuestionCombinationRule {
  id: string;
  business_context_id: string;
  rule_name: string;
  max_call_duration_seconds: number; // 60-180 seconds
  priority_threshold_critical: number; // Time remaining for critical questions
  priority_threshold_high: number;
  priority_threshold_medium: number;
  priority_threshold_low: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionGroup {
  id: string;
  rule_id: string;
  group_name: string;
  topic_category: string;
  estimated_tokens: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PriorityWeight {
  id: string;
  question_id: string;
  priority_level: number; // 1-5 (1=Optional, 5=Critical)
  weight_multiplier: number; // Fine-tuning multiplier
  effective_priority: number; // Computed: priority_level * weight_multiplier
  assigned_by: string;
  assigned_at: string;
  is_system_assigned: boolean;
}

export interface TimeConstraintOptimizer {
  id: string;
  business_context_id: string;
  optimization_version: number;
  cached_combinations: Array<{
    question_ids: string[];
    estimated_duration: number;
    priority_score: number;
    token_count: number;
  }>;
  total_token_budget: number;
  average_response_tokens: number;
  last_optimized: string;
  cache_expiry: string;
}

// API Request/Response Types

export interface CreateCombinationRuleRequest {
  business_context_id: string;
  rule_name: string;
  max_call_duration_seconds: number;
  priority_threshold_critical?: number;
  priority_threshold_high?: number;
  priority_threshold_medium?: number;
  priority_threshold_low?: number;
}

export interface UpdateCombinationRuleRequest {
  rule_name?: string;
  max_call_duration_seconds?: number;
  priority_threshold_critical?: number;
  priority_threshold_high?: number;
  priority_threshold_medium?: number;
  priority_threshold_low?: number;
  is_active?: boolean;
}

export interface CreateQuestionGroupRequest {
  rule_id: string;
  group_name: string;
  topic_category: string;
  estimated_tokens: number;
  display_order?: number;
}

export interface UpdateQuestionGroupRequest {
  group_name?: string;
  topic_category?: string;
  estimated_tokens?: number;
  display_order?: number;
  is_active?: boolean;
}

export interface SetPriorityWeightRequest {
  question_id: string;
  priority_level: number;
  weight_multiplier?: number;
}

export interface OptimizationResult {
  question_combinations: Array<{
    questions: Array<{
      id: string;
      estimated_tokens: number;
      priority_score: number;
    }>;
    total_tokens: number;
    estimated_duration: number;
    priority_score: number;
  }>;
  optimization_metadata: {
    total_questions_considered: number;
    combinations_generated: number;
    cache_hit: boolean;
    processing_time_ms: number;
  };
}

// List Response Types

export interface CombinationRulesListResponse {
  data: QuestionCombinationRule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface QuestionGroupsListResponse {
  data: QuestionGroup[];
}

export interface PriorityWeightsListResponse {
  data: PriorityWeight[];
}

// Query Parameters

export interface CombinationRulesListParams {
  business_context_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'rule_name';
  sort_order?: 'asc' | 'desc';
}

export interface QuestionGroupsListParams {
  rule_id?: string;
  topic_category?: string;
  is_active?: boolean;
  sort_by?: 'display_order' | 'created_at' | 'group_name';
  sort_order?: 'asc' | 'desc';
}

// Validation Types

export interface CombinationRuleValidation {
  isValidCallDuration: boolean;
  isValidPriorityThresholds: boolean;
  hasUniqueRuleName: boolean;
  errors: {
    call_duration?: string;
    priority_thresholds?: string;
    rule_name?: string;
  };
}

// Utility Types

export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface PriorityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface QuestionCombinationMetrics {
  rule_id: string;
  total_questions: number;
  avg_call_duration: number;
  success_rate: number;
  customer_satisfaction: number;
  last_calculated: string;
}