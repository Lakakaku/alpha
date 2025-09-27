import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('GET /api/questions/categories - Contract Test', () => {
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
    it('should return list of question categories and return 200', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          categories: expect.arrayContaining([
            {
              id: 'service_quality',
              name: 'Service Quality',
              description: 'Questions about service experience and quality',
              icon: 'star',
              color: '#007bff',
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.any(String)
            },
            {
              id: 'product_feedback',
              name: 'Product Feedback',
              description: 'Questions about product quality and satisfaction',
              icon: 'package',
              color: '#28a745',
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.any(String)
            },
            {
              id: 'store_experience',
              name: 'Store Experience',
              description: 'Questions about overall store experience',
              icon: 'home',
              color: '#ffc107',
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.any(String)
            },
            {
              id: 'staff_performance',
              name: 'Staff Performance',
              description: 'Questions about staff helpfulness and performance',
              icon: 'users',
              color: '#17a2b8',
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.any(String)
            },
            {
              id: 'suggestions',
              name: 'Suggestions',
              description: 'Open feedback and improvement suggestions',
              icon: 'lightbulb',
              color: '#6f42c1',
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.any(String)
            }
          ]),
          total: 5
        }
      });
    });

    it('should include question counts for each category', async () => {
      // Create some questions to test counts
      const questionData = {
        title: 'Test Service Question',
        question_text: 'How was our service?',
        question_type: 'scale',
        category: 'service_quality'
      };

      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const serviceCategory = response.body.data.categories.find(
        cat => cat.id === 'service_quality'
      );

      expect(serviceCategory.question_count).toBeGreaterThan(0);
    });

    it('should support include_stats parameter', async () => {
      const response = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.categories[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        statistics: {
          total_questions: expect.any(Number),
          active_questions: expect.any(Number),
          response_rate: expect.any(Number),
          average_rating: expect.any(Number),
          last_activity: expect.any(String)
        }
      });
    });

    it('should support custom categories when they exist', async () => {
      // Create a custom category (this would be done through a separate endpoint)
      // For now, just verify the response structure supports custom categories
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data.categories)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should filter by status when provided', async () => {
      const response = await request(app)
        .get('/api/questions/categories?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });

    it('should return categories ordered by display_order', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const categories = response.body.data.categories;
      
      // Verify categories are ordered
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].display_order).toBeGreaterThanOrEqual(
          categories[i - 1].display_order
        );
      }
    });

    it('should support minimal response format', async () => {
      const response = await request(app)
        .get('/api/questions/categories?format=minimal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.categories[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String)
      });

      // Should not include heavy fields in minimal format
      expect(response.body.data.categories[0].description).toBeUndefined();
      expect(response.body.data.categories[0].statistics).toBeUndefined();
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
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
        .get('/api/questions/categories')
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

  describe('Query Parameter Validation', () => {
    it('should return 400 for invalid include_stats parameter', async () => {
      const response = await request(app)
        .get('/api/questions/categories?include_stats=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: ['include_stats must be a boolean value']
        }
      });
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app)
        .get('/api/questions/categories?status=invalid_status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status filter',
          details: ['status must be one of: active, inactive, all']
        }
      });
    });

    it('should return 400 for invalid format parameter', async () => {
      const response = await request(app)
        .get('/api/questions/categories?format=invalid_format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid format parameter',
          details: ['format must be one of: full, minimal']
        }
      });
    });
  });

  describe('Business-Specific Categories', () => {
    it('should return only categories available to the business', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All categories should be associated with the business
      response.body.data.categories.forEach(category => {
        expect(category).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          available: true
        });
      });
    });

    it('should include business-specific customizations', async () => {
      const response = await request(app)
        .get('/api/questions/categories?include_customizations=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Categories may have business-specific customizations
      const categories = response.body.data.categories;
      expect(Array.isArray(categories)).toBe(true);
      
      if (categories.length > 0 && categories[0].customizations) {
        expect(categories[0].customizations).toMatchObject({
          display_name: expect.any(String),
          custom_icon: expect.any(String),
          custom_color: expect.any(String)
        });
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should return categories within acceptable time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Performance requirement
      expect(response.body.success).toBe(true);
    });

    it('should handle large number of questions efficiently', async () => {
      // This test would create many questions and verify performance
      // For now, just ensure the endpoint performs well with existing data
      const response = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return correct full response schema', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          categories: expect.arrayContaining([
            {
              id: expect.any(String),
              name: expect.any(String),
              description: expect.any(String),
              icon: expect.any(String),
              color: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
              display_order: expect.any(Number),
              question_count: expect.any(Number),
              active_questions: expect.any(Number),
              created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
            }
          ]),
          total: expect.any(Number)
        }
      });
    });

    it('should return minimal schema when requested', async () => {
      const response = await request(app)
        .get('/api/questions/categories?format=minimal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.categories[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String)
      });

      // Minimal format should not include these fields
      expect(response.body.data.categories[0].description).toBeUndefined();
      expect(response.body.data.categories[0].icon).toBeUndefined();
      expect(response.body.data.categories[0].color).toBeUndefined();
    });

    it('should include statistics when requested', async () => {
      const response = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.data.categories.length > 0) {
        expect(response.body.data.categories[0].statistics).toMatchObject({
          total_questions: expect.any(Number),
          active_questions: expect.any(Number),
          response_rate: expect.any(Number),
          average_rating: expect.any(Number),
          last_activity: expect.any(String)
        });
      }
    });
  });

  describe('Default Categories Verification', () => {
    it('should include all required default categories', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const categoryIds = response.body.data.categories.map(cat => cat.id);
      
      const requiredCategories = [
        'service_quality',
        'product_feedback', 
        'store_experience',
        'staff_performance',
        'suggestions'
      ];

      requiredCategories.forEach(requiredId => {
        expect(categoryIds).toContain(requiredId);
      });
    });

    it('should have correct category configurations', async () => {
      const response = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const serviceQuality = response.body.data.categories.find(
        cat => cat.id === 'service_quality'
      );

      expect(serviceQuality).toMatchObject({
        id: 'service_quality',
        name: 'Service Quality',
        description: expect.stringContaining('service'),
        icon: 'star',
        color: expect.stringMatching(/^#[0-9a-fA-F]{6}$/)
      });
    });
  });
});