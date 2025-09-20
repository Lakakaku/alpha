import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../../apps/backend/src/app';
import { getServiceClient } from '../../apps/backend/src/config/database';

// Security test configuration
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  TOKEN_EXPIRY: 60 * 60, // 1 hour
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days
  PASSWORD_MIN_LENGTH: 8,
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key'
};

// Test users for security testing
const TEST_USERS = {
  VALID_USER: {
    email: 'valid@security.test',
    password: 'SecurePass123!',
    id: '123e4567-e89b-12d3-a456-426614174000'
  },
  ADMIN_USER: {
    email: 'admin@security.test',
    password: 'AdminPass123!',
    id: '123e4567-e89b-12d3-a456-426614174001',
    role: 'admin_account'
  },
  LOCKED_USER: {
    email: 'locked@security.test',
    password: 'LockedPass123!',
    id: '123e4567-e89b-12d3-a456-426614174002'
  }
};

// Malicious payloads for testing
const MALICIOUS_PAYLOADS = {
  SQL_INJECTION: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "admin'--",
    "' UNION SELECT * FROM users --"
  ],
  XSS_PAYLOADS: [
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>",
    "';alert('xss');//"
  ],
  COMMAND_INJECTION: [
    "; rm -rf /",
    "| cat /etc/passwd",
    "&& curl malicious.com",
    "`rm -rf /`"
  ],
  LDAP_INJECTION: [
    "*)(uid=*",
    "*)(|(password=*))",
    "admin)(&(password=*))"
  ]
};

