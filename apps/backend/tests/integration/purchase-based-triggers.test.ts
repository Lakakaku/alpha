/**
 * Integration Tests - Purchase-Based Trigger Activation
 * Tests the complete workflow of purchase-based dynamic triggers
 * 
 * This test suite validates that purchase-based triggers can:
 * - Activate based on purchase amount thresholds
 * - Filter by product categories
 * - Apply time-since-purchase constraints
 * - Handle multi-criteria trigger conditions
 * - Log activation events for analytics
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Purchase-Based Triggers', () => {
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'purchase-trigger-business',
        name: 'Purchase Trigger Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-integration-token';

    // Create various purchase-based triggers
    const triggerData = [
      {
        business_context_id: testBusinessId,
        trigger_name: 'High-Value Purchase Trigger',
        trigger_type: 'purchase_based',
        is_active: true,
        config: {
          purchase_amount_threshold: 500.00,
          product_categories: ['electronics', 'appliances'],
          time_since_purchase_hours: 24,
          exclude_categories: []
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Premium Electronics Trigger',
        trigger_type: 'purchase_based',
        is_active: true,
        config: {
          purchase_amount_threshold: 1000.00,
          product_categories: ['electronics'],
          time_since_purchase_hours: 48,
          exclude_categories: ['accessories']
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Any Category High Spend',
        trigger_type: 'purchase_based',
        is_active: true,
        config: {
          purchase_amount_threshold: 2000.00,
          product_categories: [], // Any category
          time_since_purchase_hours: 72,
          exclude_categories: []
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Quick Fashion Feedback',
        trigger_type: 'purchase_based',
        is_active: true,
        config: {
          purchase_amount_threshold: 50.00,
          product_categories: ['clothing', 'fashion'],
          time_since_purchase_hours: 2, // Very quick follow-up
          exclude_categories: []
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Inactive Trigger',
        trigger_type: 'purchase_based',
        is_active: false, // Inactive trigger for testing
        config: {
          purchase_amount_threshold: 100.00,
          product_categories: ['books'],
          time_since_purchase_hours: 24,
          exclude_categories: []
        }
      }
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;
  });

  afterAll(async () => {
    // Clean up activation logs
    await supabase
      .from('trigger_activation_logs')
      .delete()
      .in('trigger_id', testTriggers.map(t => t.id));

    // Clean up triggers
    if (testTriggers.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', testTriggers.map(t => t.id));
    }

    if (testBusinessId) {
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', testBusinessId);
    }
  });

  describe('Amount Threshold Activation', () => {
    it('should activate trigger when purchase amount meets threshold', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            purchase_amount: 750.00, // Above 500 threshold
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const evaluation = response.body.data;
      expect(evaluation).toHaveProperty('matching_triggers');
      expect(evaluation.matching_triggers.length).toBeGreaterThan(0);
      
      // Should match the high-value purchase trigger
      const highValueTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase Trigger'
      );
      expect(highValueTrigger).toBeDefined();
      expect(highValueTrigger.activation_reason).toContain('purchase amount threshold met');
    });

    it('should not activate trigger when purchase amount below threshold', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568',
            purchase_amount: 300.00, // Below 500 threshold
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not match high-value triggers
      const highValueTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase Trigger'
      );
      expect(highValueTrigger).toBeUndefined();
    });

    it('should activate multiple triggers for very high amounts', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569',
            purchase_amount: 2500.00, // Above all thresholds
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should match multiple triggers
      expect(evaluation.matching_triggers.length).toBeGreaterThanOrEqual(3);
      
      // Should include high-value, premium electronics, and any category triggers
      const triggerNames = evaluation.matching_triggers.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('High-Value Purchase Trigger');
      expect(triggerNames).toContain('Premium Electronics Trigger');
      expect(triggerNames).toContain('Any Category High Spend');
    });
  });

  describe('Product Category Filtering', () => {
    it('should activate trigger for matching product category', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234570',
            purchase_amount: 75.00, // Above fashion threshold (50)
            purchase_category: 'clothing',
            purchase_timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const fashionTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Quick Fashion Feedback'
      );
      expect(fashionTrigger).toBeDefined();
      expect(fashionTrigger.activation_reason).toContain('product category match');
    });

    it('should not activate trigger for non-matching product category', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234571',
            purchase_amount: 1500.00, // High amount
            purchase_category: 'books', // Not in electronics category
            purchase_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not match premium electronics trigger (category mismatch)
      const electronicsOnlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Premium Electronics Trigger'
      );
      expect(electronicsOnlyTrigger).toBeUndefined();
      
      // But should match "Any Category High Spend" (no category restriction)
      const anyCategoryTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Any Category High Spend'
      );
      expect(anyCategoryTrigger).toBeDefined();
    });

    it('should handle multiple matching categories', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234572',
            purchase_amount: 600.00,
            purchase_category: 'appliances', // Matches both high-value trigger categories
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const highValueTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase Trigger'
      );
      expect(highValueTrigger).toBeDefined();
      expect(highValueTrigger.config.product_categories).toContain('appliances');
    });
  });

  describe('Time-Since-Purchase Constraints', () => {
    it('should activate trigger within time window', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234573',
            purchase_amount: 100.00,
            purchase_category: 'fashion',
            purchase_timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString() // 1.5 hours ago
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const quickFashionTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Quick Fashion Feedback'
      );
      expect(quickFashionTrigger).toBeDefined();
      expect(quickFashionTrigger.activation_reason).toContain('within time window');
    });

    it('should not activate trigger outside time window', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234574',
            purchase_amount: 100.00,
            purchase_category: 'fashion',
            purchase_timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago (beyond 2-hour window)
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const quickFashionTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Quick Fashion Feedback'
      );
      expect(quickFashionTrigger).toBeUndefined();
    });

    it('should handle different time windows correctly', async () => {
      const purchaseTime = new Date(Date.now() - 36 * 60 * 60 * 1000); // 36 hours ago
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234575',
            purchase_amount: 1200.00,
            purchase_category: 'electronics',
            purchase_timestamp: purchaseTime.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should match premium electronics (48-hour window)
      const premiumTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Premium Electronics Trigger'
      );
      expect(premiumTrigger).toBeDefined();
      
      // Should not match high-value purchase (24-hour window)
      const highValueTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase Trigger'
      );
      expect(highValueTrigger).toBeUndefined();
    });
  });

  describe('Multi-Criteria Trigger Logic', () => {
    it('should require all criteria to be met for activation', async () => {
      // Test case where amount meets threshold but category doesn't match
      const response1 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234576',
            purchase_amount: 1500.00, // Above threshold
            purchase_category: 'books', // Not in electronics
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response1.status).toBe(200);
      const evaluation1 = response1.body.data;
      
      const premiumTrigger1 = evaluation1.matching_triggers.find(
        (t: any) => t.trigger_name === 'Premium Electronics Trigger'
      );
      expect(premiumTrigger1).toBeUndefined(); // Should not activate
      
      // Test case where category matches but amount is too low
      const response2 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234577',
            purchase_amount: 500.00, // Below 1000 threshold
            purchase_category: 'electronics', // Matches category
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response2.status).toBe(200);
      const evaluation2 = response2.body.data;
      
      const premiumTrigger2 = evaluation2.matching_triggers.find(
        (t: any) => t.trigger_name === 'Premium Electronics Trigger'
      );
      expect(premiumTrigger2).toBeUndefined(); // Should not activate
    });

    it('should handle empty category arrays (any category)', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234578',
            purchase_amount: 2200.00, // Above any category threshold
            purchase_category: 'furniture', // Not explicitly listed in any trigger
            purchase_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should match "Any Category High Spend" trigger
      const anyCategoryTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Any Category High Spend'
      );
      expect(anyCategoryTrigger).toBeDefined();
      expect(anyCategoryTrigger.activation_reason).toContain('any category allowed');
    });

    it('should handle exclude categories correctly', async () => {
      // Create trigger with exclude categories
      const excludeTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Exclude Accessories Trigger',
          trigger_type: 'purchase_based',
          is_active: true,
          config: {
            purchase_amount_threshold: 200.00,
            product_categories: ['electronics'],
            time_since_purchase_hours: 24,
            exclude_categories: ['accessories']
          }
        })
        .select()
        .single();

      // Test with excluded category
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234579',
            purchase_amount: 250.00,
            purchase_category: 'accessories', // Excluded category
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const excludeTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Exclude Accessories Trigger'
      );
      expect(excludeTrigger).toBeUndefined(); // Should not activate due to exclusion

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', excludeTriggerResult.data.id);
    });
  });

  describe('Activation Logging and Analytics', () => {
    it('should log successful trigger activations', async () => {
      const customerPhone = '+46701234580';
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: customerPhone,
            purchase_amount: 800.00,
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      
      // Check that activation log was created
      const logResult = await supabase
        .from('trigger_activation_logs')
        .select('*')
        .eq('customer_phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(logResult.data).toBeTruthy();
      expect(logResult.data.length).toBe(1);
      expect(logResult.data[0].activation_reason).toBeDefined();
      expect(logResult.data[0].trigger_id).toBeDefined();
    });

    it('should include context data in activation logs', async () => {
      const customerPhone = '+46701234581';
      const purchaseAmount = 1200.00;
      
      await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: customerPhone,
            purchase_amount: purchaseAmount,
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            customer_tier: 'premium'
          }
        });

      const logResult = await supabase
        .from('trigger_activation_logs')
        .select('*')
        .eq('customer_phone', customerPhone)
        .single();

      expect(logResult.data.context_data).toBeDefined();
      expect(logResult.data.context_data.purchase_amount).toBe(purchaseAmount);
      expect(logResult.data.context_data.customer_tier).toBe('premium');
    });

    it('should track trigger performance metrics', async () => {
      const customerPhone = '+46701234582';
      
      // Trigger activation
      await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: customerPhone,
            purchase_amount: 600.00,
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        });

      // Simulate call completion
      await supabase
        .from('trigger_activation_logs')
        .update({
          call_completed: true,
          call_duration_seconds: 145,
          feedback_collected: true,
          customer_satisfaction_score: 4
        })
        .eq('customer_phone', customerPhone);

      // Verify metrics are tracked
      const logResult = await supabase
        .from('trigger_activation_logs')
        .select('*')
        .eq('customer_phone', customerPhone)
        .single();

      expect(logResult.data.call_completed).toBe(true);
      expect(logResult.data.call_duration_seconds).toBe(145);
      expect(logResult.data.feedback_collected).toBe(true);
      expect(logResult.data.customer_satisfaction_score).toBe(4);
    });
  });

  describe('Trigger State Management', () => {
    it('should not activate inactive triggers', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234583',
            purchase_amount: 150.00, // Above books threshold
            purchase_category: 'books',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not match inactive trigger
      const inactiveTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Inactive Trigger'
      );
      expect(inactiveTrigger).toBeUndefined();
    });

    it('should handle trigger updates affecting active evaluations', async () => {
      // Update trigger configuration
      const highValueTrigger = testTriggers.find(t => t.trigger_name === 'High-Value Purchase Trigger');
      
      await supabase
        .from('dynamic_triggers')
        .update({
          config: {
            purchase_amount_threshold: 1000.00, // Increased threshold
            product_categories: ['electronics', 'appliances'],
            time_since_purchase_hours: 24,
            exclude_categories: []
          }
        })
        .eq('id', highValueTrigger.id);

      // Test with amount that would have triggered before update
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234584',
            purchase_amount: 750.00, // Below new threshold
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not match due to updated threshold
      const updatedTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'High-Value Purchase Trigger'
      );
      expect(updatedTrigger).toBeUndefined();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should complete trigger evaluation within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234585',
            purchase_amount: 400.00,
            purchase_category: 'electronics',
            purchase_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle malformed purchase data gracefully', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234586',
            purchase_amount: 'invalid-amount', // Invalid data
            purchase_category: 'electronics',
            purchase_timestamp: 'invalid-date'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should handle missing purchase context gracefully', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234587'
            // Missing purchase data
          }
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('purchase_amount');
    });
  });
});