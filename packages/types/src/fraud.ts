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

// ==================== FRAUD SCORES ====================

export interface FraudScore {
  id: string;
  phone_hash: string;
  context_score: number; // 0-40 (40% weight)
  keyword_score: number; // 0-20 (20% weight)
  behavioral_score: number; // 0-30 (30% weight)
  transaction_score: number; // 0-10 (10% weight)
  composite_score: number; // 0-100 (sum of all)
  risk_level: RiskLevel;
  fraud_probability: number; // 0.0-1.0
  confidence_level: number; // 0.0-1.0
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
  is_fraudulent: boolean; // true if composite_score >= 70
  fraud_score: FraudScore;
  contributing_factors: ContributingFactor[];
  recommendations: string[];
}

// ==================== CONTEXT ANALYSIS ====================

export interface ContextAnalysis {
  id: string;
  phone_hash: string;
  feedback_content: string;
  language_detected: string; // 'sv', 'en', etc.
  business_context: BusinessContext;
  gpt_analysis: GPTAnalysis;
  legitimacy_score: number; // 0-100
  confidence_score: number; // 0-100
  analysis_metadata: ContextAnalysisMetadata;
  created_at: string;
}

export interface GPTAnalysis {
  model_version: string; // 'gpt-4o-mini'
  prompt_version: string;
  response_content: string;
  reasoning: string;
  language_authenticity: number; // 0-100
  cultural_context_match: number; // 0-100
  content_coherence: number; // 0-100
  impossible_claims_detected: string[];
  suspicious_patterns: string[];
  processing_time_ms: number;
}

export interface BusinessContext {
  business_id: string;
  business_type: string; // 'restaurant', 'retail', etc.
  location: string;
  language: string; // 'sv' primary
  typical_feedback_patterns?: string[];
  service_categories?: string[];
}

export interface ContextAnalysisMetadata {
  text_length: number;
  word_count: number;
  sentence_count: number;
  language_complexity: number; // 0-100
  sentiment_score: number; // -1 to 1
  topic_distribution: Record<string, number>;
  processing_duration: number;
}

// ==================== KEYWORD DETECTION ====================

export interface RedFlagKeyword {
  id: string;
  keyword: string;
  category: KeywordCategory;
  severity_level: number; // 1-10
  language_code: string; // 'sv', 'en', etc.
  detection_pattern: string; // Regex pattern
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
  total_severity_score: number; // Sum of matched keyword severities
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
  context_snippet: string; // Surrounding text
}

export interface KeywordRequest {
  keyword: string;
  category: KeywordCategory;
  severity_level: number;
  language_code?: string; // defaults to 'sv'
  detection_pattern?: string; // optional regex
}

// ==================== BEHAVIORAL PATTERNS ====================

export interface BehavioralPattern {
  id: string;
  phone_hash: string;
  pattern_type: PatternType;
  risk_score: number; // 0-100
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
  // Call Frequency
  calls_per_minute?: number;
  calls_per_hour?: number;
  burst_detection?: {
    burst_count: number;
    burst_duration_seconds: number;
    average_interval_seconds: number;
  };

  // Time Patterns
  time_distribution?: {
    business_hours_ratio: number; // 0-1
    off_hours_calls: number;
    weekend_calls: number;
    night_calls: number; // 22:00-06:00
  };

  // Location Patterns (if available)
  location_spread?: {
    unique_locations: number;
    max_distance_km: number;
    impossible_travel_detected: boolean;
  };

  // Similarity Patterns
  content_similarity?: {
    average_similarity_score: number; // 0-1
    duplicate_content_ratio: number; // 0-1
    template_usage_detected: boolean;
    variation_coefficient: number; // Lower = more similar
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
  time_window?: string; // '30m', '24h', '7d', '30d'
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

// ==================== SHARED ENUMS & TYPES ====================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContributingFactor {
  component: 'context' | 'keywords' | 'behavioral' | 'transaction';
  score: number;
  weight_percent: number; // 40, 20, 30, 10
  risk_indicators: string[];
  confidence: number; // 0-100
}

export interface CallerMetadata {
  call_timestamp: string;
  call_duration_seconds?: number;
  call_quality_score?: number; // 0-100
  background_noise_level?: number; // 0-100
  voice_analysis?: {
    is_synthetic: boolean;
    confidence: number; // 0-100
    voice_characteristics: string[];
  };
  device_fingerprint?: {
    user_agent?: string;
    browser_info?: string;
    screen_resolution?: string;
    timezone?: string;
  };
}

// ==================== API REQUEST/RESPONSE TYPES ====================

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
      fraud_threshold?: number; // default 70
      context_weight?: number; // default 40
      keyword_weight?: number; // default 20
      behavioral_weight?: number; // default 30
      transaction_weight?: number; // default 10
    };
  };
}

export interface FraudAnalysisResponse {
  success: boolean;
  phone_hash: string;
  is_fraudulent: boolean;
  composite_score: number; // 0-100
  risk_level: RiskLevel;
  analysis_breakdown: {
    context_analysis: {
      score: number; // 0-40
      legitimacy_assessment: string;
      language_authenticity: number;
      suspicious_elements: string[];
    };
    keyword_detection: {
      score: number; // 0-20
      keywords_found: number;
      severity_breakdown: Record<KeywordCategory, number>;
      most_severe_matches: KeywordMatch[];
    };
    behavioral_patterns: {
      score: number; // 0-30
      patterns_detected: PatternType[];
      violation_count: number;
      risk_factors: string[];
    };
    transaction_verification: {
      score: number; // 0-10
      verification_status: string;
      anomalies_detected: string[];
    };
  };
  recommendations: string[];
  processing_time_ms: number;
  analysis_id: string;
  created_at: string;
}

// ==================== ERROR TYPES ====================

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

// ==================== CONFIGURATION TYPES ====================

export interface FraudDetectionConfig {
  fraud_threshold: number; // 70 default
  component_weights: {
    context: number; // 40 default
    keywords: number; // 20 default
    behavioral: number; // 30 default
    transaction: number; // 10 default
  };
  gpt_config: {
    model: string; // 'gpt-4o-mini'
    max_tokens: number;
    temperature: number;
    timeout_ms: number;
  };
  behavioral_thresholds: {
    call_frequency_per_minute: number;
    similarity_threshold: number; // 0-1
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
  fraud_detection_rate: number; // 0-1
  average_processing_time_ms: number;
  component_accuracy: {
    context: number; // 0-100
    keywords: number; // 0-100
    behavioral: number; // 0-100
    transaction: number; // 0-100
  };
  false_positive_rate: number; // 0-1
  false_negative_rate: number; // 0-1
  last_updated: string;
}