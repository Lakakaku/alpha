import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Admin Authentication API Contract', () => {
  let testAdminId: string;
  let validSessionToken: string;

  beforeAll(async () => {
    // Create test admin account for contract testing
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'test.admin@vocilia.com',
      password: 'TestAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'test_admin',
          full_name: 'Test Administrator',
          email: 'test.admin@vocilia.com',
          is_active: true
        })
        .select()
        .single();

      testAdminId = data?.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAdminId) {
      await supabase
        .from('admin_accounts')
        .delete()
        .eq('id', testAdminId);
    }
  });

  describe('POST /api/admin/auth/login', () => {
    it('should authenticate admin with valid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'test_admin',
          password: 'TestAdmin123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          admin: {
            id: expect.any(String),
            username: 'test_admin',
            full_name: 'Test Administrator',
            email: 'test.admin@vocilia.com',
            is_active: true,
            created_at: expect.any(String)
          },
          session: {
            id: expect.any(String),
            admin_id: expect.any(String),
            created_at: expect.any(String),
            last_activity_at: expect.any(String),
            expires_at: expect.any(String),
            is_active: true
          },
          token: expect.any(String)
        }
      });

      // Store token for subsequent tests
      validSessionToken = response.body.data.token;
    });

    it('should reject invalid username', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'invalid_user',
          password: 'TestAdmin123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: expect.any(String)
        }
      });
    });

    it('should reject invalid password', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'test_admin',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: expect.any(String)
        }
      });
    });

    it('should validate request body schema', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'ab', // Too short
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should validate username pattern', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'invalid-username!', // Invalid characters
          password: 'TestAdmin123!'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('GET /api/admin/auth/session', () => {
    it('should return current session with valid token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${validSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          admin: {
            id: expect.any(String),
            username: 'test_admin',
            full_name: 'Test Administrator',
            email: 'test.admin@vocilia.com',
            is_active: true
          },
          session: {
            id: expect.any(String),
            admin_id: expect.any(String),
            created_at: expect.any(String),
            last_activity_at: expect.any(String),
            expires_at: expect.any(String),
            is_active: true
          }
        }
      });
    });

    it('should reject request without token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/auth/session');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should reject invalid token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/auth/session')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${validSessionToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should reject logout without token', async () => {
      const response = await request(API_URL)
        .post('/api/admin/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should reject logout with expired token', async () => {
      // This token should now be invalid after logout
      const response = await request(API_URL)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${validSessionToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('Rate limiting', () => {
    it('should enforce rate limiting on login attempts', async () => {
      // Make multiple failed login attempts
      const promises = Array.from({ length: 6 }, () =>
        request(API_URL)
          .post('/api/admin/auth/login')
          .send({
            username: 'test_admin',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});