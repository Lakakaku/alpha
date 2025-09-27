import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Phone System Webhook Processing (T017)', () => {
  let storeId: string;
  let verificationId: string;
  let callSessionId: string;

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Phone Webhooks',
        business_type: 'grocery',
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' }
        }
      })
      .select()
      .single();

    storeId = storeResult.data.id;

    // Create customer verification
    const verificationResult = await supabase
      .from('customer_verifications')
      .insert({
        store_id: storeId,
        phone_number: '+46701234567',
        transaction_amount: 145.75,
        transaction_time: new Date().toISOString(),
        verification_status: 'verified'
      })
      .select()
      .single();

    verificationId = verificationResult.data.id;

    // Create call session
    const callSession = await supabase
      .from('feedback_call_sessions')
      .insert({
        verification_id: verificationId,
        store_id: storeId,
        customer_phone_number: '+46701234567',
        status: 'pending',
        initiated_at: new Date().toISOString(),
        external_call_id: '46elks_test_call_12345'
      })
      .select()
      .single();

    callSessionId = callSession.data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('conversation_transcripts')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('quality_assessments')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('feedback_call_sessions')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('customer_verifications')
      .delete()
      .eq('id', verificationId);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);
  });

  describe('46elks Webhook Integration', () => {
    it('should handle call initiated webhook', async () => {
      const initiatedWebhook = {
        direction: 'outbound',
        from: '+46850XXX000', // 46elks number
        to: '+46701234567',
        callid: '46elks_test_call_12345',
        status: 'outgoing-call',
        duration: 0,
        created: new Date().toISOString(),
        cost: '0.00'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(initiatedWebhook).toString())
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('call_initiated');

      // Verify call session is updated
      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', '46elks_test_call_12345')
        .single();

      expect(updatedSession.data.status).toBe('connecting');
      expect(updatedSession.data.provider_call_id).toBe('46elks_test_call_12345');
    });

    it('should handle call answered webhook', async () => {
      const answeredWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234567',
        callid: '46elks_test_call_12345',
        status: 'answered',
        duration: 0,
        created: new Date().toISOString(),
        answered: new Date().toISOString(),
        cost: '0.05'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(answeredWebhook).toString())
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('call_answered');

      // Verify call session shows as connected
      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', '46elks_test_call_12345')
        .single();

      expect(updatedSession.data.status).toBe('in_progress');
      expect(updatedSession.data.call_answered_at).toBeDefined();
    });

    it('should handle call completed webhook with duration', async () => {
      const completedWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234567',
        callid: '46elks_test_call_12345',
        status: 'completed',
        duration: 95,
        created: new Date().toISOString(),
        answered: new Date(Date.now() - 95000).toISOString(),
        ended: new Date().toISOString(),
        cost: '0.12'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(completedWebhook).toString())
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('call_completed');

      // Verify call session is completed with correct duration
      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', '46elks_test_call_12345')
        .single();

      expect(updatedSession.data.status).toBe('completed');
      expect(updatedSession.data.call_duration_seconds).toBe(95);
      expect(updatedSession.data.call_cost_sek).toBe(0.12);
      expect(updatedSession.data.completed_at).toBeDefined();
    });

    it('should handle call failed webhook', async () => {
      // Create new call session for failure test
      const failedCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234568',
          status: 'pending',
          initiated_at: new Date().toISOString(),
          external_call_id: '46elks_failed_call_67890'
        })
        .select()
        .single();

      const failedWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234568',
        callid: '46elks_failed_call_67890',
        status: 'failed',
        duration: 0,
        created: new Date().toISOString(),
        cost: '0.00',
        reason: 'no-answer'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(failedWebhook).toString())
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('call_failed');

      // Verify call session is marked as failed
      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', '46elks_failed_call_67890')
        .single();

      expect(updatedSession.data.status).toBe('failed');
      expect(updatedSession.data.failure_reason).toBe('no_answer');
      expect(updatedSession.data.call_duration_seconds).toBe(0);
    });

    it('should handle call busy webhook', async () => {
      const busyCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234569',
          status: 'pending',
          initiated_at: new Date().toISOString(),
          external_call_id: '46elks_busy_call_11111'
        })
        .select()
        .single();

      const busyWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234569',
        callid: '46elks_busy_call_11111',
        status: 'busy',
        duration: 0,
        created: new Date().toISOString(),
        cost: '0.02'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(busyWebhook).toString())
        .expect(200);

      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', '46elks_busy_call_11111')
        .single();

      expect(updatedSession.data.status).toBe('failed');
      expect(updatedSession.data.failure_reason).toBe('line_busy');
    });
  });

  describe('OpenAI Realtime API Webhook Integration', () => {
    it('should handle session created webhook', async () => {
      const sessionCreatedWebhook = {
        type: 'session.created',
        event_id: 'evt_openai_session_123',
        session: {
          id: 'sess_openai_test_456',
          object: 'realtime.session',
          model: 'gpt-4o-mini',
          voice: 'alloy',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5
          },
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(sessionCreatedWebhook)
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('session_created');

      // Update call session with OpenAI session ID
      await supabase
        .from('feedback_call_sessions')
        .update({ 
          openai_session_id: 'sess_openai_test_456',
          ai_model_config: sessionCreatedWebhook.session
        })
        .eq('id', callSessionId);
    });

    it('should handle conversation item created webhook', async () => {
      const conversationItemWebhook = {
        type: 'conversation.item.created',
        event_id: 'evt_conversation_123',
        previous_item_id: null,
        item: {
          id: 'msg_001',
          object: 'realtime.item',
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?'
            }
          ]
        }
      };

      const response = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(conversationItemWebhook)
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('conversation_item_created');
    });

    it('should handle input audio transcription completed webhook', async () => {
      const transcriptionWebhook = {
        type: 'conversation.item.input_audio_transcription.completed',
        event_id: 'evt_transcription_123',
        item_id: 'msg_002',
        content_index: 0,
        transcript: 'Ja, det var en mycket bra upplevelse. Personalen var hjälpsam och produkterna var fräscha.'
      };

      const response = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(transcriptionWebhook)
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('transcription_completed');
      expect(response.body.transcript_text).toBe(transcriptionWebhook.transcript);
    });

    it('should handle session updated webhook', async () => {
      const sessionUpdatedWebhook = {
        type: 'session.updated',
        event_id: 'evt_session_update_123',
        session: {
          id: 'sess_openai_test_456',
          object: 'realtime.session',
          model: 'gpt-4o-mini',
          voice: 'alloy',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.6
          },
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16'
        }
      };

      const response = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(sessionUpdatedWebhook)
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('session_updated');
    });

    it('should handle error webhook', async () => {
      const errorWebhook = {
        type: 'error',
        event_id: 'evt_error_123',
        error: {
          type: 'invalid_request_error',
          code: 'invalid_audio_format',
          message: 'The audio format is not supported',
          param: 'input_audio_format'
        }
      };

      const response = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(errorWebhook)
        .expect(200);

      expect(response.body.status).toBe('processed');
      expect(response.body.event_type).toBe('error');
      expect(response.body.error_code).toBe('invalid_audio_format');
    });
  });

  describe('Webhook Security and Validation', () => {
    it('should validate 46elks webhook signatures', async () => {
      const webhookData = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234567',
        callid: 'security_test_call',
        status: 'completed'
      };

      // Test without signature - should fail
      await request(app)
        .post('/api/webhooks/46elks/call-events')
        .send(new URLSearchParams(webhookData).toString())
        .expect(401);

      // Test with invalid signature - should fail
      await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('X-46elks-Signature', 'invalid_signature')
        .send(new URLSearchParams(webhookData).toString())
        .expect(401);
    });

    it('should validate OpenAI webhook authentication', async () => {
      const webhookData = {
        type: 'session.created',
        event_id: 'evt_auth_test',
        session: { id: 'sess_auth_test' }
      };

      // Test without authorization - should fail
      await request(app)
        .post('/api/webhooks/openai/realtime')
        .send(webhookData)
        .expect(401);

      // Test with invalid token - should fail
      await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer invalid_token')
        .send(webhookData)
        .expect(401);
    });

    it('should handle malformed webhook payloads gracefully', async () => {
      // Test malformed 46elks webhook
      const malformed46elksData = 'invalid=data&format=broken';

      const response1 = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(malformed46elksData)
        .expect(400);

      expect(response1.body.error).toContain('validation');

      // Test malformed OpenAI webhook
      const malformedOpenAIData = { invalid: 'structure' };

      const response2 = await request(app)
        .post('/api/webhooks/openai/realtime')
        .set('Authorization', 'Bearer valid_openai_webhook_token')
        .send(malformedOpenAIData)
        .expect(400);

      expect(response2.body.error).toContain('validation');
    });
  });

  describe('Webhook Event Processing and Retry Logic', () => {
    it('should handle duplicate webhook events idempotently', async () => {
      const duplicateWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234567',
        callid: 'duplicate_test_call',
        status: 'completed',
        duration: 75
      };

      // Process webhook first time
      const response1 = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(duplicateWebhook).toString())
        .expect(200);

      expect(response1.body.status).toBe('processed');

      // Process same webhook again - should be idempotent
      const response2 = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(duplicateWebhook).toString())
        .expect(200);

      expect(response2.body.status).toBe('already_processed');
      expect(response2.body.idempotency_key).toBeDefined();
    });

    it('should queue webhook processing for high-volume scenarios', async () => {
      // Simulate burst of webhooks
      const webhookPromises = [];
      
      for (let i = 0; i < 10; i++) {
        const webhook = {
          direction: 'outbound',
          from: '+46850XXX000',
          to: `+4670123456${i}`,
          callid: `burst_test_call_${i}`,
          status: 'completed',
          duration: 60 + i
        };

        webhookPromises.push(
          request(app)
            .post('/api/webhooks/46elks/call-events')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send(new URLSearchParams(webhook).toString())
        );
      }

      const responses = await Promise.all(webhookPromises);

      // All should be processed successfully
      responses.forEach(response => {
        expect([200, 202]).toContain(response.status);
      });

      // Some may be queued for processing
      const queuedCount = responses.filter(r => r.status === 202).length;
      if (queuedCount > 0) {
        expect(queuedCount).toBeLessThanOrEqual(10);
      }
    });

    it('should provide webhook processing status and metrics', async () => {
      const response = await request(app)
        .get('/api/webhooks/status')
        .expect(200);

      expect(response.body).toHaveProperty('46elks_webhooks');
      expect(response.body).toHaveProperty('openai_webhooks');
      
      expect(response.body['46elks_webhooks']).toHaveProperty('total_processed');
      expect(response.body['46elks_webhooks']).toHaveProperty('success_rate');
      expect(response.body['46elks_webhooks']).toHaveProperty('average_processing_time_ms');

      expect(response.body['openai_webhooks']).toHaveProperty('total_processed');
      expect(response.body['openai_webhooks']).toHaveProperty('success_rate');
      expect(response.body['openai_webhooks']).toHaveProperty('average_processing_time_ms');
    });
  });

  describe('Event-Driven Call State Management', () => {
    it('should maintain accurate call state through webhook sequence', async () => {
      // Create new call session for state tracking
      const stateTestSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234570',
          status: 'pending',
          initiated_at: new Date().toISOString(),
          external_call_id: 'state_test_call_999'
        })
        .select()
        .single();

      // Sequence of webhooks simulating full call lifecycle
      const webhookSequence = [
        {
          status: 'outgoing-call',
          duration: 0,
          expectedStatus: 'connecting'
        },
        {
          status: 'answered',
          duration: 0,
          answered: new Date().toISOString(),
          expectedStatus: 'in_progress'
        },
        {
          status: 'completed',
          duration: 85,
          ended: new Date().toISOString(),
          expectedStatus: 'completed'
        }
      ];

      for (const [index, webhook] of webhookSequence.entries()) {
        const webhookData = {
          direction: 'outbound',
          from: '+46850XXX000',
          to: '+46701234570',
          callid: 'state_test_call_999',
          created: new Date().toISOString(),
          ...webhook
        };

        await request(app)
          .post('/api/webhooks/46elks/call-events')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(new URLSearchParams(webhookData).toString())
          .expect(200);

        // Verify state after each webhook
        const updatedSession = await supabase
          .from('feedback_call_sessions')
          .select('*')
          .eq('external_call_id', 'state_test_call_999')
          .single();

        expect(updatedSession.data.status).toBe(webhook.expectedStatus);
      }
    });

    it('should trigger appropriate downstream actions based on call events', async () => {
      // Create call session that will trigger analysis
      const triggerTestSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234571',
          status: 'pending',
          initiated_at: new Date().toISOString(),
          external_call_id: 'trigger_test_call_888'
        })
        .select()
        .single();

      // Submit completion webhook with sufficient duration for analysis
      const completionWebhook = {
        direction: 'outbound',
        from: '+46850XXX000',
        to: '+46701234571',
        callid: 'trigger_test_call_888',
        status: 'completed',
        duration: 90,
        created: new Date().toISOString(),
        answered: new Date(Date.now() - 90000).toISOString(),
        ended: new Date().toISOString(),
        cost: '0.15'
      };

      const response = await request(app)
        .post('/api/webhooks/46elks/call-events')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(new URLSearchParams(completionWebhook).toString())
        .expect(200);

      expect(response.body.triggered_actions).toContain('analysis_eligible');
      expect(response.body.next_steps).toContain('await_transcript');

      // Verify call session is marked as ready for analysis
      const updatedSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('external_call_id', 'trigger_test_call_888')
        .single();

      expect(updatedSession.data.status).toBe('completed');
      expect(updatedSession.data.analysis_eligible).toBe(true);
    });
  });
});