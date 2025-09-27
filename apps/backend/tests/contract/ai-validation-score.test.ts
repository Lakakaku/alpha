/**
 * Contract Test: GET /ai-assistant/validation/score
 * Test ID: T015
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for calculating context validation scores.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { ValidationScoreRequest } from '@vocilia/types';

describe('GET /ai-assistant/validation/score', () => {
  const endpoint = '/api/ai-assistant/validation/score';
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should return business-level validation score', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: null,
        conversation_id: null,
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        missing_requirements: expect.arrayContaining([]),
        improvement_suggestions: expect.arrayContaining([]),
        fraud_readiness_score: expect.any(Number),
        validation_version: expect.any(String),
        created_at: expect.any(String)
      });

      // Validate score ranges
      expect(response.body.overall_score).toBeGreaterThanOrEqual(0);
      expect(response.body.overall_score).toBeLessThanOrEqual(100);
      
      if (response.body.fraud_readiness_score !== null) {
        expect(response.body.fraud_readiness_score).toBeGreaterThanOrEqual(0);
        expect(response.body.fraud_readiness_score).toBeLessThanOrEqual(100);
      }

      // Validate category scores structure
      const categoryScores = response.body.category_scores;
      expect(categoryScores).toMatchObject({
        store_profile: expect.any(Number),
        personnel: expect.any(Number),
        layout: expect.any(Number),
        inventory: expect.any(Number),
        operations: expect.any(Number),
        customer_journey: expect.any(Number),
        fraud_detection: expect.any(Number),
        seasonal_variations: expect.any(Number)
      });

      // All category scores should be 0-100
      Object.values(categoryScores).forEach((score: any) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      // Validate missing requirements structure
      if (response.body.missing_requirements.length > 0) {
        const requirement = response.body.missing_requirements[0];
        expect(requirement).toMatchObject({
          category: expect.any(String),
          field: expect.any(String),
          importance: expect.stringMatching(/^(required|recommended|optional)$/),
          description: expect.any(String)
        });
      }

      // Validate improvement suggestions structure
      if (response.body.improvement_suggestions.length > 0) {
        const suggestion = response.body.improvement_suggestions[0];
        expect(suggestion).toMatchObject({
          action: expect.any(String),
          description: expect.any(String),
          impact: expect.any(Number)
        });

        expect(suggestion.impact).toBeGreaterThanOrEqual(0);
        expect(suggestion.impact).toBeLessThanOrEqual(100);
      }

      // Validate ISO date format
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);
    });

    it('should return store-specific validation score', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ store_id: storeId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: storeId,
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        created_at: expect.any(String)
      });

      expect(response.body.overall_score).toBeGreaterThanOrEqual(0);
      expect(response.body.overall_score).toBeLessThanOrEqual(100);
    });

    it('should include fraud analysis when requested', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ include_fraud_analysis: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        fraud_readiness_score: expect.any(Number),
        fraud_analysis: expect.any(Object)
      });

      expect(response.body.fraud_readiness_score).toBeGreaterThanOrEqual(0);
      expect(response.body.fraud_readiness_score).toBeLessThanOrEqual(100);

      // Validate fraud analysis structure
      expect(response.body.fraud_analysis).toMatchObject({
        detection_capabilities: expect.any(Array),
        risk_coverage: expect.any(Object),
        recommended_thresholds: expect.any(Object),
        weak_points: expect.any(Array)
      });

      // Validate detection capabilities
      if (response.body.fraud_analysis.detection_capabilities.length > 0) {
        const capability = response.body.fraud_analysis.detection_capabilities[0];
        expect(capability).toMatchObject({
          type: expect.any(String),
          coverage: expect.any(Number),
          confidence: expect.any(Number)
        });
      }

      // Validate risk coverage
      const riskCoverage = response.body.fraud_analysis.risk_coverage;
      expect(riskCoverage).toMatchObject({
        transaction_patterns: expect.any(Number),
        customer_behavior: expect.any(Number),
        temporal_analysis: expect.any(Number),
        value_thresholds: expect.any(Number)
      });
    });

    it('should support custom validation rules', async () => {
      const customRules = {
        minimum_staff_info: true,
        require_peak_hours: true,
        fraud_threshold_strictness: 'high'
      };

      const response = await request(app)
        .get(endpoint)
        .query({ 
          validation_rules: JSON.stringify(customRules)
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        validation_rules_applied: expect.any(Object)
      });

      // Should include information about applied custom rules
      expect(response.body.validation_rules_applied).toMatchObject({
        minimum_staff_info: true,
        require_peak_hours: true,
        fraud_threshold_strictness: 'high'
      });
    });

    it('should provide detailed category breakdowns', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ detailed: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        category_details: expect.any(Object)
      });

      // Validate detailed category information
      const categoryDetails = response.body.category_details;
      expect(categoryDetails.store_profile).toMatchObject({
        score: expect.any(Number),
        max_possible: expect.any(Number),
        completed_fields: expect.any(Array),
        missing_fields: expect.any(Array),
        recommendations: expect.any(Array)
      });

      // Each category should have detailed breakdown
      Object.keys(response.body.category_scores).forEach(category => {
        expect(categoryDetails[category]).toBeDefined();
        expect(categoryDetails[category].score).toBe(response.body.category_scores[category]);
      });
    });

    it('should calculate different scores for different contexts', async () => {
      // Get business-level score
      const businessResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get store-level score
      const storeResponse = await request(app)
        .get(endpoint)
        .query({ store_id: storeId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Scores might be different based on context
      expect(businessResponse.body.overall_score).toBeGreaterThanOrEqual(0);
      expect(storeResponse.body.overall_score).toBeGreaterThanOrEqual(0);

      // Store-specific score should include store context
      expect(storeResponse.body.store_id).toBe(storeId);
      expect(businessResponse.body.store_id).toBeNull();
    });

    it('should handle empty context gracefully', async () => {
      // Test with business that has minimal context
      const minimalBusinessToken = 'test-minimal-business-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${minimalBusinessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        missing_requirements: expect.any(Array)
      });

      // Should have low score for minimal context
      expect(response.body.overall_score).toBeLessThanOrEqual(30);

      // Should have many missing requirements
      expect(response.body.missing_requirements.length).toBeGreaterThan(5);
    });
  });

  describe('Validation', () => {
    it('should reject invalid UUID format for store_id', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ store_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid include_fraud_analysis values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ include_fraud_analysis: 'maybe' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject malformed validation_rules JSON', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ validation_rules: '{"invalid": json}' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject validation_rules that are too large', async () => {
      const largeRules: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeRules[`rule_${i}`] = 'A'.repeat(100);
      }

      const response = await request(app)
        .get(endpoint)
        .query({ validation_rules: JSON.stringify(largeRules) })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation rules too large',
        details: expect.any(Object)
      });
    });

    it('should reject invalid detailed parameter values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ detailed: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only calculate scores for businesses user has access to', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validation result should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should require write_context permission', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });

    it('should reject access to stores user does not manage', async () => {
      const unauthorizedStoreId = 'unauthorized-store-id';

      const response = await request(app)
        .get(endpoint)
        .query({ store_id: unauthorizedStoreId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to specified store'
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 2 seconds for business-level validation', async () => {
      const startTime = Date.now();

      await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000);
    });

    it('should respond within 3 seconds with fraud analysis', async () => {
      const startTime = Date.now();

      await request(app)
        .get(endpoint)
        .query({ include_fraud_analysis: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000);
    });

    it('should respond within 4 seconds with detailed breakdown', async () => {
      const startTime = Date.now();

      await request(app)
        .get(endpoint)
        .query({ 
          detailed: 'true',
          include_fraud_analysis: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(4000);
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          overall_score: expect.any(Number),
          category_scores: expect.any(Object)
        });
      });

      // Concurrent requests should not take significantly longer than sequential
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Caching and Consistency', () => {
    it('should return consistent scores for identical requests', async () => {
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // All responses should have identical scores
      const firstResponse = responses[0].body;
      responses.slice(1).forEach(response => {
        expect(response.body.overall_score).toBe(firstResponse.overall_score);
        expect(response.body.category_scores).toEqual(firstResponse.category_scores);
      });
    });

    it('should reflect context changes in updated scores', async () => {
      // Get initial score
      const initialResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Simulate context update (this would normally happen via context creation endpoint)
      // For testing, we'll use a special trigger
      await request(app)
        .post('/api/test/update-context')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ add_context: true })
        .expect(200);

      // Get updated score
      const updatedResponse = await request(app)
        .get(endpoint)
        .query({ force_recalculate: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Score should be higher after adding context
      expect(updatedResponse.body.overall_score).toBeGreaterThanOrEqual(initialResponse.body.overall_score);
    });

    it('should cache results appropriately', async () => {
      // First request should calculate score
      const firstStartTime = Date.now();
      const firstResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const firstTime = Date.now() - firstStartTime;

      // Second request should use cache and be faster
      const secondStartTime = Date.now();
      const secondResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const secondTime = Date.now() - secondStartTime;

      // Results should be identical
      expect(secondResponse.body.overall_score).toBe(firstResponse.body.overall_score);
      expect(secondResponse.body.category_scores).toEqual(firstResponse.body.category_scores);

      // Second request should be significantly faster (cached)
      expect(secondTime).toBeLessThan(firstTime * 0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle calculation errors gracefully', async () => {
      // Test with data that might cause calculation issues
      const errorTriggerToken = 'test-calculation-error-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${errorTriggerToken}`)
        .expect(200);

      // Should return a default score structure even if some calculations fail
      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        category_scores: expect.any(Object),
        calculation_warnings: expect.any(Array)
      });

      // Should include warning about calculation issues
      expect(response.body.calculation_warnings.length).toBeGreaterThan(0);
    });

    it('should handle missing validation rules gracefully', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ validation_rules: '{}' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should use default validation rules
      expect(response.body).toMatchObject({
        overall_score: expect.any(Number),
        validation_rules_applied: expect.any(Object)
      });

      expect(response.body.validation_rules_applied.version).toBe('default');
    });

    it('should handle very low context scores', async () => {
      const emptyContextToken = 'test-empty-context-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${emptyContextToken}`)
        .expect(200);

      expect(response.body.overall_score).toBeGreaterThanOrEqual(0);
      expect(response.body.overall_score).toBeLessThan(10);

      // Should provide many improvement suggestions
      expect(response.body.improvement_suggestions.length).toBeGreaterThan(10);
      expect(response.body.missing_requirements.length).toBeGreaterThan(15);
    });

    it('should handle very high context scores', async () => {
      const completeContextToken = 'test-complete-context-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${completeContextToken}`)
        .expect(200);

      expect(response.body.overall_score).toBeGreaterThan(90);
      expect(response.body.overall_score).toBeLessThanOrEqual(100);

      // Should have minimal missing requirements
      expect(response.body.missing_requirements.length).toBeLessThan(3);
      expect(response.body.improvement_suggestions.length).toBeLessThan(5);
    });
  });
});