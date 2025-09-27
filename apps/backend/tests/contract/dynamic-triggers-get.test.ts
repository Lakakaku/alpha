// Contract Test: GET /api/questions/triggers
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('GET /api/questions/triggers', () => {
  let authToken: string;
  let businessContextId: string;
  let testTriggerIds: string[] = [];

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

    // Create test triggers of different types
    const triggers = [
      {
        business_context_id: businessContextId,
        trigger_name: 'Purchase Based Test',
        trigger_type: 'purchase_based',
        priority_level: 3,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: {
          type: 'purchase_based',
          categories: ['meat', 'bakery'],
          minimum_items: 2
        },
        effectiveness_score: 0.75
      },
      {
        business_context_id: businessContextId,
        trigger_name: 'Time Based Test',
        trigger_type: 'time_based',
        priority_level: 4,
        sensitivity_threshold: 5,
        is_active: true,
        trigger_config: {
          type: 'time_based',
          time_windows: [{
            start_time: '09:00',
            end_time: '17:00',
            days_of_week: [1, 2, 3, 4, 5]
          }]
        },
        effectiveness_score: 0.85
      },
      {
        business_context_id: businessContextId,
        trigger_name: 'Amount Based Test',
        trigger_type: 'amount_based',
        priority_level: 2,
        sensitivity_threshold: 20,
        is_active: false,
        trigger_config: {
          type: 'amount_based',
          currency: 'SEK',
          minimum_amount: 500,
          comparison_operator: '>='
        },
        effectiveness_score: 0.60
      }
    ];

    for (const trigger of triggers) {
      const { data } = await supabase
        .from('dynamic_triggers')
        .insert(trigger)
        .select()
        .single();
      testTriggerIds.push(data.id);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTriggerIds.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', testTriggerIds);
    }
  });

  describe('Success Cases', () => {
    test('should return all triggers for authenticated business user', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      const triggerNames = response.body.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('Purchase Based Test');
      expect(triggerNames).toContain('Time Based Test');
      expect(triggerNames).toContain('Amount Based Test');
    });

    test('should filter by trigger_type parameter', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'purchase_based'
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((trigger: any) => {
        expect(trigger.trigger_type).toBe('purchase_based');
      });

      const purchaseTrigger = response.body.find((t: any) => t.trigger_name === 'Purchase Based Test');
      expect(purchaseTrigger).toBeDefined();
    });

    test('should filter by is_active parameter (true)', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          is_active: true 
        })
        .expect(200);

      response.body.forEach((trigger: any) => {
        expect(trigger.is_active).toBe(true);
      });

      const triggerNames = response.body.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('Purchase Based Test');
      expect(triggerNames).toContain('Time Based Test');
      expect(triggerNames).not.toContain('Amount Based Test'); // inactive
    });

    test('should filter by is_active parameter (false)', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          is_active: false 
        })
        .expect(200);

      response.body.forEach((trigger: any) => {
        expect(trigger.is_active).toBe(false);
      });

      const triggerNames = response.body.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('Amount Based Test');
    });

    test('should return empty array for business with no triggers', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'non-existent-uuid' })
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'time_based',
          is_active: true
        })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].trigger_name).toBe('Time Based Test');
      expect(response.body[0].trigger_type).toBe('time_based');
      expect(response.body[0].is_active).toBe(true);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/questions/triggers')
        .query({ business_context_id: businessContextId })
        .expect(401);
    });

    test('should return 403 for user accessing other business context', async () => {
      await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'different-business-uuid' })
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', 'Bearer invalid-token')
        .query({ business_context_id: businessContextId })
        .expect(401);
    });
  });

  describe('Validation', () => {
    test('should return 400 for missing business_context_id', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('business_context_id');
    });

    test('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: 'invalid-uuid' })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for invalid trigger_type', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'invalid_type'
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_type');
      expect(response.body.error).toContain('purchase_based, time_based, amount_based');
    });

    test('should return 400 for invalid is_active value', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          is_active: 'maybe'
        })
        .expect(400);

      expect(response.body.error).toContain('is_active');
      expect(response.body.error).toContain('boolean');
    });
  });

  describe('Response Format Validation', () => {
    test('should return properly formatted response', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      
      response.body.forEach((trigger: any) => {
        expect(trigger).toHaveProperty('id');
        expect(trigger).toHaveProperty('business_context_id');
        expect(trigger).toHaveProperty('trigger_name');
        expect(trigger).toHaveProperty('trigger_type');
        expect(trigger).toHaveProperty('priority_level');
        expect(trigger).toHaveProperty('sensitivity_threshold');
        expect(trigger).toHaveProperty('is_active');
        expect(trigger).toHaveProperty('trigger_config');
        expect(trigger).toHaveProperty('effectiveness_score');
        expect(trigger).toHaveProperty('created_at');
        expect(trigger).toHaveProperty('updated_at');

        expect(typeof trigger.id).toBe('string');
        expect(typeof trigger.business_context_id).toBe('string');
        expect(typeof trigger.trigger_name).toBe('string');
        expect(typeof trigger.trigger_type).toBe('string');
        expect(typeof trigger.priority_level).toBe('number');
        expect(typeof trigger.sensitivity_threshold).toBe('number');
        expect(typeof trigger.is_active).toBe('boolean');
        expect(typeof trigger.trigger_config).toBe('object');
        expect(typeof trigger.effectiveness_score).toBe('number');

        expect(['purchase_based', 'time_based', 'amount_based']).toContain(trigger.trigger_type);
        expect(trigger.priority_level).toBeGreaterThanOrEqual(1);
        expect(trigger.priority_level).toBeLessThanOrEqual(5);
        expect(trigger.sensitivity_threshold).toBeGreaterThanOrEqual(1);
        expect(trigger.sensitivity_threshold).toBeLessThanOrEqual(100);
        expect(trigger.effectiveness_score).toBeGreaterThanOrEqual(0.0);
        expect(trigger.effectiveness_score).toBeLessThanOrEqual(1.0);
      });
    });

    test('should return correct trigger_config structure for purchase_based', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'purchase_based'
        })
        .expect(200);

      const purchaseTrigger = response.body.find((t: any) => t.trigger_name === 'Purchase Based Test');
      expect(purchaseTrigger.trigger_config).toMatchObject({
        type: 'purchase_based',
        categories: ['meat', 'bakery'],
        minimum_items: 2
      });
    });

    test('should return correct trigger_config structure for time_based', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'time_based'
        })
        .expect(200);

      const timeTrigger = response.body.find((t: any) => t.trigger_name === 'Time Based Test');
      expect(timeTrigger.trigger_config).toMatchObject({
        type: 'time_based',
        time_windows: [{
          start_time: '09:00',
          end_time: '17:00',
          days_of_week: [1, 2, 3, 4, 5]
        }]
      });
    });

    test('should return correct trigger_config structure for amount_based', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          business_context_id: businessContextId,
          trigger_type: 'amount_based'
        })
        .expect(200);

      const amountTrigger = response.body.find((t: any) => t.trigger_name === 'Amount Based Test');
      expect(amountTrigger.trigger_config).toMatchObject({
        type: 'amount_based',
        currency: 'SEK',
        minimum_amount: 500,
        comparison_operator: '>='
      });
    });
  });

  describe('Performance', () => {
    test('should respond within 500ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Row Level Security', () => {
    test('should only return triggers for authenticated business context', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      response.body.forEach((trigger: any) => {
        expect(trigger.business_context_id).toBe(businessContextId);
      });
    });
  });

  describe('Sorting and Ordering', () => {
    test('should return triggers sorted by created_at descending by default', async () => {
      const response = await request(app)
        .get('/api/questions/triggers')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ business_context_id: businessContextId })
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          const prevDate = new Date(response.body[i - 1].created_at);
          const currDate = new Date(response.body[i].created_at);
          expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
        }
      }
    });
  });
});