import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('POST /api/questions - Contract Test', () => {
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

  const validQuestionData = {
    title: 'How was your service experience?',
    question_text: 'Please rate your overall satisfaction with our service today.',
    question_type: 'scale',
    category: 'service_quality',
    options: [
      { text: '1 - Very Poor', value: 1 },
      { text: '2 - Poor', value: 2 },
      { text: '3 - Fair', value: 3 },
      { text: '4 - Good', value: 4 },
      { text: '5 - Excellent', value: 5 }
    ],
    required: true,
    display_order: 1,
    triggers: {
      frequency: {
        max_per_day: 3,
        max_per_week: 10,
        cooldown_hours: 2
      },
      conditions: {
        time_of_day: ['morning', 'afternoon'],
        day_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    }
  };

  describe('Success Cases', () => {
    it('should create a new question and return 201', async () => {
      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          question: {
            id: expect.any(String),
            title: validQuestionData.title,
            question_text: validQuestionData.question_text,
            question_type: validQuestionData.question_type,
            category: validQuestionData.category,
            options: validQuestionData.options,
            required: validQuestionData.required,
            display_order: validQuestionData.display_order,
            status: 'draft',
            business_id: businessId,
            store_id: storeId,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should create question with minimal required fields', async () => {
      const minimalData = {
        title: 'Simple question',
        question_text: 'What do you think?',
        question_type: 'text',
        category: 'suggestions'
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalData)
        .expect(201);

      expect(response.body.data.question).toMatchObject({
        ...minimalData,
        required: false, // default value
        display_order: expect.any(Number), // auto-generated
        status: 'draft'
      });
    });

    it('should create boolean type question', async () => {
      const booleanData = {
        title: 'Would you recommend us?',
        question_text: 'Would you recommend our store to friends?',
        question_type: 'boolean',
        category: 'store_experience'
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(booleanData)
        .expect(201);

      expect(response.body.data.question.question_type).toBe('boolean');
    });

    it('should create multiple choice question with options', async () => {
      const multipleChoiceData = {
        title: 'Preferred contact method',
        question_text: 'How would you like us to contact you?',
        question_type: 'multiple_choice',
        category: 'store_experience',
        options: [
          { text: 'Email', value: 'email' },
          { text: 'Phone', value: 'phone' },
          { text: 'SMS', value: 'sms' }
        ]
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(multipleChoiceData)
        .expect(201);

      expect(response.body.data.question.options).toEqual(multipleChoiceData.options);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/questions')
        .send(validQuestionData)
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
        .post('/api/questions')
        .set('Authorization', 'Bearer invalid-token')
        .send(validQuestionData)
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
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: [
            'title is required',
            'question_text is required',
            'question_type is required',
            'category is required'
          ]
        }
      });
    });

    it('should return 400 for invalid question type', async () => {
      const invalidData = {
        ...validQuestionData,
        question_type: 'invalid_type'
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
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
      const invalidData = {
        ...validQuestionData,
        category: 'invalid_category'
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
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

    it('should return 400 for multiple choice without options', async () => {
      const invalidData = {
        ...validQuestionData,
        question_type: 'multiple_choice',
        options: []
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Multiple choice questions require options',
          details: ['options array must contain at least 2 items for multiple_choice questions']
        }
      });
    });

    it('should return 400 for invalid trigger configuration', async () => {
      const invalidData = {
        ...validQuestionData,
        triggers: {
          frequency: {
            max_per_day: -1,
            cooldown_hours: 25
          }
        }
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
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

    it('should return 400 for title too long', async () => {
      const invalidData = {
        ...validQuestionData,
        title: 'x'.repeat(256) // Exceeds max length
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('title must be 255 characters or less');
    });
  });

  describe('Business Logic Errors', () => {
    it('should return 409 for duplicate question title within same category', async () => {
      // First creation should succeed
      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionData)
        .expect(201);

      // Second creation with same title and category should fail
      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionData)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'DUPLICATE_QUESTION',
          message: 'Question with this title already exists in this category'
        }
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return complete question object with correct schema', async () => {
      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validQuestionData)
        .expect(201);

      const question = response.body.data.question;
      expect(question).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        question_text: expect.any(String),
        question_type: expect.stringMatching(/^(text|multiple_choice|scale|boolean)$/),
        category: expect.any(String),
        required: expect.any(Boolean),
        display_order: expect.any(Number),
        status: 'draft',
        business_id: expect.any(String),
        store_id: expect.any(String),
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });
  });
});