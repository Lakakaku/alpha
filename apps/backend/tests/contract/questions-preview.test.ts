import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('POST /api/questions/{id}/preview - Contract Test', () => {
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

    // Create a test question for preview
    const questionData = {
      title: 'Preview Test Question',
      question_text: 'How would you rate our service today?',
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

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('Success Cases', () => {
    it('should generate preview for question and return 200', async () => {
      const previewData = {
        context: {
          customer_name: 'John Doe',
          visit_time: '2025-09-21T14:30:00Z',
          purchase_amount: 45.50,
          items: ['Coffee', 'Sandwich']
        },
        format: 'html'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          preview: {
            questionId: questionId,
            format: 'html',
            content: expect.any(String),
            rendered: {
              title: 'Preview Test Question',
              questionText: 'How would you rate our service today?',
              questionType: 'scale',
              options: [
                { text: '1 - Poor', value: 1 },
                { text: '2 - Fair', value: 2 },
                { text: '3 - Good', value: 3 },
                { text: '4 - Very Good', value: 4 },
                { text: '5 - Excellent', value: 5 }
              ],
              required: true
            },
            context: {
              customer_name: 'John Doe',
              visit_time: '2025-09-21T14:30:00Z',
              purchase_amount: 45.50,
              items: ['Coffee', 'Sandwich']
            },
            generatedAt: expect.any(String)
          }
        }
      });
    });

    it('should generate JSON format preview', async () => {
      const previewData = {
        context: {
          store_name: 'Test Store',
          location: 'Downtown'
        },
        format: 'json'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.data.preview.format).toBe('json');
      expect(response.body.data.preview.content).toBeDefined();
      
      // Content should be valid JSON
      const parsedContent = JSON.parse(response.body.data.preview.content);
      expect(parsedContent).toMatchObject({
        question: {
          id: questionId,
          title: expect.any(String),
          type: 'scale'
        }
      });
    });

    it('should generate plain text format preview', async () => {
      const previewData = {
        format: 'text'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.data.preview.format).toBe('text');
      expect(typeof response.body.data.preview.content).toBe('string');
      expect(response.body.data.preview.content).toContain('Preview Test Question');
    });

    it('should handle minimal preview request', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.preview).toMatchObject({
        questionId: questionId,
        format: 'html', // default format
        content: expect.any(String),
        rendered: expect.any(Object)
      });
    });

    it('should include theme customization when provided', async () => {
      const previewData = {
        theme: {
          primaryColor: '#007bff',
          fontFamily: 'Arial',
          backgroundColor: '#ffffff'
        },
        format: 'html'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.data.preview.theme).toMatchObject({
        primaryColor: '#007bff',
        fontFamily: 'Arial',
        backgroundColor: '#ffffff'
      });

      // HTML content should include theme styles
      expect(response.body.data.preview.content).toContain('#007bff');
    });

    it('should handle mobile and desktop viewport previews', async () => {
      const mobilePreview = {
        viewport: 'mobile',
        format: 'html'
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(mobilePreview)
        .expect(200);

      expect(response.body.data.preview.viewport).toBe('mobile');
      expect(response.body.data.preview.content).toContain('viewport');
    });
  });

  describe('Multiple Question Types', () => {
    it('should preview text question type', async () => {
      const textQuestionData = {
        title: 'Text Question',
        question_text: 'What could we improve?',
        question_type: 'text',
        category: 'suggestions'
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(textQuestionData);

      const textQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .post(`/api/questions/${textQuestionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(response.body.data.preview.rendered.questionType).toBe('text');
      expect(response.body.data.preview.content).toContain('textarea');
    });

    it('should preview boolean question type', async () => {
      const booleanQuestionData = {
        title: 'Boolean Question',
        question_text: 'Would you recommend us?',
        question_type: 'boolean',
        category: 'store_experience'
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(booleanQuestionData);

      const booleanQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .post(`/api/questions/${booleanQuestionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(response.body.data.preview.rendered.questionType).toBe('boolean');
      expect(response.body.data.preview.content).toContain('radio');
    });

    it('should preview multiple choice question type', async () => {
      const mcQuestionData = {
        title: 'Multiple Choice Question',
        question_text: 'Which product did you purchase?',
        question_type: 'multiple_choice',
        category: 'product_feedback',
        options: [
          { text: 'Coffee', value: 'coffee' },
          { text: 'Tea', value: 'tea' },
          { text: 'Pastry', value: 'pastry' }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(mcQuestionData);

      const mcQuestionId = createResponse.body.data.question.id;

      const response = await request(app)
        .post(`/api/questions/${mcQuestionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(response.body.data.preview.rendered.questionType).toBe('multiple_choice');
      expect(response.body.data.preview.rendered.options).toHaveLength(3);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .send({ format: 'html' })
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
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ format: 'html' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authentication token'
        }
      });
    });

    it('should return 403 when previewing question from different business', async () => {
      const { token: otherToken } = await createTestBusinessUser();

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ format: 'html' })
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
        .post(`/api/questions/${nonExistentId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
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
        .post('/api/questions/invalid-uuid-format/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
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

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'invalid_format' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid preview format',
          details: ['format must be one of: html, json, text']
        }
      });
    });

    it('should return 400 for invalid viewport', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          format: 'html',
          viewport: 'invalid_viewport'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid viewport',
          details: ['viewport must be one of: mobile, tablet, desktop']
        }
      });
    });

    it('should return 400 for invalid theme colors', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'html',
          theme: {
            primaryColor: 'invalid-color'
          }
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid theme configuration',
          details: ['primaryColor must be a valid hex color']
        }
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should generate preview within 100ms performance target', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Performance requirement
      expect(response.body.data.preview.generationTime).toBeLessThan(100);
    });

    it('should handle large context data efficiently', async () => {
      const largeContext = {
        customer_data: Array(100).fill({ key: 'value', data: 'large_string'.repeat(50) })
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'html',
          context: largeContext
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preview.generationTime).toBeLessThan(100);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return complete preview response schema', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'html',
          context: { test: 'data' },
          theme: { primaryColor: '#007bff' }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          preview: {
            questionId: expect.any(String),
            format: 'html',
            content: expect.any(String),
            rendered: {
              title: expect.any(String),
              questionText: expect.any(String),
              questionType: expect.any(String),
              required: expect.any(Boolean)
            },
            context: { test: 'data' },
            theme: { primaryColor: '#007bff' },
            generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            generationTime: expect.any(Number)
          }
        }
      });
    });
  });
});