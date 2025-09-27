import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../../src/app';

describe('Session Details Contract - /api/v1/verification/session/{sessionToken}', () => {
  let validSessionToken: string;
  let expiredSessionToken: string;

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

    // Create an expired session token (this will be mocked in implementation)
    expiredSessionToken = 'expired-session-token-for-testing';
  });

  describe('Valid session token', () => {
    it('should return session details for valid session token', async () => {
      const response = await request(app)
        .get(`/api/v1/verification/session/${validSessionToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        session_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        store_info: {
          store_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
          store_name: expect.any(String),
          business_name: expect.any(String),
          logo_url: expect.any(String) // may be undefined, but if present should be string
        },
        status: expect.stringMatching(/^(pending|completed|expired|failed)$/),
        qr_version: expect.any(Number),
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
        expires_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)
      });

      // Verify QR version is within valid range
      expect(response.body.qr_version).toBeGreaterThanOrEqual(1);
      expect(response.body.qr_version).toBeLessThanOrEqual(9999999);

      // Verify expires_at is in the future (for new sessions)
      const expiresAt = new Date(response.body.expires_at);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Invalid session token', () => {
    it('should return 404 for non-existent session token', async () => {
      const invalidToken = 'non-existent-session-token-123456789';

      const response = await request(app)
        .get(`/api/v1/verification/session/${invalidToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: expect.stringContaining('session does not exist')
      });
    });

    it('should return 404 for malformed session token', async () => {
      const malformedToken = 'abc123'; // Too short

      const response = await request(app)
        .get(`/api/v1/verification/session/${malformedToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: expect.any(String)
      });
    });
  });

  describe('Expired session', () => {
    it('should return 410 for expired session token', async () => {
      const response = await request(app)
        .get(`/api/v1/verification/session/${expiredSessionToken}`)
        .expect(410);

      expect(response.body).toMatchObject({
        success: false,
        error: 'SESSION_EXPIRED',
        message: expect.stringContaining('session has expired')
      });
    });
  });

  describe('Session status validation', () => {
    it('should return correct status for pending session', async () => {
      const response = await request(app)
        .get(`/api/v1/verification/session/${validSessionToken}`)
        .expect(200);

      expect(response.body.status).toBe('pending');
    });
  });

  describe('Store information validation', () => {
    it('should include complete store information', async () => {
      const response = await request(app)
        .get(`/api/v1/verification/session/${validSessionToken}`)
        .expect(200);

      const storeInfo = response.body.store_info;

      // Verify store_id is a valid UUID
      expect(storeInfo.store_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Verify store_name is present and non-empty
      expect(storeInfo.store_name).toBeTruthy();
      expect(typeof storeInfo.store_name).toBe('string');
      expect(storeInfo.store_name.length).toBeGreaterThan(0);

      // Verify business_name is present and non-empty
      expect(storeInfo.business_name).toBeTruthy();
      expect(typeof storeInfo.business_name).toBe('string');
      expect(storeInfo.business_name.length).toBeGreaterThan(0);

      // logo_url is optional but if present should be a valid-looking URL or undefined
      if (storeInfo.logo_url !== undefined) {
        expect(typeof storeInfo.logo_url).toBe('string');
      }
    });
  });

  describe('Timestamp validation', () => {
    it('should return valid ISO 8601 timestamps', async () => {
      const response = await request(app)
        .get(`/api/v1/verification/session/${validSessionToken}`)
        .expect(200);

      // Test created_at timestamp
      const createdAt = new Date(response.body.created_at);
      expect(createdAt.toISOString()).toBe(response.body.created_at);

      // Test expires_at timestamp
      const expiresAt = new Date(response.body.expires_at);
      expect(expiresAt.toISOString()).toBe(response.body.expires_at);

      // Verify expires_at is after created_at
      expect(expiresAt.getTime()).toBeGreaterThan(createdAt.getTime());
    });
  });
});