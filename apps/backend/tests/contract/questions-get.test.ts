import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('GET /api/questions/{id} - Contract Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let questionId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;

    // Create a test question to retrieve
    const questionData = {
      title: 'Test Question for Retrieval',
      question_text: 'This is a test question for the GET endpoint.',
      question_type: 'text',
      category: 'service_quality',
      required: true,
      display_order: 1
    };

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionData);

    questionId = createResponse.body.data.question.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('Success Cases', () => {
    it('should return 200 with question details', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: questionId,
            title: 'Test Question for Retrieval',
            question_text: 'This is a test question for the GET endpoint.',
            question_type: 'text',
            category: 'service_quality',
            required: true,
            display_order: 1,
            status: 'draft',
            business_id: businessId,
            store_id: storeId,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should include triggers when they exist', async () => {
      // Create question with triggers
      const questionWithTriggers = {
        title: 'Question with Triggers',
        question_text: 'Test question with trigger configuration.',
        question_type: 'scale',
        category: 'service_quality',
        triggers: {
          frequency: {
            max_per_day: 5,
            max_per_week: 20,
            cooldown_hours: 4
          },
          conditions: {
            time_of_day: ['morning'],
            day_of_week: ['monday', 'tuesday']
          }
        }
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionWithTriggers);

      const triggeredQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .get(`/api/questions/${triggeredQuestionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.triggers).toMatchObject({
        frequency: {
          max_per_day: 5,
          max_per_week: 20,
          cooldown_hours: 4
        },
        conditions: {
          time_of_day: ['morning'],
          day_of_week: ['monday', 'tuesday']
        }
      });
    });

    it('should include options for multiple choice questions', async () => {
      const multipleChoiceQuestion = {
        title: 'Multiple Choice Test',
        question_text: 'Select your preference.',
        question_type: 'multiple_choice',
        category: 'product_feedback',
        options: [
          { text: 'Option A', value: 'a' },
          { text: 'Option B', value: 'b' },
          { text: 'Option C', value: 'c' }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(multipleChoiceQuestion);

      const mcQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .get(`/api/questions/${mcQuestionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.options).toEqual([
        { text: 'Option A', value: 'a' },
        { text: 'Option B', value: 'b' },
        { text: 'Option C', value: 'c' }
      ]);
    });

    it('should include analytics data when include_analytics=true', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}?include_analytics=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.analytics).toMatchObject({
        total_responses: expect.any(Number),
        response_rate: expect.any(Number),
        average_rating: expect.any(Number),
        last_response_at: expect.any(String)
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}`)
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
        .get(`/api/questions/${questionId}`)
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

    it('should return 403 when accessing question from different business', async () => {
      // Create another business user
      const { token: otherToken } = await createTestBusinessUser();

      const response = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this question'
        }
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent question', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/questions/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: 'Question not found'
        }
      });
    });

    it('should return 400 for invalid question ID format', async () => {
      const response = await request(app)
        .get('/api/questions/invalid-uuid-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid question ID format',
          details: ['Question ID must be a valid UUID']
        }
      });
    });

    it('should return 400 for invalid include_analytics parameter', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}?include_analytics=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: ['include_analytics must be a boolean value']
        }
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return correct response schema structure', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: expect.any(String),
            title: expect.any(String),
            question_text: expect.any(String),
            question_type: expect.stringMatching(/^(text|multiple_choice|scale|boolean)$/),
            category: expect.any(String),
            required: expect.any(Boolean),
            display_order: expect.any(Number),
            status: expect.stringMatching(/^(draft|active|inactive)$/),
            business_id: expect.any(String),
            store_id: expect.any(String),
            created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          }
        }
      });
    });

    it('should include analytics schema when requested', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}?include_analytics=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.analytics).toMatchObject({
        total_responses: expect.any(Number),
        response_rate: expect.any(Number),
        average_rating: expect.any(Number),
        last_response_at: expect.any(String)
      });
    });

    it('should not include analytics when not requested', async () => {
      const response = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.analytics).toBeUndefined();
    });
  });
});