import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { OpenAIService, RealtimeSessionConfig, QualityAnalysisResult } from '../ai/openaiService';
import { PhoneService, CallInitiationRequest } from '../telephony/phoneService';
import { 
  FeedbackCallSession, 
  SessionStatus, 
  CreateFeedbackCallSessionData, 
  UpdateFeedbackCallSessionData,
  MAX_RETRY_COUNT 
} from '../../models/feedbackCallSession';
import { 
  ConversationMessage, 
  CreateConversationTranscriptData 
} from '../../models/conversationTranscript';
import { CreateQualityAssessmentData } from '../../models/qualityAssessment';
import { BusinessContextProfile } from '../../models/businessContextProfile';

export class CallManagerService {
  private supabase;
  private openaiService: OpenAIService;
  private phoneService: PhoneService;
  private redis: any; // Redis client for session state

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.openaiService = new OpenAIService();
    this.phoneService = new PhoneService();
    
    // Initialize Redis for session state management
    this.initializeRedis();
  }

  async initiateCall(request: CallInitiationRequestData): Promise<CallInitiationResult> {
    // Check for existing sessions for this customer verification
    const existingSession = await this.findExistingSession(request.customer_verification_id);
    
    if (existingSession && this.isSessionActive(existingSession)) {
      throw new CallManagerError(
        'CALL_ALREADY_EXISTS', 
        'Call already exists for this customer verification',
        { existing_session_id: existingSession.id }
      );
    }

    // Check retry limits
    if (existingSession && existingSession.retry_count >= MAX_RETRY_COUNT) {
      throw new CallManagerError(
        'MAX_RETRIES_EXCEEDED',
        'Maximum retry attempts exceeded for this customer',
        { retry_count: existingSession.retry_count }
      );
    }

    // Validate phone number
    const phoneValidation = await this.phoneService.validatePhoneNumber(request.phone_number);
    if (!phoneValidation.is_valid) {
      throw new CallManagerError(
        'INVALID_PHONE_NUMBER',
        'Invalid phone number format',
        { validation_errors: phoneValidation.validation_errors }
      );
    }

    // Get business context for AI conversation
    const businessContext = await this.getBusinessContext(request.store_id);
    
    // Create call session record
    const sessionData: CreateFeedbackCallSessionData = {
      customer_verification_id: request.customer_verification_id,
      store_id: request.store_id,
      phone_number: request.phone_number,
      session_status: 'pending',
      call_initiated_at: new Date(),
      retry_count: existingSession ? existingSession.retry_count + 1 : 0
    };

    const { data: session, error } = await this.supabase
      .from('feedback_call_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error || !session) {
      throw new CallManagerError('DATABASE_ERROR', 'Failed to create call session', error);
    }

    try {
      // Initialize OpenAI Realtime session
      const realtimeConfig: RealtimeSessionConfig = {
        businessContext,
        customerPhone: request.phone_number
      };
      const openaiSessionId = await this.openaiService.initializeRealtimeSession(realtimeConfig);

      // Update session with OpenAI session ID
      await this.updateSession(session.id, { openai_session_id: openaiSessionId });

      // Store session state in Redis
      await this.storeSessionState(session.id, {
        business_context: businessContext,
        openai_session_id: openaiSessionId,
        phone_number: request.phone_number,
        status: 'pending'
      });

      // Initiate phone call
      const phoneRequest: CallInitiationRequest = {
        callSessionId: session.id,
        customerPhone: request.phone_number,
        storeId: request.store_id,
        customerVerificationId: request.customer_verification_id,
        priority: request.priority
      };

      const phoneResponse = await this.phoneService.initiateCall(phoneRequest);

      return {
        call_session_id: session.id,
        status: 'queued',
        estimated_call_time: phoneResponse.estimated_connection_time || new Date(Date.now() + 30000),
        retry_count: sessionData.retry_count || 0,
        openai_session_id: openaiSessionId,
        external_call_id: phoneResponse.external_call_id
      };

    } catch (error: any) {
      // Clean up failed session
      await this.updateSession(session.id, { 
        session_status: 'failed', 
        failure_reason: error.message 
      });
      
      throw new CallManagerError(
        'CALL_INITIATION_FAILED',
        'Failed to initiate call',
        { original_error: error.message }
      );
    }
  }

  async getCallStatus(callSessionId: string): Promise<CallStatusResult> {
    const { data: session, error } = await this.supabase
      .from('feedback_call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .single();

    if (error || !session) {
      throw new CallManagerError('SESSION_NOT_FOUND', 'Call session not found');
    }

    // Get session state from Redis
    const sessionState = await this.getSessionState(callSessionId);
    
    // Get call quality metrics if available
    const qualityMetrics = await this.getCallQualityMetrics(callSessionId);

    return {
      call_session_id: callSessionId,
      status: session.session_status as SessionStatus,
      current_retry: session.retry_count || 0,
      duration_seconds: session.duration_seconds || null,
      quality_metrics: qualityMetrics || null,
      failure_reason: session.failure_reason || null,
      conversation_active: sessionState?.openai_session_active || false,
      estimated_completion: this.estimateCallCompletion(session)
    };
  }

  async submitTranscript(
    callSessionId: string, 
    transcript: TranscriptSubmissionData
  ): Promise<TranscriptSubmissionResult> {
    // Validate session exists and is in correct state
    const session = await this.validateSessionForTranscript(callSessionId);

    // Store conversation transcript
    const transcriptRecords: CreateConversationTranscriptData[] = transcript.messages.map((msg, index) => ({
      call_session_id: callSessionId,
      speaker: msg.speaker,
      message_order: msg.message_order || index,
      content: msg.content,
      timestamp_ms: msg.timestamp_ms,
      confidence_score: msg.confidence_score,
      language_detected: msg.language_detected || 'sv',
      message_type: msg.message_type || 'response'
    }));

    const { error: transcriptError } = await this.supabase
      .from('conversation_transcripts')
      .insert(transcriptRecords);

    if (transcriptError) {
      throw new CallManagerError('TRANSCRIPT_STORAGE_FAILED', 'Failed to store transcript', transcriptError);
    }

    // Update session with completion data
    const sessionUpdate: UpdateFeedbackCallSessionData = {
      session_status: 'completed',
      call_ended_at: new Date(),
      duration_seconds: transcript.total_duration_seconds
    };

    await this.updateSession(callSessionId, sessionUpdate);

    // Store call quality metrics if provided
    if (transcript.final_audio_quality) {
      await this.storeCallQualityMetrics(callSessionId, transcript.final_audio_quality);
    }

    // Queue transcript for analysis
    await this.queueTranscriptAnalysis(callSessionId, transcript.messages);

    return {
      transcript_id: `${callSessionId}-transcript`,
      analysis_queued: true,
      estimated_analysis_completion: new Date(Date.now() + 30000), // ~30 seconds
      stored_messages_count: transcriptRecords.length
    };
  }

  async processAnalysisResults(
    callSessionId: string,
    analysisResult: QualityAnalysisResult
  ): Promise<void> {
    // Store quality assessment
    const assessmentData: CreateQualityAssessmentData = {
      call_session_id: callSessionId,
      legitimacy_score: analysisResult.scores.legitimacy_score,
      depth_score: analysisResult.scores.depth_score,
      usefulness_score: analysisResult.scores.usefulness_score,
      overall_quality_score: analysisResult.scores.overall_quality_score,
      reward_percentage: analysisResult.reward_percentage,
      is_fraudulent: analysisResult.is_fraudulent,
      fraud_reasons: analysisResult.fraud_reasons,
      analysis_summary: JSON.stringify(analysisResult.key_insights),
      business_actionable_items: analysisResult.actionable_items,
      analysis_metadata: {
        business_value_reasoning: analysisResult.business_value_reasoning,
        analysis_timestamp: new Date().toISOString()
      }
    };

    const { error } = await this.supabase
      .from('quality_assessments')
      .insert(assessmentData);

    if (error) {
      throw new CallManagerError('ASSESSMENT_STORAGE_FAILED', 'Failed to store quality assessment', error);
    }

    // Clean up Redis session state
    await this.clearSessionState(callSessionId);
  }

  async retryFailedCall(customerVerificationId: string): Promise<CallRetryResult> {
    const existingSession = await this.findExistingSession(customerVerificationId);
    
    if (!existingSession) {
      throw new CallManagerError('NO_EXISTING_SESSION', 'No existing session found for retry');
    }

    if (existingSession.retry_count >= MAX_RETRY_COUNT - 1) { // -1 because we're about to increment
      throw new CallManagerError('MAX_RETRIES_EXCEEDED', 'Maximum retries exceeded');
    }

    // Create new retry session
    const retryRequest: CallInitiationRequestData = {
      customer_verification_id: customerVerificationId,
      phone_number: existingSession.phone_number,
      store_id: existingSession.store_id,
      priority: 'high' // Higher priority for retries
    };

    const result = await this.initiateCall(retryRequest);

    return {
      new_call_session_id: result.call_session_id,
      retry_number: result.retry_count,
      estimated_call_time: result.estimated_call_time,
      previous_session_id: existingSession.id
    };
  }

  private async initializeRedis(): Promise<void> {
    const Redis = require('ioredis');
    this.redis = new Redis(process.env.REDIS_URL);
  }

  private async findExistingSession(customerVerificationId: string): Promise<FeedbackCallSession | null> {
    const { data, error } = await this.supabase
      .from('feedback_call_sessions')
      .select('*')
      .eq('customer_verification_id', customerVerificationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return error ? null : data;
  }

  private isSessionActive(session: FeedbackCallSession): boolean {
    const activeStatuses: SessionStatus[] = ['pending', 'in_progress'];
    return activeStatuses.includes(session.session_status as SessionStatus);
  }

  private async getBusinessContext(storeId: string): Promise<BusinessContextProfile> {
    const { data, error } = await this.supabase
      .from('business_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .order('context_version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new CallManagerError('BUSINESS_CONTEXT_NOT_FOUND', 'Business context not found for store');
    }

    return data as BusinessContextProfile;
  }

  private async updateSession(sessionId: string, updates: UpdateFeedbackCallSessionData): Promise<void> {
    const { error } = await this.supabase
      .from('feedback_call_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      throw new CallManagerError('SESSION_UPDATE_FAILED', 'Failed to update session', error);
    }
  }

  private async storeSessionState(sessionId: string, state: any): Promise<void> {
    await this.redis.setex(`call_session:${sessionId}`, 7200, JSON.stringify(state)); // 2 hour TTL
  }

  private async getSessionState(sessionId: string): Promise<any | null> {
    const state = await this.redis.get(`call_session:${sessionId}`);
    return state ? JSON.parse(state) : null;
  }

  private async clearSessionState(sessionId: string): Promise<void> {
    await this.redis.del(`call_session:${sessionId}`);
  }

  private async validateSessionForTranscript(callSessionId: string): Promise<FeedbackCallSession> {
    const { data: session, error } = await this.supabase
      .from('feedback_call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .single();

    if (error || !session) {
      throw new CallManagerError('SESSION_NOT_FOUND', 'Call session not found');
    }

    if (session.session_status === 'completed') {
      throw new CallManagerError('SESSION_ALREADY_COMPLETED', 'Session already has transcript');
    }

    return session as FeedbackCallSession;
  }

  private async getCallQualityMetrics(callSessionId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('call_quality_metrics')
      .select('*')
      .eq('call_session_id', callSessionId)
      .maybeSingle();

    return error ? null : data;
  }

  private async storeCallQualityMetrics(callSessionId: string, qualityData: any): Promise<void> {
    const { error } = await this.supabase
      .from('call_quality_metrics')
      .insert({
        call_session_id: callSessionId,
        ...qualityData,
        measured_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store call quality metrics:', error);
    }
  }

  private async queueTranscriptAnalysis(callSessionId: string, messages: ConversationMessage[]): Promise<void> {
    // Queue analysis job (implementation depends on job queue system)
    await this.redis.lpush('analysis_queue', JSON.stringify({
      type: 'transcript_analysis',
      call_session_id: callSessionId,
      messages: messages,
      queued_at: new Date().toISOString()
    }));
  }

  private estimateCallCompletion(session: FeedbackCallSession): Date | null {
    if (session.session_status === 'in_progress' && session.call_connected_at) {
      // Estimate 90 seconds average call duration
      return new Date(new Date(session.call_connected_at).getTime() + 90000);
    }
    return null;
  }
}

// Type definitions
export interface CallInitiationRequestData {
  customer_verification_id: string;
  phone_number: string;
  store_id: string;
  priority?: 'normal' | 'high';
}

export interface CallInitiationResult {
  call_session_id: string;
  status: 'queued' | 'failed';
  estimated_call_time: Date;
  retry_count: number;
  openai_session_id?: string;
  external_call_id?: string;
}

export interface CallStatusResult {
  call_session_id: string;
  status: SessionStatus;
  current_retry: number;
  duration_seconds: number | null;
  quality_metrics: any | null;
  failure_reason: string | null;
  conversation_active: boolean;
  estimated_completion: Date | null;
}

export interface TranscriptSubmissionData {
  messages: ConversationMessage[];
  total_duration_seconds: number;
  openai_session_id?: string;
  final_audio_quality?: any;
}

export interface TranscriptSubmissionResult {
  transcript_id: string;
  analysis_queued: boolean;
  estimated_analysis_completion: Date;
  stored_messages_count: number;
}

export interface CallRetryResult {
  new_call_session_id: string;
  retry_number: number;
  estimated_call_time: Date;
  previous_session_id: string;
}

export class CallManagerError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CallManagerError';
  }
}