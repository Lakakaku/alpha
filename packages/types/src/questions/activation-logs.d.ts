export interface TriggerActivationLog {
    id: string;
    verification_id: string;
    trigger_id: string;
    question_id: string;
    trigger_data: TriggerActivationData;
    activation_timestamp: string;
    call_position: number;
    was_asked: boolean;
    skip_reason?: string;
}
export interface TriggerActivationData {
    customer_context: {
        customer_id?: string;
        session_id: string;
        verification_type: string;
    };
    trigger_conditions: Array<{
        condition_key: string;
        condition_value: any;
        matched: boolean;
        confidence_score: number;
    }>;
    evaluation_metadata: {
        evaluation_time_ms: number;
        algorithm_version: string;
        cache_hit: boolean;
    };
    business_context: {
        business_id: string;
        store_id?: string;
        context_id: string;
    };
}
export interface CreateActivationLogRequest {
    verification_id: string;
    trigger_id: string;
    question_id: string;
    trigger_data: TriggerActivationData;
    call_position: number;
    was_asked?: boolean;
    skip_reason?: string;
}
export interface UpdateActivationLogRequest {
    was_asked?: boolean;
    skip_reason?: string;
}
export interface BulkCreateActivationLogsRequest {
    verification_id: string;
    activations: Array<{
        trigger_id: string;
        question_id: string;
        trigger_data: TriggerActivationData;
        call_position: number;
    }>;
}
export interface ActivationLogAnalytics {
    verification_id: string;
    verification_timestamp: string;
    total_triggers_fired: number;
    questions_selected: number;
    questions_asked: number;
    questions_skipped: number;
    avg_confidence_score: number;
    call_efficiency: {
        planned_duration: number;
        actual_duration: number;
        utilization_rate: number;
    };
    trigger_breakdown: Array<{
        trigger_id: string;
        trigger_name: string;
        questions_contributed: number;
        avg_confidence: number;
    }>;
}
export interface BusinessActivationReport {
    business_context_id: string;
    report_period: {
        start: string;
        end: string;
    };
    summary_metrics: {
        total_verifications: number;
        total_activations: number;
        total_questions_asked: number;
        avg_questions_per_call: number;
        avg_call_duration: number;
        question_skip_rate: number;
    };
    trigger_performance: Array<{
        trigger_id: string;
        trigger_name: string;
        activation_count: number;
        success_rate: number;
        avg_call_position: number;
        effectiveness_score: number;
    }>;
    question_performance: Array<{
        question_id: string;
        question_text: string;
        activation_count: number;
        ask_rate: number;
        avg_call_position: number;
        skip_reasons: Array<{
            reason: string;
            count: number;
        }>;
    }>;
}
export interface AdminActivationReport {
    system_overview: {
        total_businesses: number;
        total_activations_today: number;
        total_activations_week: number;
        avg_system_response_time: number;
    };
    top_performing_triggers: Array<{
        trigger_id: string;
        business_name: string;
        activation_count: number;
        success_rate: number;
        effectiveness_score: number;
    }>;
    system_health: {
        cache_hit_rate: number;
        avg_evaluation_time: number;
        error_rate: number;
        alerts: string[];
    };
}
export interface ActivationLogsListResponse {
    data: TriggerActivationLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
    summary: {
        total_activations: number;
        total_asked: number;
        total_skipped: number;
        skip_rate: number;
    };
}
export interface ActivationLogsListParams {
    verification_id?: string;
    trigger_id?: string;
    question_id?: string;
    was_asked?: boolean;
    date_from?: string;
    date_to?: string;
    business_context_id?: string;
    page?: number;
    limit?: number;
    sort_by?: 'activation_timestamp' | 'call_position' | 'verification_id';
    sort_order?: 'asc' | 'desc';
}
export interface ActivationAnalyticsParams {
    business_context_id?: string;
    date_from: string;
    date_to: string;
    trigger_ids?: string[];
    question_ids?: string[];
    include_skipped?: boolean;
    group_by?: 'day' | 'week' | 'month' | 'trigger' | 'question';
}
export type SkipReason = 'time_constraint' | 'priority_cutoff' | 'frequency_limit' | 'duplicate_topic' | 'customer_interruption' | 'technical_error' | 'low_confidence' | 'business_rule' | 'system_optimization';
export interface SkipReasonDetail {
    reason: SkipReason;
    description: string;
    metadata?: {
        time_remaining?: number;
        priority_threshold?: number;
        frequency_count?: number;
        confidence_score?: number;
        error_code?: string;
    };
}
export interface ActivationStreamEvent {
    event_type: 'activation_created' | 'activation_updated' | 'question_asked' | 'question_skipped';
    timestamp: string;
    data: {
        activation_log: TriggerActivationLog;
        business_context_id: string;
        verification_id: string;
    };
}
export interface ActivationBatchProcess {
    batch_id: string;
    verification_ids: string[];
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    processed_count: number;
    total_count: number;
    started_at: string;
    completed_at?: string;
    errors: Array<{
        verification_id: string;
        error_message: string;
        error_code: string;
    }>;
}
export interface ActivationPerformanceMetrics {
    time_period: {
        start: string;
        end: string;
    };
    processing_stats: {
        total_activations: number;
        avg_processing_time: number;
        p95_processing_time: number;
        p99_processing_time: number;
        error_rate: number;
    };
    business_distribution: Array<{
        business_context_id: string;
        activation_count: number;
        avg_processing_time: number;
    }>;
    system_resources: {
        cpu_utilization: number;
        memory_usage: number;
        database_connections: number;
        cache_hit_rate: number;
    };
}
export interface ActivationLogValidation {
    isValid: boolean;
    errors: {
        verification_id?: string;
        trigger_id?: string;
        question_id?: string;
        trigger_data?: string;
        call_position?: string;
        skip_reason?: string;
    };
}
export interface ActivationLogError {
    error_code: string;
    error_message: string;
    activation_context: {
        verification_id: string;
        trigger_id: string;
        question_id: string;
    };
    timestamp: string;
    retry_count: number;
}
export interface CallPositionAnalysis {
    position: number;
    questions_at_position: Array<{
        question_id: string;
        frequency: number;
        avg_response_time: number;
        success_rate: number;
    }>;
    position_effectiveness: number;
    optimal_question_types: string[];
}
export interface ActivationTrend {
    date: string;
    activation_count: number;
    success_rate: number;
    avg_confidence: number;
    top_triggers: string[];
}
//# sourceMappingURL=activation-logs.d.ts.map