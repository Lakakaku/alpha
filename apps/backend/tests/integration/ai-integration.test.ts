// Jest globals are available globally
import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/config/database';
import { OpenAIVoiceService } from '../../src/services/ai/OpenAIVoiceService';

// Mock the OpenAI service for integration tests
jest.mock('../../src/services/ai/OpenAIVoiceService');

describe('AI Integration Flow', () => {
  let businessId: string;
  let callSessionId: string;
  let verificationId: string;
  let questionId: string;
  let mockOpenAIService: jest.Mocked<OpenAIVoiceService>;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockOpenAIService = OpenAIVoiceService as jest.Mocked<typeof OpenAIVoiceService>;

    // Create test business
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business for AI Integration',
        email: 'test-ai@example.com',
        phone: '+46700000003'
      })
      .select()
      .single();
    
    businessId = business.id;

    // Create test question configuration
    const { data: question } = await supabase
      .from('question_configurations')
      .insert({
        business_id: businessId,
        question_text: 'Hur var din upplevelse av vår service idag?',
        frequency: 1,
        priority: 'high',
        department_tags: ['service'],
        is_active: true,
        max_response_time: 30
      })
      .select()
      .single();
    
    questionId = question.id;

    // Create test verification
    const { data: verification } = await supabase
      .from('customer_verifications')
      .insert({
        business_id: businessId,
        phone_number: '+46701234567',
        status: 'verified',
        transaction_time: new Date(),
        transaction_amount: 145.50
      })
      .select()
      .single();
    
    verificationId = verification.id;

    // Create test call session
    const { data: callSession } = await supabase
      .from('call_sessions')
      .insert({
        business_id: businessId,
        customer_phone: '+46701234567',
        verification_id: verificationId,
        status: 'in_progress',
        started_at: new Date(),
        connected_at: new Date(),
        ai_session_id: 'openai-session-123'
      })
      .select()
      .single();
    
    callSessionId = callSession.id;
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('call_responses')
      .delete()
      .eq('call_session_id', callSessionId);
    
    await supabase
      .from('call_events')
      .delete()
      .eq('call_session_id', callSessionId);
    
    await supabase
      .from('call_sessions')
      .delete()
      .eq('id', callSessionId);
    
    await supabase
      .from('question_configurations')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('customer_verifications')
      .delete()
      .eq('id', verificationId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  describe('AI Voice Integration Flow', () => {
    it('should complete full AI conversation flow', async () => {
      // Mock OpenAI service responses
      const mockConversationFlow = [
        {
          type: 'session_started',
          sessionId: 'openai-session-123',
          timestamp: new Date().toISOString()
        },
        {
          type: 'response_generated',
          sessionId: 'openai-session-123',
          data: {
            type: 'introduction',
            text: 'Hej! Jag är en AI-assistent från Test Business. Jag skulle vilja ställa några korta frågor om din upplevelse. Är det okej?',
            audioUrl: 'https://openai-audio.example.com/intro.wav'
          }
        },
        {
          type: 'customer_response',
          sessionId: 'openai-session-123',
          data: {
            text: 'Ja, det är bra.',
            confidence: 0.95,
            duration: 2.1
          }
        },
        {
          type: 'response_generated',
          sessionId: 'openai-session-123',
          data: {
            type: 'question',
            questionId: questionId,
            text: 'Hur var din upplevelse av vår service idag?',
            audioUrl: 'https://openai-audio.example.com/question1.wav'
          }
        },
        {
          type: 'customer_response',
          sessionId: 'openai-session-123',
          data: {
            text: 'Det var mycket bra, personalen var hjälpsam och professionell.',
            confidence: 0.92,
            duration: 4.8,
            sentiment: 0.8
          }
        },
        {
          type: 'response_generated',
          sessionId: 'openai-session-123',
          data: {
            type: 'conclusion',
            text: 'Tack så mycket för dina svar! Din feedback hjälper oss att förbättra oss. Ha en bra dag!',
            audioUrl: 'https://openai-audio.example.com/conclusion.wav'
          }
        },
        {
          type: 'session_ended',
          sessionId: 'openai-session-123',
          timestamp: new Date().toISOString()
        }
      ];

      // Simulate AI webhook events in sequence
      for (const event of mockConversationFlow) {
        const response = await request(app)
          .post('/api/calls/webhooks/ai')
          .send({
            eventType: event.type,
            sessionId: 'openai-session-123',
            timestamp: event.timestamp || new Date().toISOString(),
            data: event.data || {}
          });

        expect(response.status).toBe(200);
      }

      // Verify call events were created
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .order('timestamp', { ascending: true });

      expect(events).toHaveLength(7); // All events logged

      // Verify call response was recorded
      const { data: responses } = await supabase
        .from('call_responses')
        .select('*')
        .eq('call_session_id', callSessionId);

      expect(responses).toHaveLength(1);
      expect(responses![0].question_id).toBe(questionId);
      expect(responses![0].response_text).toBe('Det var mycket bra, personalen var hjälpsam och professionell.');
      expect(responses![0].confidence_score).toBe(0.92);
      expect(responses![0].sentiment_score).toBe(0.8);
      expect(responses![0].response_duration).toBe(4.8);
    });

    it('should handle AI session timeout', async () => {
      const timeoutEvent = {
        eventType: 'session_ended',
        sessionId: 'openai-session-123',
        timestamp: new Date().toISOString(),
        data: {
          reason: 'timeout',
          duration: 120
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send(timeoutEvent);

      expect(response.status).toBe(200);

      // Verify call session was updated to timeout status
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.status).toBe('timeout');
      expect(callSession.ended_at).toBeTruthy();
      expect(callSession.duration_seconds).toBe(120);
    });

    it('should handle AI error gracefully', async () => {
      const errorEvent = {
        eventType: 'error_occurred',
        sessionId: 'openai-session-123',
        timestamp: new Date().toISOString(),
        data: {
          error: 'connection_lost',
          message: 'WebSocket connection to OpenAI was lost',
          recoverable: true
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send(errorEvent);

      expect(response.status).toBe(200);

      // Verify error event was logged
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('event_type', 'failed');

      expect(events).toHaveLength(1);
      expect(events![0].event_data).toMatchObject({
        error: 'connection_lost',
        recoverable: true
      });
    });

    it('should track conversation metrics', async () => {
      const metricsEvent = {
        eventType: 'session_ended',
        sessionId: 'openai-session-123',
        timestamp: new Date().toISOString(),
        data: {
          totalTokens: 1247,
          audioMinutes: 1.8,
          cost: 0.087,
          responseLatency: {
            average: 1.2,
            p95: 2.1
          }
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send(metricsEvent);

      expect(response.status).toBe(200);

      // Verify metrics were stored
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.cost_estimate).toBe(0.087);
    });

    it('should handle multi-question conversation flow', async () => {
      // Create second question
      const { data: question2 } = await supabase
        .from('question_configurations')
        .insert({
          business_id: businessId,
          question_text: 'Vad tycker du om våra öppettider?',
          frequency: 1,
          priority: 'medium',
          department_tags: ['operations'],
          is_active: true,
          max_response_time: 25
        })
        .select()
        .single();

      const multiQuestionFlow = [
        {
          type: 'response_generated',
          data: {
            type: 'question',
            questionId: questionId,
            text: 'Hur var din upplevelse av vår service idag?'
          }
        },
        {
          type: 'customer_response',
          data: {
            text: 'Mycket bra service.',
            confidence: 0.95
          }
        },
        {
          type: 'response_generated',
          data: {
            type: 'question',
            questionId: question2.id,
            text: 'Vad tycker du om våra öppettider?'
          }
        },
        {
          type: 'customer_response',
          data: {
            text: 'De är perfekta för mig.',
            confidence: 0.88
          }
        }
      ];

      for (const event of multiQuestionFlow) {
        await request(app)
          .post('/api/calls/webhooks/ai')
          .send({
            eventType: event.type,
            sessionId: 'openai-session-123',
            timestamp: new Date().toISOString(),
            data: event.data
          });
      }

      // Verify both responses were recorded
      const { data: responses } = await supabase
        .from('call_responses')
        .select('*')
        .eq('call_session_id', callSessionId)
        .order('asked_at', { ascending: true });

      expect(responses).toHaveLength(2);
      expect(responses![0].question_id).toBe(questionId);
      expect(responses![1].question_id).toBe(question2.id);
    });

    it('should handle invalid AI session ID', async () => {
      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send({
          eventType: 'response_generated',
          sessionId: 'non-existent-session',
          timestamp: new Date().toISOString(),
          data: {}
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('AI session not found');
    });

    it('should validate AI webhook payload structure', async () => {
      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send({
          invalidField: true,
          missingRequired: 'data'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid AI webhook payload');
    });

    it('should handle real-time duration monitoring during AI conversation', async () => {
      // Simulate warning at 90 seconds
      const warningEvent = {
        eventType: 'response_generated',
        sessionId: 'openai-session-123',
        timestamp: new Date().toISOString(),
        data: {
          type: 'warning',
          text: 'Vi har tid för en sista snabb fråga.',
          timeRemaining: 30
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send(warningEvent);

      expect(response.status).toBe(200);

      // Verify warning event was logged
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('event_type', 'warning_sent');

      expect(events).toHaveLength(1);
      expect(events![0].event_data).toMatchObject({
        timeRemaining: 30
      });
    });
  });

  describe('AI Service Integration', () => {
    it('should connect to OpenAI real-time API', async () => {
      // This would test actual OpenAI connection in a real integration test
      // For now, verify the service configuration
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini-realtime-preview');
    });

    it('should handle Swedish language processing', async () => {
      const swedishResponseEvent = {
        eventType: 'customer_response',
        sessionId: 'openai-session-123',
        timestamp: new Date().toISOString(),
        data: {
          text: 'Jag är mycket nöjd med servicen och kommer definitivt att handla här igen.',
          language: 'sv',
          confidence: 0.94
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/ai')
        .send(swedishResponseEvent);

      expect(response.status).toBe(200);
    });
  });
});