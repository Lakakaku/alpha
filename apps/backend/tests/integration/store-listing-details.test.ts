import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Store Listing and Details Integration', () => {
  const supabase = createSupabaseClient();
  let authToken: string;
  let testAdminId: string;
  let testStoreId: string;

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

    // Create test business and store
    const { data: businessData } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business',
        email: 'test@business.local',
        phone: '+46701234567'
      })
      .select()
      .single();

    const { data: storeData } = await supabase
      .from('stores')
      .insert({
        business_id: businessData.id,
        name: 'Test Store',
        address: 'Test Address 123',
        city: 'Stockholm',
        phone: '+46701234567'
      })
      .select()
      .single();

    testStoreId = storeData.id;

    // Create some store status metrics
    await supabase
      .from('store_status_metrics')
      .insert([
        {
          store_id: testStoreId,
          metric_type: 'qr_scans',
          value: 150,
          recorded_at: new Date().toISOString()
        },
        {
          store_id: testStoreId,
          metric_type: 'successful_calls',
          value: 120,
          recorded_at: new Date().toISOString()
        },
        {
          store_id: testStoreId,
          metric_type: 'failed_calls',
          value: 5,
          recorded_at: new Date().toISOString()
        }
      ]);

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.session_token;
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('store_status_metrics').delete().eq('store_id', testStoreId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('name', 'Test Business');
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  describe('Store Listing', () => {
    it('should list all stores with basic information', async () => {
      const response = await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stores');
      expect(Array.isArray(response.body.stores)).toBe(true);
      expect(response.body.stores.length).toBeGreaterThan(0);

      const store = response.body.stores.find((s: any) => s.id === testStoreId);
      expect(store).toBeDefined();
      expect(store.name).toBe('Test Store');
      expect(store.business_name).toBe('Test Business');
      expect(store.address).toBe('Test Address 123');
      expect(store.city).toBe('Stockholm');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/stores?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stores');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
      expect(response.body.stores.length).toBeLessThanOrEqual(5);
    });

    it('should support search by store name', async () => {
      const response = await request(app)
        .get('/api/admin/stores?search=Test Store')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stores.length).toBeGreaterThan(0);
      const store = response.body.stores.find((s: any) => s.id === testStoreId);
      expect(store).toBeDefined();
    });

    it('should support filtering by city', async () => {
      const response = await request(app)
        .get('/api/admin/stores?city=Stockholm')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stores.length).toBeGreaterThan(0);
      response.body.stores.forEach((store: any) => {
        expect(store.city).toBe('Stockholm');
      });
    });

    it('should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/stores?limit=invalid&offset=abc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Store Details', () => {
    it('should return comprehensive store details', async () => {
      const response = await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('store');
      const store = response.body.store;

      // Basic store information
      expect(store.id).toBe(testStoreId);
      expect(store.name).toBe('Test Store');
      expect(store.address).toBe('Test Address 123');
      expect(store.city).toBe('Stockholm');
      expect(store.phone).toBe('+46701234567');

      // Business information
      expect(store.business).toBeDefined();
      expect(store.business.name).toBe('Test Business');
      expect(store.business.email).toBe('test@business.local');

      // Metrics
      expect(store.metrics).toBeDefined();
      expect(store.metrics.qr_scans).toBe(150);
      expect(store.metrics.successful_calls).toBe(120);
      expect(store.metrics.failed_calls).toBe(5);

      // Status
      expect(store.status).toBeDefined();
      expect(store.status.is_active).toBeDefined();
      expect(store.status.last_activity).toBeDefined();
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(app)
        .get('/api/admin/stores/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Store not found');
    });

    it('should validate store ID format', async () => {
      const response = await request(app)
        .get('/api/admin/stores/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid store ID format');
    });

    it('should include recent activity metrics', async () => {
      const response = await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const store = response.body.store;
      expect(store.recent_activity).toBeDefined();
      expect(Array.isArray(store.recent_activity)).toBe(true);
    });

    it('should calculate derived metrics correctly', async () => {
      const response = await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const store = response.body.store;
      const metrics = store.metrics;
      
      // Success rate should be calculated
      expect(metrics.success_rate).toBeDefined();
      const expectedSuccessRate = (120 / (120 + 5)) * 100; // 96%
      expect(metrics.success_rate).toBeCloseTo(expectedSuccessRate, 1);

      // Total calls
      expect(metrics.total_calls).toBe(125);
    });
  });

  describe('Store Status Updates', () => {
    it('should track store status changes', async () => {
      // Get initial status
      const initialResponse = await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialStatus = initialResponse.body.store.status;

      // Add some activity to change status
      await supabase
        .from('store_status_metrics')
        .insert({
          store_id: testStoreId,
          metric_type: 'qr_scans',
          value: 1,
          recorded_at: new Date().toISOString()
        });

      // Get updated status
      const updatedResponse = await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedStatus = updatedResponse.body.store.status;

      // Last activity should be more recent
      expect(new Date(updatedStatus.last_activity).getTime())
        .toBeGreaterThan(new Date(initialStatus.last_activity).getTime());
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for store listing', async () => {
      await request(app)
        .get('/api/admin/stores')
        .expect(401);
    });

    it('should require authentication for store details', async () => {
      await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .expect(401);
    });

    it('should reject invalid auth tokens', async () => {
      await request(app)
        .get('/api/admin/stores')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});