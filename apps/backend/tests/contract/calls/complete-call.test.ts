import request from 'supertest';
import { app } from '../../../src/app';

describe('POST /api/calls/{sessionId}/complete - Contract Test', () => {
  // This test MUST FAIL initially since the endpoint doesn't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const nonExistentSessionId = '99999999-9999-9999-9999-999999999999';

  describe('Success Cases', () => {
    it('should return 200 when completing call with reason completed', async () => {
      const completeRequest = {
        reason: 'completed',
        transcript: 'Hej! Tack för att du deltog i vår undersökning. Vi frågade om din upplevelse av butiken...',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Hur var din upplevelse av vår butik idag?',
            responseText: 'Det var mycket bra, personalen var hjälpsam och butiken var ren.',
            responseDuration: 15,
            confidenceScore: 0.95,
            sentimentScore: 0.8,
            askedAt: '2025-09-22T20:30:00Z',
            respondedAt: '2025-09-22T20:30:15Z'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(completeRequest)
        .expect(200);

      // Expected response structure from OpenAPI spec
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: validSessionId,
          businessId: expect.any(String),
          status: 'completed',
          startedAt: expect.any(String),
          connectedAt: expect.any(String),
          endedAt: expect.any(String),
          durationSeconds: expect.any(Number),
          questionsAsked: expect.any(Array),
          costEstimate: expect.any(Number),
          recordingUrl: expect.any(String) || null
        }
      });

      // Validate duration constraints
      expect(response.body.data.durationSeconds).toBeGreaterThan(0);
      expect(response.body.data.durationSeconds).toBeLessThanOrEqual(120); // Max 2 minutes
    });

    it('should return 200 when completing call with reason timeout', async () => {
      const timeoutRequest = {
        reason: 'timeout',
        transcript: 'Hej! Tack för att du deltog i vår undersökning. Tyvärr...',
        responses: []
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(timeoutRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'timeout'
        }
      });
    });

    it('should return 200 when completing call with reason technical_failure', async () => {
      const failureRequest = {
        reason: 'technical_failure',
        transcript: null
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(failureRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'failed'
        }
      });
    });

    it('should return 200 when completing call with reason customer_hangup', async () => {
      const hangupRequest = {
        reason: 'customer_hangup',
        transcript: 'Hej! Tack för att du deltog i vår undersökning...',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Hur var din upplevelse av vår butik idag?',
            responseText: 'Jag har ingen tid för detta nu.',
            responseDuration: 3,
            confidenceScore: 0.90,
            sentimentScore: -0.2,
            askedAt: '2025-09-22T20:30:00Z',
            respondedAt: '2025-09-22T20:30:03Z'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(hangupRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });

    it('should accept call completion without responses', async () => {
      const noResponsesRequest = {
        reason: 'timeout',
        transcript: 'Hej! Tack för att du deltog i vår undersökning. Tyvärr fick vi ingen respons.'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(noResponsesRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 for missing reason', async () => {
      const invalidRequest = {
        transcript: 'Some transcript',
        responses: []
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('reason'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid reason value', async () => {
      const invalidRequest = {
        reason: 'invalid_reason',
        transcript: 'Some transcript'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('reason'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid session ID format', async () => {
      const invalidSessionId = 'invalid-uuid';
      const validRequest = {
        reason: 'completed',
        transcript: 'Some transcript'
      };

      const response = await request(app)
        .post(`/api/calls/${invalidSessionId}/complete`)
        .send(validRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid response data structure', async () => {
      const invalidRequest = {
        reason: 'completed',
        transcript: 'Some transcript',
        responses: [
          {
            questionId: 'invalid-uuid',
            questionText: 'Question?',
            responseText: 'Answer',
            responseDuration: -5, // Invalid negative duration
            askedAt: 'invalid-date'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for confidence score out of range', async () => {
      const invalidRequest = {
        reason: 'completed',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Question?',
            responseText: 'Answer',
            responseDuration: 10,
            confidenceScore: 1.5, // Invalid - must be 0-1
            askedAt: '2025-09-22T20:30:00Z'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for sentiment score out of range', async () => {
      const invalidRequest = {
        reason: 'completed',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Question?',
            responseText: 'Answer',
            responseDuration: 10,
            sentimentScore: -2.0, // Invalid - must be -1 to 1
            askedAt: '2025-09-22T20:30:00Z'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Business Logic Cases', () => {
    it('should return 404 for non-existent call session', async () => {
      const validRequest = {
        reason: 'completed',
        transcript: 'Some transcript'
      };

      const response = await request(app)
        .post(`/api/calls/${nonExistentSessionId}/complete`)
        .send(validRequest)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CALL_SESSION_NOT_FOUND',
          message: expect.stringContaining('session'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 409 for already completed call session', async () => {
      const validRequest = {
        reason: 'completed',
        transcript: 'Some transcript'
      };

      // Assuming this session is already completed
      const completedSessionId = '550e8400-e29b-41d4-a716-446655440001';

      const response = await request(app)
        .post(`/api/calls/${completedSessionId}/complete`)
        .send(validRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CALL_ALREADY_COMPLETED',
          message: expect.stringContaining('already'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 403 for unauthorized access to call session', async () => {
      const unauthorizedSessionId = '550e8400-e29b-41d4-a716-446655440002';
      const validRequest = {
        reason: 'completed',
        transcript: 'Some transcript'
      };

      const response = await request(app)
        .post(`/api/calls/${unauthorizedSessionId}/complete`)
        .send(validRequest)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: expect.stringContaining('access'),
          details: expect.any(Object)
        }
      });
    });
  });

  describe('Response Processing Cases', () => {
    it('should validate response timing consistency', async () => {
      const invalidTimingRequest = {
        reason: 'completed',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Question?',
            responseText: 'Answer',
            responseDuration: 10,
            askedAt: '2025-09-22T20:30:00Z',
            respondedAt: '2025-09-22T20:29:55Z' // Earlier than askedAt
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(invalidTimingRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('timing');
    });

    it('should validate response duration matches timestamps', async () => {
      const inconsistentDurationRequest = {
        reason: 'completed',
        responses: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440100',
            questionText: 'Question?',
            responseText: 'Answer',
            responseDuration: 30, // Says 30 seconds
            askedAt: '2025-09-22T20:30:00Z',
            respondedAt: '2025-09-22T20:30:10Z' // But only 10 seconds apart
          }
        ]
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send(inconsistentDurationRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Type Cases', () => {
    it('should return 400 for non-JSON content type', async () => {
      const response = await request(app)
        .post(`/api/calls/${validSessionId}/complete`)
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});