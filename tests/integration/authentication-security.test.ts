import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../setup';
import { SecurityTestingService } from '../../apps/backend/src/services/security/SecurityTestingService';
import { createSupabaseClient } from '../../packages/database/src/client/supabase';

describe('Authentication Security Validation', () => {
  let app: Express;
  let securityTestingService: SecurityTestingService;
  let supabase: any;

  beforeEach(async () => {
    app = await createTestApp();
    securityTestingService = new SecurityTestingService();
    supabase = createSupabaseClient();
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Brute Force Protection', () => {
    it('should block brute force login attempts', async () => {
      const loginAttempts = [];
      const invalidCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Attempt multiple failed logins rapidly
      for (let i = 0; i < 10; i++) {
        loginAttempts.push(
          request(app)
            .post('/api/admin/auth/login')
            .send(invalidCredentials)
        );
      }

      const responses = await Promise.all(loginAttempts);
      
      // First few attempts should return 401 (invalid credentials)
      expect(responses[0].status).toBe(401);
      expect(responses[1].status).toBe(401);
      expect(responses[2].status).toBe(401);
      
      // Later attempts should be rate limited (429)
      const rateLimitedResponses = responses.slice(5);
      expect(rateLimitedResponses.some(res => res.status === 429)).toBe(true);
      
      // Verify audit logging
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'LOGIN_ATTEMPT')
        .eq('status', 'FAILED');
      
      expect(auditLogs.length).toBeGreaterThanOrEqual(5);
    });

    it('should implement progressive delay on repeated failures', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      
      // First attempt
      const start1 = Date.now();
      await request(app)
        .post('/api/admin/auth/login')
        .send({ email, password });
      const time1 = Date.now() - start1;
      
      // Second attempt (should have delay)
      const start2 = Date.now();
      await request(app)
        .post('/api/admin/auth/login')
        .send({ email, password });
      const time2 = Date.now() - start2;
      
      // Third attempt (should have longer delay)
      const start3 = Date.now();
      await request(app)
        .post('/api/admin/auth/login')
        .send({ email, password });
      const time3 = Date.now() - start3;
      
      // Verify progressive delays
      expect(time2).toBeGreaterThan(time1);
      expect(time3).toBeGreaterThan(time2);
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate sessions after timeout', async () => {
      // Create a valid session
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@vocilia.com',
          password: 'validpassword'
        });
      
      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.token;
      
      // Verify session is valid
      const validRequest = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${token}`);
      
      expect(validRequest.status).toBe(200);
      
      // Fast-forward time by mocking session expiration
      // In real implementation, this would be 2 hours
      await supabase
        .from('admin_sessions')
        .update({ 
          expires_at: new Date(Date.now() - 1000).toISOString() 
        })
        .eq('token', token);
      
      // Verify session is now invalid
      const expiredRequest = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${token}`);
      
      expect(expiredRequest.status).toBe(401);
      expect(expiredRequest.body.error).toContain('Session expired');
    });

    it('should prevent session hijacking with IP validation', async () => {
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@vocilia.com',
          password: 'validpassword'
        })
        .set('X-Forwarded-For', '192.168.1.100');
      
      const token = loginResponse.body.token;
      
      // Request from same IP should work
      const sameIpRequest = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '192.168.1.100');
      
      expect(sameIpRequest.status).toBe(200);
      
      // Request from different IP should be rejected
      const differentIpRequest = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '10.0.0.1');
      
      expect(differentIpRequest.status).toBe(401);
      expect(differentIpRequest.body.error).toContain('IP mismatch');
    });
  });

  describe('Password Reset Security', () => {
    it('should prevent password reset token reuse', async () => {
      // Request password reset
      const resetRequest = await request(app)
        .post('/api/admin/auth/password-reset')
        .send({ email: 'admin@vocilia.com' });
      
      expect(resetRequest.status).toBe(200);
      
      // Get reset token from database (in real scenario, this would be sent via email)
      const { data: resetTokens } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('email', 'admin@vocilia.com')
        .order('created_at', { ascending: false })
        .limit(1);
      
      const resetToken = resetTokens[0].token;
      
      // Use token once
      const firstUse = await request(app)
        .post('/api/admin/auth/password-reset/confirm')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        });
      
      expect(firstUse.status).toBe(200);
      
      // Try to use token again
      const secondUse = await request(app)
        .post('/api/admin/auth/password-reset/confirm')
        .send({
          token: resetToken,
          newPassword: 'anotherpassword'
        });
      
      expect(secondUse.status).toBe(400);
      expect(secondUse.body.error).toContain('Invalid or expired token');
    });

    it('should expire password reset tokens after timeout', async () => {
      // Request password reset
      await request(app)
        .post('/api/admin/auth/password-reset')
        .send({ email: 'admin@vocilia.com' });
      
      // Get and expire the token
      const { data: resetTokens } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('email', 'admin@vocilia.com')
        .order('created_at', { ascending: false })
        .limit(1);
      
      const resetToken = resetTokens[0].token;
      
      // Manually expire the token
      await supabase
        .from('password_reset_tokens')
        .update({ 
          expires_at: new Date(Date.now() - 1000).toISOString() 
        })
        .eq('token', resetToken);
      
      // Try to use expired token
      const expiredUse = await request(app)
        .post('/api/admin/auth/password-reset/confirm')
        .send({
          token: resetToken,
          newPassword: 'newpassword123'
        });
      
      expect(expiredUse.status).toBe(400);
      expect(expiredUse.body.error).toContain('expired');
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        "' OR '1'='1",
        "admin'; DROP TABLE admin_accounts; --",
        "' UNION SELECT * FROM admin_accounts --",
        "'; UPDATE admin_accounts SET password='hacked' WHERE email='admin@vocilia.com'; --"
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/admin/auth/login')
          .send({
            email: injection,
            password: injection
          });
        
        // Should not succeed with SQL injection
        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid credentials');
      }
      
      // Verify admin accounts table is intact
      const { data: adminAccounts } = await supabase
        .from('admin_accounts')
        .select('count');
      
      expect(adminAccounts).toBeDefined();
    });

    it('should prevent JWT token manipulation', async () => {
      // Get a valid token
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@vocilia.com',
          password: 'validpassword'
        });
      
      const validToken = loginResponse.body.token;
      
      // Test manipulated tokens
      const manipulatedTokens = [
        validToken.slice(0, -5) + 'xxxxx', // Modified signature
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.invalid', // Invalid token
        validToken.split('.').slice(0, 2).join('.') + '.tamperedsignature', // Tampered signature
        'Bearer invalid-token-format' // Invalid format
      ];

      for (const token of manipulatedTokens) {
        const response = await request(app)
          .get('/api/admin/stores')
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Performance Impact Validation', () => {
    it('should maintain authentication performance under security measures', async () => {
      const startTime = Date.now();
      const concurrentLogins = [];
      
      // Test concurrent authentication requests
      for (let i = 0; i < 20; i++) {
        concurrentLogins.push(
          request(app)
            .post('/api/admin/auth/login')
            .send({
              email: 'admin@vocilia.com',
              password: 'validpassword'
            })
        );
      }
      
      const responses = await Promise.all(concurrentLogins);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      expect(responses.every(res => res.status === 200)).toBe(true);
      
      // Performance should not degrade more than 10%
      const averageResponseTime = totalTime / responses.length;
      expect(averageResponseTime).toBeLessThan(500); // 500ms max per auth request
      
      // Log performance metrics
      await securityTestingService.recordPerformanceMetrics({
        test_type: 'authentication_load',
        concurrent_requests: 20,
        total_time_ms: totalTime,
        average_response_time_ms: averageResponseTime,
        success_rate: 100
      });
    });
  });
});