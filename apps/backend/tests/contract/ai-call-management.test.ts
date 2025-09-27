import request from 'supertest';
import { app } from '../../src/app';

describe('AI Call Management API Contract Tests', () => {
  const validJWT = 'valid-test-jwt';
  const validUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const swedishPhoneNumber = '+46701234567';

  beforeEach(() => {
    // These tests MUST fail initially (TDD requirement)
    // They test the contract defined in contracts/ai-call-management.yaml
  });

  describe('POST /ai/calls/initiate', () => {
    const validInitiateRequest = {
      customer_verification_id: validUUID,
      phone_number: swedishPhoneNumber,
      store_id: validUUID,
      priority: 'normal'
    };

    test('should accept valid call initiation request', async () => {
      const response = await request(app)
        .post('/ai/calls/initiate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validInitiateRequest)
        .expect(202);

      expect(response.body).toMatchObject({
        call_session_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        status: expect.stringMatching(/^(pending|queued)$/),
        estimated_call_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        retry_count: expect.any(Number)
      });

      expect(response.body.retry_count).toBeGreaterThanOrEqual(0);
      expect(response.body.retry_count).toBeLessThanOrEqual(3);
    });

    test('should reject request without authentication', async () => {
      await request(app)
        .post('/ai/calls/initiate')
        .send(validInitiateRequest)
        .expect(401);
    });

    test('should reject invalid phone number format', async () => {
      const invalidRequest = {
        ...validInitiateRequest,
        phone_number: '+1234567890' // Non-Swedish number
      };

      const response = await request(app)
        .post('/ai/calls/initiate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject duplicate call for same verification', async () => {
      // First call should succeed
      await request(app)
        .post('/ai/calls/initiate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validInitiateRequest)
        .expect(202);

      // Second call should fail with 409
      const response = await request(app)
        .post('/ai/calls/initiate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validInitiateRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should validate required fields', async () => {
      const incompleteRequest = {
        phone_number: swedishPhoneNumber
        // Missing customer_verification_id and store_id
      };

      const response = await request(app)
        .post('/ai/calls/initiate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(incompleteRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('GET /ai/calls/{call_session_id}/status', () => {
    test('should return call status for valid session', async () => {
      const response = await request(app)
        .get(`/ai/calls/${validUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(200);

      expect(response.body).toMatchObject({
        call_session_id: validUUID,
        status: expect.stringMatching(/^(pending|in_progress|completed|failed|abandoned)$/),
        current_retry: expect.any(Number),
        duration_seconds: expect.toBeOneOf([expect.any(Number), null]),
        failure_reason: expect.toBeOneOf([expect.any(String), null])
      });

      if (response.body.quality_metrics) {
        expect(response.body.quality_metrics).toMatchObject({
          connection_quality: expect.stringMatching(/^(excellent|good|fair|poor)$/),
          audio_clarity_score: expect.toBeOneOf([expect.any(Number), null]),
          latency_ms: expect.toBeOneOf([expect.any(Number), null])
        });
      }
    });

    test('should return 404 for non-existent session', async () => {
      const nonExistentUUID = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/ai/calls/${nonExistentUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid UUID format', async () => {
      await request(app)
        .get('/ai/calls/invalid-uuid/status')
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(400);
    });
  });

  describe('PATCH /ai/calls/{call_session_id}/status', () => {
    test('should update call session status', async () => {
      const updateRequest = {
        status: 'failed',
        failure_reason: 'customer_hangup',
        end_reason: 'customer_hangup'
      };

      const response = await request(app)
        .patch(`/ai/calls/${validUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        call_session_id: validUUID,
        status: 'failed',
        updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    test('should reject invalid status values', async () => {
      const invalidRequest = {
        status: 'invalid_status'
      };

      const response = await request(app)
        .patch(`/ai/calls/${validUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('POST /ai/calls/{call_session_id}/transcript', () => {
    const validTranscriptRequest = {
      messages: [
        {
          speaker: 'ai',
          content: 'Hej! Tack för att du handlade hos oss idag.',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Butiken var ren och personalen hjälpsam.',
          timestamp_ms: 5000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.95,
          language_detected: 'sv'
        }
      ],
      total_duration_seconds: 95,
      openai_session_id: 'sess_test123'
    };

    test('should accept valid transcript submission', async () => {
      const response = await request(app)
        .post(`/ai/calls/${validUUID}/transcript`)
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validTranscriptRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        transcript_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        analysis_queued: expect.any(Boolean),
        estimated_analysis_completion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    test('should reject transcript with invalid duration', async () => {
      const invalidRequest = {
        ...validTranscriptRequest,
        total_duration_seconds: 30 // Too short (min 60)
      };

      const response = await request(app)
        .post(`/ai/calls/${validUUID}/transcript`)
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject transcript with missing required fields', async () => {
      const incompleteRequest = {
        messages: validTranscriptRequest.messages
        // Missing total_duration_seconds
      };

      const response = await request(app)
        .post(`/ai/calls/${validUUID}/transcript`)
        .set('Authorization', `Bearer ${validJWT}`)
        .send(incompleteRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('POST /ai/calls/retry/{customer_verification_id}', () => {
    test('should accept retry request within limits', async () => {
      const response = await request(app)
        .post(`/ai/calls/retry/${validUUID}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(202);

      expect(response.body).toMatchObject({
        new_call_session_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        retry_number: expect.any(Number),
        estimated_call_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });

      expect(response.body.retry_number).toBeGreaterThanOrEqual(1);
      expect(response.body.retry_number).toBeLessThanOrEqual(2);
    });

    test('should reject retry when maximum attempts exceeded', async () => {
      // This would typically be tested with test data that has already reached max retries
      const response = await request(app)
        .post(`/ai/calls/retry/${validUUID}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(409);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Maximum retries exceeded')
      });
    });
  });
});

// Helper function for Jest custom matchers
expect.extend({
  toBeOneOf(received: any, validOptions: any[]) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});