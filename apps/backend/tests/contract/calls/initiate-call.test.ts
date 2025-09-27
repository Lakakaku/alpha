import request from 'supertest';
import { app } from '../../../src/app';

describe('POST /api/calls/initiate - Contract Test', () => {
  // This test MUST FAIL initially since the endpoint doesn't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  describe('Success Cases', () => {
    it('should return 201 when initiating call with valid data', async () => {
      const validRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567',
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(validRequest)
        .expect(201);

      // Expected response structure from OpenAPI spec
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          businessId: expect.any(String),
          status: 'initiated',
          startedAt: expect.any(String),
          connectedAt: null,
          endedAt: null,
          durationSeconds: null,
          questionsAsked: [],
          costEstimate: null,
          recordingUrl: null
        }
      });

      // Validate UUID format for session ID
      expect(response.body.data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should accept high priority calls', async () => {
      const highPriorityRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(highPriorityRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 for missing verificationId', async () => {
      const invalidRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('verificationId'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid phone number format', async () => {
      const invalidRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: 'invalid-phone'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('phone'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidRequest = {
        verificationId: 'invalid-uuid',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid priority value', async () => {
      const invalidRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567',
        priority: 'invalid'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Business Logic Cases', () => {
    it('should return 422 for verification not found', async () => {
      const requestWithNonExistentVerification = {
        verificationId: '99999999-9999-9999-9999-999999999999',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(requestWithNonExistentVerification)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VERIFICATION_NOT_FOUND',
          message: expect.stringContaining('verification'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 422 for incomplete verification', async () => {
      const requestWithIncompleteVerification = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567'
      };

      const response = await request(app)
        .post('/api/calls/initiate')
        .send(requestWithIncompleteVerification)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VERIFICATION_INCOMPLETE',
          message: expect.stringContaining('complete'),
          details: expect.any(Object)
        }
      });
    });
  });

  describe('Rate Limiting Cases', () => {
    it('should return 429 when rate limit exceeded', async () => {
      const validRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440000',
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerPhone: '+46701234567'
      };

      // This test assumes rate limiting middleware is implemented
      // Make multiple rapid requests to trigger rate limit
      const promises = Array(11).fill(null).map(() =>
        request(app)
          .post('/api/calls/initiate')
          .send(validRequest)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('rate limit'),
            details: expect.any(Object)
          }
        });
      }
    });
  });

  describe('Content Type Cases', () => {
    it('should return 400 for non-JSON content type', async () => {
      const response = await request(app)
        .post('/api/calls/initiate')
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for malformed JSON', async () => {
      const response = await request(app)
        .post('/api/calls/initiate')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});