/**
 * Integration Tests - Time-Based Question Activation
 * Tests the complete workflow of time-based dynamic triggers
 * 
 * This test suite validates that time-based triggers can:
 * - Activate based on time intervals since last contact
 * - Respect preferred contact hours and timezone settings
 * - Handle recurring trigger schedules
 * - Apply day-of-week and date-based constraints
 * - Optimize timing for maximum customer engagement
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Integration: Time-Based Triggers', () => {
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let authToken: string;

  beforeAll(async () => {
    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'time-trigger-business',
        name: 'Time-Based Trigger Test Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    authToken = 'test-integration-token';

    // Create various time-based triggers
    const triggerData = [
      {
        business_context_id: testBusinessId,
        trigger_name: 'Monthly Check-in',
        trigger_type: 'time_based',
        is_active: true,
        config: {
          days_since_last_contact: 30,
          preferred_contact_hours: [9, 10, 11, 14, 15, 16], // Business hours
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: [0, 6], // No Sunday/Saturday
          max_attempts_per_day: 3
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Weekly Follow-up',
        trigger_type: 'time_based',
        is_active: true,
        config: {
          days_since_last_contact: 7,
          preferred_contact_hours: [12, 13, 17, 18, 19], // Lunch and evening
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: [],
          max_attempts_per_day: 2
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Immediate Follow-up',
        trigger_type: 'time_based',
        is_active: true,
        config: {
          days_since_last_contact: 1,
          preferred_contact_hours: [10, 11, 12, 13, 14, 15, 16, 17],
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: [],
          max_attempts_per_day: 1
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Flexible Schedule',
        trigger_type: 'time_based',
        is_active: true,
        config: {
          days_since_last_contact: 14,
          preferred_contact_hours: [], // Any hour
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: [],
          max_attempts_per_day: 5
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Inactive Time Trigger',
        trigger_type: 'time_based',
        is_active: false,
        config: {
          days_since_last_contact: 3,
          preferred_contact_hours: [9, 10],
          timezone: 'Europe/Stockholm',
          excluded_days_of_week: [],
          max_attempts_per_day: 1
        }
      }
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;

    // Create test customer contact history
    const contactHistoryData = [
      {
        customer_phone: '+46701234567',
        business_context_id: testBusinessId,
        last_contact_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days ago
        contact_count: 3,
        last_successful_contact: true
      },
      {
        customer_phone: '+46701234568',
        business_context_id: testBusinessId,
        last_contact_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        contact_count: 1,
        last_successful_contact: true
      },
      {
        customer_phone: '+46701234569',
        business_context_id: testBusinessId,
        last_contact_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        contact_count: 5,
        last_successful_contact: false
      }
    ];

    await supabase
      .from('customer_contact_history')
      .insert(contactHistoryData);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('trigger_activation_logs')
      .delete()
      .in('trigger_id', testTriggers.map(t => t.id));

    await supabase
      .from('customer_contact_history')
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

  describe('Time Interval-Based Activation', () => {
    it('should activate trigger when time interval has passed', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // 35 days since last contact
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const evaluation = response.body.data;
      expect(evaluation).toHaveProperty('matching_triggers');
      
      // Should match monthly check-in trigger (30-day interval)
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      expect(monthlyTrigger).toBeDefined();
      expect(monthlyTrigger.activation_reason).toContain('time interval met');
    });

    it('should not activate trigger when interval has not passed', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // Only 2 days since last contact
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should not match weekly follow-up (7-day interval)
      const weeklyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Weekly Follow-up'
      );
      expect(weeklyTrigger).toBeUndefined();
    });

    it('should activate multiple triggers with different intervals', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567', // 35 days since last contact
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should match multiple triggers (monthly, weekly, immediate, flexible)
      expect(evaluation.matching_triggers.length).toBeGreaterThanOrEqual(3);
      
      const triggerNames = evaluation.matching_triggers.map((t: any) => t.trigger_name);
      expect(triggerNames).toContain('Monthly Check-in');
      expect(triggerNames).toContain('Weekly Follow-up');
      expect(triggerNames).toContain('Flexible Schedule');
    });
  });

  describe('Preferred Contact Hours', () => {
    it('should respect preferred contact hours in Stockholm timezone', async () => {
      // Test during preferred hours (14:00 Stockholm time)
      const stockholmTime = new Date();
      stockholmTime.setHours(14, 0, 0, 0);
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: stockholmTime.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      expect(monthlyTrigger).toBeDefined();
      expect(monthlyTrigger.timing_metadata.current_hour_preferred).toBe(true);
    });

    it('should not activate during non-preferred hours', async () => {
      // Test during non-preferred hours (22:00 Stockholm time)
      const stockholmTime = new Date();
      stockholmTime.setHours(22, 0, 0, 0);
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: stockholmTime.toISOString(),
            respect_timing_preferences: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should either not match or be marked as timing-delayed
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      
      if (monthlyTrigger) {
        expect(monthlyTrigger.timing_metadata.delayed_for_preferred_hours).toBe(true);
      }
    });

    it('should handle flexible schedule (any hour)', async () => {
      // Test during late hours
      const lateHour = new Date();
      lateHour.setHours(23, 30, 0, 0);
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: lateHour.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Flexible schedule should activate at any hour
      const flexibleTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Flexible Schedule'
      );
      expect(flexibleTrigger).toBeDefined();
      expect(flexibleTrigger.timing_metadata.any_hour_allowed).toBe(true);
    });
  });

  describe('Day-of-Week Exclusions', () => {
    it('should not activate on excluded days (weekends)', async () => {
      // Create a Saturday date
      const saturday = new Date();
      saturday.setDate(saturday.getDate() + (6 - saturday.getDay())); // Next Saturday
      saturday.setHours(10, 0, 0, 0); // During preferred hours
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: saturday.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Monthly trigger excludes weekends
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      
      if (monthlyTrigger) {
        expect(monthlyTrigger.timing_metadata.excluded_day_of_week).toBe(true);
      }
    });

    it('should activate on allowed days', async () => {
      // Create a Wednesday date
      const wednesday = new Date();
      wednesday.setDate(wednesday.getDate() + (3 - wednesday.getDay())); // Next Wednesday
      wednesday.setHours(10, 0, 0, 0); // During preferred hours
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: wednesday.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      expect(monthlyTrigger).toBeDefined();
      expect(monthlyTrigger.timing_metadata.day_of_week_allowed).toBe(true);
    });

    it('should handle triggers with no day exclusions', async () => {
      // Test on Sunday for weekly follow-up (no exclusions)
      const sunday = new Date();
      sunday.setDate(sunday.getDate() + (0 - sunday.getDay())); // Next Sunday
      sunday.setHours(13, 0, 0, 0); // During preferred hours for weekly
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568', // 8 days since last contact
            current_time: sunday.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const weeklyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Weekly Follow-up'
      );
      expect(weeklyTrigger).toBeDefined();
    });
  });

  describe('Timezone Handling', () => {
    it('should correctly apply Stockholm timezone for timing decisions', async () => {
      // Test with UTC time that's different from Stockholm time
      const utcTime = new Date();
      utcTime.setUTCHours(13, 0, 0, 0); // 13:00 UTC = 14:00/15:00 Stockholm (depending on DST)
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: utcTime.toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const monthlyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Monthly Check-in'
      );
      
      if (monthlyTrigger) {
        expect(monthlyTrigger.timing_metadata).toHaveProperty('stockholm_hour');
        expect(monthlyTrigger.timing_metadata.timezone).toBe('Europe/Stockholm');
      }
    });

    it('should handle daylight saving time transitions', async () => {
      // Create a date during DST (summer) and non-DST (winter)
      const summerDate = new Date('2024-07-15T12:00:00Z'); // During DST
      const winterDate = new Date('2024-01-15T12:00:00Z'); // During standard time
      
      // Test summer timing
      const summerResponse = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: summerDate.toISOString()
          }
        });

      expect(summerResponse.status).toBe(200);
      
      // Test winter timing
      const winterResponse = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: winterDate.toISOString()
          }
        });

      expect(winterResponse.status).toBe(200);
      
      // Both should handle timezone correctly
      expect(summerResponse.body.success).toBe(true);
      expect(winterResponse.body.success).toBe(true);
    });
  });

  describe('Daily Attempt Limits', () => {
    it('should respect max attempts per day limit', async () => {
      const customerPhone = '+46701234570';
      
      // Create multiple activation logs for today
      const today = new Date();
      const activationLogs = [
        {
          trigger_id: testTriggers.find(t => t.trigger_name === 'Immediate Follow-up').id,
          customer_phone: customerPhone,
          activated_at: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          activation_reason: 'Time interval met',
          call_completed: true
        }
      ];

      await supabase
        .from('trigger_activation_logs')
        .insert(activationLogs);

      // Try to trigger again (should be limited to 1 attempt per day)
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: customerPhone,
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const immediateTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Immediate Follow-up'
      );
      
      if (immediateTrigger) {
        expect(immediateTrigger.timing_metadata.daily_limit_reached).toBe(true);
      }
    });

    it('should allow triggers within daily limits', async () => {
      const customerPhone = '+46701234571';
      
      // Create one activation log for today (weekly allows 2 per day)
      const weeklyTrigger = testTriggers.find(t => t.trigger_name === 'Weekly Follow-up');
      await supabase
        .from('trigger_activation_logs')
        .insert({
          trigger_id: weeklyTrigger.id,
          customer_phone: customerPhone,
          activated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
          activation_reason: 'Time interval met',
          call_completed: true
        });

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: customerPhone,
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should still allow weekly trigger (under 2 per day limit)
      const weeklyTriggerMatch = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Weekly Follow-up'
      );
      expect(weeklyTriggerMatch).toBeDefined();
    });
  });

  describe('Customer Contact History Integration', () => {
    it('should use actual contact history for time calculations', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568', // Has 8 days since last contact in history
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const weeklyTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Weekly Follow-up'
      );
      expect(weeklyTrigger).toBeDefined();
      expect(weeklyTrigger.contact_history.days_since_last_contact).toBe(8);
    });

    it('should handle customers with no contact history', async () => {
      const newCustomerPhone = '+46701234999';
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: newCustomerPhone, // No history
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should match all triggers for new customers
      expect(evaluation.matching_triggers.length).toBeGreaterThan(0);
      
      evaluation.matching_triggers.forEach((trigger: any) => {
        expect(trigger.contact_history.is_new_customer).toBe(true);
      });
    });

    it('should consider previous contact success/failure', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // Has unsuccessful last contact
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      if (evaluation.matching_triggers.length > 0) {
        const trigger = evaluation.matching_triggers[0];
        expect(trigger.contact_history.last_successful_contact).toBe(false);
        expect(trigger.timing_metadata.retry_strategy).toBeDefined();
      }
    });
  });

  describe('Optimal Timing Recommendations', () => {
    it('should suggest next optimal contact time', async () => {
      // Test during non-preferred hours
      const lateNight = new Date();
      lateNight.setHours(23, 0, 0, 0);
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: lateNight.toISOString(),
            request_timing_optimization: true
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      expect(evaluation).toHaveProperty('timing_recommendations');
      expect(evaluation.timing_recommendations).toHaveProperty('next_optimal_time');
      expect(evaluation.timing_recommendations).toHaveProperty('reason');
    });

    it('should optimize for customer engagement patterns', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: new Date().toISOString(),
            customer_preferences: {
              preferred_contact_time: 'evening',
              timezone: 'Europe/Stockholm'
            }
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      if (evaluation.timing_recommendations) {
        expect(evaluation.timing_recommendations).toHaveProperty('personalized_timing');
        expect(evaluation.timing_recommendations.personalized_timing.considers_customer_preferences).toBe(true);
      }
    });
  });

  describe('Performance and Error Handling', () => {
    it('should complete time-based evaluation within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: new Date().toISOString()
          }
        });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle invalid timezone gracefully', async () => {
      // Create trigger with invalid timezone
      const invalidTriggerResult = await supabase
        .from('dynamic_triggers')
        .insert({
          business_context_id: testBusinessId,
          trigger_name: 'Invalid Timezone Trigger',
          trigger_type: 'time_based',
          is_active: true,
          config: {
            days_since_last_contact: 7,
            preferred_contact_hours: [10, 11],
            timezone: 'Invalid/Timezone',
            excluded_days_of_week: [],
            max_attempts_per_day: 1
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
            phone: '+46701234572',
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      
      // Should handle gracefully, possibly defaulting to UTC
      const evaluation = response.body.data;
      expect(evaluation).toHaveProperty('warnings');

      // Clean up
      await supabase
        .from('dynamic_triggers')
        .delete()
        .eq('id', invalidTriggerResult.data.id);
    });

    it('should handle missing contact history gracefully', async () => {
      // Delete contact history temporarily
      await supabase
        .from('customer_contact_history')
        .delete()
        .eq('customer_phone', '+46701234567');

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234567',
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      // Should treat as new customer
      if (evaluation.matching_triggers.length > 0) {
        expect(evaluation.matching_triggers[0].contact_history.is_new_customer).toBe(true);
      }
    });
  });

  describe('Trigger State and Configuration', () => {
    it('should not activate inactive triggers', async () => {
      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234569', // Has 2 days since contact, but inactive trigger has 3-day interval
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const inactiveTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Inactive Time Trigger'
      );
      expect(inactiveTrigger).toBeUndefined();
    });

    it('should handle configuration updates in real-time', async () => {
      const weeklyTrigger = testTriggers.find(t => t.trigger_name === 'Weekly Follow-up');
      
      // Update configuration
      await supabase
        .from('dynamic_triggers')
        .update({
          config: {
            days_since_last_contact: 5, // Reduced from 7
            preferred_contact_hours: [12, 13, 17, 18, 19],
            timezone: 'Europe/Stockholm',
            excluded_days_of_week: [],
            max_attempts_per_day: 2
          }
        })
        .eq('id', weeklyTrigger.id);

      const response = await request(app)
        .post('/api/questions/triggers/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          business_context_id: testBusinessId,
          customer_context: {
            phone: '+46701234568', // 8 days since last contact
            current_time: new Date().toISOString()
          }
        });

      expect(response.status).toBe(200);
      const evaluation = response.body.data;
      
      const updatedTrigger = evaluation.matching_triggers.find(
        (t: any) => t.trigger_name === 'Weekly Follow-up'
      );
      expect(updatedTrigger).toBeDefined();
      expect(updatedTrigger.config.days_since_last_contact).toBe(5);
    });
  });
});