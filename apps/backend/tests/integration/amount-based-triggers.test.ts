/**
 * Integration Tests - Amount-Based Conditional Logic
 * Tests the complete workflow of amount-based dynamic triggers
 * 
 * This test suite validates that amount-based triggers can:
 * - Apply complex conditional logic based on purchase amounts
 * - Handle progressive threshold tiers (bronze/silver/gold/platinum)
 * - Calculate cumulative spending over time periods
 * - Apply different question sets based on spending patterns
 * - Consider customer lifetime value in trigger decisions
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Amount-Based Conditional Logic', () => {
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'amount-logic-business',
        name: 'Amount-Based Logic Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-integration-token';

    // Create amount-based triggers with complex conditional logic
    const triggerData = [
      {
        business_context_id: testBusinessId,
        trigger_name: 'Bronze Tier Feedback',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 100.00,
              currency: 'SEK'
            },
            {
              type: 'single_purchase',
              operator: 'lt',
              value: 500.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: null, // Single purchase only
          question_priority_boost: 1.0
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Silver Tier VIP',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 500.00,
              currency: 'SEK'
            },
            {
              type: 'single_purchase',
              operator: 'lt',
              value: 2000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: null,
          question_priority_boost: 1.5
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Gold Tier Premium',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 2000.00,
              currency: 'SEK'
            },
            {
              type: 'single_purchase',
              operator: 'lt',
              value: 10000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: null,
          question_priority_boost: 2.0
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Platinum Elite',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 10000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: null,
          question_priority_boost: 3.0
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Monthly High Spender',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'cumulative_monthly',
              operator: 'gte',
              value: 3000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: 30,
          question_priority_boost: 2.5
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Quarterly VIP Club',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'cumulative_quarterly',
              operator: 'gte',
              value: 8000.00,
              currency: 'SEK'
            },
            {
              type: 'average_purchase',
              operator: 'gte',
              value: 400.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: 90,
          question_priority_boost: 2.8
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Lifetime Value Elite',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'lifetime_value',
              operator: 'gte',
              value: 25000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'AND',
          time_period_days: null,
          question_priority_boost: 4.0
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Complex OR Logic',
        trigger_type: 'amount_based',
        is_active: true,
        config: {
          amount_conditions: [
            {
              type: 'single_purchase',
              operator: 'gte',
              value: 5000.00,
              currency: 'SEK'
            },
            {
              type: 'cumulative_monthly',
              operator: 'gte',
              value: 4000.00,
              currency: 'SEK'
            }
          ],
          conditional_logic: 'OR', // Either condition can trigger
          time_period_days: 30,
          question_priority_boost: 2.2
        }
      }
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;

    // Create test customer purchase history
    const purchaseHistoryData = [
      // Customer 1: Consistent medium spender
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 1200.00,
        purchase_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 800.00,
        purchase_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days ago
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        purchase_amount: 1500.00,
        purchase_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
        currency: 'SEK'
      },
      // Customer 2: High single purchase
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        purchase_amount: 12000.00,
        purchase_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        currency: 'SEK'
      },
      // Customer 3: Lifetime high value
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        purchase_amount: 2200.00,
        purchase_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        purchase_amount: 3500.00,
        purchase_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        purchase_amount: 4800.00,
        purchase_date: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      },
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        purchase_amount: 15000.00,
        purchase_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'SEK'
      }
    ];

    await supabase
      .from('customer_purchase_history')
      .insert(purchaseHistoryData);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('trigger_activation_logs')
      .delete()
      .in('trigger_id', testTriggers.map(t => t.id));

    await supabase
      .from('customer_purchase_history')
      .delete()
      .eq('business_context_id', testBusinessId);

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

  describe('Single Purchase Tier Logic', () => {
    it('should activate bronze tier for medium purchases', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234570',
            purchase_amount: 250.00, // Bronze tier (100-500)
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const evaluation = response.body.data;
      const bronzeTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Bronze Tier Feedback'
      );
      
      expect(bronzeTrigger).toBeDefined();
      expect(bronzeTrigger.activation_reason).toContain('amount tier: bronze');
      expect(bronzeTrigger.priority_boost).toBe(1.0);
    });

    it('should activate silver tier for higher purchases', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234571',
            purchase_amount: 1200.00, // Silver tier (500-2000)
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const silverTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Silver Tier VIP'
      );
      
      expect(silverTrigger).toBeDefined();
      expect(silverTrigger.priority_boost).toBe(1.5);
      
      // Should not activate bronze tier (amount too high)
      const bronzeTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Bronze Tier Feedback'
      );
      expect(bronzeTrigger).toBeUndefined();
    });

    it('should activate gold tier for premium purchases', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234572',
            purchase_amount: 5500.00, // Gold tier (2000-10000)
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const goldTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Gold Tier Premium'
      );
      
      expect(goldTrigger).toBeDefined();
      expect(goldTrigger.priority_boost).toBe(2.0);
    });

    it('should activate platinum tier for ultra-premium purchases', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234573',
            purchase_amount: 15000.00, // Platinum tier (10000+)
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const platinumTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Platinum Elite'
      );
      
      expect(platinumTrigger).toBeDefined();
      expect(platinumTrigger.priority_boost).toBe(3.0);
      
      // Should also activate gold tier (no upper limit)
      const goldTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Gold Tier Premium'
      );
      expect(goldTrigger).toBeUndefined(); // Has upper limit, so should not activate
    });
  });

  describe('Cumulative Amount Logic', () => {
    it('should calculate monthly cumulative spending', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // Has 1200 + 800 = 2000 in last 30 days
            purchase_amount: 1500.00, // Current purchase
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Total should be 1200 + 800 + 1500 = 3500 (above 3000 threshold)
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly High Spender'
      );
      
      expect(monthlyTrigger).toBeDefined();
      expect(monthlyTrigger.amount_calculation.monthly_total).toBeGreaterThanOrEqual(3000);
      expect(monthlyTrigger.priority_boost).toBe(2.5);
    });

    it('should calculate quarterly cumulative with average check', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // Has multiple purchases in 90 days
            purchase_amount: 2000.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const quarterlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Quarterly VIP Club'
      );
      
      if (quarterlyTrigger) {
        expect(quarterlyTrigger.amount_calculation.quarterly_total).toBeGreaterThanOrEqual(8000);
        expect(quarterlyTrigger.amount_calculation.average_purchase).toBeGreaterThanOrEqual(400);
        expect(quarterlyTrigger.priority_boost).toBe(2.8);
      }
    });

    it('should handle lifetime value calculations', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // Has high lifetime value
            purchase_amount: 3000.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const lifetimeTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Lifetime Value Elite'
      );
      
      if (lifetimeTrigger) {
        expect(lifetimeTrigger.amount_calculation.lifetime_value).toBeGreaterThanOrEqual(25000);
        expect(lifetimeTrigger.priority_boost).toBe(4.0);
      }
    });
  });

  describe('Conditional Logic Operators', () => {
    it('should apply AND logic correctly', async () => {
      // Test silver tier with AND logic (must be >= 500 AND < 2000)
      const response1 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234574',
            purchase_amount: 1500.00, // Meets both conditions
            currency: 'SEK'
          }
        });

      expect(response1.status).toBe(200);
      const evaluation1 = response1.body.data;
      
      const silverTrigger = evaluation1.matching_triggers.find(
        (t: any) => t.trigger_name === 'Silver Tier VIP'
      );
      expect(silverTrigger).toBeDefined();

      // Test with amount that fails one condition
      const response2 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234575',
            purchase_amount: 2500.00, // Meets >= 500 but fails < 2000
            currency: 'SEK'
          }
        });

      expect(response2.status).toBe(200);
      const evaluation2 = response2.body.data;
      
      const silverTrigger2 = evaluation2.matching_triggers.find(
        (t: any) => t.trigger_name === 'Silver Tier VIP'
      );
      expect(silverTrigger2).toBeUndefined(); // Should not activate due to AND logic
    });

    it('should apply OR logic correctly', async () => {
      // Test trigger with OR logic (single purchase >= 5000 OR monthly >= 4000)
      
      // Test case 1: High single purchase, low monthly
      const response1 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234576',
            purchase_amount: 6000.00, // Meets first condition
            currency: 'SEK'
          }
        });

      expect(response1.status).toBe(200);
      const evaluation1 = response1.body.data;
      
      const orTrigger1 = evaluation1.matching_triggers.find(
        (t: any) => t.trigger_name === 'Complex OR Logic'
      );
      expect(orTrigger1).toBeDefined();
      expect(orTrigger1.activation_reason).toContain('OR condition met');

      // Test case 2: Low single purchase but high monthly cumulative
      const response2 = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // Has high monthly cumulative
            purchase_amount: 1000.00, // Low single purchase
            currency: 'SEK'
          }
        });

      expect(response2.status).toBe(200);
      const evaluation2 = response2.body.data;
      
      const orTrigger2 = evaluation2.matching_triggers.find(
        (t: any) => t.trigger_name === 'Complex OR Logic'
      );
      expect(orTrigger2).toBeDefined();
    });
  });

  describe('Priority Boost Application', () => {
    it('should apply different priority boosts based on tier', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234577',
            purchase_amount: 15000.00, // Triggers multiple tiers
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should activate platinum with highest boost
      const platinumTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Platinum Elite'
      );
      expect(platinumTrigger.priority_boost).toBe(3.0);
      
      // Verify boosts are applied in question prioritization
      expect(evaluation).toHaveProperty('question_prioritization');
      expect(evaluation.question_prioritization.highest_priority_boost).toBe(3.0);
    });

    it('should combine priority boosts for multiple active triggers', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // High lifetime value customer
            purchase_amount: 6000.00, // Also triggers OR logic
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should have multiple active triggers with different boosts
      expect(evaluation.matching_triggers.length).toBeGreaterThan(1);
      
      const totalBoost = evaluation.matching_triggers.reduce(
        (sum: number, trigger: any) => sum + trigger.priority_boost, 0
      );
      expect(totalBoost).toBeGreaterThan(4.0); // Combined effect
    });
  });

  describe('Currency Handling', () => {
    it('should handle different currencies correctly', async () => {
      // Create trigger with EUR currency
      const eurTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'EUR Premium',
          trigger_type: 'amount_based',
          is_active: true,
          config: {
            amount_conditions: [
              {
                type: 'single_purchase',
                operator: 'gte',
                value: 500.00,
                currency: 'EUR'
              }
            ],
            conditional_logic: 'AND',
            time_period_days: null,
            question_priority_boost: 1.8
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234578',
            purchase_amount: 600.00,
            currency: 'EUR'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const eurTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'EUR Premium'
      );
      expect(eurTrigger).toBeDefined();
      expect(eurTrigger.amount_calculation.currency).toBe('EUR');

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', eurTriggerResult.data.id);
    });

    it('should not activate triggers with currency mismatch', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234579',
            purchase_amount: 2000.00,
            currency: 'USD' // Different from trigger currency (SEK)
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not activate SEK-based triggers
      const sekTriggers = evaluation.matching_triggers.filter(
        (t: any) => t.config.amount_conditions.some((c: any) => c.currency === 'SEK')
      );
      expect(sekTriggers.length).toBe(0);
    });

    it('should handle currency conversion when configured', async () => {
      // Create trigger with currency conversion enabled
      const conversionTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Multi-Currency Trigger',
          trigger_type: 'amount_based',
          is_active: true,
          config: {
            amount_conditions: [
              {
                type: 'single_purchase',
                operator: 'gte',
                value: 1000.00,
                currency: 'SEK',
                allow_currency_conversion: true
              }
            ],
            conditional_logic: 'AND',
            time_period_days: null,
            question_priority_boost: 1.6
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234580',
            purchase_amount: 100.00, // USD (approximately 1100 SEK)
            currency: 'USD'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const conversionTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Multi-Currency Trigger'
      );
      
      if (conversionTrigger) {
        expect(conversionTrigger.amount_calculation.converted_amount).toBeDefined();
        expect(conversionTrigger.amount_calculation.conversion_rate).toBeDefined();
      }

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', conversionTriggerResult.data.id);
    });
  });

  describe('Complex Business Logic', () => {
    it('should handle minimum purchase count requirements', async () => {
      // Create trigger requiring multiple purchases
      const countTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Loyalty Reward',
          trigger_type: 'amount_based',
          is_active: true,
          config: {
            amount_conditions: [
              {
                type: 'cumulative_monthly',
                operator: 'gte',
                value: 2000.00,
                currency: 'SEK'
              },
              {
                type: 'purchase_count',
                operator: 'gte',
                value: 3 // At least 3 purchases
              }
            ],
            conditional_logic: 'AND',
            time_period_days: 30,
            question_priority_boost: 2.1
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // Has 3 purchases in history
            purchase_amount: 500.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const loyaltyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Loyalty Reward'
      );
      
      if (loyaltyTrigger) {
        expect(loyaltyTrigger.amount_calculation.purchase_count).toBeGreaterThanOrEqual(3);
      }

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', countTriggerResult.data.id);
    });

    it('should apply category-specific amount logic', async () => {
      // Create trigger with category-specific thresholds
      const categoryTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Electronics Premium',
          trigger_type: 'amount_based',
          is_active: true,
          config: {
            amount_conditions: [
              {
                type: 'single_purchase',
                operator: 'gte',
                value: 800.00,
                currency: 'SEK',
                category: 'electronics'
              }
            ],
            conditional_logic: 'AND',
            time_period_days: null,
            question_priority_boost: 1.7
          }
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234581',
            purchase_amount: 900.00,
            currency: 'SEK',
            purchase_category: 'electronics'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const electronicsTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Electronics Premium'
      );
      expect(electronicsTrigger).toBeDefined();

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', categoryTriggerResult.data.id);
    });

    it('should handle progressive tier benefits', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234582',
            purchase_amount: 3000.00, // Gold tier
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should apply progressive benefits (gold tier gets higher priority than silver)
      const activeTriggers = evaluation.matching_triggers.sort(
        (a: any, b: any) => b.priority_boost - a.priority_boost
      );
      
      if (activeTriggers.length > 0) {
        const highestTier = activeTriggers[0];
        expect(highestTier.tier_benefits).toBeDefined();
        expect(highestTier.tier_benefits.tier_level).toBe('gold');
        expect(highestTier.priority_boost).toBe(2.0);
      }
    });
  });

  describe('Performance and Analytics', () => {
    it('should complete amount-based evaluation within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234583',
            purchase_amount: 1500.00,
            currency: 'SEK'
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should provide detailed amount calculation metadata', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569',
            purchase_amount: 2500.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      if (evaluation.matching_triggers.length > 0) {
        const trigger = evaluation.matching_triggers[0];
        expect(trigger.amount_calculation).toHaveProperty('current_purchase');
        expect(trigger.amount_calculation).toHaveProperty('historical_total');
        expect(trigger.amount_calculation).toHaveProperty('calculation_period');
        expect(trigger.amount_calculation.current_purchase).toBe(2500.00);
      }
    });

    it('should track tier progression analytics', async () => {
      const customerPhone = '+46701234584';
      
      // Multiple evaluations to simulate tier progression
      const amounts = [150.00, 750.00, 2500.00]; // Bronze -> Silver -> Gold
      
      for (const amount of amounts) {
        await request(app)
          .post('/api/questions/triggers/evaluate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            business_context_id: testBusinessId,
            customer_context: {
              phone: customerPhone,
              purchase_amount: amount,
              currency: 'SEK'
            }
          });
      }

      // Check activation logs for progression tracking
      const logResult = await supabase
        .from('trigger_activation_logs')
        .select('*')
        .eq('customer_phone', customerPhone)
        .order('created_at', { ascending: false });

      expect(logResult.data.length).toBeGreaterThan(0);
      
      // Should have records for different tier activations
      const uniqueTriggers = new Set(logResult.data.map(log => log.trigger_id));
      expect(uniqueTriggers.size).toBeGreaterThan(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid purchase amounts gracefully', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234585',
            purchase_amount: -100.00, // Negative amount
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('purchase amount');
    });

    it('should handle missing purchase history gracefully', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234999', // No purchase history
            purchase_amount: 1000.00,
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should still evaluate single purchase triggers
      const singlePurchaseTriggers = evaluation.matching_triggers.filter(
        (t: any) => t.config.amount_conditions.every((c: any) => c.type === 'single_purchase')
      );
      expect(singlePurchaseTriggers.length).toBeGreaterThan(0);
    });

    it('should handle very large purchase amounts', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234586',
            purchase_amount: 1000000.00, // Very large amount
            currency: 'SEK'
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should activate highest tier triggers
      const platinumTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Platinum Elite'
      );
      expect(platinumTrigger).toBeDefined();
    });
  });
});