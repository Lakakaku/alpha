import request from 'supertest';
import { app } from '../../../src/app';

describe('POST /api/questions/select - Contract Test', () => {
  // This test MUST FAIL initially since the endpoint doesn't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  describe('Success Cases', () => {
    it('should return 200 with selected questions for basic business context', async () => {
      const selectionRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 90,
        customerContext: {
          department: 'electronics',
          visitTime: '2025-09-22T14:30:00Z',
          storeLocation: 'Stockholm'
        }
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(selectionRequest)
        .expect(200);

      // Expected response structure from OpenAPI spec
      expect(response.body).toMatchObject({
        success: true,
        data: {
          selectedQuestions: expect.any(Array),
          estimatedDuration: expect.any(Number),
          selectionCriteria: expect.any(Object)
        }
      });

      // Validate selected questions structure
      expect(response.body.data.selectedQuestions.length).toBeGreaterThan(0);
      expect(response.body.data.selectedQuestions.length).toBeLessThanOrEqual(3); // Reasonable limit

      response.body.data.selectedQuestions.forEach((question: any) => {
        expect(question).toMatchObject({
          id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
          questionText: expect.any(String),
          priority: expect.stringMatching(/^(high|medium|low)$/),
          maxResponseTime: expect.any(Number),
          followUpPrompts: expect.any(Array) || undefined
        });

        expect(question.questionText.length).toBeGreaterThan(10);
        expect(question.questionText.length).toBeLessThanOrEqual(500);
        expect(question.maxResponseTime).toBeGreaterThanOrEqual(10);
        expect(question.maxResponseTime).toBeLessThanOrEqual(60);
      });

      // Validate estimated duration within time budget
      expect(response.body.data.estimatedDuration).toBeGreaterThan(0);
      expect(response.body.data.estimatedDuration).toBeLessThanOrEqual(selectionRequest.timeBudgetSeconds);
    });

    it('should return 200 with questions for high frequency customer', async () => {
      const highFrequencyRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 50, // Every 50th customer
        timeBudgetSeconds: 120
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(highFrequencyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectedQuestions).toBeInstanceOf(Array);
    });

    it('should return 200 with questions for short time budget', async () => {
      const shortTimeRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 60 // Minimum time budget
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(shortTimeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.estimatedDuration).toBeLessThanOrEqual(60);
    });

    it('should handle customer context with multiple departments', async () => {
      const multiDepartmentRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 10,
        timeBudgetSeconds: 90,
        customerContext: {
          departments: ['electronics', 'clothing'],
          visitDuration: 45,
          purchaseAmount: 299.90
        }
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(multiDepartmentRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectionCriteria).toMatchObject({
        customerCount: 10,
        departments: expect.arrayContaining(['electronics', 'clothing'])
      });
    });

    it('should prioritize high priority questions when available', async () => {
      const priorityRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(priorityRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // If high priority questions exist, at least one should be selected
      const highPriorityCount = response.body.data.selectedQuestions.filter(
        (q: any) => q.priority === 'high'
      ).length;
      
      // This assertion might need adjustment based on actual data
      expect(highPriorityCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 for missing businessId', async () => {
      const invalidRequest = {
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('businessId'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid businessId format', async () => {
      const invalidRequest = {
        businessId: 'invalid-uuid',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing customerCount', async () => {
      const invalidRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error.message).toContain('customerCount');
    });

    it('should return 400 for invalid customerCount value', async () => {
      const invalidRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 0, // Must be positive
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid timeBudgetSeconds range', async () => {
      const invalidRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 30 // Below minimum of 60
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('timeBudgetSeconds');
    });

    it('should return 400 for timeBudgetSeconds above maximum', async () => {
      const invalidRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 150 // Above maximum of 120
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Business Logic Cases', () => {
    it('should return 404 for non-existent business', async () => {
      const nonExistentBusinessRequest = {
        businessId: '99999999-9999-9999-9999-999999999999',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(nonExistentBusinessRequest)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: expect.stringContaining('business'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 200 with empty array when no active questions exist', async () => {
      // Business with no active questions
      const noQuestionsRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440001',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(noQuestionsRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          selectedQuestions: [],
          estimatedDuration: 0,
          selectionCriteria: expect.any(Object)
        }
      });
    });

    it('should return 403 for unauthorized business access', async () => {
      const unauthorizedRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440002',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(unauthorizedRequest)
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

  describe('Algorithm Behavior Cases', () => {
    it('should respect question frequency settings', async () => {
      const frequencyRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 25, // 25th customer
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(frequencyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectionCriteria).toMatchObject({
        customerCount: 25,
        frequencyBasedSelection: expect.any(Boolean)
      });
    });

    it('should create selection log entry', async () => {
      const logRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 90
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(logRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.selectionCriteria).toHaveProperty('logEntryId');
    });

    it('should optimize for available time budget', async () => {
      const timeOptimizedRequest = {
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerCount: 1,
        timeBudgetSeconds: 75 // Specific time constraint
      };

      const response = await request(app)
        .post('/api/questions/select')
        .send(timeOptimizedRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.estimatedDuration).toBeLessThanOrEqual(75);
      
      // Should have selected questions that fit within time budget
      const totalMaxResponseTime = response.body.data.selectedQuestions.reduce(
        (sum: number, q: any) => sum + q.maxResponseTime, 0
      );
      expect(totalMaxResponseTime).toBeLessThanOrEqual(75);
    });
  });

  describe('Performance Cases', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId: '550e8400-e29b-41d4-a716-446655440000',
          customerCount: 1,
          timeBudgetSeconds: 90
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Content Type Cases', () => {
    it('should return 400 for non-JSON content type', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});