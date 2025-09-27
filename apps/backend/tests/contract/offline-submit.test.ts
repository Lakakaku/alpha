import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';

describe('Offline Submit Contract - POST /api/offline/submit', () => {
  let validAuthToken: string;

  beforeAll(async () => {
    // Set up authentication token for testing
    // This will need to be adjusted based on the actual auth implementation
    validAuthToken = 'test-auth-token-123';
  });

  afterAll(async () => {
    // Cleanup after tests if needed
  });

  describe('Valid feedback submission', () => {
    it('should queue feedback submission successfully', async () => {
      const feedbackSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4,
          comment: 'Great service today!',
          transactionId: 'txn_123456789',
          customerPhone: '+46701234567',
          categories: ['service', 'quality']
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(feedbackSubmission)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        estimatedSyncTime: expect.any(Number)
      });

      // Estimated sync time should be reasonable (within 5 minutes)
      expect(response.body.estimatedSyncTime).toBeGreaterThan(0);
      expect(response.body.estimatedSyncTime).toBeLessThanOrEqual(300000); // 5 minutes in ms
    });

    it('should handle minimal feedback submission', async () => {
      const minimalFeedback = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 3
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(minimalFeedback)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.any(String),
        estimatedSyncTime: expect.any(Number)
      });
    });
  });

  describe('Valid support_request submission', () => {
    it('should queue support request submission successfully', async () => {
      const supportSubmission = {
        submissionType: 'support_request',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          requestType: 'technical_issue',
          description: 'QR code scanner not working properly',
          priority: 'medium',
          customerPhone: '+46701234567',
          contactEmail: 'customer@example.com'
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(supportSubmission)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        estimatedSyncTime: expect.any(Number)
      });
    });

    it('should handle urgent support request with higher priority', async () => {
      const urgentSupport = {
        submissionType: 'support_request',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          requestType: 'payment_issue',
          description: 'Payment processing completely down',
          priority: 'urgent',
          customerPhone: '+46701234567'
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(urgentSupport)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.any(String),
        estimatedSyncTime: expect.any(Number)
      });

      // Urgent requests should have faster estimated sync time
      expect(response.body.estimatedSyncTime).toBeLessThanOrEqual(60000); // 1 minute in ms
    });
  });

  describe('Valid call_response submission', () => {
    it('should queue call response submission successfully', async () => {
      const callResponseSubmission = {
        submissionType: 'call_response',
        submissionData: {
          callSessionId: 'call_550e8400-e29b-41d4-a716-446655440000',
          questionId: 'q_12345',
          response: 'Yes, very satisfied with the service',
          responseType: 'verbal',
          confidence: 0.95,
          duration: 45000 // 45 seconds
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(callResponseSubmission)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        estimatedSyncTime: expect.any(Number)
      });
    });

    it('should handle numeric rating call response', async () => {
      const ratingResponse = {
        submissionType: 'call_response',
        submissionData: {
          callSessionId: 'call_550e8400-e29b-41d4-a716-446655440000',
          questionId: 'q_67890',
          response: '4',
          responseType: 'rating',
          confidence: 1.0,
          duration: 15000 // 15 seconds
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(ratingResponse)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.any(String),
        estimatedSyncTime: expect.any(Number)
      });
    });
  });

  describe('Invalid submissionType', () => {
    it('should return 400 for unsupported submission type', async () => {
      const invalidSubmission = {
        submissionType: 'unknown_type',
        submissionData: {
          someField: 'someValue'
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_SUBMISSION_TYPE',
        message: expect.stringContaining('submissionType')
      });
    });

    it('should return 400 for missing submission type', async () => {
      const invalidSubmission = {
        submissionData: {
          someField: 'someValue'
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('submissionType')
      });
    });
  });

  describe('Missing submissionData', () => {
    it('should return 400 for missing submission data', async () => {
      const invalidSubmission = {
        submissionType: 'feedback',
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('submissionData')
      });
    });

    it('should return 400 for null submission data', async () => {
      const invalidSubmission = {
        submissionType: 'feedback',
        submissionData: null,
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('submissionData')
      });
    });
  });

  describe('Authentication', () => {
    it('should return 401 for missing authorization header', async () => {
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .send(validSubmission)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('authorization')
      });
    });

    it('should return 401 for invalid authorization token', async () => {
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', 'Bearer invalid-token-xyz')
        .send(validSubmission)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('Invalid')
      });
    });
  });

  describe('Malformed submissionData validation', () => {
    it('should return 422 for feedback with invalid rating', async () => {
      const invalidFeedback = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 'invalid-rating' // Should be number 1-5
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidFeedback)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_DATA_FORMAT',
        message: expect.stringContaining('rating')
      });
    });

    it('should return 422 for feedback with missing storeId', async () => {
      const invalidFeedback = {
        submissionType: 'feedback',
        submissionData: {
          rating: 4,
          comment: 'Good service'
          // missing storeId
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidFeedback)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_DATA_FORMAT',
        message: expect.stringContaining('storeId')
      });
    });

    it('should return 422 for call_response with invalid confidence', async () => {
      const invalidCallResponse = {
        submissionType: 'call_response',
        submissionData: {
          callSessionId: 'call_123',
          questionId: 'q_456',
          response: 'Yes',
          confidence: 1.5 // Should be 0-1
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidCallResponse)
        .expect(422);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_DATA_FORMAT',
        message: expect.stringContaining('confidence')
      });
    });
  });

  describe('Large submission data validation', () => {
    it('should return 413 for submission data exceeding size limit', async () => {
      const largeComment = 'x'.repeat(50000); // 50KB comment
      const largeSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4,
          comment: largeComment
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(largeSubmission)
        .expect(413);

      expect(response.body).toMatchObject({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: expect.stringContaining('size limit')
      });
    });

    it('should accept submission data within size limit', async () => {
      const reasonableComment = 'x'.repeat(1000); // 1KB comment
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4,
          comment: reasonableComment
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validSubmission)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.any(String),
        estimatedSyncTime: expect.any(Number)
      });
    });
  });

  describe('Response format validation', () => {
    it('should return valid UUID format for queueId', async () => {
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 5
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validSubmission)
        .expect(200);

      // Verify queueId is proper UUID v4 format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(response.body.queueId).toMatch(uuidRegex);
    });

    it('should return reasonable estimatedSyncTime', async () => {
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 5
        },
        clientTimestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validSubmission)
        .expect(200);

      // EstimatedSyncTime should be positive and reasonable (under 1 hour)
      expect(response.body.estimatedSyncTime).toBeGreaterThan(0);
      expect(response.body.estimatedSyncTime).toBeLessThanOrEqual(3600000); // 1 hour in ms
      expect(typeof response.body.estimatedSyncTime).toBe('number');
    });
  });

  describe('Duplicate submissions handling', () => {
    it('should handle duplicate submissions gracefully', async () => {
      const submission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4,
          transactionId: 'duplicate_test_123'
        },
        clientTimestamp: new Date().toISOString()
      };

      // Submit first time
      const response1 = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(submission)
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Submit second time with same data
      const response2 = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(submission)
        .expect(200);

      // Should either return same queueId or new one with duplicate flag
      expect(response2.body.success).toBe(true);
      expect(response2.body.queueId).toBeDefined();
    });
  });

  describe('Client timestamp validation', () => {
    it('should return 400 for invalid timestamp format', async () => {
      const invalidSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4
        },
        clientTimestamp: 'invalid-timestamp'
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('clientTimestamp')
      });
    });

    it('should return 400 for missing timestamp', async () => {
      const invalidSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4
        }
        // missing clientTimestamp
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(invalidSubmission)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('clientTimestamp')
      });
    });

    it('should accept valid ISO timestamp', async () => {
      const validSubmission = {
        submissionType: 'feedback',
        submissionData: {
          storeId: '550e8400-e29b-41d4-a716-446655440000',
          rating: 4
        },
        clientTimestamp: '2023-12-07T10:30:00.000Z'
      };

      const response = await request(app)
        .post('/api/offline/submit')
        .set('Authorization', `Bearer ${validAuthToken}`)
        .send(validSubmission)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        queueId: expect.any(String),
        estimatedSyncTime: expect.any(Number)
      });
    });
  });
});