describe('Authentication Security Tests', () => {
  let serviceClient: any;

  beforeAll(async () => {
    serviceClient = getServiceClient();
    await setupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  async function setupTestUsers() {
    try {
      // Create test users with hashed passwords
      const hashedPassword = await bcrypt.hash(TEST_USERS.VALID_USER.password, 12);
      const hashedAdminPassword = await bcrypt.hash(TEST_USERS.ADMIN_USER.password, 12);
      const hashedLockedPassword = await bcrypt.hash(TEST_USERS.LOCKED_USER.password, 12);

      // Create users in auth system
      for (const user of Object.values(TEST_USERS)) {
        await serviceClient.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            id: user.id,
            role: user.role || 'business_account'
          }
        });
      }
    } catch (error) {
      console.error('Error setting up test users:', error);
    }
  }

  async function cleanupTestUsers() {
    try {
      for (const user of Object.values(TEST_USERS)) {
        await serviceClient.auth.admin.deleteUser(user.id);
      }
    } catch (error) {
      console.error('Error cleaning up test users:', error);
    }
  }

  describe('Login Security', () => {
    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USERS.VALID_USER.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with malformed email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'not-an-email',
          password: TEST_USERS.VALID_USER.password
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should reject login with missing fields', async () => {
      // Missing password
      let response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USERS.VALID_USER.email
        })
        .expect(422);

      expect(response.body.success).toBe(false);

      // Missing email
      response = await request(app)
        .post('/auth/login')
        .send({
          password: TEST_USERS.VALID_USER.password
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should implement rate limiting for failed login attempts', async () => {
      const email = 'ratelimit@test.com';
      
      // Make multiple failed login attempts
      for (let i = 0; i < SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email,
            password: 'WrongPassword123!'
          })
          .expect(401);
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/auth/login')
        .send({
          email,
          password: 'WrongPassword123!'
        })
        .expect(429);

      expect(response.body.error).toContain('Too many login attempts');
    });

    it('should protect against SQL injection in login', async () => {
      for (const payload of MALICIOUS_PAYLOADS.SQL_INJECTION) {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: payload,
            password: payload
          });

        // Should return 422 for invalid format or 401 for invalid credentials
        expect([401, 422]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    it('should protect against XSS in login response', async () => {
      for (const payload of MALICIOUS_PAYLOADS.XSS_PAYLOADS) {
        const response = await request(app)
          .post('/auth/login')
          .send({
            email: `test${payload}@example.com`,
            password: payload
          });

        // Response should not contain unescaped XSS payload
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('onerror=');
      }
    });

    it('should validate password strength on registration', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty',
        '12345678', // No uppercase, special chars
        'PASSWORD', // No lowercase, numbers, special chars
        'Pass123',  // Too short
        'Password123' // No special characters
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'test@example.com',
            password: weakPassword,
            first_name: 'Test',
            last_name: 'User'
          });

        expect([400, 422]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    it('should enforce secure password requirements', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!', // Meets all requirements
          first_name: 'New',
          last_name: 'User'
        });

      // Should succeed or fail due to other reasons, not password strength
      if (response.status === 422) {
        expect(response.body.error).not.toContain('password');
      }
    });
  });

  describe('JWT Token Security', () => {
    let validToken: string;
    let expiredToken: string;
    let malformedToken: string;

    beforeEach(async () => {
      // Create valid token
      validToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Create expired token
      expiredToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      // Create malformed token
      malformedToken = 'invalid.token.here';
    });

    it('should reject requests with missing authorization header', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authorization header required');
    });

    it('should reject requests with malformed tokens', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token');
    });

    it('should reject requests with expired tokens', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token expired');
    });

    it('should accept requests with valid tokens', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${validToken}`);

      // Should succeed or fail due to other reasons, not token validation
      expect([200, 404]).toContain(response.status);
    });

    it('should not accept tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate token payload structure', async () => {
      const invalidPayloadToken = jwt.sign(
        { 
          invalidField: 'value'
          // Missing required fields like userId, email, role
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${invalidPayloadToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Session Management Security', () => {
    it('should properly invalidate tokens on logout', async () => {
      // Login to get a token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_USERS.VALID_USER.email,
          password: TEST_USERS.VALID_USER.password
        });

      const token = loginResponse.body.data?.tokens?.access_token;
      
      if (token) {
        // Logout
        await request(app)
          .post('/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Try to use the token after logout
        const response = await request(app)
          .get('/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.error).toContain('Token invalid');
      }
    });

    it('should handle concurrent logout attempts safely', async () => {
      const token = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Multiple simultaneous logout requests
      const logoutPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/auth/logout')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(logoutPromises);
      
      // All should succeed or handle gracefully
      responses.forEach(response => {
        expect([200, 401]).toContain(response.status);
      });
    });

    it('should prevent session fixation attacks', async () => {
      // Attempt to login with a pre-existing session token
      const preExistingToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/auth/login')
        .set('Authorization', `Bearer ${preExistingToken}`)
        .send({
          email: TEST_USERS.VALID_USER.email,
          password: TEST_USERS.VALID_USER.password
        });

      // Should issue a new token, not reuse the old one
      if (response.status === 200) {
        const newToken = response.body.data?.tokens?.access_token;
        expect(newToken).toBeDefined();
        expect(newToken).not.toBe(preExistingToken);
      }
    });
  });

  describe('Authorization Security', () => {
    let businessToken: string;
    let adminToken: string;

    beforeEach(() => {
      businessToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );

      adminToken = jwt.sign(
        { 
          userId: TEST_USERS.ADMIN_USER.id,
          email: TEST_USERS.ADMIN_USER.email,
          role: 'admin_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should enforce role-based access control', async () => {
      // Business user should not access admin endpoints
      const response = await request(app)
        .get('/admin/users') // Hypothetical admin endpoint
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should prevent privilege escalation', async () => {
      // Attempt to modify user role
      const response = await request(app)
        .patch('/auth/profile')
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          role: 'admin_account' // Attempt to escalate to admin
        })
        .expect((res) => {
          // Should either reject the field or the entire request
          expect([400, 403, 422]).toContain(res.status);
        });
    });

    it('should validate resource ownership', async () => {
      const otherUserBusinessId = '999e4567-e89b-12d3-a456-426614174999';
      
      // Attempt to access another user's business
      const response = await request(app)
        .get(`/businesses/${otherUserBusinessId}`)
        .set('Authorization', `Bearer ${businessToken}`)
        .expect((res) => {
          expect([403, 404]).toContain(res.status);
        });
    });

    it('should prevent CSRF attacks', async () => {
      // Attempt to make request without proper headers
      const response = await request(app)
        .post('/businesses')
        .set('Authorization', `Bearer ${businessToken}`)
        .set('Origin', 'http://malicious-site.com')
        .send({
          name: 'Malicious Business',
          description: 'Created via CSRF',
          contact_email: 'csrf@malicious.com'
        });

      // Should be rejected due to CORS or CSRF protection
      expect([403, 400]).toContain(response.status);
    });
  });

  describe('Input Validation Security', () => {
    let validToken: string;

    beforeEach(() => {
      validToken = jwt.sign(
        { 
          userId: TEST_USERS.VALID_USER.id,
          email: TEST_USERS.VALID_USER.email,
          role: 'business_account'
        },
        SECURITY_CONFIG.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should sanitize input to prevent XSS', async () => {
      for (const payload of MALICIOUS_PAYLOADS.XSS_PAYLOADS) {
        const response = await request(app)
          .post('/businesses')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            name: payload,
            description: payload,
            contact_email: 'test@example.com'
          });

        // Should either validate and reject, or sanitize the input
        if (response.status === 201) {
          expect(response.body.data?.name).not.toContain('<script>');
          expect(response.body.data?.description).not.toContain('<script>');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    it('should validate email formats strictly', async () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user@@domain.com',
        'user@domain',
        'user.domain.com',
        'user@domain..com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email,
            password: 'ValidPass123!',
            first_name: 'Test',
            last_name: 'User'
          })
          .expect(422);

        expect(response.body.error).toContain('Invalid email');
      }
    });

    it('should validate UUID formats for ID parameters', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        'invalid-uuid-format',
        '123e4567-e89b-12d3-a456-42661417400', // Too short
        '123e4567-e89b-12d3-a456-426614174000-extra' // Too long
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .get(`/businesses/${invalidUUID}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(400);

        expect(response.body.error).toContain('Invalid UUID');
      }
    });

    it('should prevent command injection in parameters', async () => {
      for (const payload of MALICIOUS_PAYLOADS.COMMAND_INJECTION) {
        const response = await request(app)
          .get('/businesses')
          .set('Authorization', `Bearer ${validToken}`)
          .query({ search: payload });

        // Should sanitize or reject the input
        expect([200, 400, 422]).toContain(response.status);
        
        if (response.status === 200) {
          // Response should not indicate command execution
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('root:');
          expect(responseText).not.toContain('/etc/passwd');
        }
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose sensitive information in headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Should not expose sensitive server information
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive error information', async () => {
      // Attempt to trigger a database error
      const response = await request(app)
        .get('/businesses/invalid-uuid-that-causes-error')
        .set('Authorization', `Bearer ${jwt.sign({}, SECURITY_CONFIG.JWT_SECRET)}`);

      // Error response should not contain stack traces or database details
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('Error:');
      expect(responseText).not.toContain('Stack trace:');
      expect(responseText).not.toContain('Database');
      expect(responseText).not.toContain('Supabase');
      expect(responseText).not.toContain('postgres');
    });

    it('should return consistent error formats', async () => {
      const responses = await Promise.all([
        request(app).post('/auth/login').send({}), // Missing fields
        request(app).get('/auth/profile'), // Missing auth
        request(app).get('/businesses/invalid-id').set('Authorization', 'Bearer invalid') // Invalid token
      ]);

      responses.forEach(response => {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('timestamp');
      });
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for invalid users', async () => {
      const timings: number[] = [];
      
      // Test with multiple non-existent users
      const nonExistentEmails = [
        'nonexistent1@test.com',
        'nonexistent2@test.com',
        'nonexistent3@test.com'
      ];

      for (const email of nonExistentEmails) {
        const start = Date.now();
        await request(app)
          .post('/auth/login')
          .send({
            email,
            password: 'anypassword'
          })
          .expect(401);
        const end = Date.now();
        
        timings.push(end - start);
      }

      // Response times should be relatively consistent (within 100ms)
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const timingDifference = maxTiming - minTiming;
      
      expect(timingDifference).toBeLessThan(100);
    });
  });
});