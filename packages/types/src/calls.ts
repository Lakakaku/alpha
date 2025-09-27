export type CallSessionStatus =
  | 'initiated'
  | 'connecting'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'timeout';

export type CallEventType =
  | 'initiated'
  | 'connecting'
  | 'answered'
  | 'ai_connected'
  | 'question_asked'
  | 'response_received'
  | 'warning_sent'
  | 'timeout'
  | 'completed'
  | 'failed';

export type CallEventSource =
  | 'system'
  | 'telephony'
  | 'ai'
  | 'customer';

export type QuestionPriority =
  | 'high'
  | 'medium'
  | 'low';

export interface CallSession {
  id: string;
  business_id: string;
  customer_phone: string; // Encrypted
  verification_id: string;
  status: CallSessionStatus;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  questions_asked: string[]; // Array of question IDs
  ai_session_id: string | null;
  telephony_call_id: string | null;
  cost_estimate: number | null;
  recording_url: string | null;
  transcript: string | null;
  // Customer Interface Polish enhancements
  completion_confirmed_at: string | null; // Customer confirmation timestamp
  customer_satisfaction_rating: number | null; // 1-5 scale
  reward_timeline_shown_at: string | null; // When reward timeline was displayed
  quality_rating: number | null; // 1-10 call quality rating
  completion_method: 'auto' | 'customer_confirmed' | 'timeout' | null; // How call was marked complete
  created_at: string;
  updated_at: string;
}

export interface QuestionConfiguration {
  id: string;
  business_id: string;
  question_text: string;
  frequency: number; // Ask every Nth customer (1-100)
  priority: QuestionPriority;
  department_tags: string[];
  active_from: string | null;
  active_until: string | null;
  is_active: boolean;
  max_response_time: number; // Seconds
  follow_up_prompts: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CallEvent {
  id: string;
  call_session_id: string;
  event_type: CallEventType;
  event_data: Record<string, any>;
  timestamp: string;
  source: CallEventSource;
  metadata: Record<string, any> | null;
}

export interface CallResponse {
  id: string;
  call_session_id: string;
  question_id: string;
  question_text: string;
  response_text: string;
  response_duration: number;
  confidence_score: number | null;
  sentiment_score: number | null;
  asked_at: string;
  responded_at: string | null;
  ai_analysis: Record<string, any> | null;
  created_at: string;
}

export interface QuestionSelectionLog {
  id: string;
  business_id: string;
  customer_count: number;
  selected_questions: string[];
  selection_algorithm: string;
  selection_criteria: Record<string, any>;
  time_budget_seconds: number;
  estimated_duration: number;
  created_at: string;
}

// API Request/Response Types
export interface InitiateCallRequest {
  verificationId: string;
  businessId: string;
  customerPhone: string;
  priority?: 'normal' | 'high';
}

export interface CallSessionResponse {
  id: string;
  businessId: string;
  status: CallSessionStatus;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  questionsAsked: string[];
  costEstimate: number | null;
  recordingUrl: string | null;
}

export interface CompleteCallRequest {
  reason: 'completed' | 'timeout' | 'technical_failure' | 'customer_hangup';
  transcript?: string;
  responses?: CallResponseInput[];
}

export interface CallResponseInput {
  questionId: string;
  questionText: string;
  responseText: string;
  responseDuration: number;
  confidenceScore?: number;
  sentimentScore?: number;
  askedAt: string;
  respondedAt?: string;
}

export interface QuestionSelectionRequest {
  businessId: string;
  customerCount: number;
  timeBudgetSeconds?: number;
  customerContext?: Record<string, any>;
}

export interface SelectedQuestion {
  id: string;
  questionText: string;
  priority: QuestionPriority;
  maxResponseTime: number;
  followUpPrompts?: string[];
}

export interface QuestionSelectionResponse {
  selectedQuestions: SelectedQuestion[];
  estimatedDuration: number;
  selectionCriteria: Record<string, any>;
}

export interface CallEventResponse {
  id: string;
  eventType: CallEventType;
  eventData: Record<string, any>;
  timestamp: string;
  source: CallEventSource;
}

// Error types
export interface CallError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Call duration constraints
export const CALL_DURATION_LIMITS = {
  MIN_SECONDS: 60,
  MAX_SECONDS: 120,
  WARNING_THRESHOLD: 0.8, // 80% of max duration
} as const;

// Question constraints
export const QUESTION_CONSTRAINTS = {
  MIN_TEXT_LENGTH: 10,
  MAX_TEXT_LENGTH: 500,
  MIN_FREQUENCY: 1,
  MAX_FREQUENCY: 100,
  DEFAULT_RESPONSE_TIME: 30,
  MAX_RESPONSE_TIME: 60,
} as const;

// Call cost constraints
export const CALL_COST_LIMITS = {
  MAX_COST_PER_CALL: 0.25, // $0.25
  WARNING_THRESHOLD: 0.20, // $0.20
} as const;

// Enhanced API types for Customer Interface Polish
export interface CallStatusRequest {
  sessionId: string;
  includeTimeline?: boolean;
}

export interface CallStatusResponse {
  sessionId: string;
  status: CallSessionStatus;
  progress: {
    current_step: 'connecting' | 'questions' | 'completion' | 'finished';
    total_steps: number;
    completed_steps: number;
    estimated_remaining_seconds: number | null;
  };
  timeline?: CallTimelineEvent[];
  can_confirm_completion: boolean;
  reward_info?: {
    estimated_reward_sek: number;
    reward_timeline: string; // ISO timestamp when reward will be available
    reward_status: 'pending' | 'processing' | 'available';
  };
}

export interface CallTimelineEvent {
  timestamp: string; // ISO timestamp
  event: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
}

export interface CallCompletionConfirmRequest {
  sessionId: string;
  customer_confirmed: boolean;
  satisfaction_rating?: number; // 1-5 scale
  quality_rating?: number; // 1-10 scale
  feedback_text?: string;
}

export interface CallCompletionConfirmResponse {
  success: boolean;
  confirmation_timestamp: string;
  reward_info: {
    reward_amount_sek: number;
    reward_available_at: string; // ISO timestamp
    reward_reference: string;
  };
  next_steps: string[];
}