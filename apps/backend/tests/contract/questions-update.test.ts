import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('PUT /api/questions/{id} - Contract Test', () => {
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
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  beforeEach(async () => {
    // Create a fresh test question for each test
    const questionData = {
      title: 'Original Question Title',
      question_text: 'Original question text for testing updates.',
      question_type: 'text',
      category: 'service_quality',
      required: false,
      display_order: 1
    };

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionData);

    questionId = createResponse.body.data.question.id;
  });

  describe('Success Cases', () => {
    it('should update question title and return 200', async () => {
      const updateData = {
        title: 'Updated Question Title'
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: questionId,
            title: 'Updated Question Title',
            question_text: 'Original question text for testing updates.',
            question_type: 'text',
            category: 'service_quality',
            required: false,
            display_order: 1,
            status: 'draft',
            business_id: businessId,
            store_id: storeId,
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should update multiple fields simultaneously', async () => {
      const updateData = {
        title: 'Updated Multi-Field Question',
        question_text: 'Updated question text with multiple changes.',
        required: true,
        display_order: 5
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.question).toMatchObject({
        title: 'Updated Multi-Field Question',
        question_text: 'Updated question text with multiple changes.',
        required: true,
        display_order: 5
      });
    });

    it('should update question type and options', async () => {
      const updateData = {
        question_type: 'multiple_choice',
        options: [
          { text: 'Yes', value: 'yes' },
          { text: 'No', value: 'no' },
          { text: 'Maybe', value: 'maybe' }
        ]
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.question).toMatchObject({
        question_type: 'multiple_choice',
        options: [
          { text: 'Yes', value: 'yes' },
          { text: 'No', value: 'no' },
          { text: 'Maybe', value: 'maybe' }
        ]
      });
    });

    it('should update trigger configuration', async () => {
      const updateData = {
        triggers: {
          frequency: {
            max_per_day: 10,
            max_per_week: 50,
            cooldown_hours: 6
          },
          conditions: {
            time_of_day: ['afternoon', 'evening'],
            day_of_week: ['saturday', 'sunday']
          }
        }
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.question.triggers).toMatchObject({
        frequency: {
          max_per_day: 10,
          max_per_week: 50,
          cooldown_hours: 6
        },
        conditions: {
          time_of_day: ['afternoon', 'evening'],
          day_of_week: ['saturday', 'sunday']
        }
      });
    });

    it('should update category', async () => {
      const updateData = {
        category: 'product_feedback'
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.question.category).toBe('product_feedback');
    });

    it('should clear options when changing from multiple_choice to text', async () => {
      // First set it to multiple choice with options
      await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_type: 'multiple_choice',
          options: [{ text: 'Option 1', value: '1' }]
        });

      // Then change back to text
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_type: 'text'
        })
        .expect(200);

      expect(response.body.data.question.question_type).toBe('text');
      expect(response.body.data.question.options).toBeUndefined();
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .send({ title: 'Updated Title' })
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
        .put(`/api/questions/${questionId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ title: 'Updated Title' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authentication token'
        }
      });
    });

    it('should return 403 when updating question from different business', async () => {
      const { token: otherToken } = await createTestBusinessUser();

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Unauthorized Update' })
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
        .put(`/api/questions/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
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
        .put('/api/questions/invalid-uuid-format')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
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

    it('should return 400 for empty update payload', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid fields to update',
          details: ['At least one field must be provided for update']
        }
      });
    });

    it('should return 409 when updating active question with breaking changes', async () => {
      // First activate the question
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to update with breaking changes
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_type: 'multiple_choice',
          options: [{ text: 'New Option', value: 'new' }]
        })
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ACTIVE_QUESTION_CONFLICT',
          message: 'Cannot make breaking changes to active question',
          details: ['Deactivate question before changing question type or options']
        }
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid question type', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ question_type: 'invalid_type' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid question type',
          details: ['question_type must be one of: text, multiple_choice, scale, boolean']
        }
      });
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'invalid_category' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category',
          details: ['category must be one of: service_quality, product_feedback, store_experience, staff_performance, suggestions']
        }
      });
    });

    it('should return 400 for multiple choice without sufficient options', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_type: 'multiple_choice',
          options: [{ text: 'Only one option', value: '1' }]
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Multiple choice questions require at least 2 options',
          details: ['options array must contain at least 2 items for multiple_choice questions']
        }
      });
    });

    it('should return 400 for title too long', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'x'.repeat(256) })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('title must be 255 characters or less');
    });

    it('should return 400 for invalid trigger configuration', async () => {
      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          triggers: {
            frequency: {
              max_per_day: 0,
              cooldown_hours: -1
            }
          }
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid trigger configuration',
          details: [
            'max_per_day must be greater than 0',
            'cooldown_hours must be between 0 and 24'
          ]
        }
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return updated question with correct schema', async () => {
      const updateData = {
        title: 'Schema Validation Test',
        required: true
      };

      const response = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: expect.any(String),
            title: 'Schema Validation Test',
            question_text: expect.any(String),
            question_type: expect.stringMatching(/^(text|multiple_choice|scale|boolean)$/),
            category: expect.any(String),
            required: true,
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
  });
});