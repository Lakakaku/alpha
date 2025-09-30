import { CallSession, CallEvent, CallResponse, QuestionConfiguration } from '@vocilia/types';
import { CallOrchestrator } from '../../services/calls/CallOrchestrator';
import { OpenAIVoiceService } from '../../services/ai/OpenAIVoiceService';
import { FortyElksService } from '../../services/telephony/FortyElksService';
import { TwilioService } from '../../services/telephony/TwilioService';
import { EventEmitter } from 'events';

export interface CallProcessorConfig {
  enabled: boolean;
  intervalMs: number;
  maxConcurrentCalls: number;
  timeoutMinutes: number;
  retryAttempts: number;
}

export class CallProcessor extends EventEmitter {
  private config: CallProcessorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private activeCalls = new Map<string, OpenAIVoiceService>();

  constructor(config?: Partial<CallProcessorConfig>) {
    super();
    
    this.config = {
      enabled: true,
      intervalMs: 10000, // Check every 10 seconds
      maxConcurrentCalls: 5,
      timeoutMinutes: 2,
      retryAttempts: 3,
      ...config
    };
  }

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    console.log('Starting Call Processor...');
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      try {
        await this.processCallQueue();
        await this.monitorActiveCalls();
        await this.cleanupStallCalls();
      } catch (error) {
        console.error('Call processor cycle error:', error);
        this.emit('error', error);
      }
    }, this.config.intervalMs);

    this.emit('started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // End all active calls
    for (const [sessionId, aiService] of this.activeCalls.entries()) {
      try {
        aiService.endSession();
        console.log(`Ended AI session for call ${sessionId}`);
      } catch (error) {
        console.error(`Failed to end AI session ${sessionId}:`, error);
      }
    }

    this.activeCalls.clear();
    this.isRunning = false;
    console.log('Call Processor stopped');
    this.emit('stopped');
  }

  private async processCallQueue(): Promise<void> {
    // Find calls that need AI processing (telephony connected but AI not started)
    const readyCalls = await CallSession.findByStatus(['connecting', 'in_progress']);
    
    for (const call of readyCalls) {
      // Skip if we're already processing this call
      if (this.activeCalls.has(call.id)) {
        continue;
      }

      // Check concurrent call limit
      if (this.activeCalls.size >= this.config.maxConcurrentCalls) {
        console.log('Max concurrent calls reached, queuing call:', call.id);
        break;
      }

      // Check if call needs AI processing
      const events = await CallEvent.findBySessionId(call.id);
      const hasAISession = events.some(e => e.eventType === 'ai_session_started');
      
      if (!hasAISession && call.status === 'in_progress') {
        await this.startAIProcessing(call);
      }
    }
  }

  private async startAIProcessing(session: CallSession): Promise<void> {
    try {
      console.log(`Starting AI processing for call ${session.id}`);

      // Get questions for this business
      const questions = await QuestionConfiguration.findByBusinessId(session.businessId);
      
      if (!questions || questions.length === 0) {
        console.error(`No questions configured for business ${session.businessId}`);
        await this.failCall(session.id, 'No questions configured');
        return;
      }

      // Create AI service instance
      const aiService = new OpenAIVoiceService();
      
      // Set up event handlers
      aiService.on('session_ended', () => {
        this.activeCalls.delete(session.id);
        this.handleAISessionEnd(session.id);
      });

      aiService.on('error', (error) => {
        console.error(`AI service error for call ${session.id}:`, error);
        this.activeCalls.delete(session.id);
        this.failCall(session.id, error.message);
      });

      // Start voice session
      await aiService.startVoiceSession({
        sessionId: session.id,
        businessId: session.businessId,
        questions: questions.slice(0, session.expectedQuestions).map(q => ({
          id: q.id,
          text: q.text,
          responseType: q.responseType
        })),
        businessName: session.businessName || 'Your Business',
        maxDurationMinutes: session.maxDuration || 2
      });

      this.activeCalls.set(session.id, aiService);

      await CallEvent.create({
        sessionId: session.id,
        eventType: 'ai_processing_started',
        providerId: 'system',
        eventData: {
          questions_count: Math.min(questions.length, session.expectedQuestions),
          processor_id: 'call-processor'
        }
      });

    } catch (error) {
      console.error(`Failed to start AI processing for call ${session.id}:`, error);
      await this.failCall(session.id, error instanceof Error ? error.message : 'AI processing failed');
    }
  }

  private async monitorActiveCalls(): Promise<void> {
    for (const [sessionId, aiService] of this.activeCalls.entries()) {
      try {
        // Check if AI session is still active
        if (!aiService.isSessionActive()) {
          console.log(`AI session ended for call ${sessionId}`);
          this.activeCalls.delete(sessionId);
          continue;
        }

        // Get session and check for timeout
        const session = await CallSession.findById(sessionId);
        if (!session) {
          console.warn(`Session ${sessionId} not found, ending AI service`);
          aiService.endSession();
          this.activeCalls.delete(sessionId);
          continue;
        }

        // Check for timeout
        const sessionAge = Date.now() - new Date(session.createdAt).getTime();
        const maxDurationMs = (session.maxDuration || this.config.timeoutMinutes * 60) * 1000;

        if (sessionAge > maxDurationMs) {
          console.log(`Call ${sessionId} timed out, ending AI session`);
          await aiService.endSession();
          this.activeCalls.delete(sessionId);
          
          await session.updateStatus('timeout', {
            actualDuration: Math.floor(sessionAge / 1000)
          });
        }

      } catch (error) {
        console.error(`Error monitoring call ${sessionId}:`, error);
      }
    }
  }

  private async cleanupStallCalls(): Promise<void> {
    // Find calls that have been in intermediate states too long
    const timeoutThreshold = new Date(Date.now() - this.config.timeoutMinutes * 60 * 1000);
    
    const stalledCalls = await CallSession.findOlderThan(timeoutThreshold, ['initiated', 'connecting']);
    
    for (const call of stalledCalls) {
      console.log(`Cleaning up stalled call ${call.id} (status: ${call.status})`);
      
      await call.updateStatus('failed', {
        actualDuration: Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 1000)
      });

      await CallEvent.create({
        sessionId: call.id,
        eventType: 'call_cleanup',
        providerId: 'system',
        eventData: {
          previous_status: call.status,
          reason: 'stalled_call_cleanup',
          processor_id: 'call-processor'
        }
      });
    }
  }

  private async handleAISessionEnd(sessionId: string): Promise<void> {
    try {
      const session = await CallSession.findById(sessionId);
      if (!session) return;

      // If session is not already in terminal state, mark as completed
      if (!['completed', 'failed', 'timeout'].includes(session.status)) {
        const responses = await CallResponse.findBySessionId(sessionId);
        
        await session.updateStatus('completed', {
          actualDuration: Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000)
        });

        await CallEvent.create({
          sessionId,
          eventType: 'call_processing_completed',
          providerId: 'system',
          eventData: {
            responses_collected: responses.length,
            processor_id: 'call-processor'
          }
        });
      }

    } catch (error) {
      console.error(`Failed to handle AI session end for ${sessionId}:`, error);
    }
  }

  private async failCall(sessionId: string, reason: string): Promise<void> {
    try {
      const session = await CallSession.findById(sessionId);
      if (session && !['completed', 'failed', 'timeout'].includes(session.status)) {
        await session.updateStatus('failed');

        await CallEvent.create({
          sessionId,
          eventType: 'call_processing_failed',
          providerId: 'system',
          eventData: {
            reason,
            processor_id: 'call-processor'
          }
        });
      }
    } catch (error) {
      console.error(`Failed to mark call ${sessionId} as failed:`, error);
    }
  }

  // Public methods for monitoring
  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  getActiveCalls(): string[] {
    return Array.from(this.activeCalls.keys());
  }

  isProcessorRunning(): boolean {
    return this.isRunning;
  }

  getConfig(): CallProcessorConfig {
    return { ...this.config };
  }

  // Method to manually trigger call processing (for testing)
  async processCall(sessionId: string): Promise<boolean> {
    try {
      const session = await CallSession.findById(sessionId);
      if (!session) {
        return false;
      }

      await this.startAIProcessing(session);
      return true;
    } catch (error) {
      console.error(`Manual call processing failed for ${sessionId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const callProcessor = new CallProcessor();