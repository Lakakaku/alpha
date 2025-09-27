export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
export type Speaker = 'ai' | 'customer';
export type MessageType = 'question' | 'response' | 'system' | 'error';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';
export type CheckType = 'timing' | 'content' | 'context' | 'pattern';
export type ReviewDecision = 'confirmed_fraud' | 'false_positive' | 'needs_investigation';
export interface FeedbackCallSession {
    id: string;
    customer_verification_id: string;
    store_id: string;
    phone_number: string;
    session_status: SessionStatus;
    call_initiated_at: string;
    call_connected_at: string | null;
    call_ended_at: string | null;
    duration_seconds: number | null;
    retry_count: number;
    failure_reason: string | null;
    openai_session_id: string | null;
    created_at: string;
    expires_at: string;
}
export interface ConversationTranscript {
    id: string;
    call_session_id: string;
    speaker: Speaker;
    message_order: number;
    content: string;
    timestamp_ms: number;
    confidence_score: number | null;
    language_detected: string;
    message_type: MessageType;
    created_at: string;
}
export interface QualityAssessment {
    id: string;
    call_session_id: string;
    legitimacy_score: number;
    depth_score: number;
    usefulness_score: number;
    overall_quality_score: number;
    reward_percentage: number;
    is_fraudulent: boolean;
    fraud_reasons: Record<string, any> | null;
    analysis_summary: string | null;
    business_actionable_items: Record<string, any> | null;
    analysis_metadata: Record<string, any> | null;
    created_at: string;
}
export interface BusinessContextProfile {
    id: string;
    store_id: string;
    context_version: number;
    operating_hours: Record<string, any>;
    departments: Record<string, any>;
    current_campaigns: Record<string, any> | null;
    question_configuration: Record<string, any>;
    baseline_facts: Record<string, any>;
    context_completeness_score: number;
    last_updated_at: string;
    updated_by: string | null;
}
export interface WeeklyAnalysisReport {
    id: string;
    store_id: string;
    analysis_week: string;
    total_feedback_count: number;
    average_quality_score: number | null;
    positive_trends: Record<string, any> | null;
    negative_issues: Record<string, any> | null;
    new_issues: Record<string, any> | null;
    department_insights: Record<string, any> | null;
    historical_comparison: Record<string, any> | null;
    predictive_insights: Record<string, any> | null;
    actionable_recommendations: Record<string, any> | null;
    report_metadata: Record<string, any> | null;
    generated_at: string;
}
export interface CallQualityMetrics {
    id: string;
    call_session_id: string;
    connection_quality: ConnectionQuality;
    audio_clarity_score: number | null;
    latency_ms: number | null;
    packet_loss_percentage: number | null;
    openai_api_latency: number | null;
    technical_errors: Record<string, any> | null;
    bandwidth_usage_kb: number | null;
    device_info: Record<string, any> | null;
    measured_at: string;
}
export interface FraudDetectionResult {
    id: string;
    call_session_id: string;
    check_type: CheckType;
    is_suspicious: boolean;
    confidence_level: number;
    fraud_indicators: Record<string, any> | null;
    context_violations: Record<string, any> | null;
    decision_reasoning: string | null;
    manual_review_required: boolean;
    reviewed_by: string | null;
    review_decision: ReviewDecision | null;
    created_at: string;
}
export interface InitiateCallRequest {
    customer_verification_id: string;
    store_id: string;
    phone_number: string;
    priority?: 'normal' | 'high';
}
export interface InitiateCallResponse {
    success: boolean;
    call_session_id: string;
    status: SessionStatus;
    estimated_wait_time_minutes?: number;
    retry_number: number;
}
export interface CallStatusResponse {
    call_session_id: string;
    status: SessionStatus;
    call_initiated_at: string;
    call_connected_at: string | null;
    call_ended_at: string | null;
    duration_seconds: number | null;
    retry_count: number;
    failure_reason: string | null;
    quality_metrics?: {
        connection_quality: ConnectionQuality;
        audio_clarity_score: number | null;
        latency_ms: number | null;
    };
}
export interface SubmitTranscriptRequest {
    messages: Array<{
        speaker: Speaker;
        content: string;
        timestamp_ms: number;
        message_order: number;
        message_type: MessageType;
        confidence_score?: number;
        language_detected?: string;
    }>;
    total_duration_seconds: number;
    openai_session_id: string;
    call_ended_at: string;
}
export interface SubmitTranscriptResponse {
    success: boolean;
    transcript_id: string;
    analysis_queued: boolean;
    estimated_analysis_time_seconds: number;
}
export interface RetryCallResponse {
    success: boolean;
    new_session_id: string;
    retry_number: number;
    max_retries_reached: boolean;
}
export interface QualityAnalysisRequest {
    call_session_id: string;
    transcript_id: string;
    business_context?: Record<string, any>;
}
export interface QualityAnalysisResponse {
    success: boolean;
    assessment_id: string;
    scores: {
        legitimacy_score: number;
        depth_score: number;
        usefulness_score: number;
        overall_quality_score: number;
    };
    reward_percentage: number;
    is_fraudulent: boolean;
    analysis_summary: string;
    business_actionable_items: string[];
    processing_time_seconds: number;
}
export interface FraudDetectionRequest {
    call_session_id: string;
    check_types: CheckType[];
    business_context: Record<string, any>;
}
export interface FraudDetectionResponse {
    success: boolean;
    results: Array<{
        check_type: CheckType;
        is_suspicious: boolean;
        confidence_level: number;
        fraud_indicators: string[];
        decision_reasoning: string;
    }>;
    overall_fraud_score: number;
    recommended_action: 'approve' | 'review' | 'reject';
}
export interface SummarizeRequest {
    call_session_ids: string[];
    analysis_type: 'daily' | 'weekly' | 'custom';
    date_range?: {
        start_date: string;
        end_date: string;
    };
}
export interface SummarizeResponse {
    success: boolean;
    summary: {
        total_calls: number;
        average_quality_score: number;
        top_positive_themes: string[];
        top_issues_identified: string[];
        fraud_detection_summary: {
            total_suspicious: number;
            fraud_rate_percentage: number;
            common_fraud_patterns: string[];
        };
    };
    detailed_insights: Record<string, any>;
}
export interface CleanupLowGradeRequest {
    quality_threshold: number;
    older_than_days?: number;
    store_ids?: string[];
}
export interface CleanupLowGradeResponse {
    success: boolean;
    deleted_count: number;
    space_freed_mb: number;
    retention_policy_applied: string;
}
export interface AnalysisMetricsResponse {
    success: boolean;
    metrics: {
        total_calls_analyzed: number;
        average_analysis_time_seconds: number;
        quality_score_distribution: Record<string, number>;
        fraud_detection_stats: {
            total_checks_performed: number;
            fraud_rate_percentage: number;
            false_positive_rate: number;
        };
        system_performance: {
            openai_api_uptime: number;
            average_api_latency_ms: number;
            error_rate_percentage: number;
        };
    };
    time_period: {
        start_date: string;
        end_date: string;
    };
}
export interface GenerateReportRequest {
    store_id: string;
    analysis_week: string;
    analysis_depth: 'basic' | 'comprehensive' | 'detailed';
    include_comparisons?: boolean;
    include_predictions?: boolean;
}
export interface GenerateReportResponse {
    success: boolean;
    report_id: string;
    status: 'generating' | 'completed' | 'failed';
    estimated_completion_time_seconds?: number;
    preview?: {
        total_feedback_count: number;
        average_quality_score: number;
        key_insights_count: number;
    };
}
export interface BusinessSearchRequest {
    store_id: string;
    query: string;
    time_range: {
        start_date: string;
        end_date: string;
    };
    search_type?: 'semantic' | 'keyword' | 'hybrid';
    limit?: number;
}
export interface BusinessSearchResponse {
    success: boolean;
    results: Array<{
        call_session_id: string;
        relevance_score: number;
        excerpt: string;
        call_date: string;
        quality_score: number;
        key_topics: string[];
    }>;
    total_matches: number;
    search_metadata: {
        query_processing_time_ms: number;
        search_type_used: string;
        total_documents_searched: number;
    };
}
export interface TrendsResponse {
    success: boolean;
    store_id: string;
    trends: {
        quality_trends: Array<{
            week: string;
            average_score: number;
            call_count: number;
            trend_direction: 'improving' | 'declining' | 'stable';
        }>;
        topic_trends: Array<{
            topic: string;
            mention_frequency: number;
            sentiment_trend: 'positive' | 'negative' | 'neutral';
            weeks_data: Array<{
                week: string;
                mentions: number;
                average_sentiment: number;
            }>;
        }>;
        department_trends: Record<string, {
            feedback_count: number;
            average_score: number;
            top_issues: string[];
        }>;
    };
    analysis_period: {
        start_week: string;
        end_week: string;
        total_weeks: number;
    };
}
export interface RecommendationsResponse {
    success: boolean;
    store_id: string;
    recommendations: Array<{
        id: string;
        category: 'operational' | 'customer_service' | 'product' | 'training';
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        suggested_actions: string[];
        expected_impact: string;
        implementation_difficulty: 'easy' | 'medium' | 'hard';
        estimated_cost_impact: 'low' | 'medium' | 'high';
        supporting_data: {
            feedback_count: number;
            average_quality_score: number;
            sentiment_analysis: Record<string, number>;
        };
    }>;
    generated_at: string;
    valid_until: string;
}
export interface AICallSystemDatabase {
    public: {
        Tables: {
            feedback_call_sessions: {
                Row: FeedbackCallSession;
                Insert: Omit<FeedbackCallSession, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<FeedbackCallSession, 'id' | 'created_at'>>;
            };
            conversation_transcripts: {
                Row: ConversationTranscript;
                Insert: Omit<ConversationTranscript, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<ConversationTranscript, 'id' | 'created_at'>>;
            };
            quality_assessments: {
                Row: QualityAssessment;
                Insert: Omit<QualityAssessment, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<QualityAssessment, 'id' | 'created_at'>>;
            };
            business_context_profiles: {
                Row: BusinessContextProfile;
                Insert: Omit<BusinessContextProfile, 'id' | 'last_updated_at'> & {
                    id?: string;
                    last_updated_at?: string;
                };
                Update: Partial<Omit<BusinessContextProfile, 'id'>> & {
                    last_updated_at?: string;
                };
            };
            weekly_analysis_reports: {
                Row: WeeklyAnalysisReport;
                Insert: Omit<WeeklyAnalysisReport, 'id' | 'generated_at'> & {
                    id?: string;
                    generated_at?: string;
                };
                Update: Partial<Omit<WeeklyAnalysisReport, 'id' | 'generated_at'>>;
            };
            call_quality_metrics: {
                Row: CallQualityMetrics;
                Insert: Omit<CallQualityMetrics, 'id' | 'measured_at'> & {
                    id?: string;
                    measured_at?: string;
                };
                Update: Partial<Omit<CallQualityMetrics, 'id' | 'measured_at'>>;
            };
            fraud_detection_results: {
                Row: FraudDetectionResult;
                Insert: Omit<FraudDetectionResult, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<FraudDetectionResult, 'id' | 'created_at'>>;
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            session_status: SessionStatus;
            speaker: Speaker;
            message_type: MessageType;
            connection_quality: ConnectionQuality;
            check_type: CheckType;
            review_decision: ReviewDecision;
        };
    };
}
export interface OpenAIServiceConfig {
    apiKey: string;
    model: string;
    voiceModel: string;
    maxTokens: number;
    temperature: number;
}
export interface PhoneServiceConfig {
    username: string;
    password: string;
    webhookUrl: string;
    retryAttempts: number;
    retryDelay: number;
}
export interface AICallManagerConfig {
    maxConcurrentCalls: number;
    callTimeoutMinutes: number;
    analysisTimeoutMinutes: number;
    retryPolicy: {
        maxRetries: number;
        backoffMultiplier: number;
    };
}
export interface AIHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeSessionsCount: number;
    metrics: {
        openai: {
            recentCalls: number;
            averageLatency: number;
        };
        phone: {
            recentCalls: number;
            connectionQuality: Record<ConnectionQuality, number>;
        };
        system: {
            uptime: number;
            memoryUsage: NodeJS.MemoryUsage;
            nodeVersion: string;
        };
    };
    timestamp: string;
}
export interface AIMetricsSnapshot {
    sessionId: string;
    storeId: string;
    operation: string;
    duration?: number;
    success: boolean;
    errorCode?: string;
    metadata?: Record<string, any>;
}
export interface AIServiceError extends Error {
    code: string;
    statusCode: number;
    context?: Record<string, any>;
    retryable?: boolean;
}
export interface DataCleanupJob {
    id: string;
    scheduledAt: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    parameters: {
        retentionDays: number;
        qualityThreshold: number;
        batchSize: number;
    };
    results?: {
        deletedSessions: number;
        deletedTranscripts: number;
        spaceSavedMB: number;
    };
}
export interface WeeklyReportJob {
    id: string;
    storeId: string;
    weekOf: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    scheduledAt: string;
    completedAt?: string;
    reportId?: string;
    error?: string;
}
//# sourceMappingURL=ai-call-system.d.ts.map