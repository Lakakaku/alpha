// Frequency Harmonizer Types
// Feature: Step 5.2: Advanced Question Logic

export type ResolutionStrategy = 'combine' | 'priority' | 'alternate' | 'custom';

export interface FrequencyHarmonizer {
  id: string;
  rule_id: string;
  question_pair_hash: string; // Hash of question ID pair for uniqueness
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: ResolutionStrategy;
  custom_frequency?: number; // For custom strategy
  priority_question_id?: string; // For priority strategy
  created_at: string;
  updated_at: string;
}

export interface FrequencyConflict {
  question_pair: {
    question_1: {
      id: string;
      text: string;
      current_frequency: number;
      target_frequency: number;
      frequency_window: string;
    };
    question_2: {
      id: string;
      text: string;
      current_frequency: number;
      target_frequency: number;
      frequency_window: string;
    };
  };
  conflict_type: 'frequency_overlap' | 'topic_similarity' | 'timing_conflict' | 'resource_contention';
  conflict_severity: 'low' | 'medium' | 'high' | 'critical';
  suggested_resolutions: ResolutionSuggestion[];
  detected_at: string;
}

export interface ResolutionSuggestion {
  strategy: ResolutionStrategy;
  description: string;
  estimated_improvement: number; // Percentage improvement in call efficiency
  implementation_effort: 'low' | 'medium' | 'high';
  configuration: ResolutionConfiguration;
}

// Strategy-specific configuration types
export interface CombineStrategyConfig {
  strategy: 'combine';
  combined_question_text: string;
  combined_frequency: number;
  combined_window: string;
  preserve_individual_analytics: boolean;
}

export interface PriorityStrategyConfig {
  strategy: 'priority';
  priority_question_id: string;
  fallback_frequency?: number; // How often to ask the non-priority question
  priority_threshold: number; // Percentage of time to prioritize
}

export interface AlternateStrategyConfig {
  strategy: 'alternate';
  alternation_pattern: 'round_robin' | 'weighted' | 'time_based' | 'customer_based';
  alternation_ratio?: number; // For weighted alternation
  time_interval?: string; // For time-based alternation
}

export interface CustomStrategyConfig {
  strategy: 'custom';
  custom_frequency: number;
  custom_window: string;
  custom_logic: {
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    action: 'ask_question_1' | 'ask_question_2' | 'ask_both' | 'skip_both';
  };
}

export type ResolutionConfiguration = 
  | CombineStrategyConfig 
  | PriorityStrategyConfig 
  | AlternateStrategyConfig 
  | CustomStrategyConfig;

// API Request/Response Types

export interface CreateFrequencyHarmonizerRequest {
  rule_id: string;
  question_id_1: string;
  question_id_2: string;
  resolution_strategy: ResolutionStrategy;
  custom_frequency?: number;
  priority_question_id?: string;
}

export interface UpdateFrequencyHarmonizerRequest {
  resolution_strategy?: ResolutionStrategy;
  custom_frequency?: number;
  priority_question_id?: string;
}

export interface BulkResolveConflictsRequest {
  rule_id: string;
  conflict_resolutions: Array<{
    question_id_1: string;
    question_id_2: string;
    resolution_strategy: ResolutionStrategy;
    configuration: ResolutionConfiguration;
  }>;
}

export interface DetectConflictsRequest {
  rule_id: string;
  question_ids?: string[]; // If not provided, checks all questions in rule
  include_suggestions?: boolean;
  conflict_threshold?: 'low' | 'medium' | 'high'; // Sensitivity level
}

// Response Types

