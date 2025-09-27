/**
 * Fraud Detection Types
 * Task: T029 - Fraud detection types
 *
 * Defines types for fraud detection system components:
 * - Context analysis using GPT-4o-mini (40% weight)
 * - Keyword detection (20% weight)
 * - Behavioral patterns (30% weight)
 * - Transaction verification (10% weight)
 */
export interface FraudScore {
    id: string;
    phone_hash: string;
    context_score: number;
    keyword_score: number;
    behavioral_score: number;
    transaction_score: number;
    composite_score: number;
    risk_level: RiskLevel;
    fraud_probability: number;
    confidence_level: number;
    analysis_version: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
}
export interface FraudScoreRequest {
    phone_hash: string;
    feedback_content: string;
    business_context: BusinessContext;
    caller_metadata?: CallerMetadata;
}
export interface FraudScoreResponse {
    phone_hash: string;
    is_fraudulent: boolean;
    fraud_score: FraudScore;
    contributing_factors: ContributingFactor[];
    recommendations: string[];
}
export interface ContextAnalysis {
    id: string;
    phone_hash: string;
    feedback_content: string;
    language_detected: string;
    business_context: BusinessContext;
    gpt_analysis: GPTAnalysis;
    legitimacy_score: number;
    confidence_score: number;
    analysis_metadata: ContextAnalysisMetadata;
    created_at: string;
}
export interface GPTAnalysis {
    model_version: string;
    prompt_version: string;
    response_content: string;
    reasoning: string;
    language_authenticity: number;
    cultural_context_match: number;
    content_coherence: number;
    impossible_claims_detected: string[];
    suspicious_patterns: string[];
    processing_time_ms: number;
}
export interface BusinessContext {
    business_id: string;
    business_type: string;
    location: string;
    language: string;
    typical_feedback_patterns?: string[];
    service_categories?: string[];
}
export interface ContextAnalysisMetadata {
    text_length: number;
    word_count: number;
    sentence_count: number;
    language_complexity: number;
    sentiment_score: number;
    topic_distribution: Record<string, number>;
    processing_duration: number;
}
export interface RedFlagKeyword {
    id: string;
    keyword: string;
    category: KeywordCategory;
    severity_level: number;
    language_code: string;
    detection_pattern: string;
    created_by: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export type KeywordCategory = 'profanity' | 'threats' | 'nonsensical' | 'impossible';
export interface KeywordDetectionResult {
    id: string;
    phone_hash: string;
    feedback_content: string;
    keywords_found: KeywordMatch[];
    total_severity_score: number;
    category_distribution: Record<KeywordCategory, number>;
    language_analyzed: string;
    created_at: string;
}
export interface KeywordMatch {
    keyword: string;
    category: KeywordCategory;
    severity_level: number;
    match_position: number;
    match_text: string;
    detection_pattern: string;
    context_snippet: string;
}
export interface KeywordRequest {
    keyword: string;
    category: KeywordCategory;
    severity_level: number;
    language_code?: string;
    detection_pattern?: string;
}
export interface BehavioralPattern {
    id: string;
    phone_hash: string;
    pattern_type: PatternType;
    risk_score: number;
    violation_count: number;
    pattern_data: PatternData;
    detection_rules: DetectionRule[];
    first_detected: string;
    last_updated: string;
    is_resolved: boolean;
    resolution_notes?: string;
}
export type PatternType = 'call_frequency' | 'time_pattern' | 'location_pattern' | 'similarity_pattern';
export interface PatternData {
    calls_per_minute?: number;
    calls_per_hour?: number;
    burst_detection?: {
        burst_count: number;
        burst_duration_seconds: number;
        average_interval_seconds: number;
    };
    time_distribution?: {
        business_hours_ratio: number;
        off_hours_calls: number;
        weekend_calls: number;
        night_calls: number;
    };
    location_spread?: {
        unique_locations: number;
        max_distance_km: number;
        impossible_travel_detected: boolean;
    };
    content_similarity?: {
        average_similarity_score: number;
        duplicate_content_ratio: number;
        template_usage_detected: boolean;
        variation_coefficient: number;
    };
}
export interface DetectionRule {
    rule_name: string;
    threshold_value: number;
    actual_value: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    triggered: boolean;
    rule_description: string;
}
export interface BehavioralPatternRequest {
    phone_hash: string;
    time_window?: string;
}
export interface BehavioralPatternResponse {
    phone_hash: string;
    patterns: BehavioralPattern[];
    overall_risk_level: RiskLevel;
    time_window_analyzed: string;
    analysis_summary: {
        total_violations: number;
        highest_risk_score: number;
        pattern_types_detected: PatternType[];
        recommendation: string;
    };
}
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface ContributingFactor {
    component: 'context' | 'keywords' | 'behavioral' | 'transaction';
    score: number;
    weight_percent: number;
    risk_indicators: string[];
    confidence: number;
}
export interface CallerMetadata {
    call_timestamp: string;
    call_duration_seconds?: number;
    call_quality_score?: number;
    background_noise_level?: number;
    voice_analysis?: {
        is_synthetic: boolean;
        confidence: number;
        voice_characteristics: string[];
    };
    device_fingerprint?: {
        user_agent?: string;
        browser_info?: string;
        screen_resolution?: string;
        timezone?: string;
    };
}
export interface FraudAnalysisRequest {
    phone_hash: string;
    feedback_content: string;
    business_context: BusinessContext;
    caller_metadata?: CallerMetadata;
    analysis_options?: {
        skip_context_analysis?: boolean;
        skip_keyword_detection?: boolean;
        skip_behavioral_analysis?: boolean;
        custom_thresholds?: {
            fraud_threshold?: number;
            context_weight?: number;
            keyword_weight?: number;
            behavioral_weight?: number;
            transaction_weight?: number;
        };
    };
}
export interface FraudAnalysisResponse {
    success: boolean;
    phone_hash: string;
    is_fraudulent: boolean;
    composite_score: number;
    risk_level: RiskLevel;
    analysis_breakdown: {
        context_analysis: {
            score: number;
            legitimacy_assessment: string;
            language_authenticity: number;
            suspicious_elements: string[];
        };
        keyword_detection: {
            score: number;
            keywords_found: number;
            severity_breakdown: Record<KeywordCategory, number>;
            most_severe_matches: KeywordMatch[];
        };
        behavioral_patterns: {
            score: number;
            patterns_detected: PatternType[];
            violation_count: number;
            risk_factors: string[];
        };
        transaction_verification: {
            score: number;
            verification_status: string;
            anomalies_detected: string[];
        };
    };
    recommendations: string[];
    processing_time_ms: number;
    analysis_id: string;
    created_at: string;
}
export interface FraudDetectionError {
    error: string;
    message: string;
    code: string;
    details?: Record<string, any>;
    timestamp: string;
    request_id?: string;
}
export interface ValidationError extends FraudDetectionError {
    error: 'validation_error';
    field_errors: FieldError[];
}
export interface FieldError {
    field: string;
    message: string;
    value?: any;
    constraint: string;
}
export interface FraudDetectionConfig {
    fraud_threshold: number;
    component_weights: {
        context: number;
        keywords: number;
        behavioral: number;
        transaction: number;
    };
    gpt_config: {
        model: string;
        max_tokens: number;
        temperature: number;
        timeout_ms: number;
    };
    behavioral_thresholds: {
        call_frequency_per_minute: number;
        similarity_threshold: number;
        burst_detection_window_seconds: number;
    };
    cache_settings: {
        fraud_score_ttl_minutes: number;
        context_analysis_ttl_minutes: number;
        behavioral_pattern_ttl_minutes: number;
    };
}
export interface FraudDetectionStats {
    total_analyses_performed: number;
    fraud_detection_rate: number;
    average_processing_time_ms: number;
    component_accuracy: {
        context: number;
        keywords: number;
        behavioral: number;
        transaction: number;
    };
    false_positive_rate: number;
    false_negative_rate: number;
    last_updated: string;
}
//# sourceMappingURL=fraud.d.ts.map