import request from 'supertest';
import { app } from '../../src/app';

describe('Business Analysis API Contract Tests', () => {
  const validJWT = 'valid-test-jwt';
  const validUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const validDate = '2025-09-22'; // Monday

  beforeEach(() => {
    // These tests MUST fail initially (TDD requirement)
    // They test the contract defined in contracts/business-analysis.yaml
  });

  describe('POST /ai/business-analysis/weekly-reports', () => {
    const validWeeklyReportRequest = {
      store_id: validUUID,
      analysis_week: validDate,
      include_comparisons: true,
      analysis_depth: 'standard',
      custom_focus_areas: ['customer_service', 'product_quality']
    };

    test('should accept valid weekly report generation request', async () => {
      const response = await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validWeeklyReportRequest)
        .expect(202);

      expect(response.body).toMatchObject({
        analysis_job_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        estimated_completion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        status: expect.stringMatching(/^(queued|processing)$/)
      });
    });

    test('should reject request without authentication', async () => {
      await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .send(validWeeklyReportRequest)
        .expect(401);
    });

    test('should reject invalid analysis depth', async () => {
      const invalidRequest = {
        ...validWeeklyReportRequest,
        analysis_depth: 'invalid_depth'
      };

      const response = await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject duplicate analysis for same week', async () => {
      // First request should succeed
      await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validWeeklyReportRequest)
        .expect(202);

      // Second request should fail with 409
      const response = await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validWeeklyReportRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should validate required fields', async () => {
      const incompleteRequest = {
        store_id: validUUID
        // Missing analysis_week
      };

      const response = await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(incompleteRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid focus areas', async () => {
      const invalidRequest = {
        ...validWeeklyReportRequest,
        custom_focus_areas: ['invalid_area']
      };

      const response = await request(app)
        .post('/ai/business-analysis/weekly-reports')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('GET /ai/business-analysis/weekly-reports/{store_id}', () => {
    test('should return list of weekly reports for store', async () => {
      const response = await request(app)
        .get(`/ai/business-analysis/weekly-reports/${validUUID}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .query({ weeks_back: 12, include_summary_only: false })
        .expect(200);

      expect(response.body).toMatchObject({
        reports: expect.arrayContaining([
          expect.objectContaining({
            report_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
            store_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
            analysis_week: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            total_feedback_count: expect.any(Number),
            generated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          })
        ]),
        pagination: expect.objectContaining({
          total_items: expect.any(Number),
          items_per_page: expect.any(Number),
          current_page: expect.any(Number),
          total_pages: expect.any(Number),
          has_next: expect.any(Boolean),
          has_previous: expect.any(Boolean)
        })
      });
    });

    test('should validate weeks_back parameter range', async () => {
      const response = await request(app)
        .get(`/ai/business-analysis/weekly-reports/${validUUID}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .query({ weeks_back: 100 }) // Above max 52
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid UUID format', async () => {
      await request(app)
        .get('/ai/business-analysis/weekly-reports/invalid-uuid')
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(400);
    });
  });

  describe('GET /ai/business-analysis/weekly-reports/{store_id}/{analysis_week}', () => {
    test('should return specific weekly report', async () => {
      const response = await request(app)
        .get(`/ai/business-analysis/weekly-reports/${validUUID}/${validDate}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(200);

      expect(response.body).toMatchObject({
        report_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        store_id: validUUID,
        analysis_week: validDate,
        total_feedback_count: expect.any(Number),
        generated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });

      expect(response.body.total_feedback_count).toBeGreaterThanOrEqual(0);

      if (response.body.average_quality_score !== null) {
        expect(response.body.average_quality_score).toBeGreaterThanOrEqual(0);
        expect(response.body.average_quality_score).toBeLessThanOrEqual(1);
      }

      // Validate trend structure if present
      if (response.body.positive_trends) {
        expect(response.body.positive_trends).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              category: expect.stringMatching(/^(customer_service|product_quality|store_environment|pricing|accessibility)$/),
              description: expect.any(String),
              trend_strength: expect.stringMatching(/^(weak|moderate|strong|very_strong)$/),
              supporting_feedback_count: expect.any(Number),
              confidence_level: expect.any(Number)
            })
          ])
        );
      }

      // Validate issue structure if present
      if (response.body.negative_issues) {
        expect(response.body.negative_issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              category: expect.stringMatching(/^(customer_service|product_quality|store_environment|pricing|accessibility)$/),
              description: expect.any(String),
              severity: expect.stringMatching(/^(minor|moderate|serious|critical)$/),
              frequency: expect.any(Number),
              impact_assessment: expect.stringMatching(/^(low|medium|high|very_high)$/)
            })
          ])
        );
      }

      // Validate recommendations if present
      if (response.body.actionable_recommendations) {
        expect(response.body.actionable_recommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              recommendation_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
              category: expect.stringMatching(/^(product|service|environment|staff|pricing|accessibility)$/),
              title: expect.any(String),
              description: expect.any(String),
              priority: expect.stringMatching(/^(low|medium|high|urgent)$/)
            })
          ])
        );
      }
    });

    test('should return 404 for non-existent report', async () => {
      const nonExistentDate = '2020-01-01';
      
      const response = await request(app)
        .get(`/ai/business-analysis/weekly-reports/${validUUID}/${nonExistentDate}`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('POST /ai/business-analysis/search', () => {
    const validSearchRequest = {
      store_id: validUUID,
      query: 'meat section opinions',
      time_range: {
        start_date: '2025-09-01',
        end_date: '2025-09-28'
      },
      search_scope: ['feedback_summaries', 'weekly_reports'],
      max_results: 20
    };

    test('should return search results for natural language query', async () => {
      const response = await request(app)
        .post('/ai/business-analysis/search')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validSearchRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            result_type: expect.stringMatching(/^(feedback_summary|weekly_report|actionable_item|trend)$/),
            result_id: expect.any(String),
            title: expect.any(String),
            content_excerpt: expect.any(String),
            relevance_score: expect.any(Number),
            source_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
          })
        ]),
        total_matches: expect.any(Number),
        search_metadata: expect.objectContaining({
          query_interpretation: expect.any(String),
          search_time_ms: expect.any(Number),
          relevance_threshold: expect.any(Number)
        })
      });

      // Validate relevance scores
      response.body.results.forEach((result: any) => {
        expect(result.relevance_score).toBeGreaterThanOrEqual(0);
        expect(result.relevance_score).toBeLessThanOrEqual(1);
        expect(result.content_excerpt.length).toBeLessThanOrEqual(300);
      });
    });

    test('should reject query that is too long', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        query: 'a'.repeat(501) // Exceeds 500 char limit
      };

      const response = await request(app)
        .post('/ai/business-analysis/search')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid search scope', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        search_scope: ['invalid_scope']
      };

      const response = await request(app)
        .post('/ai/business-analysis/search')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should validate max_results range', async () => {
      const invalidRequest = {
        ...validSearchRequest,
        max_results: 150 // Above max 100
      };

      const response = await request(app)
        .post('/ai/business-analysis/search')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('GET /ai/business-analysis/insights/trends', () => {
    test('should return trend analysis with predictions', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/insights/trends')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          store_id: validUUID,
          trend_period: '8_weeks',
          trend_types: ['positive_trends', 'negative_trends', 'emerging_issues'],
          include_predictions: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        trend_analysis: expect.objectContaining({
          positive_trends: expect.any(Array),
          negative_trends: expect.any(Array),
          emerging_issues: expect.any(Array),
          improvement_opportunities: expect.any(Array)
        }),
        analysis_period: expect.objectContaining({
          start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          weeks_analyzed: expect.any(Number)
        })
      });

      if (response.body.predictive_insights) {
        expect(response.body.predictive_insights).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              insight_type: expect.stringMatching(/^(opportunity|risk|trend_continuation|seasonal_prediction)$/),
              description: expect.any(String),
              confidence_level: expect.any(Number),
              time_horizon: expect.stringMatching(/^(next_week|next_month|next_quarter)$/),
              potential_impact: expect.stringMatching(/^(low|medium|high|very_high)$/)
            })
          ])
        );

        response.body.predictive_insights.forEach((insight: any) => {
          expect(insight.confidence_level).toBeGreaterThanOrEqual(0);
          expect(insight.confidence_level).toBeLessThanOrEqual(1);
          expect(insight.description.length).toBeLessThanOrEqual(400);
        });
      }
    });

    test('should validate trend period options', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/insights/trends')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          store_id: validUUID,
          trend_period: 'invalid_period'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should require store_id parameter', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/insights/trends')
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('GET /ai/business-analysis/recommendations', () => {
    test('should return filtered actionable recommendations', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/recommendations')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          store_id: validUUID,
          priority_filter: ['high', 'urgent'],
          category_filter: ['service', 'environment'],
          implementation_complexity: ['simple', 'moderate'],
          max_recommendations: 20
        })
        .expect(200);

      expect(response.body).toMatchObject({
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            recommendation_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
            category: expect.stringMatching(/^(product|service|environment|staff|pricing|accessibility)$/),
            title: expect.any(String),
            description: expect.any(String),
            priority: expect.stringMatching(/^(low|medium|high|urgent)$/),
            implementation_complexity: expect.stringMatching(/^(simple|moderate|complex)$/),
            estimated_impact: expect.stringMatching(/^(minor|moderate|significant|major)$/),
            timeline_estimate: expect.stringMatching(/^(immediate|days|weeks|months)$/)
          })
        ]),
        summary_stats: expect.objectContaining({
          total_recommendations: expect.any(Number),
          by_priority: expect.any(Object),
          by_category: expect.any(Object),
          estimated_impact_score: expect.any(Number)
        })
      });

      // Validate impact score range
      expect(response.body.summary_stats.estimated_impact_score).toBeGreaterThanOrEqual(0);
      expect(response.body.summary_stats.estimated_impact_score).toBeLessThanOrEqual(10);

      // Validate field lengths
      response.body.recommendations.forEach((rec: any) => {
        expect(rec.title.length).toBeLessThanOrEqual(100);
        expect(rec.description.length).toBeLessThanOrEqual(500);
      });
    });

    test('should validate max_recommendations range', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/recommendations')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          store_id: validUUID,
          max_recommendations: 100 // Above max 50
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid priority filter', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/recommendations')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          store_id: validUUID,
          priority_filter: ['invalid_priority']
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should require store_id parameter', async () => {
      const response = await request(app)
        .get('/ai/business-analysis/recommendations')
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });
});

// Helper function for Jest custom matchers
expect.extend({
  toBeOneOf(received: any, validOptions: any[]) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});