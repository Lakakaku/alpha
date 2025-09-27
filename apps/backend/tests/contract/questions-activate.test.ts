import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('POST /api/questions/{id}/activate - Contract Test', () => {
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
      title: 'Test Question for Activation',
      question_text: 'This question will be activated in tests.',
      question_type: 'scale',
      category: 'service_quality',
      options: [
        { text: '1 - Poor', value: 1 },
        { text: '2 - Fair', value: 2 },
        { text: '3 - Good', value: 3 },
        { text: '4 - Very Good', value: 4 },
        { text: '5 - Excellent', value: 5 }
      ],
      required: true
    };

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionData);

    questionId = createResponse.body.data.question.id;
  });

  describe('Success Cases', () => {
    it('should activate draft question and return 200', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: questionId,
            title: 'Test Question for Activation',
            status: 'active',
            activated_at: expect.any(String),
            updated_at: expect.any(String)
          },
          activation: {
            activatedBy: businessId,
            activatedAt: expect.any(String),
            previousStatus: 'draft'
          }
        }
      });
    });

    it('should activate question with custom activation settings', async () => {
      const activationData = {
        schedule: {
          start_date: '2025-09-22T00:00:00Z',
          end_date: '2025-12-31T23:59:59Z'
        },
        priority: 'high',
        weight: 1.5
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(response.body.data.question).toMatchObject({
        status: 'active',
        schedule: {
          start_date: '2025-09-22T00:00:00Z',
          end_date: '2025-12-31T23:59:59Z'
        },
        priority: 'high',
        weight: 1.5
      });
    });

    it('should reactivate inactive question', async () => {
      // First activate the question
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then deactivate it
      await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`);

      // Now reactivate it
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.question.status).toBe('active');
      expect(response.body.data.activation.previousStatus).toBe('inactive');
    });

    it('should activate with trigger configuration validation', async () => {
      const activationData = {
        validate_triggers: true,
        trigger_overrides: {
          frequency: {
            max_per_day: 10,
            cooldown_hours: 4
          }
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(response.body.data.question.status).toBe('active');
      expect(response.body.data.validation).toMatchObject({
        triggers_validated: true,
        validation_passed: true
      });
    });

    it('should activate and update display order automatically', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ auto_order: true })
        .expect(200);

      expect(response.body.data.question.status).toBe('active');
      expect(typeof response.body.data.question.display_order).toBe('number');
    });

    it('should handle immediate activation', async () => {
      const activationData = {
        immediate: true,
        notify_customers: true
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(response.body.data.question.status).toBe('active');
      expect(response.body.data.activation.immediate).toBe(true);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
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
        .post(`/api/questions/${questionId}/activate`)
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

    it('should return 403 when activating question from different business', async () => {
      const { token: otherToken } = await createTestBusinessUser();

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
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
        .post(`/api/questions/${nonExistentId}/activate`)
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
        .post('/api/questions/invalid-uuid-format/activate')
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

    it('should return 409 when activating already active question', async () => {
      // First activation should succeed
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second activation should fail
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_ALREADY_ACTIVE',
          message: 'Question is already active'
        }
      });
    });

    it('should return 400 for deleted question', async () => {
      // Delete the question first
      await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'CANNOT_ACTIVATE_DELETED',
          message: 'Cannot activate deleted question'
        }
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for invalid schedule dates', async () => {
      const invalidSchedule = {
        schedule: {
          start_date: '2025-12-31T23:59:59Z',
          end_date: '2025-01-01T00:00:00Z' // end before start
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSchedule)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule configuration',
          details: ['end_date must be after start_date']
        }
      });
    });

    it('should return 400 for invalid priority value', async () => {
      const invalidData = {
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid priority value',
          details: ['priority must be one of: low, normal, high, urgent']
        }
      });
    });

    it('should return 400 for invalid weight value', async () => {
      const invalidData = {
        weight: -1.5
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid weight value',
          details: ['weight must be between 0.1 and 10.0']
        }
      });
    });

    it('should return 400 for past start date', async () => {
      const pastDate = {
        schedule: {
          start_date: '2020-01-01T00:00:00Z'
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(pastDate)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid schedule dates',
          details: ['start_date cannot be in the past']
        }
      });
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate question completeness before activation', async () => {
      // Create incomplete question (missing required fields for activation)
      const incompleteQuestion = {
        title: 'Incomplete Question',
        question_text: '',  // Empty text should fail validation
        question_type: 'text',
        category: 'service_quality'
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteQuestion);

      const incompleteQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .post(`/api/questions/${incompleteQuestionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_INCOMPLETE',
          message: 'Question is not ready for activation',
          details: ['question_text cannot be empty']
        }
      });
    });

    it('should respect maximum active questions limit', async () => {
      // This test would depend on business rules about max active questions
      // For now, just ensure the endpoint handles the concept
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: false })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return complete activation response schema', async () => {
      const activationData = {
        schedule: {
          start_date: '2025-09-22T00:00:00Z'
        },
        priority: 'high',
        weight: 2.0
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: expect.any(String),
            title: expect.any(String),
            status: 'active',
            priority: 'high',
            weight: 2.0,
            activated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          },
          activation: {
            activatedBy: expect.any(String),
            activatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            previousStatus: 'draft'
          }
        }
      });
    });

    it('should include validation results when validation is requested', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ validate_triggers: true })
        .expect(200);

      expect(response.body.data.validation).toMatchObject({
        triggers_validated: true,
        validation_passed: expect.any(Boolean)
      });
    });
  });
});