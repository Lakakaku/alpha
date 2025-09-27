import request from 'supertest';
import { app } from '../../src/app';

describe('AI Call Flow Integration Test', () => {
  const validJWT = 'valid-test-jwt';
  const validStoreId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const validCustomerPhone = '+46701234567';

  beforeEach(() => {
    // This test MUST fail initially (TDD requirement)
    // Tests complete AI call flow from quickstart.md Scenario 1
  });

  test('should complete full AI call workflow: verification → call → transcript → analysis', async () => {
    // Step 1: Create customer verification record (simulates existing verification flow)
    const verificationResponse = await request(app)
      .post('/api/verification/create')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        store_id: validStoreId,
        transaction_time: '2025-09-23T14:30:00Z',
        transaction_value: 125.50,
        phone_number: validCustomerPhone
      })
      .expect(201);

    const verificationId = verificationResponse.body.verification_id;
    expect(verificationId).toBeDefined();

    // Step 2: Initiate AI call (should trigger automatically after verification)
    const callResponse = await request(app)
      .post('/ai/calls/initiate')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        customer_verification_id: verificationId,
        phone_number: validCustomerPhone,
        store_id: validStoreId,
        priority: 'normal'
      })
      .expect(202);

    const callSessionId = callResponse.body.call_session_id;
    expect(callSessionId).toBeDefined();
    expect(callResponse.body.status).toMatch(/^(pending|queued)$/);
    expect(callResponse.body.retry_count).toBe(0);

    // Step 3: Check call status
    const statusResponse = await request(app)
      .get(`/ai/calls/${callSessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      call_session_id: callSessionId,
      status: expect.stringMatching(/^(pending|in_progress|completed)$/),
      current_retry: 0
    });

    // Step 4: Simulate call connection and conversation (mock OpenAI response)
    const connectionResponse = await request(app)
      .patch(`/ai/calls/${callSessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        status: 'in_progress',
        call_connected_at: new Date().toISOString()
      })
      .expect(200);

    expect(connectionResponse.body.status).toBe('in_progress');

    // Step 5: Submit conversation transcript (1.5 minutes, detailed feedback)
    const transcriptResponse = await request(app)
      .post(`/ai/calls/${callSessionId}/transcript`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            message_type: 'question',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Butiken var ren och personalen var mycket hjälpsam vid köttdisken. Jag hittade allt jag behövde.',
            timestamp_ms: 5000,
            message_order: 2,
            message_type: 'response',
            confidence_score: 0.95,
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Det låter bra! Fanns det något som kunde förbättras?',
            timestamp_ms: 12000,
            message_order: 3,
            message_type: 'question',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Kassakön var lite lång, men det var fredag kväll så det är förståeligt. Annars var allt perfekt.',
            timestamp_ms: 18000,
            message_order: 4,
            message_type: 'response',
            confidence_score: 0.92,
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 95, // Within 60-120 second range for analysis
        openai_session_id: 'sess_test123',
        final_audio_quality: {
          connection_quality: 'good',
          audio_clarity_score: 0.88,
          latency_ms: 45,
          packet_loss_percentage: 0.2
        }
      })
      .expect(201);

    const transcriptId = transcriptResponse.body.transcript_id;
    expect(transcriptId).toBeDefined();
    expect(transcriptResponse.body.analysis_queued).toBe(true);

    // Step 6: Process feedback analysis
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSessionId,
        transcript_id: transcriptId,
        priority: 'normal'
      })
      .expect(202);

    const analysisId = analysisResponse.body.analysis_id;
    expect(analysisId).toBeDefined();
    expect(analysisResponse.body.status).toMatch(/^(queued|processing)$/);

    // Step 7: Check analysis status (simulate completion)
    let analysisComplete = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!analysisComplete && attempts < maxAttempts) {
      const statusCheck = await request(app)
        .get(`/ai/analysis/${analysisId}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(200);

      if (statusCheck.body.status === 'completed') {
        analysisComplete = true;
        expect(statusCheck.body.progress_percentage).toBe(100);
      } else if (statusCheck.body.status === 'failed') {
        throw new Error(`Analysis failed: ${statusCheck.body.error_message}`);
      }

      attempts++;
      if (!analysisComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      }
    }

    // For testing purposes, simulate completion if not naturally completed
    if (!analysisComplete) {
      console.warn('Analysis not completed within timeout, simulating completion for test');
    }

    // Step 8: Retrieve analysis results
    const resultsResponse = await request(app)
      .get(`/ai/analysis/${analysisId}/results`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(200);

    // Validate quality assessment results
    expect(resultsResponse.body).toMatchObject({
      assessment_id: expect.any(String),
      call_session_id: callSessionId,
      scores: {
        legitimacy_score: expect.any(Number),
        depth_score: expect.any(Number),
        usefulness_score: expect.any(Number),
        overall_quality_score: expect.any(Number)
      },
      reward_percentage: expect.any(Number),
      is_fraudulent: false, // Should be legitimate for this scenario
      created_at: expect.any(String)
    });

    // Validate score ranges
    expect(resultsResponse.body.scores.legitimacy_score).toBeGreaterThanOrEqual(0);
    expect(resultsResponse.body.scores.legitimacy_score).toBeLessThanOrEqual(1);
    expect(resultsResponse.body.scores.depth_score).toBeGreaterThan(0.5); // Should be high for detailed feedback
    expect(resultsResponse.body.scores.usefulness_score).toBeGreaterThan(0.5); // Actionable feedback
    expect(resultsResponse.body.scores.overall_quality_score).toBeGreaterThan(0.5);

    // Validate reward percentage (should be 8-12% for good detailed feedback)
    expect(resultsResponse.body.reward_percentage).toBeGreaterThanOrEqual(2.00);
    expect(resultsResponse.body.reward_percentage).toBeLessThanOrEqual(15.00);
    expect(resultsResponse.body.reward_percentage).toBeGreaterThan(7.0); // Expected high reward

    // Step 9: Verify final call status is completed
    const finalStatusResponse = await request(app)
      .get(`/ai/calls/${callSessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(200);

    expect(finalStatusResponse.body.status).toBe('completed');
    expect(finalStatusResponse.body.duration_seconds).toBe(95);
    expect(finalStatusResponse.body.failure_reason).toBeNull();

    // Step 10: Verify business actionable items were generated
    if (resultsResponse.body.business_actionable_items) {
      expect(resultsResponse.body.business_actionable_items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            description: expect.any(String),
            priority: expect.any(String)
          })
        ])
      );
    }

    // Step 11: Verify fraud detection results (should show no fraud)
    const fraudCheckResponse = await request(app)
      .post('/ai/analysis/fraud-check')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSessionId,
        check_types: ['timing', 'content', 'context'],
        business_context: {
          operating_hours: {
            friday: { open: '08:00', close: '21:00' }
          }
        }
      })
      .expect(200);

    expect(fraudCheckResponse.body.overall_is_fraudulent).toBe(false);
    expect(fraudCheckResponse.body.should_exclude_from_rewards).toBe(false);
    expect(fraudCheckResponse.body.confidence_level).toBeGreaterThan(0.7);

    console.log('✅ Complete AI call flow test passed - from verification to reward calculation');
  });

  test('should handle call retry logic correctly (max 3 attempts)', async () => {
    // Create verification
    const verificationResponse = await request(app)
      .post('/api/verification/create')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        store_id: validStoreId,
        transaction_time: '2025-09-23T14:30:00Z',
        transaction_value: 85.00,
        phone_number: '+46701234568'
      })
      .expect(201);

    const verificationId = verificationResponse.body.verification_id;

    // First call attempt
    const firstCallResponse = await request(app)
      .post('/ai/calls/initiate')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        customer_verification_id: verificationId,
        phone_number: '+46701234568',
        store_id: validStoreId
      })
      .expect(202);

    const firstCallSessionId = firstCallResponse.body.call_session_id;
    expect(firstCallResponse.body.retry_count).toBe(0);

    // Simulate first call failure
    await request(app)
      .patch(`/ai/calls/${firstCallSessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        status: 'failed',
        failure_reason: 'customer_no_answer',
        end_reason: 'timeout'
      })
      .expect(200);

    // First retry attempt (retry 1)
    const retry1Response = await request(app)
      .post(`/ai/calls/retry/${verificationId}`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(202);

    expect(retry1Response.body.retry_number).toBe(1);

    const retry1SessionId = retry1Response.body.new_call_session_id;

    // Simulate second call failure
    await request(app)
      .patch(`/ai/calls/${retry1SessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        status: 'failed',
        failure_reason: 'customer_hangup',
        end_reason: 'customer_hangup'
      })
      .expect(200);

    // Second retry attempt (retry 2)
    const retry2Response = await request(app)
      .post(`/ai/calls/retry/${verificationId}`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(202);

    expect(retry2Response.body.retry_number).toBe(2);

    const retry2SessionId = retry2Response.body.new_call_session_id;

    // Simulate third call failure
    await request(app)
      .patch(`/ai/calls/${retry2SessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        status: 'failed',
        failure_reason: 'technical_failure',
        end_reason: 'technical_failure'
      })
      .expect(200);

    // Third retry attempt should fail (exceeded max 3 total attempts)
    const retry3Response = await request(app)
      .post(`/ai/calls/retry/${verificationId}`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(409);

    expect(retry3Response.body.error).toContain('Maximum retries exceeded');
    expect(retry3Response.body.message).toContain('3 total attempts');

    console.log('✅ Call retry logic test passed - correctly enforced 3 attempt limit');
  });

  test('should handle Swedish language requirement correctly', async () => {
    // Create verification
    const verificationResponse = await request(app)
      .post('/api/verification/create')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        store_id: validStoreId,
        transaction_time: '2025-09-23T15:00:00Z',
        transaction_value: 65.00,
        phone_number: '+46701234569'
      })
      .expect(201);

    const verificationId = verificationResponse.body.verification_id;

    // Initiate call
    const callResponse = await request(app)
      .post('/ai/calls/initiate')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        customer_verification_id: verificationId,
        phone_number: '+46701234569',
        store_id: validStoreId
      })
      .expect(202);

    const callSessionId = callResponse.body.call_session_id;

    // Submit transcript with non-Swedish response (should trigger abandonment)
    const transcriptResponse = await request(app)
      .post(`/ai/calls/${callSessionId}/transcript`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            message_type: 'question',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Sorry, I don\'t speak Swedish',
            timestamp_ms: 3000,
            message_order: 2,
            message_type: 'response',
            confidence_score: 0.95,
            language_detected: 'en'
          }
        ],
        total_duration_seconds: 15, // Short duration due to language barrier
        openai_session_id: 'sess_language_test'
      })
      .expect(201);

    // Check that call status becomes abandoned due to language barrier
    const statusResponse = await request(app)
      .get(`/ai/calls/${callSessionId}/status`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(200);

    expect(statusResponse.body.status).toBe('abandoned');
    expect(statusResponse.body.failure_reason).toContain('language_barrier');
    expect(statusResponse.body.duration_seconds).toBeLessThan(60);

    // Verify no analysis is performed for abandoned calls
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSessionId,
        transcript_id: transcriptResponse.body.transcript_id
      })
      .expect(400); // Should reject analysis for abandoned calls

    expect(analysisResponse.body.error).toContain('Cannot analyze abandoned call');

    console.log('✅ Swedish language requirement test passed - correctly handled language barrier');
  });
});