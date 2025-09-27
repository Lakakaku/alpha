import { Database } from '@vocilia/types';

export type FraudDetectionResult = Database['public']['Tables']['fraud_detection_results']['Row'];
export type FraudDetectionResultInsert = Database['public']['Tables']['fraud_detection_results']['Insert'];
export type FraudDetectionResultUpdate = Database['public']['Tables']['fraud_detection_results']['Update'];

export type CheckType = 'timing' | 'content' | 'context' | 'pattern';
export type ReviewDecision = 'confirmed_fraud' | 'false_positive' | 'needs_investigation';

export interface CreateFraudDetectionResultData {
  call_session_id: string;
  check_type: CheckType;
  is_suspicious: boolean;
  confidence_level: number;
  fraud_indicators?: string[];
  context_violations?: ContextViolation[];
  decision_reasoning?: string;
  manual_review_required?: boolean;
  reviewed_by?: string;
  review_decision?: ReviewDecision;
}

export interface ContextViolation {
  violation_type: string;
  expected_value: string;
  actual_value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface FraudCheckRequest {
  call_session_id: string;
  check_types: CheckType[];
  business_context?: Record<string, any>;
  force_recheck?: boolean;
}

export interface FraudCheckResponse {
  fraud_results: FraudDetectionResult[];
  overall_is_fraudulent: boolean;
  confidence_level: number;
  should_exclude_from_rewards: boolean;
  summary_reasoning?: string;
}

export interface FraudPattern {
  pattern_type: string;
  description: string;
  indicators: string[];
  severity_weight: number;
  minimum_confidence: number;
}

export interface FraudStatistics {
  total_checks: number;
  suspicious_count: number;
  confirmed_fraud_count: number;
  false_positive_count: number;
  fraud_rate_percentage: number;
  top_fraud_indicators: string[];
}

export const CHECK_TYPE_VALUES: CheckType[] = [
  'timing',
  'content', 
  'context',
  'pattern'
];

export const REVIEW_DECISION_VALUES: ReviewDecision[] = [
  'confirmed_fraud',
  'false_positive',
  'needs_investigation'
];

export const VIOLATION_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const;

export const CONFIDENCE_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.8,
  MEDIUM_CONFIDENCE: 0.6,
  LOW_CONFIDENCE: 0.4,
  MANUAL_REVIEW_THRESHOLD: 0.7
};

export const FRAUD_EXCLUSION_THRESHOLD = 0.6;