import { Database } from '@vocilia/types';

export type FeedbackCallSession = Database['public']['Tables']['feedback_call_sessions']['Row'];
export type FeedbackCallSessionInsert = Database['public']['Tables']['feedback_call_sessions']['Insert'];
export type FeedbackCallSessionUpdate = Database['public']['Tables']['feedback_call_sessions']['Update'];

export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'abandoned';

export interface CreateFeedbackCallSessionData {
  customer_verification_id: string;
  store_id: string;
  phone_number: string;
  session_status?: SessionStatus;
  call_initiated_at?: Date;
  retry_count?: number;
  openai_session_id?: string;
}

export interface UpdateFeedbackCallSessionData {
  session_status?: SessionStatus;
  call_connected_at?: Date;
  call_ended_at?: Date;
  duration_seconds?: number;
  retry_count?: number;
  failure_reason?: string;
  openai_session_id?: string;
}

export interface FeedbackCallSessionWithDetails extends FeedbackCallSession {
  store_name?: string;
  customer_phone_masked?: string;
}

export const SESSION_STATUS_VALUES: SessionStatus[] = [
  'pending',
  'in_progress', 
  'completed',
  'failed',
  'abandoned'
];

export const MAX_RETRY_COUNT = 3;
export const DATA_RETENTION_DAYS = 90;