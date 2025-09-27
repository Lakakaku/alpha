import request from 'supertest';
import { app } from '../../src/app';

describe('Feedback Analysis API Contract Tests', () => {
  const validJWT = 'valid-test-jwt';
  const validUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    // These tests MUST fail initially (TDD requirement)
    // They test the contract defined in contracts/feedback-analysis.yaml
  });

  describe('POST /ai/analysis/process', () => {
    const validProcessRequest = {
      call_session_id: validUUID,
      transcript_id: validUUID,
      priority: 'normal'
    };

    test('should accept valid analysis request', async () => {
      const response = await request(app)
        .post('/ai/analysis/process')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validProcessRequest)
        .expect(202);

      expect(response.body).toMatchObject({
        analysis_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        estimated_completion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        status: expect.stringMatching(/^(queued|processing)$/)
      });
    });

    test('should reject request without authentication', async () => {
      await request(app)
        .post('/ai/analysis/process')
        .send(validProcessRequest)
        .expect(401);
    });

    test('should reject request with missing required fields', async () => {
      const incompleteRequest = {
        call_session_id: validUUID
        // Missing transcript_id
      };

      const response = await request(app)
        .post('/ai/analysis/process')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(incompleteRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should return 404 for non-existent call session', async () => {
      const nonExistentRequest = {
        call_session_id: '00000000-0000-0000-0000-000000000000',
        transcript_id: validUUID
      };

      const response = await request(app)
        .post('/ai/analysis/process')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(nonExistentRequest)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('GET /ai/analysis/{analysis_id}/status', () => {
    test('should return analysis status for valid ID', async () => {
      const response = await request(app)
        .get(`/ai/analysis/${validUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(200);

      expect(response.body).toMatchObject({
        analysis_id: validUUID,
        status: expect.stringMatching(/^(queued|processing|completed|failed)$/),
        progress_percentage: expect.any(Number),
        current_stage: expect.stringMatching(/^(legitimacy_check|depth_analysis|usefulness_analysis|scoring|summarization)$/),
        error_message: expect.toBeOneOf([expect.any(String), null])
      });

      expect(response.body.progress_percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.progress_percentage).toBeLessThanOrEqual(100);
    });

    test('should return 404 for non-existent analysis', async () => {
      const nonExistentUUID = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .get(`/ai/analysis/${nonExistentUUID}/status`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(404);
    });
  });

  describe('GET /ai/analysis/{analysis_id}/results', () => {
    test('should return complete quality assessment results', async () => {
      const response = await request(app)
        .get(`/ai/analysis/${validUUID}/results`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(200);

      expect(response.body).toMatchObject({
        assessment_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        call_session_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        scores: {
          legitimacy_score: expect.any(Number),
          depth_score: expect.any(Number),
          usefulness_score: expect.any(Number),
          overall_quality_score: expect.any(Number)
        },
        reward_percentage: expect.any(Number),
        is_fraudulent: expect.any(Boolean),
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });

      // Validate score ranges
      expect(response.body.scores.legitimacy_score).toBeGreaterThanOrEqual(0);
      expect(response.body.scores.legitimacy_score).toBeLessThanOrEqual(1);
      expect(response.body.scores.depth_score).toBeGreaterThanOrEqual(0);
      expect(response.body.scores.depth_score).toBeLessThanOrEqual(1);
      expect(response.body.scores.usefulness_score).toBeGreaterThanOrEqual(0);
      expect(response.body.scores.usefulness_score).toBeLessThanOrEqual(1);
      expect(response.body.scores.overall_quality_score).toBeGreaterThanOrEqual(0);
      expect(response.body.scores.overall_quality_score).toBeLessThanOrEqual(1);

      // Validate reward percentage (2-15% range)
      expect(response.body.reward_percentage).toBeGreaterThanOrEqual(2.00);
      expect(response.body.reward_percentage).toBeLessThanOrEqual(15.00);

      // Validate optional fraud data
      if (response.body.fraud_reasons) {
        expect(response.body.fraud_reasons).toEqual(expect.arrayContaining([expect.any(String)]));
      }

      if (response.body.business_actionable_items) {
        expect(response.body.business_actionable_items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              category: expect.stringMatching(/^(product|service|environment|staff|pricing|accessibility)$/),
              description: expect.any(String),
              priority: expect.stringMatching(/^(low|medium|high|urgent)$/)
            })
          ])
        );
      }
    });

    test('should return 404 for uncompleted analysis', async () => {
      const uncompletedUUID = '11111111-1111-1111-1111-111111111111';
      
      await request(app)
        .get(`/ai/analysis/${uncompletedUUID}/results`)
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(404);
    });
  });

  describe('POST /ai/analysis/fraud-check', () => {
    const validFraudCheckRequest = {
      call_session_id: validUUID,
      check_types: ['timing', 'content', 'context'],
      business_context: {
        operating_hours: {
          monday: { open: '08:00', close: '20:00' }
        }
      },
      force_recheck: false
    };

    test('should perform fraud detection analysis', async () => {
      const response = await request(app)
        .post('/ai/analysis/fraud-check')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validFraudCheckRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        fraud_results: expect.arrayContaining([
          expect.objectContaining({
            check_type: expect.stringMatching(/^(timing|content|context|pattern)$/),
            is_suspicious: expect.any(Boolean),
            confidence_level: expect.any(Number),
            decision_reasoning: expect.any(String)
          })
        ]),
        overall_is_fraudulent: expect.any(Boolean),
        confidence_level: expect.any(Number),
        should_exclude_from_rewards: expect.any(Boolean)
      });

      // Validate confidence levels
      expect(response.body.confidence_level).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence_level).toBeLessThanOrEqual(1);

      response.body.fraud_results.forEach((result: any) => {
        expect(result.confidence_level).toBeGreaterThanOrEqual(0);
        expect(result.confidence_level).toBeLessThanOrEqual(1);
      });
    });

    test('should reject request with invalid check types', async () => {
      const invalidRequest = {
        ...validFraudCheckRequest,
        check_types: ['invalid_type']
      };

      const response = await request(app)
        .post('/ai/analysis/fraud-check')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should require at least one check type', async () => {
      const invalidRequest = {
        ...validFraudCheckRequest,
        check_types: []
      };

      const response = await request(app)
        .post('/ai/analysis/fraud-check')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('POST /ai/analysis/summary/generate', () => {
    const validSummaryRequest = {
      call_session_id: validUUID,
      quality_threshold: 0.08,
      preserve_details: true,
      target_length: 'standard'
    };

    test('should generate feedback summary for high-quality content', async () => {
      const response = await request(app)
        .post('/ai/analysis/summary/generate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(validSummaryRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        summary_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        summary_text: expect.any(String),
        key_insights: expect.arrayContaining([expect.any(String)]),
        summary_metadata: expect.any(Object)
      });

      expect(response.body.summary_text.length).toBeGreaterThan(0);

      if (response.body.actionable_items) {
        expect(response.body.actionable_items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              category: expect.stringMatching(/^(product|service|environment|staff|pricing|accessibility)$/),
              description: expect.any(String),
              priority: expect.stringMatching(/^(low|medium|high|urgent)$/)
            })
          ])
        );
      }
    });

    test('should reject quality threshold outside valid range', async () => {
      const invalidRequest = {
        ...validSummaryRequest,
        quality_threshold: 0.25 // Above max 0.15
      };

      const response = await request(app)
        .post('/ai/analysis/summary/generate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid target length', async () => {
      const invalidRequest = {
        ...validSummaryRequest,
        target_length: 'invalid_length'
      };

      const response = await request(app)
        .post('/ai/analysis/summary/generate')
        .set('Authorization', `Bearer ${validJWT}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('DELETE /ai/analysis/cleanup', () => {
    test('should clean up low-grade feedback', async () => {
      const response = await request(app)
        .delete('/ai/analysis/cleanup')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          quality_threshold: 0.02,
          batch_size: 100,
          dry_run: false
        })
        .expect(200);

      expect(response.body).toMatchObject({
        deleted_count: expect.any(Number),
        preserved_count: expect.any(Number),
        execution_time_ms: expect.any(Number),
        dry_run: false
      });

      expect(response.body.deleted_count).toBeGreaterThanOrEqual(0);
      expect(response.body.preserved_count).toBeGreaterThanOrEqual(0);
      expect(response.body.execution_time_ms).toBeGreaterThan(0);
    });

    test('should perform dry run without actual deletion', async () => {
      const response = await request(app)
        .delete('/ai/analysis/cleanup')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          quality_threshold: 0.05,
          dry_run: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        deleted_count: expect.any(Number),
        preserved_count: expect.any(Number),
        execution_time_ms: expect.any(Number),
        dry_run: true
      });
    });

    test('should require quality_threshold parameter', async () => {
      const response = await request(app)
        .delete('/ai/analysis/cleanup')
        .set('Authorization', `Bearer ${validJWT}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });

    test('should reject invalid batch size', async () => {
      const response = await request(app)
        .delete('/ai/analysis/cleanup')
        .set('Authorization', `Bearer ${validJWT}`)
        .query({
          quality_threshold: 0.03,
          batch_size: 2000 // Above max 1000
        })
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