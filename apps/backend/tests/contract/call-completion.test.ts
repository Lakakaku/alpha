import request from 'supertest';
import { app } from '../../src/app';

describe('POST /api/calls/{sessionId}/confirm-completion - Contract Test', () => {
  // This test MUST FAIL initially since the endpoint doesn't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
  const nonExistentSessionId = '99999999-9999-9999-9999-999999999999';
  const unauthorizedSessionId = '550e8400-e29b-41d4-a716-446655440002';
  const alreadyConfirmedSessionId = '550e8400-e29b-41d4-a716-446655440003';
  const notCompletedSessionId = '550e8400-e29b-41d4-a716-446655440004';

  describe('Success Cases', () => {
    it('should return 200 with valid completion confirmation with satisfaction score', async () => {
      const confirmationRequest = {
        confirmed: true,
        call_quality_rating: 4,
        feedback_text: 'Samtalet var bra och tydligt. AI:n förstod mig väl.',
        device_info: {
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          screen_width: 390,
          screen_height: 844
        }
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(confirmationRequest)
        .expect(200);

      // Expected response structure from OpenAPI spec
      expect(response.body).toMatchObject({
        session_id: validSessionId,
        confirmed_at: expect.any(String),
        reward_info: {
          estimated_amount: expect.any(String),
          payment_method: 'swish',
          timeline: {
            verification_by: expect.any(String),
            payment_by: expect.any(String)
          }
        },
        next_steps: expect.any(Array)
      });

      // Validate timestamp format (ISO 8601)
      expect(response.body.confirmed_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );

      // Validate reward amount format (SEK)
      expect(response.body.reward_info.estimated_amount).toMatch(/^\d+(\.\d{2})? SEK$/);

      // Validate timeline dates
      expect(response.body.reward_info.timeline.verification_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(response.body.reward_info.timeline.payment_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Validate next_steps is non-empty array
      expect(response.body.next_steps.length).toBeGreaterThan(0);
      response.body.next_steps.forEach((step: string) => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      });
    });

    it('should return 200 with completion confirmation without optional fields', async () => {
      const minimalRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(minimalRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        session_id: validSessionId,
        confirmed_at: expect.any(String),
        reward_info: expect.any(Object),
        next_steps: expect.any(Array)
      });

      // Should still include reward info even without optional fields
      expect(response.body.reward_info.payment_method).toBe('swish');
      expect(response.body.reward_info.timeline).toBeDefined();
    });

    it('should return 200 with minimum satisfaction score (1)', async () => {
      const minScoreRequest = {
        confirmed: true,
        call_quality_rating: 1,
        feedback_text: 'Samtalet var svårt att förstå.'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(minScoreRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should return 200 with maximum satisfaction score (5)', async () => {
      const maxScoreRequest = {
        confirmed: true,
        call_quality_rating: 5,
        feedback_text: 'Perfekt samtal! Mycket nöjd med upplevelsen.'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(maxScoreRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should return 200 with maximum length feedback text', async () => {
      const longFeedbackRequest = {
        confirmed: true,
        call_quality_rating: 3,
        feedback_text: 'A'.repeat(500) // Exactly 500 characters
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(longFeedbackRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should include valid confirmationTimestamp in response', async () => {
      const confirmationRequest = {
        confirmed: true,
        call_quality_rating: 4
      };

      const beforeTime = new Date();
      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);
      const afterTime = new Date();

      const confirmedAt = new Date(response.body.confirmed_at);
      expect(confirmedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(confirmedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should include proper rewardTimeline structure', async () => {
      const confirmationRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      const timeline = response.body.reward_info.timeline;
      
      // Verification date should be within reasonable range (next 7 days)
      const verificationDate = new Date(timeline.verification_by);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      expect(verificationDate.getTime()).toBeGreaterThan(now.getTime());
      expect(verificationDate.getTime()).toBeLessThanOrEqual(sevenDaysFromNow.getTime());

      // Payment date should be after verification date
      const paymentDate = new Date(timeline.payment_by);
      expect(paymentDate.getTime()).toBeGreaterThan(verificationDate.getTime());
    });
  });

  describe('Validation Cases', () => {
    it('should return 404 for invalid session ID format', async () => {
      const invalidSessionId = 'invalid-uuid';
      const validRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${invalidSessionId}/confirm-completion`)
        .send(validRequest)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('session'),
        details: expect.any(Object)
      });
    });

    it('should return 404 for non-existent session ID', async () => {
      const validRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${nonExistentSessionId}/confirm-completion`)
        .send(validRequest)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'CALL_SESSION_NOT_FOUND',
        message: expect.stringContaining('session'),
        details: expect.any(Object)
      });
    });

    it('should return 409 for already confirmed call', async () => {
      const validRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${alreadyConfirmedSessionId}/confirm-completion`)
        .send(validRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'CALL_ALREADY_CONFIRMED',
        message: expect.stringContaining('already confirmed'),
        details: expect.any(Object)
      });
    });

    it('should return 401 for unauthorized access', async () => {
      const validRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${unauthorizedSessionId}/confirm-completion`)
        .set('Authorization', 'Bearer invalid-token')
        .send(validRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('access'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for invalid satisfaction score (below 1)', async () => {
      const invalidRequest = {
        confirmed: true,
        call_quality_rating: 0
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('rating'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for invalid satisfaction score (above 5)', async () => {
      const invalidRequest = {
        confirmed: true,
        call_quality_rating: 6
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('rating'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for feedback text exceeding max length', async () => {
      const invalidRequest = {
        confirmed: true,
        feedback_text: 'A'.repeat(501) // Exceeds 500 character limit
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('feedback'),
        details: expect.any(Object)
      });
    });

    it('should return 422 for call not in completed status', async () => {
      const validRequest = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${notCompletedSessionId}/confirm-completion`)
        .send(validRequest)
        .expect(422);

      expect(response.body).toMatchObject({
        error: 'INVALID_CALL_STATUS',
        message: expect.stringContaining('completed'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for missing required confirmed field', async () => {
      const invalidRequest = {
        call_quality_rating: 4
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('confirmed'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for invalid confirmed field type', async () => {
      const invalidRequest = {
        confirmed: 'yes' // Should be boolean
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'VALIDATION_ERROR',
        message: expect.stringContaining('confirmed'),
        details: expect.any(Object)
      });
    });

    it('should return 400 for non-JSON content type', async () => {
      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send('invalid-json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });

  describe('Feedback Text Validation and Sanitization', () => {
    it('should sanitize HTML in feedback text', async () => {
      const htmlRequest = {
        confirmed: true,
        feedback_text: '<script>alert("xss")</script>Bra samtal!'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(htmlRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
      // Note: Actual sanitization validation would depend on implementation
    });

    it('should handle special characters in feedback text', async () => {
      const specialCharsRequest = {
        confirmed: true,
        feedback_text: 'Bra samtal! Älskar ÅÄÖ characters and émojis 😊'
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(specialCharsRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should handle empty feedback text', async () => {
      const emptyFeedbackRequest = {
        confirmed: true,
        feedback_text: ''
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(emptyFeedbackRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should handle null feedback text', async () => {
      const nullFeedbackRequest = {
        confirmed: true,
        feedback_text: null
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(nullFeedbackRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });
  });

  describe('Device Info Validation', () => {
    it('should accept valid device info', async () => {
      const deviceInfoRequest = {
        confirmed: true,
        device_info: {
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          screen_width: 1920,
          screen_height: 1080
        }
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(deviceInfoRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should handle missing device info fields', async () => {
      const partialDeviceInfoRequest = {
        confirmed: true,
        device_info: {
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
          // Missing screen dimensions
        }
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(partialDeviceInfoRequest)
        .expect(200);

      expect(response.body.session_id).toBe(validSessionId);
    });

    it('should handle invalid screen dimensions', async () => {
      const invalidDeviceInfoRequest = {
        confirmed: true,
        device_info: {
          user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          screen_width: -100,
          screen_height: 'invalid'
        }
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidDeviceInfoRequest)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Response Structure Validation', () => {
    it('should include all required response fields', async () => {
      const request = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      // Validate all required fields are present
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('confirmed_at');
      expect(response.body).toHaveProperty('reward_info');
      expect(response.body).toHaveProperty('next_steps');

      // Validate reward_info structure
      expect(response.body.reward_info).toHaveProperty('estimated_amount');
      expect(response.body.reward_info).toHaveProperty('payment_method');
      expect(response.body.reward_info).toHaveProperty('timeline');

      // Validate timeline structure
      expect(response.body.reward_info.timeline).toHaveProperty('verification_by');
      expect(response.body.reward_info.timeline).toHaveProperty('payment_by');
    });

    it('should return proper estimated reward amount format', async () => {
      const request = {
        confirmed: true,
        call_quality_rating: 5
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      const estimatedAmount = response.body.reward_info.estimated_amount;
      
      // Should be in format "XX.XX SEK" or "XX SEK"
      expect(estimatedAmount).toMatch(/^\d+(\.\d{2})? SEK$/);
      
      // Extract numeric value and validate reasonable range
      const numericAmount = parseFloat(estimatedAmount.replace(' SEK', ''));
      expect(numericAmount).toBeGreaterThan(0);
      expect(numericAmount).toBeLessThanOrEqual(100); // Reasonable upper bound
    });

    it('should return payment method as swish', async () => {
      const request = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      expect(response.body.reward_info.payment_method).toBe('swish');
    });

    it('should return next_steps as array of strings', async () => {
      const request = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      expect(Array.isArray(response.body.next_steps)).toBe(true);
      expect(response.body.next_steps.length).toBeGreaterThan(0);
      
      response.body.next_steps.forEach((step: any) => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Cases', () => {
    it('should respond within acceptable time limits', async () => {
      const request = {
        confirmed: true,
        call_quality_rating: 4
      };

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.session_id).toBe(validSessionId);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should return consistent error format for validation errors', async () => {
      const invalidRequest = {
        confirmed: true,
        call_quality_rating: 10 // Invalid rating
      };

      const response = await request(app)
        .post(`/api/calls/${validSessionId}/confirm-completion`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.details).toBe('object');
    });

    it('should return consistent error format for business logic errors', async () => {
      const request = {
        confirmed: true
      };

      const response = await request(app)
        .post(`/api/calls/${alreadyConfirmedSessionId}/confirm-completion`)
.send(confirmationRequest)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
    });
  });
});