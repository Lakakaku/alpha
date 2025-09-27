import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('DELETE /api/questions/{id} - Contract Test', () => {
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

  async function createTestQuestion(status: string = 'draft') {
    const questionData = {
      title: 'Test Question for Deletion',
      question_text: 'This question will be deleted in tests.',
      question_type: 'text',
      category: 'service_quality',
      required: false
    };

    const createResponse = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionData);

    const questionId = createResponse.body.data.question.id;

    // Activate if needed
    if (status === 'active') {
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    return questionId;
  }

  describe('Success Cases', () => {
    it('should delete draft question and return 200', async () => {
      const questionId = await createTestQuestion('draft');

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Question deleted successfully',
          deletedQuestionId: questionId
        }
      });

      // Verify question is actually deleted
      await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should soft delete active question and return 200', async () => {
      const questionId = await createTestQuestion('active');

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Question deactivated and marked for deletion',
          deletedQuestionId: questionId,
          deletionType: 'soft'
        }
      });

      // Verify question is marked as deleted but still retrievable
      const getResponse = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.question.status).toBe('deleted');
    });

    it('should handle force deletion with force=true parameter', async () => {
      const questionId = await createTestQuestion('active');

      const response = await request(app)
        .delete(`/api/questions/${questionId}?force=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Question permanently deleted',
          deletedQuestionId: questionId,
          deletionType: 'permanent'
        }
      });

      // Verify question is completely gone
      await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should delete question with responses (cascade)', async () => {
      const questionId = await createTestQuestion('active');

      // Simulate adding responses (this would be done through other API calls)
      // For now, just test the deletion succeeds
      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should delete question with triggers', async () => {
      const questionData = {
        title: 'Question with Triggers',
        question_text: 'This question has triggers.',
        question_type: 'scale',
        category: 'service_quality',
        triggers: {
          frequency: {
            max_per_day: 5,
            cooldown_hours: 2
          }
        }
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      const questionId = createResponse.body.data.question.id;

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const questionId = await createTestQuestion();

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
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
      const questionId = await createTestQuestion();

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
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

    it('should return 403 when deleting question from different business', async () => {
      const questionId = await createTestQuestion();
      const { token: otherToken } = await createTestBusinessUser();

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
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
        .delete(`/api/questions/${nonExistentId}`)
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
        .delete('/api/questions/invalid-uuid-format')
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

    it('should return 400 for invalid force parameter', async () => {
      const questionId = await createTestQuestion();

      const response = await request(app)
        .delete(`/api/questions/${questionId}?force=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: ['force parameter must be a boolean value']
        }
      });
    });

    it('should return 409 when trying to delete already deleted question', async () => {
      const questionId = await createTestQuestion();

      // First deletion should succeed
      await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second deletion should fail
      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'QUESTION_ALREADY_DELETED',
          message: 'Question is already deleted'
        }
      });
    });
  });

  describe('Constraint Violations', () => {
    it('should handle foreign key constraints gracefully', async () => {
      const questionId = await createTestQuestion('active');

      // This should succeed even if there are related records
      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should warn about dependent data when force deleting', async () => {
      const questionId = await createTestQuestion('active');

      const response = await request(app)
        .delete(`/api/questions/${questionId}?force=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Question permanently deleted',
          deletedQuestionId: questionId,
          deletionType: 'permanent'
        }
      });

      // Check for warnings about dependent data
      if (response.body.data.warnings) {
        expect(Array.isArray(response.body.data.warnings)).toBe(true);
      }
    });
  });

  describe('Response Schema Validation', () => {
    it('should return correct response schema for soft deletion', async () => {
      const questionId = await createTestQuestion('active');

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.any(String),
          deletedQuestionId: expect.any(String),
          deletionType: expect.stringMatching(/^(soft|permanent)$/)
        }
      });
    });

    it('should return correct response schema for permanent deletion', async () => {
      const questionId = await createTestQuestion('draft');

      const response = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.any(String),
          deletedQuestionId: questionId
        }
      });
    });

    it('should include affected records count when available', async () => {
      const questionId = await createTestQuestion('active');

      const response = await request(app)
        .delete(`/api/questions/${questionId}?force=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should include count of related records that were also deleted
      expect(response.body.data).toMatchObject({
        message: expect.any(String),
        deletedQuestionId: questionId,
        deletionType: 'permanent'
      });

      if (response.body.data.affectedRecords) {
        expect(typeof response.body.data.affectedRecords).toBe('object');
      }
    });
  });
});