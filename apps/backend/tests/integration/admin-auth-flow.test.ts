import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Admin Authentication Flow Integration', () => {
  const supabase = createSupabaseClient();
  let testAdminId: string;

  beforeAll(async () => {
    // Create test admin account
    const { data: adminData, error } = await supabase
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
    
    if (error) throw error;
    testAdminId = adminData.id;
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  afterEach(async () => {
    // Clean up sessions after each test
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
  });

  it('should complete full authentication flow', async () => {
    // 1. Login
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword'
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('session_token');
    expect(loginResponse.body).toHaveProperty('expires_at');
    const sessionToken = loginResponse.body.session_token;

    // 2. Verify session is active
    const sessionResponse = await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(sessionResponse.body.admin.username).toBe('testadmin');
    expect(sessionResponse.body.session.is_active).toBe(true);

    // 3. Access protected endpoint
    const protectedResponse = await request(app)
      .get('/api/admin/stores')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(Array.isArray(protectedResponse.body.stores)).toBe(true);

    // 4. Logout
    await request(app)
      .post('/api/admin/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    // 5. Verify session is invalidated
    await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(401);
  });

  it('should handle session timeout correctly', async () => {
    // Create expired session
    const { data: session } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: testAdminId,
        session_token: 'expired-token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
        is_active: true
      })
      .select()
      .single();

    // Try to use expired session
    await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', 'Bearer expired-token')
      .expect(401);

    // Verify session is marked inactive
    const { data: updatedSession } = await supabase
      .from('admin_sessions')
      .select('is_active')
      .eq('session_token', 'expired-token')
      .single();

    expect(updatedSession?.is_active).toBe(false);
  });

  it('should prevent concurrent sessions for same admin', async () => {
    // First login
    const firstLogin = await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword'
      })
      .expect(200);

    const firstToken = firstLogin.body.session_token;

    // Second login should invalidate first session
    const secondLogin = await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword'
      })
      .expect(200);

    const secondToken = secondLogin.body.session_token;
    expect(secondToken).not.toBe(firstToken);

    // First session should be invalid
    await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(401);

    // Second session should be valid
    await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);
  });

  it('should audit authentication events', async () => {
    const beforeCount = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact' })
      .eq('admin_id', testAdminId);

    // Login creates audit log
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword'
      })
      .expect(200);

    const sessionToken = loginResponse.body.session_token;

    // Logout creates audit log
    await request(app)
      .post('/api/admin/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    const afterCount = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact' })
      .eq('admin_id', testAdminId);

    // Should have at least 2 new audit logs (login + logout)
    expect(afterCount.count! - beforeCount.count!).toBeGreaterThanOrEqual(2);

    // Verify audit log content
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('admin_id', testAdminId)
      .order('created_at', { ascending: false })
      .limit(2);

    expect(auditLogs?.[0].action).toBe('LOGOUT');
    expect(auditLogs?.[1].action).toBe('LOGIN');
  });

  it('should handle invalid credentials properly', async () => {
    // Wrong username
    await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'wronguser',
        password: 'testpassword'
      })
      .expect(401);

    // Wrong password
    await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'wrongpassword'
      })
      .expect(401);

    // Missing credentials
    await request(app)
      .post('/api/admin/auth/login')
      .send({})
      .expect(400);
  });
});