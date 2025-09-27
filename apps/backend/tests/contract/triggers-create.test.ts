import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('POST /api/questions/{id}/triggers - Contract Test', () => {
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

    // Create a test question for trigger configuration
    const questionData = {
      title: 'Question for Trigger Testing',
      question_text: 'This question will have triggers configured.',
      question_type: 'scale',
      category: 'service_quality',
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
    it('should create frequency trigger and return 201', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          max_per_week: 20,
          max_per_month: 50,
          cooldown_hours: 4,
          reset_on_new_day: true
        },
        active: true,
        priority: 1
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          trigger: {
            id: expect.any(String),
            question_id: questionId,
            type: 'frequency',
            configuration: {
              max_per_day: 5,
              max_per_week: 20,
              max_per_month: 50,
              cooldown_hours: 4,
              reset_on_new_day: true
            },
            active: true,
            priority: 1,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should create time-based trigger', async () => {
      const triggerData = {
        type: 'time_condition',
        configuration: {
          time_of_day: ['morning', 'afternoon'],
          day_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'America/New_York',
          exclude_holidays: true
        },
        active: true,
        priority: 2
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger).toMatchObject({
        type: 'time_condition',
        configuration: {
          time_of_day: ['morning', 'afternoon'],
          day_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'America/New_York',
          exclude_holidays: true
        }
      });
    });

    it('should create customer-based trigger', async () => {
      const triggerData = {
        type: 'customer_condition',
        configuration: {
          customer_type: ['new', 'returning'],
          min_purchase_amount: 25.00,
          max_purchase_amount: 500.00,
          visit_frequency: 'weekly',
          loyalty_tier: ['bronze', 'silver', 'gold']
        },
        active: true,
        priority: 3
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger.configuration).toMatchObject({
        customer_type: ['new', 'returning'],
        min_purchase_amount: 25.00,
        max_purchase_amount: 500.00,
        visit_frequency: 'weekly',
        loyalty_tier: ['bronze', 'silver', 'gold']
      });
    });

    it('should create store-based trigger', async () => {
      const triggerData = {
        type: 'store_condition',
        configuration: {
          store_locations: [storeId],
          busy_hours: ['12:00-14:00', '17:00-19:00'],
          staff_count_min: 2,
          queue_length_max: 5
        },
        active: true,
        priority: 4
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger.configuration.store_locations).toContain(storeId);
    });

    it('should create composite trigger with multiple conditions', async () => {
      const triggerData = {
        type: 'composite',
        configuration: {
          operator: 'AND',
          conditions: [
            {
              type: 'frequency',
              config: { max_per_day: 3, cooldown_hours: 2 }
            },
            {
              type: 'time_condition',
              config: { time_of_day: ['afternoon'] }
            },
            {
              type: 'customer_condition',
              config: { min_purchase_amount: 20.00 }
            }
          ]
        },
        active: true,
        priority: 5
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger.configuration.operator).toBe('AND');
      expect(response.body.data.trigger.configuration.conditions).toHaveLength(3);
    });

    it('should create trigger with custom validation rules', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 10,
          cooldown_hours: 1
        },
        validation_rules: {
          skip_if_recent_negative: true,
          require_purchase: true,
          min_session_duration: 30
        },
        active: true
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger.validation_rules).toMatchObject({
        skip_if_recent_negative: true,
        require_purchase: true,
        min_session_duration: 30
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 without authentication', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .send(triggerData)
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
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', 'Bearer invalid-token')
        .send(triggerData)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authentication token'
        }
      });
    });

    it('should return 403 when creating trigger for question from different business', async () => {
      const { token: otherToken } = await createTestBusinessUser();

      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(triggerData)
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
      
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post(`/api/questions/${nonExistentId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
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
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post('/api/questions/invalid-uuid-format/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
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

    it('should return 409 when creating duplicate trigger of same type', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 }
      };

      // First creation should succeed
      await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      // Second creation of same type should fail
      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'DUPLICATE_TRIGGER_TYPE',
          message: 'Trigger of this type already exists for this question'
        }
      });
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: [
            'type is required',
            'configuration is required'
          ]
        }
      });
    });

    it('should return 400 for invalid trigger type', async () => {
      const triggerData = {
        type: 'invalid_type',
        configuration: { max_per_day: 5 }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid trigger type',
          details: ['type must be one of: frequency, time_condition, customer_condition, store_condition, composite']
        }
      });
    });

    it('should return 400 for invalid frequency configuration', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: -1,
          cooldown_hours: 25
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid frequency configuration',
          details: [
            'max_per_day must be greater than 0',
            'cooldown_hours must be between 0 and 24'
          ]
        }
      });
    });

    it('should return 400 for invalid time condition configuration', async () => {
      const triggerData = {
        type: 'time_condition',
        configuration: {
          time_of_day: ['invalid_time'],
          day_of_week: ['invalid_day']
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid time condition configuration',
          details: [
            'time_of_day values must be one of: morning, afternoon, evening, night',
            'day_of_week values must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday'
          ]
        }
      });
    });

    it('should return 400 for invalid customer condition configuration', async () => {
      const triggerData = {
        type: 'customer_condition',
        configuration: {
          min_purchase_amount: -10,
          max_purchase_amount: 'invalid'
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid customer condition configuration',
          details: [
            'min_purchase_amount must be greater than or equal to 0',
            'max_purchase_amount must be a number'
          ]
        }
      });
    });

    it('should return 400 for invalid composite trigger configuration', async () => {
      const triggerData = {
        type: 'composite',
        configuration: {
          operator: 'INVALID',
          conditions: []
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid composite trigger configuration',
          details: [
            'operator must be one of: AND, OR',
            'conditions array must contain at least 1 condition'
          ]
        }
      });
    });

    it('should return 400 for invalid priority value', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 },
        priority: 0
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid priority value',
          details: ['priority must be between 1 and 10']
        }
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should create trigger within 50ms performance target', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 8,
          cooldown_hours: 3
        }
      };

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // Performance requirement
      expect(response.body.success).toBe(true);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return complete trigger response schema', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 7,
          cooldown_hours: 2
        },
        active: true,
        priority: 1
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          trigger: {
            id: expect.any(String),
            question_id: questionId,
            type: 'frequency',
            configuration: expect.any(Object),
            active: true,
            priority: 1,
            created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          }
        }
      });
    });

    it('should include validation results when validation rules are provided', async () => {
      const triggerData = {
        type: 'frequency',
        configuration: { max_per_day: 5 },
        validation_rules: {
          require_purchase: true
        }
      };

      const response = await request(app)
        .post(`/api/questions/${questionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(201);

      expect(response.body.data.trigger.validation_rules).toMatchObject({
        require_purchase: true
      });
    });
  });
});