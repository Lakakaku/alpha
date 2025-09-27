import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('GET /api/questions - Contract Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('Success Cases', () => {
    it('should return 200 with empty questions list', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          questions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      });
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/questions?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0
      });
    });

    it('should support category filtering', async () => {
      const response = await request(app)
        .get('/api/questions?category=service_quality')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.questions)).toBe(true);
    });

    it('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.questions)).toBe(true);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/questions')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authentication token'
        }
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/questions?page=0&limit=101')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination parameters',
          details: [
            'Page must be greater than 0',
            'Limit must be between 1 and 100'
          ]
        }
      });
    });

    it('should return 400 for invalid category filter', async () => {
      const response = await request(app)
        .get('/api/questions?category=invalid_category')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category filter',
          details: ['Category must be one of: service_quality, product_feedback, store_experience, staff_performance, suggestions']
        }
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return correct response schema structure', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate response structure
      expect(response.body).toMatchObject({
        success: true,
        data: {
          questions: expect.any(Array),
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
          }
        }
      });
    });

    it('should return questions with correct schema when questions exist', async () => {
      // This test will be updated when we have sample data
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // If questions exist, validate their structure
      if (response.body.data.questions.length > 0) {
        const question = response.body.data.questions[0];
        expect(question).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          question_text: expect.any(String),
          question_type: expect.stringMatching(/^(text|multiple_choice|scale|boolean)$/),
          category: expect.any(String),
          status: expect.stringMatching(/^(draft|active|inactive)$/),
          created_at: expect.any(String),
          updated_at: expect.any(String),
          business_id: businessId,
          store_id: storeId
        });
      }
    });
  });
});