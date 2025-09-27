import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Session Management Integration', () => {
  const supabase = createSupabaseClient();
  let testAdminId: string;

  beforeAll(async () => {
    // Create test admin
    const { data: adminData } = await supabase
      .from('admin_accounts')
      .insert({
        user_id: 'test-admin-user-id',
        username: 'testadmin',
        full_name: 'Test Admin',
        email: 'test@admin.local',
        is_active: true
      })
      .select()
      .single();
    
    testAdminId = adminData.id;
  });

  afterAll(async () => {
    // Clean up all test sessions and admin
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  afterEach(async () => {
    // Clean up sessions after each test
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
  });

  describe('Session Creation', () => {
    it('should create session on successful login', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      expect(response.body).toHaveProperty('session_token');
      expect(response.body).toHaveProperty('expires_at');

      // Verify session in database
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('session_token', response.body.session_token)
        .single();

      expect(session).toBeDefined();
      expect(session.admin_id).toBe(testAdminId);
      expect(session.is_active).toBe(true);
      expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should set session expiry to 2 hours from creation', async () => {
      const beforeLogin = Date.now();
      
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      const afterLogin = Date.now();
      const expiryTime = new Date(response.body.expires_at).getTime();
      
      // Should expire approximately 2 hours (7200000ms) from now
      const twoHours = 2 * 60 * 60 * 1000;
      expect(expiryTime).toBeGreaterThan(beforeLogin + twoHours - 1000); // Allow 1s tolerance
      expect(expiryTime).toBeLessThan(afterLogin + twoHours + 1000);
    });

    it('should generate unique session tokens', async () => {
      // Create first session
      const response1 = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      // Clean up first session
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('session_token', response1.body.session_token);

      // Create second session
      const response2 = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      expect(response1.body.session_token).not.toBe(response2.body.session_token);
    });

    it('should invalidate existing sessions on new login', async () => {
      // First login
      const response1 = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      const token1 = response1.body.session_token;

      // Second login should invalidate first session
      const response2 = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      const token2 = response2.body.session_token;

      // Verify first session is inactive
      const { data: session1 } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', token1)
        .single();

      expect(session1?.is_active).toBe(false);

      // Verify second session is active
      const { data: session2 } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', token2)
        .single();

      expect(session2?.is_active).toBe(true);
    });
  });

  describe('Session Validation', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create a valid session for each test
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        });
      
      validToken = response.body.session_token;
    });

    it('should validate active session', async () => {
      const response = await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.admin).toBeDefined();
      expect(response.body.admin.username).toBe('testadmin');
      expect(response.body.session).toBeDefined();
      expect(response.body.session.is_active).toBe(true);
    });

    it('should reject invalid session token', async () => {
      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired session', async () => {
      // Create expired session manually
      const expiredToken = 'expired-test-token';
      await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: expiredToken,
          expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
          is_active: true
        });

      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      // Verify session is marked inactive
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', expiredToken)
        .single();

      expect(session?.is_active).toBe(false);
    });

    it('should reject inactive session', async () => {
      // Deactivate the session
      await supabase
        .from('admin_sessions')
        .update({ is_active: false })
        .eq('session_token', validToken);

      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);
    });

    it('should require authorization header', async () => {
      await request(app)
        .get('/api/admin/auth/session')
        .expect(401);
    });

    it('should require Bearer token format', async () => {
      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', validToken) // Missing "Bearer"
        .expect(401);
    });
  });

  describe('Session Extension', () => {
    let validToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        });
      
      validToken = response.body.session_token;
    });

    it('should extend session on activity', async () => {
      // Get initial expiry time
      const { data: initialSession } = await supabase
        .from('admin_sessions')
        .select('expires_at')
        .eq('session_token', validToken)
        .single();

      const initialExpiry = new Date(initialSession.expires_at).getTime();

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make authenticated request
      await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Check if expiry was extended
      const { data: updatedSession } = await supabase
        .from('admin_sessions')
        .select('expires_at')
        .eq('session_token', validToken)
        .single();

      const updatedExpiry = new Date(updatedSession.expires_at).getTime();

      expect(updatedExpiry).toBeGreaterThan(initialExpiry);
    });

    it('should not extend expired sessions', async () => {
      // Create expired session
      const expiredToken = 'expired-extension-token';
      await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: expiredToken,
          expires_at: new Date(Date.now() - 1000).toISOString(),
          is_active: true
        });

      // Try to use expired session (should fail)
      await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      // Verify session remains inactive
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', expiredToken)
        .single();

      expect(session?.is_active).toBe(false);
    });
  });

  describe('Session Termination', () => {
    let validToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        });
      
      validToken = response.body.session_token;
    });

    it('should terminate session on logout', async () => {
      // Logout
      await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Verify session is inactive
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', validToken)
        .single();

      expect(session?.is_active).toBe(false);

      // Verify token is no longer valid
      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);
    });

    it('should handle logout with invalid token gracefully', async () => {
      await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle logout without token gracefully', async () => {
      await request(app)
        .post('/api/admin/auth/logout')
        .expect(401);
    });
  });

  describe('Concurrent Session Management', () => {
    it('should handle multiple simultaneous login attempts', async () => {
      const loginPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/admin/auth/login')
          .send({
            username: 'testadmin',
            password: 'testpassword'
          })
      );

      const responses = await Promise.all(loginPromises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('session_token');
      });

      // Only the last session should be active
      const activeSessions = await supabase
        .from('admin_sessions')
        .select('session_token')
        .eq('admin_id', testAdminId)
        .eq('is_active', true);

      expect(activeSessions.data?.length).toBe(1);
    });

    it('should handle session validation race conditions', async () => {
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        });

      const token = loginResponse.body.session_token;

      // Make multiple simultaneous requests with same token
      const requestPromises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/admin/stores')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(requestPromises);

      // All should succeed (no race condition issues)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Session Cleanup', () => {
    it('should mark expired sessions as inactive during validation', async () => {
      // Create session that will expire soon
      const shortLivedToken = 'short-lived-token';
      await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: shortLivedToken,
          expires_at: new Date(Date.now() + 100).toISOString(), // 100ms from now
          is_active: true
        });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 200));

      // Try to validate expired session
      await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(401);

      // Verify session is marked inactive
      const { data: session } = await supabase
        .from('admin_sessions')
        .select('is_active')
        .eq('session_token', shortLivedToken)
        .single();

      expect(session?.is_active).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should not leak session information in error responses', async () => {
      const response = await request(app)
        .get('/api/admin/auth/session')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Should not contain sensitive information
      expect(JSON.stringify(response.body)).not.toContain('session_token');
      expect(JSON.stringify(response.body)).not.toContain('admin_id');
    });

    it('should use secure session token generation', async () => {
      const response = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      const token = response.body.session_token;

      // Token should be sufficiently long and random
      expect(token.length).toBeGreaterThan(20);
      expect(token).toMatch(/^[a-zA-Z0-9+/=]+$/); // Base64-like pattern
    });

    it('should prevent session fixation attacks', async () => {
      // Try to create session with specific token
      const fixedToken = 'fixed-session-token';
      
      // This should fail - sessions should only be created through login
      const { error } = await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: fixedToken,
          expires_at: new Date(Date.now() + 7200000).toISOString(),
          is_active: true
        });

      // If manual insertion succeeds, the token shouldn't be valid for API access
      if (!error) {
        await request(app)
          .get('/api/admin/auth/session')
          .set('Authorization', `Bearer ${fixedToken}`)
          .expect(401);
      }
    });
  });
});