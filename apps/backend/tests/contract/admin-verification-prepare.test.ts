import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Admin Verification Prepare API Contract', () => {
  let testAdminId: string;
  let validSessionToken: string;
  let testCycleId: string;
  let testBusinessId: string;
  let testStoreId: string;

  beforeAll(async () => {
    // Create test admin account
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'test.verification.prepare.admin@vocilia.com',
      password: 'TestAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'test_verification_prepare_admin',
          full_name: 'Test Verification Prepare Administrator',
          email: 'test.verification.prepare.admin@vocilia.com',
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
          session_token: 'test_verification_prepare_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      validSessionToken = session.session_token;

      // Create test business
      const { data: business } = await supabase
        .from('businesses')
        .insert({
          name: 'Test Verification Business',
          email: 'test.business@vocilia.com',
          phone: '+46701234567'
        })
        .select()
        .single();

      testBusinessId = business.id;

      // Create test store
      const { data: store } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Test Verification Store',
          address: 'Test Address 123',
          city: 'Stockholm',
          postal_code: '12345'
        })
        .select()
        .single();

      testStoreId = store.id;

      // Create test verification cycle
      const { data: cycle } = await supabase
        .from('weekly_verification_cycles')
        .insert({
          cycle_week: '2025-09-23',
          status: 'ready',
          total_stores: 1,
          completed_stores: 0,
          created_by: testAdminId
        })
        .select()
        .single();

      testCycleId = cycle.id;

      // Create some test feedback sessions for the store
      await supabase
        .from('feedback_sessions')
        .insert([
          {
            store_id: testStoreId,
            customer_phone: '+46701234568',
            transaction_amount: 250.00,
            created_at: '2025-09-23T10:00:00Z'
          },
          {
            store_id: testStoreId,
            customer_phone: '+46701234569',
            transaction_amount: 150.00,
            created_at: '2025-09-23T14:30:00Z'
          }
        ]);
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
    
    if (testStoreId) {
      await supabase
        .from('feedback_sessions')
        .delete()
        .eq('store_id', testStoreId);
      
      await supabase
        .from('stores')
        .delete()
        .eq('id', testStoreId);
    }
    
    if (testBusinessId) {
      await supabase
        .from('businesses')
        .delete()
        .eq('id', testBusinessId);
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

  describe('POST /api/admin/verification/cycles/{cycleId}/prepare', () => {
    it('should return 401 without valid session token', async () => {
      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${testCycleId}/prepare`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid session token', async () => {
      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${testCycleId}/prepare`)
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent cycle', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${nonExistentId}/prepare`)
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Not Found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles/invalid-uuid/prepare')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('UUID');
    });

    it('should start database preparation with valid cycle', async () => {
      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${testCycleId}/prepare`)
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('job_id');
      expect(response.body.message).toContain('preparation started');
      expect(typeof response.body.job_id).toBe('string');
    });

    it('should return 409 when cycle is already prepared', async () => {
      // First, mark cycle as already prepared
      await supabase
        .from('weekly_verification_cycles')
        .update({ status: 'distributed' })
        .eq('id', testCycleId);

      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${testCycleId}/prepare`)
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already prepared');

      // Reset for other tests
      await supabase
        .from('weekly_verification_cycles')
        .update({ status: 'ready' })
        .eq('id', testCycleId);
    });

    it('should return 400 when cycle is in preparing status', async () => {
      // Set cycle to preparing
      await supabase
        .from('weekly_verification_cycles')
        .update({ status: 'preparing' })
        .eq('id', testCycleId);

      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${testCycleId}/prepare`)
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('currently preparing');

      // Reset for other tests
      await supabase
        .from('weekly_verification_cycles')
        .update({ status: 'ready' })
        .eq('id', testCycleId);
    });

    it('should return 400 when cycle has no stores', async () => {
      // Create cycle with no stores
      const { data: emptyCycle } = await supabase
        .from('weekly_verification_cycles')
        .insert({
          cycle_week: '2025-10-07',
          status: 'ready',
          total_stores: 0,
          completed_stores: 0,
          created_by: testAdminId
        })
        .select()
        .single();

      const response = await request(API_URL)
        .post(`/api/admin/verification/cycles/${emptyCycle.id}/prepare`)
        .set('Authorization', `Bearer ${validSessionToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('no stores');

      // Cleanup
      await supabase
        .from('weekly_verification_cycles')
        .delete()
        .eq('id', emptyCycle.id);
    });
  });
});