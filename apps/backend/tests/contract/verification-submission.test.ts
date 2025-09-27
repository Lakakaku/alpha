import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';

describe('Verification Submission Contract - /api/v1/verification/submit', () => {
  let validSessionToken: string;

  beforeAll(async () => {
    // Create a valid session token for testing
    const storeId = '550e8400-e29b-41d4-a716-446655440000';
    const response = await request(app)
      .post(`/api/v1/qr/verify/${storeId}`)
      .query({ v: 12345, t: Math.floor(Date.now() / 1000) })
      .send({
        ip_address: '192.168.1.100',
        user_agent: 'Test User Agent'
      });
    
    validSessionToken = response.body.session_token;
  });

  const validSubmissionData = {
    transaction_time: '14:32',
    transaction_amount: 125.50,
    phone_number: '070-123 45 67'
  };

  describe('Valid submission', () => {
    it('should return verification ID for valid submission', async () => {
      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(validSubmissionData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        verification_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        validation_results: {
          time_validation: {
            status: expect.stringMatching(/^(valid|out_of_tolerance|invalid)$/),
            difference_minutes: expect.any(Number),
            tolerance_range: expect.any(String)
          },
          amount_validation: {
            status: expect.stringMatching(/^(valid|out_of_tolerance|invalid)$/),
            difference_sek: expect.any(Number),
            tolerance_range: expect.any(String)
          },
          phone_validation: {
            status: expect.stringMatching(/^(valid|invalid_format|not_swedish)$/),
            e164_format: expect.any(String),
            national_format: expect.any(String)
          },
          overall_valid: expect.any(Boolean)
        },
        next_steps: expect.any(String)
      });
    });
  });

  describe('Invalid session token', () => {
    it('should return 401 for missing session token', async () => {
      const response = await request(app)
        .post('/api/v1/verification/submit')
        .send(validSubmissionData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('session token')
      });
    });

    it('should return 401 for invalid session token', async () => {
      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', 'invalid-token-123')
        .send(validSubmissionData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'UNAUTHORIZED',
        message: expect.stringContaining('Invalid session token')
      });
    });
  });

  describe('Out-of-tolerance time validation', () => {
    it('should return validation error for time outside ±2 minutes', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const timeString = fiveMinutesAgo.toTimeString().substring(0, 5); // HH:MM format

      const outOfToleranceData = {
        ...validSubmissionData,
        transaction_time: timeString
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(outOfToleranceData)
        .expect(200); // Still returns 200 but with validation failure

      expect(response.body.validation_results.time_validation).toMatchObject({
        status: 'out_of_tolerance',
        difference_minutes: expect.any(Number),
        tolerance_range: expect.any(String)
      });

      expect(response.body.validation_results.overall_valid).toBe(false);
    });
  });

  describe('Out-of-tolerance amount validation', () => {
    it('should return validation error for amount outside ±2 SEK', async () => {
      const outOfToleranceData = {
        ...validSubmissionData,
        transaction_amount: 120.00 // Assuming expected is ~125, this is >2 SEK difference
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(outOfToleranceData)
        .expect(200); // Still returns 200 but with validation failure

      expect(response.body.validation_results.amount_validation).toMatchObject({
        status: 'out_of_tolerance',
        difference_sek: expect.any(Number),
        tolerance_range: expect.any(String)
      });

      expect(response.body.validation_results.overall_valid).toBe(false);
    });
  });

  describe('Invalid phone number validation', () => {
    it('should return validation error for non-Swedish phone number', async () => {
      const invalidPhoneData = {
        ...validSubmissionData,
        phone_number: '+1-555-123-4567' // US phone number
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(invalidPhoneData)
        .expect(200); // Still returns 200 but with validation failure

      expect(response.body.validation_results.phone_validation).toMatchObject({
        status: 'not_swedish'
      });

      expect(response.body.validation_results.overall_valid).toBe(false);
    });

    it('should return validation error for invalid phone format', async () => {
      const invalidPhoneData = {
        ...validSubmissionData,
        phone_number: '123-456-789' // Invalid format
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(invalidPhoneData)
        .expect(200); // Still returns 200 but with validation failure

      expect(response.body.validation_results.phone_validation).toMatchObject({
        status: 'invalid_format'
      });

      expect(response.body.validation_results.overall_valid).toBe(false);
    });
  });

  describe('Missing required fields', () => {
    it('should return 400 for missing transaction_time', async () => {
      const incompleteData = {
        transaction_amount: validSubmissionData.transaction_amount,
        phone_number: validSubmissionData.phone_number
        // missing transaction_time
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('transaction_time')
      });
    });

    it('should return 400 for missing transaction_amount', async () => {
      const incompleteData = {
        transaction_time: validSubmissionData.transaction_time,
        phone_number: validSubmissionData.phone_number
        // missing transaction_amount
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('transaction_amount')
      });
    });

    it('should return 400 for missing phone_number', async () => {
      const incompleteData = {
        transaction_time: validSubmissionData.transaction_time,
        transaction_amount: validSubmissionData.transaction_amount
        // missing phone_number
      };

      const response = await request(app)
        .post('/api/v1/verification/submit')
        .set('X-Session-Token', validSessionToken)
        .send(incompleteData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'VALIDATION_FAILED',
        message: expect.stringContaining('phone_number')
      });
    });
  });
});