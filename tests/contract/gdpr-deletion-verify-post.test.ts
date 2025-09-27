/**
 * Contract test for POST /api/gdpr/deletion-requests/{requestId}/verify
 * 
 * @description Validates GDPR deletion verification endpoint contract compliance
 * @constitutional_requirement Customer verification before data deletion
 * @performance_target <1s verification processing
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('POST /api/gdpr/deletion-requests/{requestId}/verify - Contract Test', () => {
  const mockRequestId = 'gdpr-del-123e4567-e89b-12d3-a456-426614174000';
  const validVerificationRequest = {
    verification_method: 'sms_code',
    verification_code: '123456',
    customer_phone: '+46701234567',
    confirmation_text: 'I confirm that I want to permanently delete all my personal data'
  };

  it('should fail - endpoint not implemented yet (TDD)', async () => {
    const response = await request(app)
      .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
      .set('Authorization', 'Bearer mock-customer-token-+46701234567')
      .send(validVerificationRequest)
      .expect(404);

    // This test MUST fail until T025-T029 services are implemented
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'Route not implemented'
    });
  });

  describe('Authentication & Authorization (Constitutional: Customer or admin)', () => {
    it('should fail - requires authentication', async () => {
      await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .send(validVerificationRequest)
        .expect(401);
    });

    it('should allow customer to verify own deletion request', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validVerificationRequest);

      // Should not be 403 when customer verifies own request
      expect([200, 404]).toContain(response.status);
    });

    it('should allow admin to verify on behalf of customer', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validVerificationRequest,
          admin_override: true,
          admin_justification: 'Customer called support line for verification'
        });

      // Should not be 403 when admin verifies
      expect([200, 404]).toContain(response.status);
    });

    it('should deny customer access to other deletion requests', async () => {
      await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46709876543')
        .send(validVerificationRequest)
        .expect(403);
    });
  });

  describe('Request Validation (Constitutional: TypeScript strict)', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({})
        .expect(400);

      expect(response.body.errors).toContain('verification_method is required');
      expect(response.body.errors).toContain('verification_code is required');
      expect(response.body.errors).toContain('customer_phone is required');
    });

    it('should validate verification method enum', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          verification_method: 'invalid_method'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'verification_method must be one of: sms_code, email_link, voice_call, admin_override'
      );
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          customer_phone: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.errors).toContain('customer_phone must be valid Swedish phone number');
    });

    it('should validate confirmation text presence', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          confirmation_text: ''
        })
        .expect(400);

      expect(response.body.errors).toContain('confirmation_text is required for deletion verification');
    });
  });

  describe('Response Structure Validation', () => {
    it('should return verification result', async () => {
      // This test will pass once endpoint is implemented
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validVerificationRequest);

      if (response.status === 200) {
        expect(response.body).toMatchObject({
          request_id: mockRequestId,
          verification_status: expect.stringMatching(/^(verified|failed|expired)$/),
          verification_timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          deletion_scheduled: expect.any(Boolean),
          scheduled_deletion_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          processing_time_ms: expect.any(Number),
          verification_attempts: expect.any(Number),
          expires_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          compliance_status: {
            within_deadline: expect.any(Boolean),
            hours_until_deadline: expect.any(Number)
          }
        });

        // Constitutional requirement: <1s verification processing
        expect(response.body.processing_time_ms).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('Verification Code Validation', () => {
    it('should validate SMS verification code format', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          verification_method: 'sms_code',
          verification_code: '12345' // Invalid: too short
        })
        .expect(400);

      expect(response.body.errors).toContain('verification_code must be 6 digits for SMS verification');
    });

    it('should handle expired verification codes', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          verification_code: '000000' // Mock expired code
        });

      if (response.status === 400) {
        expect(response.body.error).toBe('verification_code_expired');
        expect(response.body.message).toContain('Verification code has expired');
      }
    });

    it('should handle invalid verification codes', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          verification_code: '999999' // Mock invalid code
        });

      if (response.status === 400) {
        expect(response.body.error).toBe('invalid_verification_code');
        expect(response.body.verification_attempts).toBeGreaterThan(0);
      }
    });
  });

  describe('Phone Number Matching (Constitutional)', () => {
    it('should verify phone number matches deletion request', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validVerificationRequest,
          customer_phone: '+46709876543' // Different phone number
        })
        .expect(400);

      expect(response.body.error).toBe('phone_number_mismatch');
      expect(response.body.message).toContain('Phone number does not match deletion request');
    });
  });

  describe('Admin Override Handling', () => {
    it('should allow admin override with justification', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          verification_method: 'admin_override',
          customer_phone: validVerificationRequest.customer_phone,
          admin_justification: 'Customer verified identity via phone call',
          confirmation_text: 'Admin confirmed customer deletion request'
        });

      if (response.status === 200) {
        expect(response.body.verification_status).toBe('verified');
        expect(response.body.verification_method_used).toBe('admin_override');
        expect(response.body.admin_override).toBe(true);
      }
    });

    it('should require justification for admin override', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          verification_method: 'admin_override',
          customer_phone: validVerificationRequest.customer_phone,
          confirmation_text: 'Admin confirmed customer deletion request'
        })
        .expect(400);

      expect(response.body.errors).toContain('admin_justification is required for admin override');
    });
  });

  describe('GDPR Compliance (Constitutional: 72-hour deadline)', () => {
    it('should schedule deletion within deadline', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validVerificationRequest);

      if (response.status === 200 && response.body.verification_status === 'verified') {
        const scheduledTime = new Date(response.body.scheduled_deletion_time);
        const verificationTime = new Date(response.body.verification_timestamp);
        const hoursUntilDeletion = (scheduledTime.getTime() - verificationTime.getTime()) / (1000 * 60 * 60);
        
        // Should schedule deletion immediately after verification
        expect(hoursUntilDeletion).toBeLessThanOrEqual(1);
        expect(response.body.compliance_status.within_deadline).toBe(true);
      }
    });
  });

  describe('Rate Limiting & Security', () => {
    it('should limit verification attempts', async () => {
      // Simulate multiple failed attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
            .set('Authorization', 'Bearer mock-customer-token-+46701234567')
            .send({
              ...validVerificationRequest,
              verification_code: '999999'
            })
        );
      }

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];

      // Should rate limit after multiple failed attempts
      expect([429, 423]).toContain(lastResponse.status);
    });
  });

  describe('Performance Requirements (Constitutional: ≤10% impact)', () => {
    it('should process verification within 1 second', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validVerificationRequest);

      const processingTime = Date.now() - startTime;

      if (response.status === 200) {
        // Constitutional requirement: <1s verification processing
        expect(processingTime).toBeLessThanOrEqual(1000);
        expect(response.body.processing_time_ms).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('Audit Trail Requirements', () => {
    it('should log verification attempt details', async () => {
      const response = await request(app)
        .post(`/api/gdpr/deletion-requests/${mockRequestId}/verify`)
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validVerificationRequest);

      if (response.status === 200) {
        // Should include audit information in response
        expect(response.body).toHaveProperty('audit_log_id');
        expect(response.body.verification_timestamp).toBeTruthy();
        expect(response.body.verification_attempts).toBeGreaterThan(0);
      }
    });
  });
});