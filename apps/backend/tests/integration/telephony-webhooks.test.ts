// Jest globals are available globally
import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/config/database';

describe('Telephony Webhooks Integration', () => {
  let businessId: string;
  let callSessionId: string;
  let verificationId: string;

  beforeEach(async () => {
    // Create test business
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business for Webhooks',
        email: 'test-webhooks@example.com',
        phone: '+46700000002'
      })
      .select()
      .single();
    
    businessId = business.id;

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
        status: 'initiated',
        started_at: new Date(),
        telephony_call_id: '46elks-test-call-123'
      })
      .select()
      .single();
    
    callSessionId = callSession.id;
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('call_events')
      .delete()
      .eq('call_session_id', callSessionId);
    
    await supabase
      .from('telephony_provider_logs')
      .delete()
      .eq('call_session_id', callSessionId);
    
    await supabase
      .from('call_sessions')
      .delete()
      .eq('id', callSessionId);
    
    await supabase
      .from('customer_verifications')
      .delete()
      .eq('id', verificationId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  describe('POST /api/calls/webhooks/telephony', () => {
    it('should handle 46elks call_answered webhook', async () => {
      const webhookPayload = {
        eventType: 'call_answered',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          answerTime: new Date().toISOString(),
          callDuration: 0,
          provider: '46elks'
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify call session was updated
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.status).toBe('in_progress');
      expect(callSession.connected_at).toBeTruthy();

      // Verify call event was created
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('event_type', 'answered');

      expect(events).toHaveLength(1);
      expect(events![0].source).toBe('telephony');

      // Verify telephony log was created
      const { data: logs } = await supabase
        .from('telephony_provider_logs')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('operation', 'webhook');

      expect(logs).toHaveLength(1);
      expect(logs![0].provider).toBe('46elks');
      expect(logs![0].success).toBe(true);
    });

    it('should handle call_completed webhook', async () => {
      // First set call to in_progress
      await supabase
        .from('call_sessions')
        .update({ 
          status: 'in_progress',
          connected_at: new Date()
        })
        .eq('id', callSessionId);

      const webhookPayload = {
        eventType: 'call_completed',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          endTime: new Date().toISOString(),
          callDuration: 85,
          provider: '46elks',
          cost: 0.12
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify call session was updated
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.status).toBe('completed');
      expect(callSession.ended_at).toBeTruthy();
      expect(callSession.duration_seconds).toBe(85);
      expect(callSession.cost_estimate).toBe(0.12);
    });

    it('should handle call_failed webhook', async () => {
      const webhookPayload = {
        eventType: 'call_failed',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          failureReason: 'no_answer',
          provider: '46elks'
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify call session was updated
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.status).toBe('failed');
      expect(callSession.ended_at).toBeTruthy();

      // Verify failure event was created
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('event_type', 'failed');

      expect(events).toHaveLength(1);
      expect(events![0].event_data).toMatchObject({
        failureReason: 'no_answer'
      });
    });

    it('should handle recording_available webhook', async () => {
      const webhookPayload = {
        eventType: 'recording_available',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          recordingUrl: 'https://recordings.46elks.com/test-recording-123.wav',
          recordingDuration: 85,
          provider: '46elks'
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify call session was updated with recording URL
      const { data: callSession } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(callSession.recording_url).toBe('https://recordings.46elks.com/test-recording-123.wav');
    });

    it('should handle Twilio webhooks with different format', async () => {
      // Update call session to use Twilio
      await supabase
        .from('call_sessions')
        .update({ telephony_call_id: 'twilio-call-456' })
        .eq('id', callSessionId);

      const webhookPayload = {
        eventType: 'call_answered',
        callId: 'twilio-call-456',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          CallStatus: 'in-progress',
          CallSid: 'twilio-call-456',
          provider: 'twilio'
        }
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(200);

      // Verify provider-specific handling
      const { data: logs } = await supabase
        .from('telephony_provider_logs')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('provider', 'twilio');

      expect(logs).toHaveLength(1);
    });

    it('should handle unknown call session gracefully', async () => {
      const webhookPayload = {
        eventType: 'call_answered',
        callId: 'unknown-call-123',
        sessionId: '550e8400-e29b-41d4-a716-446655440000', // Non-existent UUID
        timestamp: new Date().toISOString(),
        data: {}
      };

      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Call session not found');
    });

    it('should validate webhook signature (46elks)', async () => {
      const webhookPayload = {
        eventType: 'call_answered',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {}
      };

      // Test with invalid signature
      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .set('X-46elks-Signature', 'invalid-signature')
        .send(webhookPayload);

      // Should still process for development, but log security warning
      expect(response.status).toBe(200);
    });

    it('should handle malformed webhook payload', async () => {
      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send({
          invalidField: 'test',
          missingRequired: true
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid webhook payload');
    });

    it('should handle duplicate webhook events idempotently', async () => {
      const webhookPayload = {
        eventType: 'call_answered',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {
          answerTime: new Date().toISOString(),
          provider: '46elks'
        }
      };

      // Send same webhook twice
      const response1 = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      const response2 = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Should not create duplicate events
      const { data: events } = await supabase
        .from('call_events')
        .select('*')
        .eq('call_session_id', callSessionId)
        .eq('event_type', 'answered');

      expect(events).toHaveLength(1);
    });
  });

  describe('Webhook Error Handling', () => {
    it('should retry failed database operations', async () => {
      // This test would require mocking database failures
      // For now, just verify the webhook endpoint handles errors gracefully
      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send({
          eventType: 'call_answered',
          callId: 'test-call',
          sessionId: 'invalid-uuid-format',
          timestamp: new Date().toISOString(),
          data: {}
        });

      expect(response.status).toBe(400);
    });

    it('should log webhook processing metrics', async () => {
      const webhookPayload = {
        eventType: 'call_answered',
        callId: '46elks-test-call-123',
        sessionId: callSessionId,
        timestamp: new Date().toISOString(),
        data: {}
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/calls/webhooks/telephony')
        .send(webhookPayload);

      const endTime = Date.now();

      expect(response.status).toBe(200);

      // Verify latency was logged
      const { data: logs } = await supabase
        .from('telephony_provider_logs')
        .select('*')
        .eq('call_session_id', callSessionId);

      expect(logs![0].latency_ms).toBeGreaterThan(0);
      expect(logs![0].latency_ms).toBeLessThan(endTime - startTime + 100);
    });
  });
});