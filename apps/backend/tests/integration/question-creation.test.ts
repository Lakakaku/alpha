import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Question Creation Integration Test', () => {
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

  describe('User Scenario: Business Manager Creates New Custom Question', () => {
    it('should complete full question creation workflow', async () => {
      // Step 1: Business manager accesses question categories
      const categoriesResponse = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(categoriesResponse.body.success).toBe(true);
      expect(categoriesResponse.body.data.categories).toContainEqual(
        expect.objectContaining({
          id: 'service_quality',
          name: 'Service Quality'
        })
      );

      // Step 2: Business manager creates a new scale question
      const questionData = {
        title: 'How satisfied were you with our service today?',
        question_text: 'Please rate your overall satisfaction with the service you received during your visit.',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1 - Very Dissatisfied', value: 1 },
          { text: '2 - Dissatisfied', value: 2 },
          { text: '3 - Neutral', value: 3 },
          { text: '4 - Satisfied', value: 4 },
          { text: '5 - Very Satisfied', value: 5 }
        ],
        required: true,
        display_order: 1
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(createResponse.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: expect.any(String),
            title: questionData.title,
            question_text: questionData.question_text,
            question_type: 'scale',
            category: 'service_quality',
            options: questionData.options,
            required: true,
            status: 'draft',
            business_id: businessId,
            store_id: storeId
          }
        }
      });

      const questionId = createResponse.body.data.question.id;

      // Step 3: Business manager configures frequency triggers
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          max_per_week: 25,
          cooldown_hours: 4,
          reset_on_new_day: true
        },
        active: true,
        priority: 1
      };

      const triggerResponse = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.data.trigger.type).toBe('frequency');

      // Step 4: Business manager previews the question
      const previewData = {
        context: {
          customer_name: 'John Doe',
          visit_time: '2025-09-21T14:30:00Z',
          purchase_amount: 35.75
        },
        format: 'html'
      };

      const previewResponse = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(previewResponse.body.success).toBe(true);
      expect(previewResponse.body.data.preview.content).toContain(questionData.title);
      expect(previewResponse.body.data.preview.rendered.options).toHaveLength(5);

      // Step 5: Business manager activates the question
      const activationData = {
        schedule: {
          start_date: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
        },
        priority: 'high',
        immediate: false
      };

      const activateResponse = await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activationData)
        .expect(200);

      expect(activateResponse.body.success).toBe(true);
      expect(activateResponse.body.data.question.status).toBe('active');

      // Step 6: Verify question appears in active questions list
      const listResponse = await request(app)
        .get('/api/questions?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.questions).toContainEqual(
        expect.objectContaining({
          id: questionId,
          status: 'active'
        })
      );

      // Step 7: Verify question can be retrieved with full details
      const getResponse = await request(app)
        .get(`/api/questions/${questionId}?include_analytics=true`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.question).toMatchObject({
        id: questionId,
        status: 'active',
        title: questionData.title,
        analytics: expect.objectContaining({
          total_responses: expect.any(Number),
          response_rate: expect.any(Number)
        })
      });
    });

    it('should handle question creation with validation errors gracefully', async () => {
      // Step 1: Attempt to create question with missing required fields
      const invalidQuestionData = {
        title: 'Incomplete Question',
        // Missing question_text, question_type, category
      };

      const errorResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidQuestionData)
        .expect(400);

      expect(errorResponse.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: expect.arrayContaining([
            'question_text is required',
            'question_type is required',
            'category is required'
          ])
        }
      });

      // Step 2: Attempt to create multiple choice question without options
      const invalidMCQuestion = {
        title: 'Multiple Choice Without Options',
        question_text: 'What is your preference?',
        question_type: 'multiple_choice',
        category: 'service_quality',
        options: [] // Empty options array
      };

      const mcErrorResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMCQuestion)
        .expect(400);

      expect(mcErrorResponse.body.error.code).toBe('VALIDATION_ERROR');
      expect(mcErrorResponse.body.error.details).toContain(
        'options array must contain at least 2 items for multiple_choice questions'
      );

      // Step 3: Create valid question to verify system recovery
      const validQuestionData = {
        title: 'Valid Recovery Question',
        question_text: 'This question should work.',
        question_type: 'text',
        category: 'suggestions',
        required: false
      };

      const successResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionData)
        .expect(201);

      expect(successResponse.body.success).toBe(true);
    });

    it('should support creating questions of different types', async () => {
      const questionTypes = [
        {
          type: 'text',
          data: {
            title: 'Text Question',
            question_text: 'Please share your feedback.',
            question_type: 'text',
            category: 'suggestions',
            required: false
          }
        },
        {
          type: 'boolean',
          data: {
            title: 'Boolean Question',
            question_text: 'Would you recommend us to friends?',
            question_type: 'boolean',
            category: 'store_experience',
            required: true
          }
        },
        {
          type: 'multiple_choice',
          data: {
            title: 'Multiple Choice Question',
            question_text: 'Which product category interests you most?',
            question_type: 'multiple_choice',
            category: 'product_feedback',
            options: [
              { text: 'Coffee & Beverages', value: 'coffee' },
              { text: 'Pastries & Desserts', value: 'pastries' },
              { text: 'Sandwiches & Light Meals', value: 'sandwiches' },
              { text: 'Retail Products', value: 'retail' }
            ],
            required: true
          }
        }
      ];

      const createdQuestions = [];

      for (const questionType of questionTypes) {
        const response = await request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionType.data)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.question.question_type).toBe(questionType.type);
        
        createdQuestions.push(response.body.data.question);
      }

      // Verify all questions are listed
      const listResponse = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      createdQuestions.forEach(question => {
        expect(listResponse.body.data.questions).toContainEqual(
          expect.objectContaining({
            id: question.id,
            question_type: question.question_type
          })
        );
      });
    });

    it('should handle concurrent question creation by multiple users', async () => {
      // Create another business user
      const { token: secondToken, business_id: secondBusinessId } = await createTestBusinessUser();

      const questionData1 = {
        title: 'Concurrent Question 1',
        question_text: 'First concurrent question.',
        question_type: 'scale',
        category: 'service_quality'
      };

      const questionData2 = {
        title: 'Concurrent Question 2',
        question_text: 'Second concurrent question.',
        question_type: 'scale',
        category: 'service_quality'
      };

      // Create questions concurrently
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionData1)
          .expect(201),
        request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${secondToken}`)
          .send(questionData2)
          .expect(201)
      ]);

      // Verify both questions were created successfully
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);

      // Verify they belong to different businesses
      expect(response1.body.data.question.business_id).toBe(businessId);
      expect(response2.body.data.question.business_id).toBe(secondBusinessId);
      expect(response1.body.data.question.business_id).not.toBe(
        response2.body.data.question.business_id
      );

      // Verify isolation - first user can't see second user's question
      const firstUserQuestions = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const firstUserQuestionIds = firstUserQuestions.body.data.questions.map(q => q.id);
      expect(firstUserQuestionIds).toContain(response1.body.data.question.id);
      expect(firstUserQuestionIds).not.toContain(response2.body.data.question.id);
    });

    it('should maintain data integrity throughout question lifecycle', async () => {
      // Create question
      const questionData = {
        title: 'Lifecycle Test Question',
        question_text: 'Testing question lifecycle integrity.',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1', value: 1 },
          { text: '2', value: 2 },
          { text: '3', value: 3 },
          { text: '4', value: 4 },
          { text: '5', value: 5 }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;
      const originalCreatedAt = createResponse.body.data.question.created_at;

      // Update question
      const updateData = {
        title: 'Updated Lifecycle Test Question',
        required: true
      };

      const updateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Verify update preserved data integrity
      expect(updateResponse.body.data.question).toMatchObject({
        id: questionId,
        title: 'Updated Lifecycle Test Question',
        question_text: questionData.question_text, // Unchanged
        question_type: 'scale', // Unchanged
        options: questionData.options, // Unchanged
        required: true, // Updated
        created_at: originalCreatedAt, // Unchanged
        updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) // Changed
      });

      // Activate question
      await request(app)
        .post(`/api/questions/${questionId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify final state
      const finalResponse = await request(app)
        .get(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalResponse.body.data.question).toMatchObject({
        id: questionId,
        status: 'active',
        title: 'Updated Lifecycle Test Question',
        question_text: questionData.question_text,
        created_at: originalCreatedAt,
        activated_at: expect.any(String)
      });
    });
  });
});