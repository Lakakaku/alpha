import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';

describe('QR Verification Contract - /api/v1/qr/verify/{storeId}', () => {
  const validStoreId = '550e8400-e29b-41d4-a716-446655440000';
  const invalidStoreId = 'invalid-uuid';
  const validQRParams = {
    v: 12345,
    t: Math.floor(Date.now() / 1000)
  };

  const validRequestBody = {
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
  };

  describe('Valid QR verification', () => {
    it('should return session token for valid QR parameters', async () => {
      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(validQRParams)
        .send(validRequestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        session_token: expect.any(String),
        store_info: {
          store_id: validStoreId,
          store_name: expect.any(String),
          business_name: expect.any(String)
        },
        fraud_warning: expect.any(Boolean)
      });

      // Session token should be at least 32 characters
      expect(response.body.session_token).toMatch(/^[a-zA-Z0-9]{32,64}$/);
    });
  });

  describe('Invalid store ID', () => {
    it('should return 404 for non-existent store', async () => {
      const response = await request(app)
        .post(`/api/v1/qr/verify/${invalidStoreId}`)
        .query(validQRParams)
        .send(validRequestBody)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'STORE_NOT_FOUND',
        message: expect.any(String)
      });
    });
  });

  describe('Missing QR parameters', () => {
    it('should return 400 for missing version parameter', async () => {
      const invalidParams = { t: validQRParams.t }; // missing 'v'

      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(invalidParams)
        .send(validRequestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: expect.stringContaining('version')
      });
    });

    it('should return 400 for missing timestamp parameter', async () => {
      const invalidParams = { v: validQRParams.v }; // missing 't'

      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(invalidParams)
        .send(validRequestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: expect.stringContaining('timestamp')
      });
    });

    it('should return 400 for invalid version parameter', async () => {
      const invalidParams = { 
        v: 99999999, // out of range (max 9999999)
        t: validQRParams.t 
      };

      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(invalidParams)
        .send(validRequestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: expect.stringContaining('version must be between 1 and 9999999')
      });
    });
  });

  describe('Rate limiting', () => {
    it('should return 429 after 10 requests from same IP', async () => {
      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post(`/api/v1/qr/verify/${validStoreId}`)
          .query(validQRParams)
          .send(validRequestBody)
          .expect(200);
      }

      // 11th request should be rate limited
      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(validQRParams)
        .send(validRequestBody)
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('Too many')
      });
    });
  });

  describe('Invalid request body', () => {
    it('should return 400 for missing IP address', async () => {
      const invalidBody = {
        user_agent: validRequestBody.user_agent
        // missing ip_address
      };

      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(validQRParams)
        .send(invalidBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: expect.stringContaining('ip_address')
      });
    });

    it('should return 400 for missing user agent', async () => {
      const invalidBody = {
        ip_address: validRequestBody.ip_address
        // missing user_agent
      };

      const response = await request(app)
        .post(`/api/v1/qr/verify/${validStoreId}`)
        .query(validQRParams)
        .send(invalidBody)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'INVALID_PARAMETERS',
        message: expect.stringContaining('user_agent')
      });
    });
  });
});