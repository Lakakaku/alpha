import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Admin Verification Cycles POST API Contract', () => {
  let testAdminId: string;
  let validSessionToken: string;
  let createdCycleIds: string[] = [];

  beforeAll(async () => {
    // Create test admin account
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'test.verification.post.admin@vocilia.com',
      password: 'TestAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'test_verification_post_admin',
          full_name: 'Test Verification POST Administrator',
          email: 'test.verification.post.admin@vocilia.com',
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
          session_token: 'test_verification_post_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      validSessionToken = session.session_token;
    }
  });

  afterAll(async () => {
    // Cleanup created cycles
    if (createdCycleIds.length > 0) {
      await supabase
        .from('weekly_verification_cycles')
        .delete()
        .in('id', createdCycleIds);
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

  describe('POST /api/admin/verification/cycles', () => {
    it('should return 401 without valid session token', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .send({
          cycle_week: '2025-09-30'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid session token', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          cycle_week: '2025-09-30'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should create verification cycle with valid data', async () => {
      const cycleWeek = '2025-09-30'; // Monday

      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: cycleWeek
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('cycle_week', cycleWeek);
      expect(response.body).toHaveProperty('status', 'preparing');
      expect(response.body).toHaveProperty('total_stores', 0);
      expect(response.body).toHaveProperty('completed_stores', 0);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');

      // Store for cleanup
      createdCycleIds.push(response.body.id);
    });

    it('should return 400 for missing cycle_week', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Bad Request');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: 'invalid-date'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for non-Monday date', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: '2025-10-01' // Tuesday
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Monday');
    });

    it('should return 409 for duplicate cycle week', async () => {
      const cycleWeek = '2025-10-06'; // Monday

      // Create first cycle
      const firstResponse = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: cycleWeek
        })
        .expect(201);

      createdCycleIds.push(firstResponse.body.id);

      // Try to create duplicate
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: cycleWeek
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('already exists');
    });

    it('should return 400 for past date', async () => {
      const pastDate = '2024-01-01'; // Past Monday

      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .send({
          cycle_week: pastDate
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('past');
    });

    it('should return 400 for invalid JSON', async () => {
      const response = await request(API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${validSessionToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});