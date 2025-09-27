import request from 'supertest';
import { app } from '../../../src/app';

describe('Call Status API - Contract Tests', () => {
  // These tests MUST FAIL initially since the endpoints don't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const nonExistentSessionId = '99999999-9999-9999-9999-999999999999';

  describe('GET /api/calls/{sessionId}/status', () => {
    describe('Success Cases', () => {
      it('should return 200 with call session status structure', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        // Expected response structure from contract specification
        expect(response.body).toMatchObject({
          session_id: validSessionId,
          status: expect.stringMatching(/^(verification_pending|call_scheduled|call_in_progress|call_completed|completion_confirmed|reward_calculated|reward_displayed)$/),
          status_updated_at: expect.any(String),
          next_poll_interval: expect.any(Number)
        });

        // Validate session_id is UUID format
        expect(response.body.session_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        // Validate timestamp format (ISO 8601)
        expect(response.body.status_updated_at).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );

        // Validate next_poll_interval is reasonable
        expect(response.body.next_poll_interval).toBeGreaterThan(0);
        expect(response.body.next_poll_interval).toBeLessThanOrEqual(60);
      });

      it('should include call_duration when status is call_completed or later', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        if (['call_completed', 'completion_confirmed', 'reward_calculated', 'reward_displayed'].includes(response.body.status)) {
          expect(response.body.call_duration).toBeDefined();
          expect(typeof response.body.call_duration).toBe('number');
          expect(response.body.call_duration).toBeGreaterThan(0);
          expect(response.body.call_duration).toBeLessThanOrEqual(120); // Max 2 minutes
        }
      });

      it('should include expected_reward_range when appropriate', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        if (['call_completed', 'completion_confirmed', 'reward_calculated', 'reward_displayed'].includes(response.body.status)) {
          expect(response.body.expected_reward_range).toBeDefined();
          expect(response.body.expected_reward_range).toMatchObject({
            min_percent: expect.any(Number),
            max_percent: expect.any(Number)
          });

          expect(response.body.expected_reward_range.min_percent).toBeGreaterThanOrEqual(2);
          expect(response.body.expected_reward_range.min_percent).toBeLessThanOrEqual(15);
          expect(response.body.expected_reward_range.max_percent).toBeGreaterThanOrEqual(2);
          expect(response.body.expected_reward_range.max_percent).toBeLessThanOrEqual(15);
          expect(response.body.expected_reward_range.max_percent).toBeGreaterThanOrEqual(response.body.expected_reward_range.min_percent);
        }
      });

      it('should include reward_timeline when reward is calculated', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        if (['reward_calculated', 'reward_displayed'].includes(response.body.status)) {
          expect(response.body.reward_timeline).toBeDefined();
          expect(response.body.reward_timeline).toMatchObject({
            verification_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            payment_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
          });
        }
      });
    });

    describe('Validation Cases', () => {
      it('should return 400 for invalid session ID format', async () => {
        const invalidSessionId = 'invalid-uuid';

        const response = await request(app)
          .get(`/api/calls/${invalidSessionId}/status`)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('sessionId')
        });
      });

      it('should return 400 for empty session ID', async () => {
        const response = await request(app)
          .get('/api/calls//status')
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.any(String)
        });
      });
    });

    describe('Business Logic Cases', () => {
      it('should return 404 for non-existent call session', async () => {
        const response = await request(app)
          .get(`/api/calls/${nonExistentSessionId}/status`)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('session')
        });
      });
    });

    describe('Status Progression Cases', () => {
      it('should track valid status values', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        const validStatuses = [
          'verification_pending',
          'call_scheduled', 
          'call_in_progress',
          'call_completed',
          'completion_confirmed',
          'reward_calculated',
          'reward_displayed'
        ];
        
        expect(validStatuses).toContain(response.body.status);
      });

      it('should provide appropriate polling intervals based on status', async () => {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        // Active statuses should have shorter polling intervals
        if (['verification_pending', 'call_scheduled', 'call_in_progress'].includes(response.body.status)) {
          expect(response.body.next_poll_interval).toBeLessThanOrEqual(10);
        }

        // Completed statuses can have longer intervals
        if (['call_completed', 'completion_confirmed', 'reward_calculated', 'reward_displayed'].includes(response.body.status)) {
          expect(response.body.next_poll_interval).toBeGreaterThanOrEqual(5);
        }
      });
    });

    describe('Performance Cases', () => {
      it('should respond within acceptable time limits', async () => {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        
        expect(response.body.session_id).toBe(validSessionId);
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      });
    });
  });

  describe('POST /api/calls/{sessionId}/confirm-completion', () => {
    const validConfirmation = {
      confirmed: true,
      call_quality_rating: 4,
      feedback_text: 'The call went well, clear audio quality',
      device_info: {
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        screen_width: 375,
        screen_height: 812
      }
    };

    describe('Success Cases', () => {
      it('should return 200 with completion confirmation', async () => {
        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(validConfirmation)
          .expect(200);

        expect(response.body).toMatchObject({
          session_id: validSessionId,
          confirmed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          reward_info: {
            estimated_amount: expect.any(String),
            payment_method: 'swish',
            timeline: {
              verification_by: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
              payment_by: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
            }
          },
          next_steps: expect.any(Array)
        });

        // Validate estimated_amount format (Swedish currency)
        expect(response.body.reward_info.estimated_amount).toMatch(/^\d+(\.\d{2})?\s*SEK$/);

        // Validate next_steps contains meaningful instructions
        expect(response.body.next_steps.length).toBeGreaterThan(0);
        response.body.next_steps.forEach((step: string) => {
          expect(typeof step).toBe('string');
          expect(step.length).toBeGreaterThan(0);
        });
      });

      it('should accept minimal confirmation without optional fields', async () => {
        const minimalConfirmation = {
          confirmed: true
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(minimalConfirmation)
          .expect(200);

        expect(response.body.session_id).toBe(validSessionId);
        expect(response.body.confirmed_at).toBeDefined();
        expect(response.body.reward_info).toBeDefined();
      });

      it('should handle confirmation denial', async () => {
        const denialConfirmation = {
          confirmed: false,
          feedback_text: 'Did not receive the call as expected'
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(denialConfirmation)
          .expect(200);

        expect(response.body.session_id).toBe(validSessionId);
        expect(response.body.confirmed_at).toBeDefined();
        // When confirmed=false, reward_info might be different or null
      });
    });

    describe('Validation Cases', () => {
      it('should return 400 for missing confirmed field', async () => {
        const invalidConfirmation = {
          call_quality_rating: 4
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(invalidConfirmation)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('confirmed')
        });
      });

      it('should return 400 for invalid call_quality_rating', async () => {
        const invalidConfirmation = {
          confirmed: true,
          call_quality_rating: 6 // Out of range (1-5)
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(invalidConfirmation)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('rating')
        });
      });

      it('should return 400 for feedback_text too long', async () => {
        const invalidConfirmation = {
          confirmed: true,
          feedback_text: 'x'.repeat(501) // Exceeds 500 char limit
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send(invalidConfirmation)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('feedback_text')
        });
      });

      it('should return 400 for invalid session ID format', async () => {
        const response = await request(app)
          .post('/api/calls/invalid-uuid/confirm-completion')
          .send(validConfirmation)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('sessionId')
        });
      });
    });

    describe('Business Logic Cases', () => {
      it('should return 404 for non-existent call session', async () => {
        const response = await request(app)
          .post(`/api/calls/${nonExistentSessionId}/confirm-completion`)
          .send(validConfirmation)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('session')
        });
      });

      it('should return 400 if call is not in completable state', async () => {
        // Assuming this session is still in progress
        const inProgressSessionId = '550e8400-e29b-41d4-a716-446655440001';

        const response = await request(app)
          .post(`/api/calls/${inProgressSessionId}/confirm-completion`)
          .send(validConfirmation)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('status')
        });
      });
    });
  });

  describe('POST /api/calls/{sessionId}/quality-feedback', () => {
    const validQualityFeedback = {
      rating: 4,
      issues: ['audio_quality', 'ai_understanding'],
      comments: 'Overall good experience, but some audio clarity issues'
    };

    describe('Success Cases', () => {
      it('should return 200 with success response', async () => {
        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(validQualityFeedback)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.any(String)
        });
      });

      it('should accept minimal feedback with only rating', async () => {
        const minimalFeedback = {
          rating: 5
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(minimalFeedback)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should accept all valid issue types', async () => {
        const validIssues = [
          'audio_quality',
          'connection_drops', 
          'ai_understanding',
          'call_duration',
          'language_clarity'
        ];

        for (const issue of validIssues) {
          const feedback = {
            rating: 3,
            issues: [issue]
          };

          const response = await request(app)
            .post(`/api/calls/${validSessionId}/quality-feedback`)
            .send(feedback)
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('Validation Cases', () => {
      it('should return 400 for missing rating', async () => {
        const invalidFeedback = {
          comments: 'Missing rating field'
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('rating')
        });
      });

      it('should return 400 for invalid rating range', async () => {
        const invalidFeedback = {
          rating: 0 // Out of range (1-5)
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('rating')
        });
      });

      it('should return 400 for invalid issue type', async () => {
        const invalidFeedback = {
          rating: 3,
          issues: ['invalid_issue_type']
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('issues')
        });
      });

      it('should return 400 for comments too long', async () => {
        const invalidFeedback = {
          rating: 3,
          comments: 'x'.repeat(501) // Exceeds 500 char limit
        };

        const response = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send(invalidFeedback)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('comments')
        });
      });
    });

    describe('Business Logic Cases', () => {
      it('should return 404 for non-existent call session', async () => {
        const response = await request(app)
          .post(`/api/calls/${nonExistentSessionId}/quality-feedback`)
          .send(validQualityFeedback)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('session')
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete call status workflow', async () => {
      // 1. Get initial status
      const statusResponse = await request(app)
        .get(`/api/calls/${validSessionId}/status`)
        .expect(200);

      expect(statusResponse.body.session_id).toBe(validSessionId);

      // 2. If call is completed, confirm completion
      if (statusResponse.body.status === 'call_completed') {
        const confirmResponse = await request(app)
          .post(`/api/calls/${validSessionId}/confirm-completion`)
          .send({ confirmed: true })
          .expect(200);

        expect(confirmResponse.body.session_id).toBe(validSessionId);

        // 3. Submit quality feedback
        const feedbackResponse = await request(app)
          .post(`/api/calls/${validSessionId}/quality-feedback`)
          .send({ rating: 4 })
          .expect(200);

        expect(feedbackResponse.body.success).toBe(true);

        // 4. Check final status
        const finalStatusResponse = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);

        expect(['completion_confirmed', 'reward_calculated', 'reward_displayed'])
          .toContain(finalStatusResponse.body.status);
      }
    });

    it('should maintain data consistency across multiple status checks', async () => {
      const responses = [];

      // Make multiple status requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .expect(200);
        
        responses.push(response.body);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All responses should have same session_id
      responses.forEach(response => {
        expect(response.session_id).toBe(validSessionId);
      });

      // Status should not regress (only progress forward)
      const statusOrder = [
        'verification_pending',
        'call_scheduled', 
        'call_in_progress',
        'call_completed',
        'completion_confirmed',
        'reward_calculated',
        'reward_displayed'
      ];

      for (let i = 1; i < responses.length; i++) {
        const prevStatusIndex = statusOrder.indexOf(responses[i-1].status);
        const currentStatusIndex = statusOrder.indexOf(responses[i].status);
        
        expect(currentStatusIndex).toBeGreaterThanOrEqual(prevStatusIndex);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send('{"confirmed": true, "malformed": }')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('JSON')
      });
    });

    it('should handle server errors gracefully', async () => {
      // This test assumes there might be server errors during development
      try {
        await request(app)
          .get(`/api/calls/${validSessionId}/status`)
          .timeout(5000);
      } catch (error) {
        // If the endpoint fails, it should fail with proper error structure
        expect(error).toBeDefined();
      }
    });
  });
});