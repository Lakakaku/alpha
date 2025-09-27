// Contract Test: POST /api/questions/triggers
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('POST /api/questions/triggers', () => {
  let authToken: string;
  let businessContextId: string;
  const createdTriggerIds: string[] = [];

  beforeAll(async () => {
    // Setup authentication
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@business.com',
        password: 'testpassword'
      });
    
    authToken = authResponse.body.token;
    businessContextId = authResponse.body.user.business_context_id;
  });

  afterAll(async () => {
    // Cleanup created triggers
    if (createdTriggerIds.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', createdTriggerIds);
    }
  });

  describe('Success Cases - Purchase Based Triggers', () => {
    test('should create purchase_based trigger with minimal config', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Basic Purchase Trigger',
        trigger_type: 'purchase_based',
        trigger_config: {
          type: 'purchase_based',
          categories: ['meat', 'dairy']
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);

      expect(response.body).toMatchObject({
        business_context_id: businessContextId,
        trigger_name: 'Basic Purchase Trigger',
        trigger_type: 'purchase_based',
        priority_level: 3, // Default
        sensitivity_threshold: 10, // Default
        is_active: true, // Default
        effectiveness_score: 0.0 // Default
      });
      expect(response.body.trigger_config).toEqual(createRequest.trigger_config);
    });

    test('should create purchase_based trigger with complete config', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Complete Purchase Trigger',
        trigger_type: 'purchase_based',
        priority_level: 5,
        sensitivity_threshold: 5,
        trigger_config: {
          type: 'purchase_based',
          categories: ['bakery', 'produce'],
          required_items: ['bread', 'bananas'],
          minimum_items: 3
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);
      expect(response.body).toMatchObject(createRequest);
    });
  });

  describe('Success Cases - Time Based Triggers', () => {
    test('should create time_based trigger', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Business Hours Trigger',
        trigger_type: 'time_based',
        priority_level: 4,
        sensitivity_threshold: 15,
        trigger_config: {
          type: 'time_based',
          time_windows: [
            {
              start_time: '09:00',
              end_time: '12:00',
              days_of_week: [1, 2, 3, 4, 5]
            },
            {
              start_time: '13:00',
              end_time: '17:00',
              days_of_week: [1, 2, 3, 4, 5]
            }
          ]
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);
      expect(response.body).toMatchObject(createRequest);
    });

    test('should create weekend time_based trigger', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Weekend Trigger',
        trigger_type: 'time_based',
        trigger_config: {
          type: 'time_based',
          time_windows: [{
            start_time: '10:00',
            end_time: '16:00',
            days_of_week: [0, 6] // Sunday and Saturday
          }]
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);
      expect(response.body.trigger_config).toEqual(createRequest.trigger_config);
    });
  });

  describe('Success Cases - Amount Based Triggers', () => {
    test('should create amount_based trigger with minimum amount', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'High Value Purchase',
        trigger_type: 'amount_based',
        priority_level: 5,
        trigger_config: {
          type: 'amount_based',
          currency: 'SEK',
          minimum_amount: 1000,
          comparison_operator: '>='
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);
      expect(response.body).toMatchObject(createRequest);
    });

    test('should create amount_based trigger with range', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Medium Range Purchase',
        trigger_type: 'amount_based',
        trigger_config: {
          type: 'amount_based',
          currency: 'SEK',
          minimum_amount: 200,
          maximum_amount: 800,
          comparison_operator: 'between'
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);
      expect(response.body.trigger_config).toEqual(createRequest.trigger_config);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Unauthorized Trigger',
        trigger_type: 'purchase_based',
        trigger_config: {
          type: 'purchase_based',
          categories: ['test']
        }
      };

      await request(app)
        .post('/api/questions/triggers')
        .send(createRequest)
        .expect(401);
    });

    test('should return 403 for creating trigger in different business context', async () => {
      const createRequest = {
        business_context_id: 'different-business-uuid',
        trigger_name: 'Forbidden Trigger',
        trigger_type: 'purchase_based',
        trigger_config: {
          type: 'purchase_based',
          categories: ['test']
        }
      };

      await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(403);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('business_context_id');
      expect(response.body.error).toContain('trigger_name');
      expect(response.body.error).toContain('trigger_type');
      expect(response.body.error).toContain('trigger_config');
    });

    test('should return 400 for invalid trigger_type', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Type Trigger',
          trigger_type: 'invalid_type',
          trigger_config: {}
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_type');
      expect(response.body.error).toContain('purchase_based, time_based, amount_based');
    });

    test('should return 400 for invalid priority_level', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Priority Trigger',
          trigger_type: 'purchase_based',
          priority_level: 6, // Max is 5
          trigger_config: {
            type: 'purchase_based',
            categories: ['test']
          }
        })
        .expect(400);

      expect(response.body.error).toContain('priority_level');
      expect(response.body.error).toContain('1 and 5');
    });

    test('should return 400 for invalid sensitivity_threshold', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Sensitivity Trigger',
          trigger_type: 'purchase_based',
          sensitivity_threshold: 150, // Max is 100
          trigger_config: {
            type: 'purchase_based',
            categories: ['test']
          }
        })
        .expect(400);

      expect(response.body.error).toContain('sensitivity_threshold');
      expect(response.body.error).toContain('1 and 100');
    });

    test('should return 400 for mismatched trigger_config type', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Mismatched Config Trigger',
          trigger_type: 'purchase_based',
          trigger_config: {
            type: 'time_based', // Doesn't match trigger_type
            time_windows: []
          }
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_config');
      expect(response.body.error).toContain('match trigger_type');
    });

    test('should return 400 for invalid purchase_based config', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Purchase Config',
          trigger_type: 'purchase_based',
          trigger_config: {
            type: 'purchase_based'
            // Missing required categories
          }
        })
        .expect(400);

      expect(response.body.error).toContain('categories');
    });

    test('should return 400 for invalid time_based config', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Time Config',
          trigger_type: 'time_based',
          trigger_config: {
            type: 'time_based',
            time_windows: [{
              start_time: '25:00', // Invalid time format
              end_time: '17:00',
              days_of_week: [1, 2, 3]
            }]
          }
        })
        .expect(400);

      expect(response.body.error).toContain('start_time');
    });

    test('should return 400 for invalid amount_based config', async () => {
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: businessContextId,
          trigger_name: 'Invalid Amount Config',
          trigger_type: 'amount_based',
          trigger_config: {
            type: 'amount_based',
            currency: 'SEK',
            minimum_amount: -100, // Negative amount
            comparison_operator: '>='
          }
        })
        .expect(400);

      expect(response.body.error).toContain('minimum_amount');
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted response', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Format Test Trigger',
        trigger_type: 'purchase_based',
        trigger_config: {
          type: 'purchase_based',
          categories: ['test']
        }
      };

      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      createdTriggerIds.push(response.body.id);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('business_context_id');
      expect(response.body).toHaveProperty('trigger_name');
      expect(response.body).toHaveProperty('trigger_type');
      expect(response.body).toHaveProperty('priority_level');
      expect(response.body).toHaveProperty('sensitivity_threshold');
      expect(response.body).toHaveProperty('is_active');
      expect(response.body).toHaveProperty('trigger_config');
      expect(response.body).toHaveProperty('effectiveness_score');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');

      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.effectiveness_score).toBe('number');
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const createRequest = {
        business_context_id: businessContextId,
        trigger_name: 'Performance Test Trigger',
        trigger_type: 'purchase_based',
        trigger_config: {
          type: 'purchase_based',
          categories: ['performance']
        }
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createRequest)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);

      createdTriggerIds.push(response.body.id);
    });
  });
});