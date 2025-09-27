import { Database } from '@vocilia/types';

export type QualityAssessment = Database['public']['Tables']['quality_assessments']['Row'];
export type QualityAssessmentInsert = Database['public']['Tables']['quality_assessments']['Insert'];
export type QualityAssessmentUpdate = Database['public']['Tables']['quality_assessments']['Update'];

export interface CreateQualityAssessmentData {
  call_session_id: string;
  legitimacy_score: number;
  depth_score: number;
  usefulness_score: number;
  overall_quality_score: number;
  reward_percentage: number;
  is_fraudulent?: boolean;
  fraud_reasons?: string[];
  analysis_summary?: string;
  business_actionable_items?: ActionableItem[];
  analysis_metadata?: AssessmentMetadata;
}

export interface ActionableItem {
  category: 'product' | 'service' | 'environment' | 'staff' | 'pricing' | 'accessibility';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  department?: string;
  estimated_impact: 'minor' | 'moderate' | 'significant' | 'major';
  implementation_complexity: 'simple' | 'moderate' | 'complex';
}

export interface AssessmentMetadata {
  model_version?: string;
  analysis_duration_ms?: number;
  confidence_metrics?: Record<string, number>;
  processing_stages?: string[];
}

export interface QualityScores {
  legitimacy_score: number;
  depth_score: number;
  usefulness_score: number;
  overall_quality_score: number;
}

export const MIN_REWARD_PERCENTAGE = 2.0;
export const MAX_REWARD_PERCENTAGE = 15.0;
export const QUALITY_SCORE_RANGE = { min: 0.0, max: 1.0 };
export const REWARD_QUALIFYING_THRESHOLD = 0.02;