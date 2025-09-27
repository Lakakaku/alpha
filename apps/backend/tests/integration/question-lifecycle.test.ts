import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Question Lifecycle Integration Test', () => {
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

  describe('User Scenario: Complete Question Lifecycle Management', () => {
    it('should handle full lifecycle: draft → active → inactive → deleted', async () => {
      // Step 1: Create question in draft status
      const questionData = {
        title: 'Lifecycle Test Question',
        question_text: 'This question will go through the complete lifecycle.',
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
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;
      
      // Verify initial draft status
      expect(createResponse.body.data.question.status).toBe('draft');
      expect(createResponse.body.data.question.activated_at).toBeNull();

      // Step 2: Activate question (draft → active)
      const activationData = {
        schedule: {
          start_date: new Date().toISOString(),
        },
        priority: 'high',
        immediate: true
      };

      const activateResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(activateResponse.body.data.question.status).toBe('active');
      expect(activateResponse.body.data.question.activated_at).toBeDefined();
      expect(activateResponse.body.data.activation.previousStatus).toBe('draft');

      // Verify question appears in active questions list
      const activeListResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const activeQuestion = activeListResponse.body.data.questions.find(q => q.id === questionId);
      expect(activeQuestion).toBeDefined();
      expect(activeQuestion.status).toBe('active');

      // Step 3: Deactivate question (active → inactive)
      const deactivateResponse = await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Testing lifecycle' })
        .expect(200);

      expect(deactivateResponse.body.data.question.status).toBe('inactive');
      expect(deactivateResponse.body.data.deactivation.previousStatus).toBe('active');
      expect(deactivateResponse.body.data.deactivation.reason).toBe('Testing lifecycle');

      // Verify question no longer appears in active questions list
      const updatedActiveListResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const stillActiveQuestion = updatedActiveListResponse.body.data.questions.find(q => q.id === questionId);
      expect(stillActiveQuestion).toBeUndefined();

      // Verify question appears in inactive questions list
      const inactiveListResponse = await request(app)
        .get('/api/questions?status=inactive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const inactiveQuestion = inactiveListResponse.body.data.questions.find(q => q.id === questionId);
      expect(inactiveQuestion).toBeDefined();
      expect(inactiveQuestion.status).toBe('inactive');

      // Step 4: Reactivate question (inactive → active)
      const reactivateResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(reactivateResponse.body.data.question.status).toBe('active');
      expect(reactivateResponse.body.data.activation.previousStatus).toBe('inactive');

      // Step 5: Delete question (active → deleted)
      const deleteResponse = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.data.deletionType).toBe('soft'); // Active questions get soft deleted

      // Verify question is marked as deleted but still retrievable
      const deletedQuestionResponse = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deletedQuestionResponse.body.data.question.status).toBe('deleted');

      // Step 6: Permanently delete question
      const permanentDeleteResponse = await request(app)
        .delete(`/api/questions/${questionId}?force=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(permanentDeleteResponse.body.data.deletionType).toBe('permanent');

      // Verify question is completely gone
      await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle lifecycle state transitions with validation', async () => {
      // Create question
      const questionData = {
        title: 'State Transition Test',
        question_text: 'Testing state transition validation.',
        question_type: 'text',
        category: 'suggestions'
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;

      // Test invalid state transitions
      
      // Cannot deactivate a draft question
      const invalidDeactivateResponse = await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(invalidDeactivateResponse.body.error.code).toBe('INVALID_STATE_TRANSITION');

      // Activate question first
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Cannot activate already active question
      const duplicateActivateResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(duplicateActivateResponse.body.error.code).toBe('QUESTION_ALREADY_ACTIVE');

      // Deactivate question
      await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Cannot deactivate already inactive question
      const duplicateDeactivateResponse = await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(duplicateDeactivateResponse.body.error.code).toBe('QUESTION_ALREADY_INACTIVE');

      // Delete question
      await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Cannot activate deleted question
      const activateDeletedResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(activateDeletedResponse.body.error.code).toBe('CANNOT_ACTIVATE_DELETED');
    });

    it('should handle lifecycle operations with question updates', async () => {
      // Create question
      const questionData = {
        title: 'Update Lifecycle Test',
        question_text: 'Testing updates during lifecycle.',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1', value: 1 },
          { text: '2', value: 2 },
          { text: '3', value: 3 }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;

      // Update question while in draft status (should work)
      const draftUpdateData = {
        title: 'Updated Draft Question',
        question_type: 'multiple_choice',
        options: [
          { text: 'Option A', value: 'a' },
          { text: 'Option B', value: 'b' }
        ]
      };

      const draftUpdateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(draftUpdateData)
        .expect(200);

      expect(draftUpdateResponse.body.data.question.title).toBe('Updated Draft Question');
      expect(draftUpdateResponse.body.data.question.question_type).toBe('multiple_choice');

      // Activate question
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Update question while active (non-breaking changes should work)
      const activeUpdateData = {
        title: 'Updated Active Question'
      };

      const activeUpdateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activeUpdateData)
        .expect(200);

      expect(activeUpdateResponse.body.data.question.title).toBe('Updated Active Question');

      // Try breaking change while active (should fail)
      const breakingUpdateData = {
        question_type: 'text',
        options: null
      };

      const breakingUpdateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(breakingUpdateData)
        .expect(409);

      expect(breakingUpdateResponse.body.error.code).toBe('ACTIVE_QUESTION_CONFLICT');

      // Deactivate and try breaking change (should work)
      await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const inactiveUpdateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(breakingUpdateData)
        .expect(200);

      expect(inactiveUpdateResponse.body.data.question.question_type).toBe('text');
      expect(inactiveUpdateResponse.body.data.question.options).toBeUndefined();
    });

    it('should track lifecycle history and audit trail', async () => {
      // Create question
      const questionData = {
        title: 'Audit Trail Test',
        question_text: 'Testing audit trail functionality.',
        question_type: 'boolean',
        category: 'store_experience'
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;

      // Perform various lifecycle operations
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ immediate: true })
        .expect(200);

      await request(app)
        .post(`/api/questions/${questionId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Maintenance' })
        .expect(200);

      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ immediate: true })
        .expect(200);

      // Get question with audit history
      const historyResponse = await request(app)
        .get(`/api/questions/${questionId}?include_history=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const question = historyResponse.body.data.question;
      expect(question.history).toBeDefined();
      expect(Array.isArray(question.history)).toBe(true);
      expect(question.history.length).toBeGreaterThanOrEqual(3); // Create, activate, deactivate, reactivate

      // Verify history entries have correct structure
      question.history.forEach(entry => {
        expect(entry).toMatchObject({
          action: expect.stringMatching(/^(created|activated|deactivated|updated|deleted)$/),
          timestamp: expect.any(String),
          actor: businessId,
          details: expect.any(Object)
        });
      });

      // Verify chronological order
      for (let i = 1; i < question.history.length; i++) {
        const prevTimestamp = new Date(question.history[i - 1].timestamp);
        const currTimestamp = new Date(question.history[i].timestamp);
        expect(currTimestamp.getTime()).toBeGreaterThanOrEqual(prevTimestamp.getTime());
      }
    });

    it('should handle bulk lifecycle operations', async () => {
      // Create multiple questions
      const questionTitles = [
        'Bulk Operation Question 1',
        'Bulk Operation Question 2',
        'Bulk Operation Question 3'
      ];

      const questionIds = [];

      for (const title of questionTitles) {
        const questionData = {
          title: title,
          question_text: `Text for ${title}`,
          question_type: 'text',
          category: 'suggestions'
        };

        const response = await request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionData)
          .expect(201);

        questionIds.push(response.body.data.question.id);
      }

      // Bulk activate all questions
      const bulkActivatePromises = questionIds.map(questionId =>
        request(app)
          .post(`/api/questions/${questionId}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      const activateResponses = await Promise.all(bulkActivatePromises);
      
      // Verify all activations succeeded
      activateResponses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.question.status).toBe('active');
      });

      // Verify all questions appear in active list
      const activeListResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const activeQuestionIds = activeListResponse.body.data.questions.map(q => q.id);
      questionIds.forEach(questionId => {
        expect(activeQuestionIds).toContain(questionId);
      });

      // Bulk deactivate all questions
      const bulkDeactivatePromises = questionIds.map(questionId =>
        request(app)
          .post(`/api/questions/${questionId}/deactivate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Bulk deactivation test' })
          .expect(200)
      );

      const deactivateResponses = await Promise.all(bulkDeactivatePromises);
      
      // Verify all deactivations succeeded
      deactivateResponses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.question.status).toBe('inactive');
      });

      // Verify no questions appear in active list
      const finalActiveListResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalActiveQuestionIds = finalActiveListResponse.body.data.questions.map(q => q.id);
      questionIds.forEach(questionId => {
        expect(finalActiveQuestionIds).not.toContain(questionId);
      });
    });

    it('should handle lifecycle operations with scheduling', async () => {
      // Create question
      const questionData = {
        title: 'Scheduled Lifecycle Test',
        question_text: 'Testing scheduled lifecycle operations.',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1', value: 1 },
          { text: '2', value: 2 },
          { text: '3', value: 3 }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;

      // Schedule activation for future date
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const scheduledActivationData = {
        schedule: {
          start_date: futureDate.toISOString(),
          end_date: new Date(futureDate.getTime() + 3600000).toISOString() // 1 hour after start
        },
        immediate: false
      };

      const scheduleResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduledActivationData)
        .expect(200);

      expect(scheduleResponse.body.data.question.status).toBe('scheduled'); // Not immediately active
      expect(scheduleResponse.body.data.question.schedule).toMatchObject({
        start_date: futureDate.toISOString(),
        end_date: expect.any(String)
      });

      // Verify scheduled question doesn't appear in active list yet
      const activeListResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const activeQuestion = activeListResponse.body.data.questions.find(q => q.id === questionId);
      expect(activeQuestion).toBeUndefined();

      // Verify scheduled question appears in scheduled list
      const scheduledListResponse = await request(app)
        .get('/api/questions?status=scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const scheduledQuestion = scheduledListResponse.body.data.questions.find(q => q.id === questionId);
      expect(scheduledQuestion).toBeDefined();
      expect(scheduledQuestion.status).toBe('scheduled');

      // Test immediate activation override
      const immediateActivationResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ immediate: true, override_schedule: true })
        .expect(200);

      expect(immediateActivationResponse.body.data.question.status).toBe('active');
    });
  });
});