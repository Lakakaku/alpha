import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Weekly Business Report Generation (T010)', () => {
  let storeId: string;
  let businessUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create test store and business user
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Reports',
        business_type: 'grocery',
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' }
        }
      })
      .select()
      .single();

    storeId = storeResult.data.id;

    // Create business user account
    const userResult = await supabase.auth.admin.createUser({
      email: 'business-reports@test.com',
      password: 'TestPassword123!',
      email_confirm: true
    });

    businessUserId = userResult.data.user.id;

    // Link user to store
    await supabase
      .from('user_accounts')
      .insert({
        id: businessUserId,
        email: 'business-reports@test.com',
        role: 'business_owner',
        store_id: storeId
      });

    // Get auth token
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'business-reports@test.com',
        password: 'TestPassword123!'
      });

    authToken = authResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('weekly_analysis_reports')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('quality_assessments')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('feedback_call_sessions')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('user_accounts')
      .delete()
      .eq('id', businessUserId);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    await supabase.auth.admin.deleteUser(businessUserId);
  });

  describe('Weekly Report Generation', () => {
    it('should generate comprehensive weekly report with all required sections', async () => {
      // Create test feedback sessions for the week
      const weekStartDate = '2025-09-22'; // Monday
      const callSessions = [];

      for (let day = 0; day < 7; day++) {
        const sessionDate = new Date('2025-09-22');
        sessionDate.setDate(sessionDate.getDate() + day);

        const sessionResult = await supabase
          .from('feedback_call_sessions')
          .insert({
            store_id: storeId,
            customer_phone_number: `+4670123456${day}`,
            status: 'completed',
            call_duration_seconds: 90,
            initiated_at: sessionDate.toISOString(),
            completed_at: new Date(sessionDate.getTime() + 90000).toISOString()
          })
          .select()
          .single();

        callSessions.push(sessionResult.data);

        // Create quality assessment for each session
        await supabase
          .from('quality_assessments')
          .insert({
            call_session_id: sessionResult.data.id,
            store_id: storeId,
            overall_satisfaction: 0.8 + (day * 0.02),
            service_quality: 0.75 + (day * 0.03),
            product_quality: 0.85 + (day * 0.01),
            cleanliness_rating: 0.9 - (day * 0.01),
            staff_helpfulness: 0.8 + (day * 0.02),
            reward_percentage: 8.5 + (day * 0.5),
            is_fraudulent: false,
            feedback_summary: `Day ${day + 1} feedback: Positive experience with ${day % 2 === 0 ? 'meat' : 'produce'} department`,
            positive_highlights: [`Good ${day % 2 === 0 ? 'meat quality' : 'fresh produce'}`],
            improvement_areas: day > 3 ? [`Checkout wait time on day ${day + 1}`] : [],
            business_insights: {
              department_mentions: {
                meat: day % 2 === 0 ? 1 : 0,
                produce: day % 2 === 1 ? 1 : 0
              },
              sentiment_trends: {
                positive_score: 0.8 + (day * 0.02),
                negative_score: 0.1 - (day * 0.01)
              }
            }
          });
      }

      // Test weekly report generation
      const response = await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          analysis_week: weekStartDate,
          analysis_depth: 'comprehensive'
        })
        .expect(202);

      expect(response.body).toHaveProperty('report_id');
      expect(response.body).toHaveProperty('processing_status', 'initiated');

      // Wait for processing and retrieve report
      await new Promise(resolve => setTimeout(resolve, 2000));

      const reportResponse = await request(app)
        .get(`/api/ai/business/reports/${response.body.report_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const report = reportResponse.body;

      // Validate report structure
      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('store_id', storeId);
      expect(report).toHaveProperty('analysis_week', weekStartDate);
      expect(report).toHaveProperty('report_status', 'completed');

      // Validate required sections
      expect(report).toHaveProperty('positive_trends');
      expect(Array.isArray(report.positive_trends)).toBe(true);
      expect(report.positive_trends.length).toBeGreaterThan(0);

      expect(report).toHaveProperty('negative_issues');
      expect(Array.isArray(report.negative_issues)).toBe(true);

      expect(report).toHaveProperty('new_issues');
      expect(Array.isArray(report.new_issues)).toBe(true);

      expect(report).toHaveProperty('department_insights');
      expect(typeof report.department_insights).toBe('object');

      // Validate department insights structure
      expect(report.department_insights).toHaveProperty('meat');
      expect(report.department_insights).toHaveProperty('produce');

      // Validate trend analysis
      expect(report).toHaveProperty('trend_analysis');
      expect(report.trend_analysis).toHaveProperty('satisfaction_trend');
      expect(report.trend_analysis).toHaveProperty('reward_percentage_avg');
      expect(report.trend_analysis.reward_percentage_avg).toBeGreaterThanOrEqual(8.0);
      expect(report.trend_analysis.reward_percentage_avg).toBeLessThanOrEqual(15.0);

      // Validate actionable recommendations
      expect(report).toHaveProperty('actionable_recommendations');
      expect(Array.isArray(report.actionable_recommendations)).toBe(true);
    });

    it('should handle week with no feedback data gracefully', async () => {
      const emptyWeekDate = '2025-09-15'; // Previous week with no data

      const response = await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          analysis_week: emptyWeekDate,
          analysis_depth: 'standard'
        })
        .expect(202);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const reportResponse = await request(app)
        .get(`/api/ai/business/reports/${response.body.report_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const report = reportResponse.body;

      expect(report.report_status).toBe('completed');
      expect(report.positive_trends).toHaveLength(0);
      expect(report.negative_issues).toHaveLength(0);
      expect(report.new_issues).toHaveLength(0);
      expect(report.actionable_recommendations).toContain('No feedback data available for analysis period');
    });

    it('should compare trends with previous weeks when data available', async () => {
      // This test expects the previous test data to exist for comparison
      const currentWeek = '2025-09-29'; // Week after test data
      
      const response = await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          analysis_week: currentWeek,
          analysis_depth: 'comprehensive',
          include_trend_comparison: true
        })
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const reportResponse = await request(app)
        .get(`/api/ai/business/reports/${response.body.report_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const report = reportResponse.body;

      // Should include comparison metrics
      expect(report).toHaveProperty('week_over_week_comparison');
      expect(report.week_over_week_comparison).toHaveProperty('satisfaction_change');
      expect(report.week_over_week_comparison).toHaveProperty('volume_change');
    });
  });

  describe('Report Retrieval and Search', () => {
    it('should list all reports for store with pagination', async () => {
      const response = await request(app)
        .get('/api/ai/business/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          store_id: storeId,
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body).toHaveProperty('reports');
      expect(Array.isArray(response.body.reports)).toBe(true);
      expect(response.body).toHaveProperty('total_count');
      expect(response.body).toHaveProperty('has_more');
    });

    it('should filter reports by date range', async () => {
      const response = await request(app)
        .get('/api/ai/business/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          store_id: storeId,
          start_date: '2025-09-20',
          end_date: '2025-09-30'
        })
        .expect(200);

      expect(response.body.reports).toBeDefined();
      // All reports should be within date range
      response.body.reports.forEach((report: any) => {
        const reportDate = new Date(report.analysis_week);
        expect(reportDate.getTime()).toBeGreaterThanOrEqual(new Date('2025-09-20').getTime());
        expect(reportDate.getTime()).toBeLessThanOrEqual(new Date('2025-09-30').getTime());
      });
    });
  });

  describe('Natural Language Search', () => {
    it('should search feedback by department mentions', async () => {
      const response = await request(app)
        .post('/api/ai/business/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          query: 'meat department feedback',
          time_range: {
            start_date: '2025-09-22',
            end_date: '2025-09-28'
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('search_results');
      expect(response.body).toHaveProperty('total_matches');
      expect(response.body).toHaveProperty('search_summary');

      // Results should contain meat department references
      const results = response.body.search_results;
      expect(results.some((result: any) => 
        result.feedback_content.toLowerCase().includes('meat')
      )).toBe(true);
    });

    it('should provide search suggestions for empty results', async () => {
      const response = await request(app)
        .post('/api/ai/business/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          query: 'nonexistent product category',
          time_range: {
            start_date: '2025-09-22',
            end_date: '2025-09-28'
          }
        })
        .expect(200);

      expect(response.body.search_results).toHaveLength(0);
      expect(response.body).toHaveProperty('search_suggestions');
      expect(Array.isArray(response.body.search_suggestions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .post('/api/ai/business/reports/generate')
        .send({
          store_id: storeId,
          analysis_week: '2025-09-22'
        })
        .expect(401);
    });

    it('should reject requests for unauthorized store', async () => {
      // Create another store that user doesn't have access to
      const otherStoreResult = await supabase
        .from('stores')
        .insert({
          name: 'Unauthorized Store',
          business_type: 'restaurant'
        })
        .select()
        .single();

      await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: otherStoreResult.data.id,
          analysis_week: '2025-09-22'
        })
        .expect(403);

      // Cleanup
      await supabase
        .from('stores')
        .delete()
        .eq('id', otherStoreResult.data.id);
    });

    it('should validate date format for analysis week', async () => {
      await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          store_id: storeId,
          analysis_week: 'invalid-date'
        })
        .expect(400);
    });
  });
});