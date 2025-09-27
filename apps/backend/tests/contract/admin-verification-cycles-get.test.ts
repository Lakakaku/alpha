import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Admin Verification Cycles GET API Contract', () => {
  let testAdminId: string;
  let validSessionToken: string;
  let testCycleId: string;

  beforeAll(async () => {
    // Create test admin account
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'test.verification.admin@vocilia.com',
      password: 'TestAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'test_verification_admin',
          full_name: 'Test Verification Administrator',
          email: 'test.verification.admin@vocilia.com',
          is_active: true
        })
        .select()
        .single();

      testAdminId = data.id;

      // Create session
      const { data: session } = await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: 'test_verification_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        })
        .select()
        .single();

      validSessionToken = session.session_token;

      // Create test verification cycle
      const { data: cycle } = await supabase
        .from('weekly_verification_cycles')
        .insert({
          cycle_week: '2025-09-23',
          status: 'preparing',
          total_stores: 5,
          completed_stores: 0,
          created_by: testAdminId
        })
        .select()
        .single();

      testCycleId = cycle.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCycleId) {
      await supabase
        .from('weekly_verification_cycles')
        .delete()
        .eq('id', testCycleId);
    }
    
    if (testAdminId) {
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('admin_id', testAdminId);
      
      await supabase
        .from('admin_accounts')
        .delete()
        .eq('id', testAdminId);
    }
  });

  describe('GET /api/admin/verification/cycles', () => {
    it('should return 401 without valid session token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid session token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return verification cycles list with valid session', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cycles');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.cycles)).toBe(true);
      
      // Verify cycle structure
      if (response.body.cycles.length > 0) {
        const cycle = response.body.cycles[0];
        expect(cycle).toHaveProperty('id');
        expect(cycle).toHaveProperty('cycle_week');
        expect(cycle).toHaveProperty('status');
        expect(cycle).toHaveProperty('total_stores');
        expect(cycle).toHaveProperty('completed_stores');
        expect(cycle).toHaveProperty('created_at');
        expect(cycle).toHaveProperty('updated_at');
      }

      // Verify pagination structure
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('total_pages');
    });

    it('should support pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles?page=1&limit=10')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should support status filtering', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles?status=preparing')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cycles');
      
      // All returned cycles should have the filtered status
      response.body.cycles.forEach((cycle: any) => {
        expect(cycle.status).toBe('preparing');
      });
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles?status=invalid_status')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/verification/cycles?page=0&limit=-1')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});