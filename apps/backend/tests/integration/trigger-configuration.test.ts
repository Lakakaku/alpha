import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Trigger Configuration Integration Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let testQuestion: any;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;

    // Create a test question for trigger configuration
    const questionData = {
      title: 'Trigger Configuration Test Question',
      question_text: 'This question will have various triggers configured.',
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

    const response = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionData);

    testQuestion = response.body.data.question;
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('User Scenario: Business Manager Configures Advanced Question Triggers', () => {
    it('should configure frequency-based triggers with comprehensive settings', async () => {
      const frequencyTriggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          max_per_week: 25,
          max_per_month: 100,
          cooldown_hours: 4,
          reset_on_new_day: true,
          respect_customer_preferences: true,
          escalation_rules: {
            increase_frequency_on_positive: true,
            decrease_frequency_on_negative: true,
            skip_after_complaint: true
          }
        },
        active: true,
        priority: 1
      };

      const response = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(frequencyTriggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      
      const trigger = response.body.data.trigger;
      expect(trigger).toMatchObject({
        id: expect.any(String),
        question_id: testQuestion.id,
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          max_per_week: 25,
          max_per_month: 100,
          cooldown_hours: 4,
          reset_on_new_day: true,
          respect_customer_preferences: true,
          escalation_rules: {
            increase_frequency_on_positive: true,
            decrease_frequency_on_negative: true,
            skip_after_complaint: true
          }
        },
        active: true,
        priority: 1
      });

      // Verify trigger is applied to question
      const questionResponse = await request(app)
        .get(`/api/questions/${testQuestion.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(questionResponse.body.data.question.triggers).toBeDefined();
      expect(questionResponse.body.data.question.triggers.frequency).toMatchObject({
        max_per_day: 5,
        max_per_week: 25,
        max_per_month: 100
      });
    });

    it('should configure time-based triggers with complex scheduling', async () => {
      const timeTriggerData = {
        type: 'time_condition',
        configuration: {
          time_of_day: ['morning', 'afternoon'],
          day_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          timezone: 'America/New_York',
          exclude_holidays: true,
          seasonal_adjustments: {
            summer_months: ['june', 'july', 'august'],
            winter_months: ['december', 'january', 'february'],
            holiday_periods: ['thanksgiving_week', 'christmas_week']
          },
          special_hours: {
            'monday': ['09:00-11:00', '14:00-16:00'],
            'friday': ['10:00-12:00', '15:00-17:00']
          }
        },
        active: true,
        priority: 2
      };

      const response = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(timeTriggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trigger.configuration).toMatchObject({
        time_of_day: ['morning', 'afternoon'],
        day_of_week: expect.arrayContaining(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
        timezone: 'America/New_York',
        exclude_holidays: true
      });

      // Test trigger evaluation with current time context
      const evaluationResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: {
            current_time: '2025-09-22T10:30:00Z', // Monday morning
            timezone: 'America/New_York',
            is_holiday: false
          }
        })
        .expect(200);

      expect(evaluationResponse.body.data.evaluation.time_condition).toMatchObject({
        passes: true,
        reason: 'Within allowed time window',
        next_opportunity: expect.any(String)
      });
    });

    it('should configure customer-based triggers with segmentation', async () => {
      const customerTriggerData = {
        type: 'customer_condition',
        configuration: {
          customer_segments: ['new_customer', 'vip', 'frequent_visitor'],
          min_purchase_amount: 25.00,
          max_purchase_amount: 500.00,
          visit_frequency: 'weekly',
          loyalty_tiers: ['bronze', 'silver', 'gold', 'platinum'],
          demographic_filters: {
            age_ranges: ['18-25', '26-35', '36-50'],
            preferred_categories: ['coffee', 'food', 'retail']
          },
          behavioral_triggers: {
            first_time_visitor: true,
            returning_after_absence: true,
            high_value_transaction: true,
            multiple_items_purchase: true
          }
        },
        active: true,
        priority: 3
      };

      const response = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(customerTriggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trigger.configuration.customer_segments).toContain('vip');
      expect(response.body.data.trigger.configuration.behavioral_triggers.first_time_visitor).toBe(true);

      // Test trigger evaluation with customer context
      const customerEvaluationResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: {
            customer_profile: {
              segment: 'vip',
              loyalty_tier: 'gold',
              visit_count: 15,
              average_purchase: 45.50,
              preferred_categories: ['coffee', 'food'],
              age_range: '26-35'
            },
            current_transaction: {
              amount: 32.75,
              items: ['coffee', 'pastry'],
              is_first_visit: false
            }
          }
        })
        .expect(200);

      expect(customerEvaluationResponse.body.data.evaluation.customer_condition).toMatchObject({
        passes: true,
        matched_criteria: expect.arrayContaining(['segment_match', 'loyalty_tier_match', 'purchase_amount_range']),
        score: expect.any(Number)
      });
    });

    it('should configure store-based triggers with environmental conditions', async () => {
      const storeTriggerData = {
        type: 'store_condition',
        configuration: {
          store_locations: [storeId],
          occupancy_thresholds: {
            min_customers: 2,
            max_customers: 20,
            optimal_range: [5, 15]
          },
          staff_requirements: {
            min_staff_count: 2,
            required_roles: ['cashier', 'barista'],
            experience_levels: ['intermediate', 'senior']
          },
          environmental_factors: {
            weather_conditions: ['sunny', 'cloudy'],
            temperature_range: [65, 85],
            special_events: ['happy_hour', 'lunch_rush']
          },
          queue_management: {
            max_wait_time_minutes: 5,
            max_queue_length: 8,
            service_speed_threshold: 3.0
          }
        },
        active: true,
        priority: 4
      };

      const response = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeTriggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trigger.configuration.store_locations).toContain(storeId);
      expect(response.body.data.trigger.configuration.occupancy_thresholds.optimal_range).toEqual([5, 15]);

      // Test trigger evaluation with store context
      const storeEvaluationResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: {
            store_status: {
              current_occupancy: 12,
              staff_count: 3,
              staff_roles: ['cashier', 'barista', 'manager'],
              queue_length: 4,
              average_wait_time: 3.5,
              weather: 'sunny',
              temperature: 72,
              active_events: ['afternoon_rush']
            }
          }
        })
        .expect(200);

      expect(storeEvaluationResponse.body.data.evaluation.store_condition).toMatchObject({
        passes: true,
        conditions_met: expect.arrayContaining(['occupancy_optimal', 'staff_adequate', 'queue_manageable']),
        store_score: expect.any(Number)
      });
    });

    it('should configure composite triggers with complex logic', async () => {
      const compositeTriggerData = {
        type: 'composite',
        configuration: {
          operator: 'AND',
          conditions: [
            {
              type: 'frequency',
              weight: 0.3,
              config: {
                max_per_day: 3,
                cooldown_hours: 2
              }
            },
            {
              type: 'time_condition',
              weight: 0.2,
              config: {
                time_of_day: ['afternoon'],
                day_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
              }
            },
            {
              type: 'customer_condition',
              weight: 0.3,
              config: {
                min_purchase_amount: 20.00,
                customer_segments: ['returning_customer']
              }
            },
            {
              type: 'store_condition',
              weight: 0.2,
              config: {
                max_queue_length: 5,
                min_staff_count: 2
              }
            }
          ],
          evaluation_rules: {
            minimum_score: 0.7,
            require_all_conditions: false,
            weighted_scoring: true,
            fallback_behavior: 'skip_question'
          }
        },
        active: true,
        priority: 5
      };

      const response = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(compositeTriggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trigger.configuration.operator).toBe('AND');
      expect(response.body.data.trigger.configuration.conditions).toHaveLength(4);

      // Test composite trigger evaluation
      const compositeEvaluationResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers/evaluate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: {
            comprehensive: {
              time: '2025-09-22T15:30:00Z', // Monday afternoon
              customer: {
                segment: 'returning_customer',
                purchase_amount: 28.50
              },
              store: {
                queue_length: 3,
                staff_count: 3
              },
              frequency_check: {
                questions_today: 1,
                last_question_time: '2025-09-22T12:00:00Z'
              }
            }
          }
        })
        .expect(200);

      expect(compositeEvaluationResponse.body.data.evaluation.composite).toMatchObject({
        overall_score: expect.any(Number),
        passes: expect.any(Boolean),
        condition_scores: expect.any(Array),
        recommendation: expect.any(String)
      });
    });

    it('should handle trigger priority and conflict resolution', async () => {
      // Create additional question for conflict testing
      const conflictQuestionData = {
        title: 'Conflict Test Question',
        question_text: 'Testing trigger conflicts.',
        question_type: 'text',
        category: 'suggestions'
      };

      const conflictQuestionResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictQuestionData)
        .expect(201);

      const conflictQuestionId = conflictQuestionResponse.body.data.question.id;

      // Create high-priority trigger for original question
      const highPriorityTrigger = {
        type: 'frequency',
        configuration: {
          max_per_day: 3,
          cooldown_hours: 1
        },
        active: true,
        priority: 1 // High priority
      };

      await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(highPriorityTrigger)
        .expect(201);

      // Create low-priority trigger for conflict question
      const lowPriorityTrigger = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          cooldown_hours: 2
        },
        active: true,
        priority: 5 // Low priority
      };

      await request(app)
        .post(`/api/questions/${conflictQuestionId}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(lowPriorityTrigger)
        .expect(201);

      // Test trigger resolution with multiple eligible questions
      const resolutionResponse = await request(app)
        .post('/api/questions/triggers/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          context: {
            current_time: new Date().toISOString(),
            customer_id: 'CUST-123',
            store_id: storeId
          },
          max_questions: 1
        })
        .expect(200);

      expect(resolutionResponse.body.success).toBe(true);
      expect(resolutionResponse.body.data.selected_questions).toHaveLength(1);
      
      // Higher priority question should be selected
      const selectedQuestion = resolutionResponse.body.data.selected_questions[0];
      expect(selectedQuestion.priority_score).toBeGreaterThanOrEqual(
        resolutionResponse.body.data.alternative_questions?.[0]?.priority_score || 0
      );
    });

    it('should support trigger testing and validation', async () => {
      // Create triggers for testing
      const testTriggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 2,
          cooldown_hours: 6
        },
        active: true,
        priority: 1
      };

      const triggerResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testTriggerData)
        .expect(201);

      const triggerId = triggerResponse.body.data.trigger.id;

      // Test trigger with various scenarios
      const testScenarios = [
        {
          name: 'Customer within frequency limits',
          context: {
            customer_id: 'CUST-NEW',
            questions_today: 0,
            last_question_time: null
          },
          expectedResult: true
        },
        {
          name: 'Customer at daily limit',
          context: {
            customer_id: 'CUST-LIMIT',
            questions_today: 2,
            last_question_time: '2025-09-22T10:00:00Z'
          },
          expectedResult: false
        },
        {
          name: 'Customer in cooldown period',
          context: {
            customer_id: 'CUST-COOLDOWN',
            questions_today: 1,
            last_question_time: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
          },
          expectedResult: false
        },
        {
          name: 'Customer past cooldown period',
          context: {
            customer_id: 'CUST-READY',
            questions_today: 1,
            last_question_time: new Date(Date.now() - 7 * 3600000).toISOString() // 7 hours ago
          },
          expectedResult: true
        }
      ];

      for (const scenario of testScenarios) {
        const testResponse = await request(app)
          .post(`/api/questions/${testQuestion.id}/triggers/${triggerId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            scenario: scenario.name,
            context: scenario.context
          })
          .expect(200);

        expect(testResponse.body.data.test_result).toMatchObject({
          scenario: scenario.name,
          passes: scenario.expectedResult,
          explanation: expect.any(String),
          evaluation_details: expect.any(Object)
        });
      }
    });

    it('should handle trigger updates and versioning', async () => {
      // Create initial trigger
      const initialTriggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          cooldown_hours: 2
        },
        active: true,
        priority: 1
      };

      const createResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(initialTriggerData)
        .expect(201);

      const triggerId = createResponse.body.data.trigger.id;

      // Update trigger configuration
      const updatedTriggerData = {
        configuration: {
          max_per_day: 3,
          max_per_week: 15,
          cooldown_hours: 4,
          respect_customer_preferences: true
        },
        priority: 2
      };

      const updateResponse = await request(app)
        .put(`/api/questions/${testQuestion.id}/triggers/${triggerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedTriggerData)
        .expect(200);

      expect(updateResponse.body.data.trigger.configuration).toMatchObject({
        max_per_day: 3,
        max_per_week: 15,
        cooldown_hours: 4,
        respect_customer_preferences: true
      });
      expect(updateResponse.body.data.trigger.priority).toBe(2);

      // Verify trigger version history
      const historyResponse = await request(app)
        .get(`/api/questions/${testQuestion.id}/triggers/${triggerId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.data.versions).toHaveLength(2); // Original + updated
      expect(historyResponse.body.data.versions[0].configuration.max_per_day).toBe(5); // Original
      expect(historyResponse.body.data.versions[1].configuration.max_per_day).toBe(3); // Updated
    });

    it('should support trigger analytics and performance monitoring', async () => {
      // Create trigger for analytics testing
      const analyticsTriggerData = {
        type: 'frequency',
        configuration: {
          max_per_day: 10,
          cooldown_hours: 1
        },
        active: true,
        priority: 1
      };

      const triggerResponse = await request(app)
        .post(`/api/questions/${testQuestion.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(analyticsTriggerData)
        .expect(201);

      const triggerId = triggerResponse.body.data.trigger.id;

      // Simulate trigger evaluations and responses
      const simulationPromises = Array.from({ length: 20 }, (_, i) => {
        return request(app)
          .post(`/api/questions/${testQuestion.id}/triggers/evaluate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            context: {
              customer_id: `CUST-${i.toString().padStart(3, '0')}`,
              timestamp: new Date(Date.now() - i * 300000).toISOString() // Spread over 5 minutes each
            }
          });
      });

      await Promise.all(simulationPromises);

      // Get trigger analytics
      const analyticsResponse = await request(app)
        .get(`/api/questions/${testQuestion.id}/triggers/${triggerId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          period: '24h',
          include_performance: true
        })
        .expect(200);

      expect(analyticsResponse.body.data.analytics).toMatchObject({
        trigger_id: triggerId,
        period: '24h',
        total_evaluations: expect.any(Number),
        successful_triggers: expect.any(Number),
        failed_triggers: expect.any(Number),
        success_rate: expect.any(Number),
        average_evaluation_time: expect.any(Number),
        performance_metrics: {
          fastest_evaluation: expect.any(Number),
          slowest_evaluation: expect.any(Number),
          median_evaluation_time: expect.any(Number)
        },
        trigger_reasons: expect.any(Array)
      });

      // Verify performance meets requirements
      expect(analyticsResponse.body.data.analytics.average_evaluation_time).toBeLessThan(50); // < 50ms target
    });
  });
});