export interface FrequencyHarmonizersListResponse {
  data: FrequencyHarmonizer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ConflictDetectionResponse {
  rule_id: string;
  conflicts_detected: FrequencyConflict[];
  resolution_summary: {
    total_conflicts: number;
    critical_conflicts: number;
    high_priority_conflicts: number;
    auto_resolvable: number;
    requires_manual_review: number;
  };
  processing_metadata: {
    questions_analyzed: number;
    pairs_checked: number;
    processing_time_ms: number;
  };
}

export interface HarmonizationEffectivenessReport {
  rule_id: string;
  report_period: {
    start: string;
    end: string;
  };
  harmonizer_performance: Array<{
    harmonizer_id: string;
    question_pair: {
      question_1_id: string;
      question_2_id: string;
    };
    resolution_strategy: ResolutionStrategy;
    effectiveness_metrics: {
      conflict_reduction: number; // Percentage
      call_efficiency_improvement: number; // Percentage
      customer_satisfaction_impact: number; // -1.0 to 1.0
      total_applications: number;
      successful_resolutions: number;
    };
  }>;
  overall_impact: {
    total_conflicts_resolved: number;
    avg_call_time_reduction: number; // Seconds
    question_redundancy_reduction: number; // Percentage
    system_performance_impact: number; // Processing time impact
  };
}

// Query Parameters

export interface FrequencyHarmonizersListParams {
  rule_id?: string;
  resolution_strategy?: ResolutionStrategy;
  question_id?: string; // Returns harmonizers involving this question
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'resolution_strategy';
  sort_order?: 'asc' | 'desc';
}

export interface ConflictAnalysisParams {
  business_context_id?: string;
  rule_id?: string;
  date_from?: string;
  date_to?: string;
  conflict_severity?: string[];
  resolution_status?: 'unresolved' | 'resolved' | 'pending';
}

// Analytics and Monitoring Types

export interface HarmonizationMetrics {
  harmonizer_id: string;
  last_30_days: {
    activations: number;
    successful_resolutions: number;
    conflicts_prevented: number;
    call_time_saved: number; // Seconds
  };
  performance_indicators: {
    resolution_success_rate: number;
    avg_processing_time: number;
    customer_satisfaction_score: number;
    business_satisfaction_score: number;
  };
  trend_analysis: {
    activation_trend: 'increasing' | 'stable' | 'decreasing';
    effectiveness_trend: 'improving' | 'stable' | 'degrading';
    recommended_action: string;
  };
}

export interface SystemHarmonizationHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  system_metrics: {
    total_harmonizers: number;
    active_harmonizers: number;
    unresolved_conflicts: number;
    avg_resolution_time: number;
  };
  performance_indicators: {
    conflict_detection_accuracy: number;
    resolution_success_rate: number;
    system_processing_overhead: number;
    cache_efficiency: number;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    affected_harmonizer_ids: string[];
    recommended_action: string;
  }>;
}

// Real-time Processing Types

export interface HarmonizationEvent {
  event_type: 'conflict_detected' | 'harmonizer_applied' | 'resolution_success' | 'resolution_failure';
  timestamp: string;
  rule_id: string;
  harmonizer_id?: string;
  question_ids: string[];
  event_data: {
    conflict?: FrequencyConflict;
    resolution_applied?: ResolutionConfiguration;
    outcome?: {
      success: boolean;
      metrics: Record<string, number>;
      error_message?: string;
    };
  };
}

export interface HarmonizationBatchJob {
  job_id: string;
  job_type: 'conflict_detection' | 'bulk_resolution' | 'effectiveness_analysis';
  rule_ids: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total_items: number;
    processed_items: number;
    current_item: string;
  };
  results?: {
    conflicts_detected: number;
    resolutions_applied: number;
    errors: Array<{
      item_id: string;
      error_message: string;
    }>;
  };
  started_at: string;
  completed_at?: string;
}

// Testing and Validation Types

export interface HarmonizationTestScenario {
  scenario_name: string;
  rule_id: string;
  question_configurations: Array<{
    question_id: string;
    frequency_target: number;
    frequency_window: string;
    current_frequency: number;
  }>;
  expected_conflicts: number;
  expected_resolutions: ResolutionStrategy[];
}

export interface HarmonizationTestResult {
  scenario_name: string;
  test_passed: boolean;
  actual_conflicts_detected: number;
  actual_resolutions_suggested: ResolutionStrategy[];
  discrepancies: string[];
  performance_metrics: {
    detection_time_ms: number;
    resolution_time_ms: number;
    memory_usage: number;
  };
}

// Validation Types

export interface HarmonizerValidation {
  isValid: boolean;
  errors: {
    question_pair?: string;
    resolution_strategy?: string;
    custom_frequency?: string;
    priority_question?: string;
    configuration?: string;
  };
  warnings: {
    effectiveness_concern?: string;
    performance_impact?: string;
    business_impact?: string;
  };
}

// Utility Types

export interface QuestionPair {
  question_1: string;
  question_2: string;
  pair_hash: string;
}

export interface ConflictMatrix {
  rule_id: string;
  question_ids: string[];
  conflict_scores: number[][]; // 2D matrix of conflict scores
  conflict_types: string[][]; // 2D matrix of conflict types
  generated_at: string;
}

export interface OptimalHarmonizationPlan {
  rule_id: string;
  recommended_harmonizers: Array<{
    question_id_1: string;
    question_id_2: string;
    strategy: ResolutionStrategy;
    configuration: ResolutionConfiguration;
    expected_benefit: number;
  }>;
  implementation_order: string[]; // Harmonizer IDs in optimal implementation order
  total_expected_improvement: number;
  estimated_implementation_time: number; // Minutes
}