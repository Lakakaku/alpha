// Contract Test: PUT /api/questions/triggers/{triggerId}
// Feature: Step 5.2: Advanced Question Logic

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('PUT /api/questions/triggers/{triggerId}', () => {
  let authToken: string;
  let businessContextId: string;
  let testTriggerId: string;
  let otherBusinessTriggerId: string;

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

    // Create test trigger
    const { data: trigger } = await supabase
      .from('dynamic_triggers')
      .insert({
        business_context_id: businessContextId,
        trigger_name: 'Original Trigger',
        trigger_type: 'purchase_based',
        priority_level: 3,
        sensitivity_threshold: 10,
        is_active: true,
        trigger_config: {
          type: 'purchase_based',
          categories: ['original', 'category'],
          minimum_items: 1
        },
        effectiveness_score: 0.5
      })
      .select()
      .single();
    
    testTriggerId = trigger.id;

    // Create trigger in different business context for authorization tests
    const { data: otherTrigger } = await supabase
      .from('dynamic_triggers')
      .insert({
        business_context_id: 'different-business-uuid',
        trigger_name: 'Other Business Trigger',
        trigger_type: 'time_based',
        priority_level: 2,
        sensitivity_threshold: 20,
        is_active: true,
        trigger_config: {
          type: 'time_based',
          time_windows: [{
            start_time: '09:00',
            end_time: '17:00',
            days_of_week: [1, 2, 3, 4, 5]
          }]
        },
        effectiveness_score: 0.3
      })
      .select()
      .single();
    
    otherBusinessTriggerId = otherTrigger.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('dynamic_triggers')
      .delete()
      .in('id', [testTriggerId, otherBusinessTriggerId]);
  });

  describe('Success Cases', () => {
    test('should update trigger name only', async () => {
      const updateRequest = {
        trigger_name: 'Updated Trigger Name'
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.trigger_name).toBe('Updated Trigger Name');
      expect(response.body.priority_level).toBe(3); // Unchanged
      expect(response.body.trigger_type).toBe('purchase_based'); // Unchanged
      expect(response.body.updated_at).not.toBe(response.body.created_at);
    });

    test('should update priority level only', async () => {
      const updateRequest = {
        priority_level: 5
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.priority_level).toBe(5);
      expect(response.body.trigger_name).toBe('Updated Trigger Name'); // From previous test
    });

    test('should update sensitivity threshold', async () => {
      const updateRequest = {
        sensitivity_threshold: 25
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.sensitivity_threshold).toBe(25);
    });

    test('should update trigger config for purchase_based', async () => {
      const updateRequest = {
        trigger_config: {
          type: 'purchase_based',
          categories: ['updated', 'categories', 'list'],
          required_items: ['specific', 'items'],
          minimum_items: 3
        }
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.trigger_config).toEqual(updateRequest.trigger_config);
    });

    test('should update is_active status', async () => {
      const updateRequest = {
        is_active: false
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.is_active).toBe(false);

      // Reactivate for other tests
      await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ is_active: true })
        .expect(200);
    });

    test('should update multiple fields at once', async () => {
      const updateRequest = {
        trigger_name: 'Multi-Update Trigger',
        priority_level: 4,
        sensitivity_threshold: 15,
        trigger_config: {
          type: 'purchase_based',
          categories: ['multi', 'update'],
          minimum_items: 2
        },
        is_active: true
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body).toMatchObject(updateRequest);
      expect(response.body.trigger_type).toBe('purchase_based'); // Should remain unchanged
    });

    test('should handle empty update gracefully', async () => {
      const updateRequest = {};

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Should return existing trigger unchanged except updated_at
      expect(response.body.trigger_name).toBe('Multi-Update Trigger');
      expect(response.body.priority_level).toBe(4);
    });
  });

  describe('Success Cases - Different Trigger Types', () => {
    test('should update to time_based trigger config', async () => {
      // First change the trigger type in database to allow config change
      await supabase
        .from('dynamic_triggers')
        .update({ trigger_type: 'time_based' })
        .eq('id', testTriggerId);

      const updateRequest = {
        trigger_config: {
          type: 'time_based',
          time_windows: [
            {
              start_time: '08:00',
              end_time: '12:00',
              days_of_week: [1, 2, 3, 4, 5]
            },
            {
              start_time: '14:00',
              end_time: '18:00',
              days_of_week: [1, 2, 3, 4, 5]
            }
          ]
        }
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.trigger_config).toEqual(updateRequest.trigger_config);
    });

    test('should update to amount_based trigger config', async () => {
      // First change the trigger type in database
      await supabase
        .from('dynamic_triggers')
        .update({ trigger_type: 'amount_based' })
        .eq('id', testTriggerId);

      const updateRequest = {
        trigger_config: {
          type: 'amount_based',
          currency: 'SEK',
          minimum_amount: 750,
          maximum_amount: 1500,
          comparison_operator: 'between'
        }
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      expect(response.body.trigger_config).toEqual(updateRequest.trigger_config);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 for unauthenticated request', async () => {
      await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .send({ trigger_name: 'Unauthorized Update' })
        .expect(401);
    });

    test('should return 403 for updating trigger in different business context', async () => {
      await request(app)
        .put(`/api/questions/triggers/${otherBusinessTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trigger_name: 'Forbidden Update' })
        .expect(403);
    });

    test('should return 401 for invalid token', async () => {
      await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ trigger_name: 'Invalid Token Update' })
        .expect(401);
    });

    test('should return 404 for non-existent trigger', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .put(`/api/questions/triggers/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trigger_name: 'Non-existent Trigger' })
        .expect(404);
    });
  });

  describe('Validation Errors', () => {
    test('should return 400 for invalid trigger ID format', async () => {
      const response = await request(app)
        .put('/api/questions/triggers/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ trigger_name: 'Invalid ID Update' })
        .expect(400);

      expect(response.body.error).toContain('valid UUID');
    });

    test('should return 400 for trigger_name too long', async () => {
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          trigger_name: 'A'.repeat(101) // Max is 100 chars
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_name');
      expect(response.body.error).toContain('100');
    });

    test('should return 400 for invalid priority_level', async () => {
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority_level: 0 // Below minimum of 1
        })
        .expect(400);

      expect(response.body.error).toContain('priority_level');
      expect(response.body.error).toContain('1 and 5');
    });

    test('should return 400 for invalid sensitivity_threshold', async () => {
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sensitivity_threshold: 101 // Above maximum of 100
        })
        .expect(400);

      expect(response.body.error).toContain('sensitivity_threshold');
      expect(response.body.error).toContain('1 and 100');
    });

    test('should return 400 for mismatched trigger_config type', async () => {
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          trigger_config: {
            type: 'purchase_based', // Current trigger is amount_based from previous test
            categories: ['mismatch']
          }
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_config');
      expect(response.body.error).toContain('match trigger_type');
    });

    test('should return 400 for invalid trigger_config structure', async () => {
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          trigger_config: {
            type: 'amount_based',
            currency: 'SEK',
            minimum_amount: -500, // Negative amount
            comparison_operator: '>='
          }
        })
        .expect(400);

      expect(response.body.error).toContain('minimum_amount');
    });

    test('should return 400 for duplicate trigger name in same business context', async () => {
      // Create another trigger to test against
      const { data: anotherTrigger } = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: businessContextId,
          trigger_name: 'Another Trigger For Duplicate Test',
          trigger_type: 'purchase_based',
          priority_level: 2,
          sensitivity_threshold: 30,
          is_active: true,
          trigger_config: {
            type: 'purchase_based',
            categories: ['test']
          },
          effectiveness_score: 0.4
        })
        .select()
        .single();

      // Try to update main trigger to have same name as another trigger
      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          trigger_name: 'Another Trigger For Duplicate Test'
        })
        .expect(400);

      expect(response.body.error).toContain('trigger_name');
      expect(response.body.error).toContain('unique');

      // Cleanup
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', anotherTrigger.id);
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted response', async () => {
      const updateRequest = {
        trigger_name: 'Format Test Update'
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

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
      const updateRequest = {
        trigger_name: 'Performance Test Update'
      };

      const startTime = Date.now();
      
      await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Database Persistence', () => {
    test('should persist updates to database correctly', async () => {
      // Reset trigger type to purchase_based for this test
      await supabase
        .from('dynamic_triggers')
        .update({ trigger_type: 'purchase_based' })
        .eq('id', testTriggerId);

      const updateRequest = {
        trigger_name: 'Persistence Test Update',
        priority_level: 1,
        sensitivity_threshold: 50,
        trigger_config: {
          type: 'purchase_based',
          categories: ['persistence', 'test'],
          required_items: ['item1', 'item2'],
          minimum_items: 4
        },
        is_active: true
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Verify in database
      const { data: dbTrigger } = await supabase
        .from('dynamic_triggers')
        .select('*')
        .eq('id', testTriggerId)
        .single();

      expect(dbTrigger).toMatchObject({
        trigger_name: 'Persistence Test Update',
        priority_level: 1,
        sensitivity_threshold: 50,
        is_active: true
      });
      expect(dbTrigger.trigger_config).toEqual(updateRequest.trigger_config);
      expect(new Date(dbTrigger.updated_at).getTime()).toBeGreaterThan(new Date(dbTrigger.created_at).getTime());
    });
  });

  describe('Effectiveness Score', () => {
    test('should not allow direct updates to effectiveness_score', async () => {
      const updateRequest = {
        effectiveness_score: 0.95 // This should be ignored
      };

      const response = await request(app)
        .put(`/api/questions/triggers/${testTriggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // effectiveness_score should not have changed
      expect(response.body.effectiveness_score).not.toBe(0.95);
    });
  });
});