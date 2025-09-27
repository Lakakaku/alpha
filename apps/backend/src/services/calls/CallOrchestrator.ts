import { CallSession, CallSessionStatus, InitiateCallRequest, CallSessionResponse } from '@vocilia/types';
import { CallSessionModel } from '../../models/CallSession';
import { CallEventModel } from '../../models/CallEvent';
import { QuestionSelector } from './QuestionSelector';
import { FortyElksService } from '../telephony/FortyElksService';
import { TwilioService } from '../telephony/TwilioService';
import { OpenAIVoiceService } from '../ai/OpenAIVoiceService';
import { CallLogger } from './CallLogger';
import { CostTracker } from './CostTracker';
import { TelephonyService, TelephonyProvider } from '@vocilia/types';

export class CallOrchestrator {
  private questionSelector: QuestionSelector;
  private primaryTelephonyService: TelephonyService;
  private fallbackTelephonyService: TelephonyService;
  private aiService: OpenAIVoiceService;
  private callLogger: CallLogger;
  private costTracker: CostTracker;

  constructor() {
    this.questionSelector = new QuestionSelector();
    this.primaryTelephonyService = new FortyElksService();
    this.fallbackTelephonyService = new TwilioService();
    this.aiService = new OpenAIVoiceService();
    this.callLogger = new CallLogger();
    this.costTracker = new CostTracker();
  }

  async initiateCall(request: InitiateCallRequest): Promise<CallSessionResponse> {
    try {
      // Validate the verification
      await this.validateVerification(request.verificationId, request.businessId);

      // Create call session
      const session = await CallSessionModel.create({
        business_id: request.businessId,
        customer_phone: request.customerPhone,
        verification_id: request.verificationId,
        status: 'initiated',
        started_at: new Date().toISOString(),
      });

      // Log initiation event
      await CallEventModel.createInitiatedEvent(session.id, {
        priority: request.priority || 'normal',
        verificationId: request.verificationId,
      });

      // Start call processing in background
      this.processCallAsync(session.id).catch(error => {
        console.error(`Error processing call ${session.id}:`, error);
        this.handleCallFailure(session.id, 'technical_failure', error.message);
      });

      return this.formatCallSessionResponse(session);
    } catch (error) {
      console.error('Error initiating call:', error);
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  async getCallStatus(sessionId: string): Promise<CallSessionResponse> {
    try {
      const session = await CallSessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Call session not found');
      }

      return this.formatCallSessionResponse(session);
    } catch (error) {
      console.error('Error getting call status:', error);
      throw new Error(`Failed to get call status: ${error.message}`);
    }
  }

  async completeCall(sessionId: string, data: {
    reason: 'completed' | 'timeout' | 'technical_failure' | 'customer_hangup';
    transcript?: string;
    responses?: Array<{
      questionId: string;
      questionText: string;
      responseText: string;
      responseDuration: number;
      confidenceScore?: number;
      sentimentScore?: number;
      askedAt: string;
      respondedAt?: string;
    }>;
  }): Promise<CallSessionResponse> {
    try {
      const session = await CallSessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Call session not found');
      }

      // Check if already completed
      if (['completed', 'failed', 'timeout'].includes(session.status)) {
        throw new Error('Call session is already completed');
      }

      // Determine final status
      let finalStatus: CallSessionStatus;
      switch (data.reason) {
        case 'completed':
        case 'customer_hangup':
          finalStatus = 'completed';
          break;
        case 'timeout':
          finalStatus = 'timeout';
          break;
        case 'technical_failure':
          finalStatus = 'failed';
          break;
        default:
          finalStatus = 'failed';
      }

      // Calculate duration
      const duration = this.calculateCallDuration(session.started_at, session.connected_at);
      const costEstimate = await this.costTracker.calculateCallCost(session.id, duration);

      // Update session
      const updatedSession = await CallSessionModel.updateStatus(sessionId, finalStatus, {
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        transcript: data.transcript,
        cost_estimate: costEstimate,
      });

      // Save responses if provided
      if (data.responses && data.responses.length > 0) {
        await this.saveCallResponses(sessionId, data.responses);
      }

      // Log completion event
      if (finalStatus === 'completed') {
        await CallEventModel.createCompletedEvent(sessionId, {
          reason: data.reason,
          responseCount: data.responses?.length || 0,
          duration: duration,
          cost: costEstimate,
        });
      } else if (finalStatus === 'timeout') {
        await CallEventModel.createTimeoutEvent(sessionId, {
          reason: data.reason,
          duration: duration,
        });
      } else {
        await CallEventModel.createFailedEvent(sessionId, {
          reason: data.reason,
          error: 'Call completion failure',
        });
      }

      // Log call completion
      await this.callLogger.logCallCompletion(sessionId, finalStatus, {
        duration,
        cost: costEstimate,
        responseCount: data.responses?.length || 0,
      });

      return this.formatCallSessionResponse(updatedSession);
    } catch (error) {
      console.error('Error completing call:', error);
      throw new Error(`Failed to complete call: ${error.message}`);
    }
  }

