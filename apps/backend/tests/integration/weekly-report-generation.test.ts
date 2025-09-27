/**
 * Integration test for weekly report generation
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('Weekly Report Generation Integration', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  beforeEach(async () => {
    // Setup test data - would normally seed database with feedback
    // This will be implemented with actual database integration
  });

  afterEach(async () => {
    // Cleanup test data
  });

  test('should generate complete weekly report with AI analysis', async () => {
    // Initiate report generation
    const generateResponse = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send({
        week_number: 38,
        year: 2025,
        force_regenerate: true
      })
      .expect(202);

    const jobId = generateResponse.body.job_id;
    expect(jobId).toBeDefined();

    // Poll job status until completion
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await request(app)
        .get(`/feedback-analysis/status/${jobId}`)
        .set('Authorization', authToken)
        .expect(200);

      if (statusResponse.body.status === 'completed') {
        jobCompleted = true;
        
        // Verify job completion details
        expect(statusResponse.body).toMatchObject({
          job_id: jobId,
          status: 'completed',
          result_url: expect.stringContaining('/feedback-analysis/reports/'),
          processing_time_ms: expect.any(Number),
          completed_at: expect.any(String)
        });

        // Processing should complete within reasonable time
        expect(statusResponse.body.processing_time_ms).toBeLessThan(300000); // 5 minutes max

      } else if (statusResponse.body.status === 'failed') {
        throw new Error(`Report generation failed: ${statusResponse.body.error_message}`);
      }
      
      attempts++;
    }

    expect(jobCompleted).toBe(true);

    // Fetch the generated report
    const reportResponse = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    // Verify complete report structure
    expect(reportResponse.body).toMatchObject({
      id: expect.any(String),
      store_id: testStoreId,
      business_id: expect.any(String),
      week_number: 38,
      year: 2025,
      total_feedback_count: expect.any(Number),
      created_at: expect.any(String),
      updated_at: expect.any(String)
    });

    // Verify AI-generated content
    if (reportResponse.body.total_feedback_count > 0) {
      expect(reportResponse.body.positive_summary).toBeDefined();
      expect(reportResponse.body.negative_summary).toBeDefined();
      expect(reportResponse.body.general_opinions).toBeDefined();
      
      expect(typeof reportResponse.body.positive_summary).toBe('string');
      expect(typeof reportResponse.body.negative_summary).toBe('string');
      expect(typeof reportResponse.body.general_opinions).toBe('string');
      
      // Summaries should be meaningful (not empty or too short)
      expect(reportResponse.body.positive_summary.length).toBeGreaterThan(20);
      expect(reportResponse.body.negative_summary.length).toBeGreaterThan(20);
      expect(reportResponse.body.general_opinions.length).toBeGreaterThan(20);
    }

    // Verify actionable insights
    if (reportResponse.body.actionable_insights) {
      expect(Array.isArray(reportResponse.body.actionable_insights)).toBe(true);
      
      reportResponse.body.actionable_insights.forEach((insight: any) => {
        expect(insight).toMatchObject({
          title: expect.any(String),
          description: expect.any(String),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          department: expect.any(String),
          suggested_actions: expect.any(Array)
        });
      });
    }

    // Verify new critiques identification
    if (reportResponse.body.new_critiques) {
      expect(Array.isArray(reportResponse.body.new_critiques)).toBe(true);
      
      reportResponse.body.new_critiques.forEach((critique: string) => {
        expect(typeof critique).toBe('string');
        expect(critique.length).toBeGreaterThan(5);
      });
    }
  }, 120000); // 2 minute timeout for full integration test

  test('should handle concurrent report generation requests', async () => {
    // Submit multiple concurrent requests
    const concurrentRequests = Array(3).fill(0).map((_, index) =>
      request(app)
        .post(`/feedback-analysis/reports/${testStoreId}/generate`)
        .set('Authorization', authToken)
        .send({
          week_number: 35 + index,
          year: 2025,
          force_regenerate: true
        })
    );

    const responses = await Promise.all(concurrentRequests);

    // All requests should be accepted
    responses.forEach(response => {
      expect(response.status).toBe(202);
      expect(response.body.job_id).toBeDefined();
    });

    // Jobs should be queued appropriately
    const jobIds = responses.map(r => r.body.job_id);
    expect(new Set(jobIds).size).toBe(3); // All job IDs should be unique

    // Check that jobs are processed (basic status check)
    for (const jobId of jobIds) {
      const statusResponse = await request(app)
        .get(`/feedback-analysis/status/${jobId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(['queued', 'processing', 'completed']).toContain(statusResponse.body.status);
    }
  });

  test('should integrate sentiment analysis correctly', async () => {
    // Generate report
    const generateResponse = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send({
        week_number: 39,
        year: 2025,
        force_regenerate: true
      })
      .expect(202);

    const jobId = generateResponse.body.job_id;

    // Wait for completion
    let jobCompleted = false;
    let attempts = 0;

    while (!jobCompleted && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request(app)
        .get(`/feedback-analysis/status/${jobId}`)
        .set('Authorization', authToken);

      if (statusResponse.body.status === 'completed') {
        jobCompleted = true;
      } else if (statusResponse.body.status === 'failed') {
        throw new Error(`Report generation failed: ${statusResponse.body.error_message}`);
      }
      
      attempts++;
    }

    expect(jobCompleted).toBe(true);

    // Fetch report and verify sentiment analysis integration
    const reportResponse = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    if (reportResponse.body.total_feedback_count > 0) {
      // Should have sentiment distribution
      expect(reportResponse.body.sentiment_distribution).toBeDefined();
      
      const sentimentDist = reportResponse.body.sentiment_distribution;
      expect(sentimentDist).toMatchObject({
        positive: expect.any(Number),
        negative: expect.any(Number),
        neutral: expect.any(Number),
        mixed: expect.any(Number)
      });

      // Sentiment counts should sum to total feedback
      const totalSentiment = sentimentDist.positive + sentimentDist.negative + 
                            sentimentDist.neutral + sentimentDist.mixed;
      expect(totalSentiment).toBe(reportResponse.body.total_feedback_count);

      // Should have department-specific sentiment analysis
      if (reportResponse.body.department_breakdown) {
        expect(Array.isArray(reportResponse.body.department_breakdown)).toBe(true);
        
        reportResponse.body.department_breakdown.forEach((dept: any) => {
          expect(dept).toMatchObject({
            department: expect.any(String),
            feedback_count: expect.any(Number),
            sentiment_scores: expect.objectContaining({
              positive: expect.any(Number),
              negative: expect.any(Number),
              neutral: expect.any(Number)
            })
          });
        });
      }
    }
  }, 90000);

  test('should generate meaningful AI insights based on feedback patterns', async () => {
    // Generate report with focus on insights
    const generateResponse = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send({
        week_number: 40,
        year: 2025,
        force_regenerate: true
      })
      .expect(202);

    const jobId = generateResponse.body.job_id;

    // Wait for completion
    let jobCompleted = false;
    let attempts = 0;

    while (!jobCompleted && attempts < 45) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request(app)
        .get(`/feedback-analysis/status/${jobId}`)
        .set('Authorization', authToken);

      if (statusResponse.body.status === 'completed') {
        jobCompleted = true;
      } else if (statusResponse.body.status === 'failed') {
        throw new Error('Report generation failed');
      }
      
      attempts++;
    }

    expect(jobCompleted).toBe(true);

    // Verify AI insights quality
    const reportResponse = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    if (reportResponse.body.actionable_insights && reportResponse.body.actionable_insights.length > 0) {
      const insights = reportResponse.body.actionable_insights;
      
      // Should prioritize critical and high priority insights
      const highPriorityInsights = insights.filter((i: any) => 
        ['critical', 'high'].includes(i.priority)
      );
      
      if (highPriorityInsights.length > 0) {
        // High priority insights should come first
        const firstInsight = insights[0];
        expect(['critical', 'high']).toContain(firstInsight.priority);
      }

      // Insights should have actionable suggestions
      insights.forEach((insight: any) => {
        expect(insight.suggested_actions).toBeDefined();
        expect(Array.isArray(insight.suggested_actions)).toBe(true);
        
        if (insight.suggested_actions.length > 0) {
          insight.suggested_actions.forEach((action: string) => {
            expect(typeof action).toBe('string');
            expect(action.length).toBeGreaterThan(10); // Should be descriptive
          });
        }
      });

      // Should cover multiple departments if feedback exists
      const departments = new Set(insights.map((i: any) => i.department));
      if (departments.size > 1) {
        expect(departments.size).toBeGreaterThan(1);
      }
    }

    // Should identify trending issues
    if (reportResponse.body.new_critiques && reportResponse.body.new_critiques.length > 0) {
      reportResponse.body.new_critiques.forEach((critique: string) => {
        // New critiques should be specific and actionable
        expect(critique.length).toBeGreaterThan(15);
        
        // Should not be generic complaints
        const genericTerms = ['bad', 'good', 'ok', 'fine'];
        const isGeneric = genericTerms.some(term => 
          critique.toLowerCase().includes(term) && critique.length < 30
        );
        expect(isGeneric).toBe(false);
      });
    }
  }, 120000);

  test('should handle insufficient data gracefully', async () => {
    // Try to generate report for period with no data
    const emptyStoreId = 'empty-store-no-data';
    
    const generateResponse = await request(app)
      .post(`/feedback-analysis/reports/${emptyStoreId}/generate`)
      .set('Authorization', authToken)
      .send({
        week_number: 1,
        year: 2025,
        force_regenerate: true
      });

    if (generateResponse.status === 202) {
      // If job is created, it should complete quickly with minimal data
      const jobId = generateResponse.body.job_id;
      
      let jobCompleted = false;
      let attempts = 0;

      while (!jobCompleted && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/feedback-analysis/status/${jobId}`)
          .set('Authorization', authToken);

        if (statusResponse.body.status === 'completed') {
          jobCompleted = true;
          
          // Should complete quickly with no data
          expect(statusResponse.body.processing_time_ms).toBeLessThan(30000);
          
          // Fetch the report
          const reportResponse = await request(app)
            .get(`/feedback-analysis/reports/${emptyStoreId}/current`)
            .set('Authorization', authToken)
            .expect(200);

          // Should have zero feedback count
          expect(reportResponse.body.total_feedback_count).toBe(0);
          
          // Should have appropriate empty state messages
          expect(reportResponse.body.general_opinions).toContain('no feedback');
          
        } else if (statusResponse.body.status === 'failed') {
          // Acceptable to fail with insufficient data
          expect(statusResponse.body.error_message).toContain('insufficient');
        }
        
        attempts++;
      }
    } else if (generateResponse.status === 400) {
      // Acceptable to reject immediately if no data
      expect(generateResponse.body.message).toContain('insufficient');
    }
  });

  test('should validate report data persistence and retrieval', async () => {
    // Generate report
    const generateResponse = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send({
        week_number: 37,
        year: 2025,
        force_regenerate: true
      })
      .expect(202);

    const jobId = generateResponse.body.job_id;

    // Wait for completion
    let jobCompleted = false;
    let attempts = 0;

    while (!jobCompleted && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request(app)
        .get(`/feedback-analysis/status/${jobId}`)
        .set('Authorization', authToken);

      if (statusResponse.body.status === 'completed') {
        jobCompleted = true;
      }
      
      attempts++;
    }

    expect(jobCompleted).toBe(true);

    // Fetch report multiple times to verify consistency
    const reportResponse1 = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    const reportResponse2 = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    // Reports should be identical
    expect(reportResponse1.body.id).toBe(reportResponse2.body.id);
    expect(reportResponse1.body.total_feedback_count).toBe(reportResponse2.body.total_feedback_count);
    expect(reportResponse1.body.positive_summary).toBe(reportResponse2.body.positive_summary);

    // Should be included in historical reports
    const historicalResponse = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(historicalResponse.body)).toBe(true);
    
    const reportFound = historicalResponse.body.some((report: any) => 
      report.id === reportResponse1.body.id
    );
    expect(reportFound).toBe(true);
  }, 90000);
});