import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Frequency Management Integration Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let testQuestions: any[] = [];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;

    // Create multiple test questions with different frequency settings
    const questionTemplates = [
      {
        title: 'High Frequency Question',
        question_text: 'Quick satisfaction check.',
        question_type: 'scale',
        category: 'service_quality',
        frequency: { max_per_day: 10, cooldown_hours: 1 }
      },
      {
        title: 'Medium Frequency Question',
        question_text: 'Product feedback request.',
        question_type: 'multiple_choice',
        category: 'product_feedback',
        frequency: { max_per_day: 5, cooldown_hours: 4 }
      },
      {
        title: 'Low Frequency Question',
        question_text: 'Detailed experience survey.',
        question_type: 'text',
        category: 'store_experience',
        frequency: { max_per_day: 2, cooldown_hours: 8 }
      }
    ];

    for (const template of questionTemplates) {
      const questionData = {
        title: template.title,
        question_text: template.question_text,
        question_type: template.question_type,
        category: template.category,
        options: template.question_type === 'scale' ? [
          { text: '1', value: 1 },
          { text: '2', value: 2 },
          { text: '3', value: 3 },
          { text: '4', value: 4 },
          { text: '5', value: 5 }
        ] : template.question_type === 'multiple_choice' ? [
          { text: 'Option A', value: 'a' },
          { text: 'Option B', value: 'b' },
          { text: 'Option C', value: 'c' }
        ] : undefined
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      const question = response.body.data.question;

      // Add frequency trigger
      const triggerData = {
        type: 'frequency',
        configuration: template.frequency,
        active: true,
        priority: testQuestions.length + 1
      };

      await request(app)
        .post(`/api/questions/${question.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData);

      // Activate question
      await request(app)
        .post(`/api/questions/${question.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`);

      testQuestions.push({
        ...question,
        frequency: template.frequency
      });
    }
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('User Scenario: Advanced Frequency Management and Customer Experience Optimization', () => {
    it('should manage daily frequency limits across multiple questions', async () => {
      const customerId = 'FREQ-TEST-001';
      const testDate = '2025-09-22';

      // Simulate customer visiting and triggering questions throughout the day
      const visitScenarios = [
        {
          time: '09:00:00',
          expectedQuestions: 3, // All questions available
          purchaseAmount: 15.50
        },
        {
          time: '11:30:00',
          expectedQuestions: 3, // Still within limits
          purchaseAmount: 8.25
        },
        {
          time: '13:15:00',
          expectedQuestions: 2, // High frequency question at limit
          purchaseAmount: 22.75
        },
        {
          time: '15:45:00',
          expectedQuestions: 1, // Only low frequency question available
          purchaseAmount: 35.00
        },
        {
          time: '18:20:00',
          expectedQuestions: 0, // All questions at daily limits
          purchaseAmount: 12.50
        }
      ];

      for (const scenario of visitScenarios) {
        const timestamp = `${testDate}T${scenario.time}Z`;
        
        // Get available questions for customer at this time
        const availableResponse = await request(app)
          .post('/api/questions/frequency/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            customer_id: customerId,
            timestamp: timestamp,
            context: {
              store_id: storeId,
              purchase_amount: scenario.purchaseAmount
            }
          })
          .expect(200);

        expect(availableResponse.body.data.available_questions).toHaveLength(scenario.expectedQuestions);

        // If questions are available, simulate asking them
        if (scenario.expectedQuestions > 0) {
          const questionsToAsk = availableResponse.body.data.available_questions.slice(0, 1); // Ask one question
          
          for (const questionCheck of questionsToAsk) {
            // Record question being asked
            await request(app)
              .post('/api/questions/frequency/record')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                question_id: questionCheck.question_id,
                customer_id: customerId,
                timestamp: timestamp,
                context: {
                  store_id: storeId,
                  purchase_amount: scenario.purchaseAmount
                }
              })
              .expect(201);
          }
        }

        // Verify frequency counters are updated
        const counterResponse = await request(app)
          .get(`/api/questions/frequency/counters/${customerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ date: testDate })
          .expect(200);

        expect(counterResponse.body.data.counters).toMatchObject({
          customer_id: customerId,
          date: testDate,
          daily_totals: expect.any(Object),
          question_specific: expect.any(Object)
        });
      }
    });

    it('should handle cooldown periods with atomic precision', async () => {
      const customerId = 'COOLDOWN-TEST-001';
      const highFreqQuestion = testQuestions.find(q => q.frequency.cooldown_hours === 1);
      
      // Record first question
      const firstTimestamp = '2025-09-22T10:00:00Z';
      await request(app)
        .post('/api/questions/frequency/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question_id: highFreqQuestion.id,
          customer_id: customerId,
          timestamp: firstTimestamp
        })
        .expect(201);

      // Test cooldown periods at various intervals
      const cooldownTests = [
        {
          time: '2025-09-22T10:30:00Z', // 30 minutes later
          shouldBeAvailable: false,
          reason: 'Still in cooldown period'
        },
        {
          time: '2025-09-22T10:59:00Z', // 59 minutes later
          shouldBeAvailable: false,
          reason: 'Just under cooldown threshold'
        },
        {
          time: '2025-09-22T11:00:00Z', // Exactly 1 hour later
          shouldBeAvailable: true,
          reason: 'Cooldown period complete'
        },
        {
          time: '2025-09-22T11:15:00Z', // 75 minutes later
          shouldBeAvailable: true,
          reason: 'Well past cooldown period'
        }
      ];

      for (const test of cooldownTests) {
        const checkResponse = await request(app)
          .post('/api/questions/frequency/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            customer_id: customerId,
            timestamp: test.time,
            question_ids: [highFreqQuestion.id]
          })
          .expect(200);

        const questionCheck = checkResponse.body.data.available_questions.find(
          q => q.question_id === highFreqQuestion.id
        );

        if (test.shouldBeAvailable) {
          expect(questionCheck).toBeDefined();
          expect(questionCheck.status).toBe('available');
        } else {
          expect(questionCheck).toBeUndefined();
          
          // Check blocked questions for details
          const blockedQuestion = checkResponse.body.data.blocked_questions.find(
            q => q.question_id === highFreqQuestion.id
          );
          expect(blockedQuestion).toBeDefined();
          expect(blockedQuestion.reason).toContain('cooldown');
        }
      }
    });

    it('should support frequency management across weekly and monthly periods', async () => {
      const customerId = 'PERIOD-TEST-001';
      const testQuestion = testQuestions[0];

      // Configure question with weekly and monthly limits
      const weeklyMonthlyTrigger = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          max_per_week: 20,
          max_per_month: 60,
          cooldown_hours: 2,
          period_reset_times: {
            week_start: 'monday',
            month_start: 1
          }
        },
        active: true,
        priority: 1
      };

      await request(app)
        .put(`/api/questions/${testQuestion.id}/triggers/frequency`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(weeklyMonthlyTrigger)
        .expect(200);

      // Simulate questions over multiple weeks
      const weeklyTestScenarios = [
        {
          week: 1,
          days: 7,
          questionsPerDay: 3,
          expectedTotal: 21,
          shouldHitWeeklyLimit: true
        },
        {
          week: 2,
          days: 5,
          questionsPerDay: 4,
          expectedTotal: 20,
          shouldHitWeeklyLimit: true
        },
        {
          week: 3,
          days: 3,
          questionsPerDay: 5,
          expectedTotal: 15,
          shouldHitWeeklyLimit: false
        }
      ];

      let monthlyTotal = 0;

      for (const scenario of weeklyTestScenarios) {
        const weekStartDate = new Date('2025-09-01');
        weekStartDate.setDate(weekStartDate.getDate() + (scenario.week - 1) * 7);

        for (let day = 0; day < scenario.days; day++) {
          const currentDate = new Date(weekStartDate);
          currentDate.setDate(currentDate.getDate() + day);
          
          for (let question = 0; question < scenario.questionsPerDay; question++) {
            const timestamp = new Date(currentDate);
            timestamp.setHours(9 + question * 2); // Spread throughout day
            
            const recordResponse = await request(app)
              .post('/api/questions/frequency/record')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                question_id: testQuestion.id,
                customer_id: customerId,
                timestamp: timestamp.toISOString()
              });

            if (monthlyTotal < 60 && (question * day + question) < 20) {
              expect(recordResponse.status).toBe(201);
              monthlyTotal++;
            } else {
              expect(recordResponse.status).toBe(429); // Too many requests
            }
          }
        }

        // Check weekly summary
        const weeklySummaryResponse = await request(app)
          .get(`/api/questions/frequency/summary/${customerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            period: 'week',
            week_start: weekStartDate.toISOString().split('T')[0]
          })
          .expect(200);

        const weeklyData = weeklySummaryResponse.body.data.summary;
        expect(weeklyData.period).toBe('week');
        expect(weeklyData.total_questions).toBeLessThanOrEqual(20); // Weekly limit
      }

      // Check monthly summary
      const monthlySummaryResponse = await request(app)
        .get(`/api/questions/frequency/summary/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          period: 'month',
          month: '2025-09'
        })
        .expect(200);

      expect(monthlySummaryResponse.body.data.summary.total_questions).toBeLessThanOrEqual(60);
    });

    it('should optimize frequency based on customer feedback patterns', async () => {
      const customerId = 'OPTIMIZATION-TEST-001';
      const testQuestion = testQuestions.find(q => q.question_type === 'scale');

      // Configure adaptive frequency trigger
      const adaptiveTrigger = {
        type: 'frequency',
        configuration: {
          max_per_day: 5,
          cooldown_hours: 4,
          adaptive_behavior: {
            increase_on_positive: true,
            decrease_on_negative: true,
            skip_after_complaint: true,
            satisfaction_threshold: 4
          },
          optimization_rules: {
            min_frequency: 1,
            max_frequency: 10,
            adjustment_factor: 0.2
          }
        },
        active: true,
        priority: 1
      };

      await request(app)
        .put(`/api/questions/${testQuestion.id}/triggers/frequency`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(adaptiveTrigger)
        .expect(200);

      // Simulate feedback patterns
      const feedbackScenarios = [
        {
          rating: 5,
          timestamp: '2025-09-22T10:00:00Z',
          expectedFrequencyChange: 'increase'
        },
        {
          rating: 5,
          timestamp: '2025-09-22T14:00:00Z',
          expectedFrequencyChange: 'increase'
        },
        {
          rating: 2,
          timestamp: '2025-09-22T16:00:00Z',
          expectedFrequencyChange: 'decrease'
        },
        {
          rating: 1,
          timestamp: '2025-09-22T18:00:00Z',
          expectedFrequencyChange: 'pause'
        }
      ];

      for (const scenario of feedbackScenarios) {
        // Record question and response
        await request(app)
          .post('/api/questions/frequency/record')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            question_id: testQuestion.id,
            customer_id: customerId,
            timestamp: scenario.timestamp,
            response: {
              value: scenario.rating,
              type: 'scale'
            }
          })
          .expect(201);

        // Check frequency adjustment
        const frequencyResponse = await request(app)
          .get(`/api/questions/frequency/profile/${customerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const questionProfile = frequencyResponse.body.data.profile.questions[testQuestion.id];
        expect(questionProfile).toBeDefined();
        expect(questionProfile.adaptive_adjustments).toBeDefined();

        if (scenario.expectedFrequencyChange === 'increase') {
          expect(questionProfile.current_frequency).toBeGreaterThan(questionProfile.base_frequency);
        } else if (scenario.expectedFrequencyChange === 'decrease') {
          expect(questionProfile.current_frequency).toBeLessThan(questionProfile.base_frequency);
        } else if (scenario.expectedFrequencyChange === 'pause') {
          expect(questionProfile.status).toBe('paused');
          expect(questionProfile.pause_reason).toContain('negative_feedback');
        }
      }
    });

    it('should handle frequency management at scale with performance requirements', async () => {
      const customerIds = Array.from({ length: 100 }, (_, i) => `SCALE-TEST-${i.toString().padStart(3, '0')}`);
      const questionId = testQuestions[0].id;

      // Simulate concurrent frequency checks
      const concurrentChecks = customerIds.map(customerId => {
        return request(app)
          .post('/api/questions/frequency/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            customer_id: customerId,
            timestamp: new Date().toISOString(),
            question_ids: [questionId]
          });
      });

      const startTime = Date.now();
      const responses = await Promise.all(concurrentChecks);
      const endTime = Date.now();

      // Verify all requests completed successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify performance requirements
      const totalDuration = endTime - startTime;
      const averageRequestTime = totalDuration / customerIds.length;
      
      expect(averageRequestTime).toBeLessThan(10); // < 10ms per request target
      expect(totalDuration).toBeLessThan(1000); // < 1 second total for 100 concurrent requests

      // Simulate concurrent frequency recording
      const concurrentRecords = customerIds.slice(0, 50).map(customerId => {
        return request(app)
          .post('/api/questions/frequency/record')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            question_id: questionId,
            customer_id: customerId,
            timestamp: new Date().toISOString()
          });
      });

      const recordStartTime = Date.now();
      const recordResponses = await Promise.all(concurrentRecords);
      const recordEndTime = Date.now();

      // Verify atomic operations
      recordResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify counter update performance
      const recordDuration = recordEndTime - recordStartTime;
      expect(recordDuration).toBeLessThan(500); // < 500ms for 50 atomic updates
    });

    it('should provide comprehensive frequency analytics and insights', async () => {
      const analyticsCustomerId = 'ANALYTICS-TEST-001';
      const questionId = testQuestions[0].id;

      // Generate frequency data over multiple days
      const days = 7;
      const questionsPerDay = 3;

      for (let day = 0; day < days; day++) {
        const date = new Date('2025-09-15');
        date.setDate(date.getDate() + day);

        for (let q = 0; q < questionsPerDay; q++) {
          const timestamp = new Date(date);
          timestamp.setHours(10 + q * 3); // Spread throughout day

          await request(app)
            .post('/api/questions/frequency/record')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              question_id: questionId,
              customer_id: analyticsCustomerId,
              timestamp: timestamp.toISOString(),
              response: {
                value: Math.floor(Math.random() * 5) + 1,
                type: 'scale'
              }
            });
        }
      }

      // Get comprehensive analytics
      const analyticsResponse = await request(app)
        .get(`/api/questions/frequency/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          question_id: questionId,
          period: '7d',
          include_trends: true,
          include_patterns: true
        })
        .expect(200);

      expect(analyticsResponse.body.data.analytics).toMatchObject({
        question_id: questionId,
        period: '7d',
        total_customers: expect.any(Number),
        total_questions_asked: expect.any(Number),
        average_frequency_per_customer: expect.any(Number),
        frequency_distribution: expect.any(Object),
        temporal_patterns: {
          hourly_distribution: expect.any(Array),
          daily_patterns: expect.any(Array),
          peak_hours: expect.any(Array)
        },
        customer_segments: {
          high_frequency: expect.any(Number),
          medium_frequency: expect.any(Number),
          low_frequency: expect.any(Number)
        },
        optimization_opportunities: expect.any(Array),
        performance_metrics: {
          average_response_rate: expect.any(Number),
          satisfaction_correlation: expect.any(Number),
          frequency_effectiveness: expect.any(Number)
        }
      });

      // Get customer-specific analytics
      const customerAnalyticsResponse = await request(app)
        .get(`/api/questions/frequency/analytics/${analyticsCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          period: '7d',
          include_recommendations: true
        })
        .expect(200);

      expect(customerAnalyticsResponse.body.data.customer_analytics).toMatchObject({
        customer_id: analyticsCustomerId,
        period: '7d',
        total_questions: questionsPerDay * days,
        average_daily_questions: questionsPerDay,
        response_patterns: expect.any(Object),
        satisfaction_trends: expect.any(Array),
        frequency_preferences: expect.any(Object),
        recommendations: expect.any(Array)
      });
    });

    it('should handle frequency reset and cleanup operations', async () => {
      const cleanupCustomerId = 'CLEANUP-TEST-001';
      const questionId = testQuestions[0].id;

      // Generate historical frequency data
      const historicalDates = [
        '2025-08-01', '2025-08-15', '2025-09-01', '2025-09-15', '2025-09-21'
      ];

      for (const date of historicalDates) {
        await request(app)
          .post('/api/questions/frequency/record')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            question_id: questionId,
            customer_id: cleanupCustomerId,
            timestamp: `${date}T12:00:00Z`
          });
      }

      // Test frequency reset for specific period
      const resetResponse = await request(app)
        .post('/api/questions/frequency/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: cleanupCustomerId,
          question_id: questionId,
          reset_period: 'month',
          target_month: '2025-09'
        })
        .expect(200);

      expect(resetResponse.body.data.reset_summary).toMatchObject({
        customer_id: cleanupCustomerId,
        question_id: questionId,
        period_reset: 'month',
        records_affected: expect.any(Number),
        counters_reset: expect.any(Number)
      });

      // Verify reset was applied
      const postResetSummary = await request(app)
        .get(`/api/questions/frequency/summary/${cleanupCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          period: 'month',
          month: '2025-09'
        })
        .expect(200);

      expect(postResetSummary.body.data.summary.total_questions).toBe(0);

      // Test cleanup of old frequency data
      const cleanupResponse = await request(app)
        .post('/api/questions/frequency/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          retention_days: 30,
          dry_run: false
        })
        .expect(200);

      expect(cleanupResponse.body.data.cleanup_summary).toMatchObject({
        records_removed: expect.any(Number),
        storage_freed: expect.any(String),
        oldest_remaining_record: expect.any(String)
      });
    });
  });
});