  private async processCallAsync(sessionId: string): Promise<void> {
    try {
      // Get call session
      const session = await CallSessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Call session not found');
      }

      // Update status to connecting
      await CallSessionModel.updateStatus(sessionId, 'connecting');
      await CallEventModel.createConnectingEvent(sessionId);

      // Initiate telephony call
      let telephonyCallId: string;
      try {
        const callResult = await this.primaryTelephonyService.initiateCall({
          to: session.customer_phone,
          timeout: 30,
          record: true,
          maxDuration: 120,
        });

        if (callResult.status === 'failed') {
          throw new Error(callResult.message || 'Primary telephony service failed');
        }

        telephonyCallId = callResult.callId;
      } catch (primaryError) {
        console.warn('Primary telephony service failed, trying fallback:', primaryError);
        
        // Try fallback service
        const fallbackResult = await this.fallbackTelephonyService.initiateCall({
          to: session.customer_phone,
          timeout: 30,
          record: true,
          maxDuration: 120,
        });

        if (fallbackResult.status === 'failed') {
          throw new Error('Both telephony services failed');
        }

        telephonyCallId = fallbackResult.callId;
      }

      // Update session with telephony call ID
      await CallSessionModel.update(sessionId, {
        telephony_call_id: telephonyCallId,
      });

      // Wait for call to be answered (this would be handled by webhooks in production)
      // For now, we simulate the progression
      await this.simulateCallProgression(sessionId);

    } catch (error) {
      await this.handleCallFailure(sessionId, 'technical_failure', error.message);
    }
  }

  private async simulateCallProgression(sessionId: string): Promise<void> {
    // In production, this would be driven by real telephony webhooks
    // For now, we simulate the call progression for testing

    try {
      // Simulate call being answered after 5-10 seconds
      setTimeout(async () => {
        try {
          await CallSessionModel.updateStatus(sessionId, 'in_progress', {
            connected_at: new Date().toISOString(),
          });
          await CallEventModel.createAnsweredEvent(sessionId);

          // Select questions for the call
          const session = await CallSessionModel.findById(sessionId);
          if (session) {
            const questions = await this.questionSelector.selectQuestions({
              businessId: session.business_id,
              customerCount: 1, // This would be determined from business context
              timeBudgetSeconds: 90,
            });

            // Start AI conversation
            await this.aiService.startConversation(sessionId, questions.selectedQuestions);
            await CallEventModel.createAiConnectedEvent(sessionId, {
              questionCount: questions.selectedQuestions.length,
              estimatedDuration: questions.estimatedDuration,
            });
          }
        } catch (error) {
          console.error('Error in call progression:', error);
        }
      }, 5000 + Math.random() * 5000);

    } catch (error) {
      await this.handleCallFailure(sessionId, 'technical_failure', error.message);
    }
  }

  private async handleCallFailure(sessionId: string, reason: string, errorMessage: string): Promise<void> {
    try {
      await CallSessionModel.updateStatus(sessionId, 'failed', {
        ended_at: new Date().toISOString(),
      });

      await CallEventModel.createFailedEvent(sessionId, {
        reason,
        error: errorMessage,
      });

      await this.callLogger.logCallFailure(sessionId, reason, errorMessage);
    } catch (error) {
      console.error('Error handling call failure:', error);
    }
  }

  private async validateVerification(verificationId: string, businessId: string): Promise<void> {
    // In production, this would validate against the verification table
    // For now, we just check if the IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(verificationId)) {
      throw new Error('Invalid verification ID format');
    }
    
    if (!uuidRegex.test(businessId)) {
      throw new Error('Invalid business ID format');
    }

    // TODO: Add actual verification validation logic
    // - Check if verification exists
    // - Check if verification is complete
    // - Check if verification belongs to the business
    // - Check if verification is not expired
  }

  private calculateCallDuration(startedAt: string, connectedAt?: string): number {
    if (!connectedAt) {
      return 0;
    }

    const startTime = new Date(connectedAt).getTime();
    const endTime = new Date().getTime();
    return Math.round((endTime - startTime) / 1000);
  }

  private async saveCallResponses(sessionId: string, responses: Array<{
    questionId: string;
    questionText: string;
    responseText: string;
    responseDuration: number;
    confidenceScore?: number;
    sentimentScore?: number;
    askedAt: string;
    respondedAt?: string;
  }>): Promise<void> {
    const { CallResponseModel } = await import('../../models/CallResponse');
    
    for (const response of responses) {
      await CallResponseModel.create({
        call_session_id: sessionId,
        question_id: response.questionId,
        question_text: response.questionText,
        response_text: response.responseText,
        response_duration: response.responseDuration,
        confidence_score: response.confidenceScore,
        sentiment_score: response.sentimentScore,
        asked_at: response.askedAt,
        responded_at: response.respondedAt || new Date().toISOString(),
      });
    }
  }

  private formatCallSessionResponse(session: CallSession): CallSessionResponse {
    return {
      id: session.id,
      businessId: session.business_id,
      status: session.status,
      startedAt: session.started_at,
      connectedAt: session.connected_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration_seconds,
      questionsAsked: session.questions_asked || [],
      costEstimate: session.cost_estimate,
      recordingUrl: session.recording_url,
    };
  }

  async getCallEvents(sessionId: string, limit?: number): Promise<any[]> {
    try {
      const events = await CallEventModel.findBySessionId(sessionId, { limit });
      return events.map(event => ({
        id: event.id,
        eventType: event.event_type,
        eventData: event.event_data,
        timestamp: event.timestamp,
        source: event.source,
      }));
    } catch (error) {
      console.error('Error getting call events:', error);
      throw new Error(`Failed to get call events: ${error.message}`);
    }
  }

  async cancelCall(sessionId: string): Promise<void> {
    try {
      const session = await CallSessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Call session not found');
      }

      if (['completed', 'failed', 'timeout'].includes(session.status)) {
        throw new Error('Cannot cancel completed call');
      }

      // Cancel telephony call if in progress
      if (session.telephony_call_id) {
        try {
          await this.primaryTelephonyService.hangupCall(session.telephony_call_id);
        } catch (error) {
          console.warn('Error hanging up telephony call:', error);
        }
      }

      // Update session status
      await CallSessionModel.updateStatus(sessionId, 'failed', {
        ended_at: new Date().toISOString(),
      });

      await CallEventModel.createFailedEvent(sessionId, {
        reason: 'cancelled',
        cancelled_by: 'system',
      });

    } catch (error) {
      console.error('Error cancelling call:', error);
      throw new Error(`Failed to cancel call: ${error.message}`);
    }
  }

  async getActiveCallsForBusiness(businessId: string): Promise<CallSessionResponse[]> {
    try {
      const sessions = await CallSessionModel.findActiveByBusinessId(businessId);
      return sessions.map(session => this.formatCallSessionResponse(session));
    } catch (error) {
      console.error('Error getting active calls:', error);
      throw new Error(`Failed to get active calls: ${error.message}`);
    }
  }

  async getCallMetrics(businessId: string, dateFrom?: string, dateTo?: string): Promise<{
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    timeoutCalls: number;
    averageDuration: number;
    totalCost: number;
  }> {
    try {
      return await CallSessionModel.getCallMetrics(businessId, dateFrom, dateTo);
    } catch (error) {
      console.error('Error getting call metrics:', error);
      throw new Error(`Failed to get call metrics: ${error.message}`);
    }
  }
}