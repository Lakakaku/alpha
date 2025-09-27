import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Call Retry Mechanism (T011)', () => {
  let storeId: string;
  let verificationId: string;
  let customerPhone: string;

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Retry Logic',
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
    customerPhone = '+46701234567';

    // Create initial verification record
    const verificationResult = await supabase
      .from('customer_verifications')
      .insert({
        store_id: storeId,
        phone_number: customerPhone,
        transaction_amount: 150.00,
        transaction_time: new Date().toISOString(),
        verification_status: 'verified'
      })
      .select()
      .single();

    verificationId = verificationResult.data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('fraud_detection_results')
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

  describe('Maximum 3 Call Attempts (FR-001)', () => {
    let callSessionId: string;

    beforeEach(async () => {
      // Reset any existing call sessions for this verification
      await supabase
        .from('feedback_call_sessions')
        .delete()
        .eq('verification_id', verificationId);
    });

    it('should allow first call attempt', async () => {
      const response = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone
        })
        .expect(202);

      expect(response.body).toHaveProperty('call_session_id');
      expect(response.body).toHaveProperty('attempt_number', 1);
      expect(response.body).toHaveProperty('max_attempts', 3);
      expect(response.body.status).toBe('pending');

      callSessionId = response.body.call_session_id;

      // Verify database record
      const session = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(session.data.retry_count).toBe(0);
      expect(session.data.verification_id).toBe(verificationId);
    });

    it('should allow second call attempt after first failure', async () => {
      // Create first failed attempt
      const firstAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'customer_unavailable',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Attempt retry
      const response = await request(app)
        .put(`/api/ai/calls/${firstAttempt.data.id}/retry`)
        .send({
          retry_reason: 'customer_unavailable'
        })
        .expect(202);

      expect(response.body).toHaveProperty('call_session_id');
      expect(response.body).toHaveProperty('attempt_number', 2);
      expect(response.body).toHaveProperty('retry_count', 1);
      expect(response.body.status).toBe('pending');

      // Verify new session created
      const newSession = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('id', response.body.call_session_id)
        .single();

      expect(newSession.data.retry_count).toBe(1);
      expect(newSession.data.original_verification_id).toBe(verificationId);
    });

    it('should allow third call attempt after second failure', async () => {
      // Create two failed attempts
      const firstAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'no_answer'
        })
        .select()
        .single();

      const secondAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 1,
          failure_reason: 'line_busy',
          original_verification_id: verificationId
        })
        .select()
        .single();

      // Attempt third retry
      const response = await request(app)
        .put(`/api/ai/calls/${secondAttempt.data.id}/retry`)
        .send({
          retry_reason: 'line_busy'
        })
        .expect(202);

      expect(response.body).toHaveProperty('attempt_number', 3);
      expect(response.body).toHaveProperty('retry_count', 2);
      expect(response.body.status).toBe('pending');
      expect(response.body.is_final_attempt).toBe(true);
    });

    it('should reject fourth call attempt', async () => {
      // Create three failed attempts
      const attempts = [];
      for (let i = 0; i < 3; i++) {
        const attempt = await supabase
          .from('feedback_call_sessions')
          .insert({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: customerPhone,
            status: 'failed',
            retry_count: i,
            failure_reason: 'customer_unavailable',
            original_verification_id: i > 0 ? verificationId : null
          })
          .select()
          .single();
        attempts.push(attempt.data);
      }

      // Attempt fourth retry should fail
      const response = await request(app)
        .put(`/api/ai/calls/${attempts[2].id}/retry`)
        .send({
          retry_reason: 'customer_unavailable'
        })
        .expect(409);

      expect(response.body.error).toContain('Maximum retries exceeded');
      expect(response.body.max_attempts).toBe(3);
      expect(response.body.current_attempts).toBe(3);
    });
  });

  describe('Retry Timing Logic', () => {
    it('should enforce minimum delay between retry attempts', async () => {
      // Create recent failed attempt
      const recentAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'no_answer',
          initiated_at: new Date().toISOString(), // Just now
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      // Immediate retry should be rejected due to timing
      const response = await request(app)
        .put(`/api/ai/calls/${recentAttempt.data.id}/retry`)
        .send({
          retry_reason: 'no_answer'
        })
        .expect(429);

      expect(response.body.error).toContain('minimum delay');
      expect(response.body).toHaveProperty('retry_available_at');
      expect(response.body).toHaveProperty('minimum_delay_minutes');
    });

    it('should allow retry after minimum delay period', async () => {
      // Create old failed attempt (simulate past time)
      const oldTime = new Date();
      oldTime.setMinutes(oldTime.getMinutes() - 30); // 30 minutes ago

      const oldAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'technical_error',
          initiated_at: oldTime.toISOString(),
          completed_at: oldTime.toISOString()
        })
        .select()
        .single();

      // Retry should now be allowed
      const response = await request(app)
        .put(`/api/ai/calls/${oldAttempt.data.id}/retry`)
        .send({
          retry_reason: 'technical_error'
        })
        .expect(202);

      expect(response.body.status).toBe('pending');
      expect(response.body.retry_count).toBe(1);
    });
  });

  describe('Retry Reason Tracking', () => {
    it('should track different failure reasons across attempts', async () => {
      const failureReasons = ['no_answer', 'line_busy', 'customer_declined'];
      const attempts = [];

      // Create chain of failed attempts with different reasons
      for (let i = 0; i < failureReasons.length; i++) {
        const pastTime = new Date();
        pastTime.setHours(pastTime.getHours() - (i + 1)); // Space attempts apart

        const attempt = await supabase
          .from('feedback_call_sessions')
          .insert({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: customerPhone,
            status: 'failed',
            retry_count: i,
            failure_reason: failureReasons[i],
            initiated_at: pastTime.toISOString(),
            completed_at: pastTime.toISOString(),
            original_verification_id: i > 0 ? verificationId : null
          })
          .select()
          .single();

        attempts.push(attempt.data);
      }

      // Check call history includes all failure reasons
      const response = await request(app)
        .get(`/api/ai/calls/history/${verificationId}`)
        .expect(200);

      expect(response.body.attempts).toHaveLength(3);
      
      response.body.attempts.forEach((attempt: any, index: number) => {
        expect(attempt.failure_reason).toBe(failureReasons[index]);
        expect(attempt.retry_count).toBe(index);
      });

      expect(response.body.total_attempts).toBe(3);
      expect(response.body.can_retry).toBe(false); // Max attempts reached
    });

    it('should provide retry recommendations based on failure patterns', async () => {
      // Create pattern of technical failures
      const technicalFailure = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'openai_api_error',
          initiated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      const response = await request(app)
        .get(`/api/ai/calls/${technicalFailure.data.id}/retry-recommendation`)
        .expect(200);

      expect(response.body).toHaveProperty('recommended_action');
      expect(response.body).toHaveProperty('retry_strategy');
      expect(response.body).toHaveProperty('estimated_success_probability');

      // Technical errors should recommend immediate retry
      expect(response.body.recommended_action).toBe('retry_immediately');
      expect(response.body.retry_strategy).toContain('technical');
    });
  });

  describe('Concurrent Retry Prevention', () => {
    it('should prevent multiple simultaneous retry attempts', async () => {
      const failedAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'no_answer',
          initiated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      // Start first retry
      const firstRetry = request(app)
        .put(`/api/ai/calls/${failedAttempt.data.id}/retry`)
        .send({ retry_reason: 'no_answer' });

      // Start second retry immediately (should fail)
      const secondRetry = request(app)
        .put(`/api/ai/calls/${failedAttempt.data.id}/retry`)
        .send({ retry_reason: 'no_answer' });

      const [firstResponse, secondResponse] = await Promise.all([
        firstRetry,
        secondRetry
      ]);

      // One should succeed, one should fail
      const responses = [firstResponse, secondResponse];
      const successCount = responses.filter(r => r.status === 202).length;
      const conflictCount = responses.filter(r => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      const conflictResponse = responses.find(r => r.status === 409);
      expect(conflictResponse.body.error).toContain('retry already in progress');
    });
  });

  describe('Retry Success Handling', () => {
    it('should clear retry chain when call finally succeeds', async () => {
      // Create failed attempts
      const firstFailed = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 0,
          failure_reason: 'no_answer'
        })
        .select()
        .single();

      const secondFailed = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'failed',
          retry_count: 1,
          failure_reason: 'line_busy',
          original_verification_id: verificationId
        })
        .select()
        .single();

      // Create successful third attempt
      const successfulAttempt = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: customerPhone,
          status: 'completed',
          retry_count: 2,
          call_duration_seconds: 95,
          original_verification_id: verificationId
        })
        .select()
        .single();

      // Verify no more retries possible for this verification
      const retryResponse = await request(app)
        .put(`/api/ai/calls/${successfulAttempt.data.id}/retry`)
        .send({ retry_reason: 'test' })
        .expect(409);

      expect(retryResponse.body.error).toContain('Call already completed successfully');

      // Check verification status shows completion
      const statusResponse = await request(app)
        .get(`/api/ai/calls/status?verification_id=${verificationId}`)
        .expect(200);

      expect(statusResponse.body.final_status).toBe('completed');
      expect(statusResponse.body.total_attempts).toBe(3);
      expect(statusResponse.body.successful_attempt_number).toBe(3);
    });
  });
});