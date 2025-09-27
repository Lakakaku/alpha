import { Database } from '@vocilia/types';

export type CallQualityMetrics = Database['public']['Tables']['call_quality_metrics']['Row'];
export type CallQualityMetricsInsert = Database['public']['Tables']['call_quality_metrics']['Insert'];
export type CallQualityMetricsUpdate = Database['public']['Tables']['call_quality_metrics']['Update'];

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface CreateCallQualityMetricsData {
  call_session_id: string;
  connection_quality: ConnectionQuality;
  audio_clarity_score?: number;
  latency_ms?: number;
  packet_loss_percentage?: number;
  openai_api_latency?: number;
  technical_errors?: TechnicalError[];
  bandwidth_usage_kb?: number;
  device_info?: DeviceInfo;
}

export interface TechnicalError {
  error_type: string;
  error_message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recovery_attempted?: boolean;
}

export interface DeviceInfo {
  user_agent?: string;
  browser?: string;
  browser_version?: string;
  operating_system?: string;
  device_type?: 'desktop' | 'tablet' | 'mobile';
  screen_resolution?: string;
  network_type?: string;
}

export interface QualityMetricsSummary {
  connection_quality: ConnectionQuality;
  overall_quality_score?: number;
  performance_issues?: string[];
  recommendations?: string[];
}

export interface QualityThresholds {
  audio_clarity_excellent: number;
  audio_clarity_good: number;
  latency_excellent: number;
  latency_good: number;
  packet_loss_excellent: number;
  packet_loss_good: number;
}

export const CONNECTION_QUALITY_VALUES: ConnectionQuality[] = [
  'excellent',
  'good', 
  'fair',
  'poor'
];

export const QUALITY_THRESHOLDS: QualityThresholds = {
  audio_clarity_excellent: 0.9,
  audio_clarity_good: 0.7,
  latency_excellent: 100, // ms
  latency_good: 300, // ms
  packet_loss_excellent: 1.0, // %
  packet_loss_good: 3.0 // %
};

export const AUDIO_CLARITY_RANGE = { min: 0.0, max: 1.0 };
export const MAX_ACCEPTABLE_LATENCY_MS = 500;
export const MAX_ACCEPTABLE_PACKET_LOSS_PERCENT = 5.0;