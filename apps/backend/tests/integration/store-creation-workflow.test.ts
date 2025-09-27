import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Store Creation Workflow Integration', () => {
  const supabase = createSupabaseClient();
  let authToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let createdStoreIds: string[] = [];

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

    // Create test business
    const { data: businessData } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business for Store Creation',
        email: 'test@business.local',
        phone: '+46701234567'
      })
      .select()
      .single();

    testBusinessId = businessData.id;

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
    // Clean up created stores
    if (createdStoreIds.length > 0) {
      await supabase.from('stores').delete().in('id', createdStoreIds);
    }
    
    // Clean up test data
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  describe('Store Creation', () => {
    it('should create a new store successfully', async () => {
      const storeData = {
        business_id: testBusinessId,
        name: 'New Test Store',
        address: 'Test Address 456',
        city: 'Gothenburg',
        postal_code: '41234',
        phone: '+46701234568',
        description: 'A test store for integration testing'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(201);

      expect(response.body).toHaveProperty('store');
      const store = response.body.store;

      expect(store.id).toBeDefined();
      expect(store.name).toBe(storeData.name);
      expect(store.address).toBe(storeData.address);
      expect(store.city).toBe(storeData.city);
      expect(store.postal_code).toBe(storeData.postal_code);
      expect(store.phone).toBe(storeData.phone);
      expect(store.description).toBe(storeData.description);
      expect(store.business_id).toBe(testBusinessId);
      expect(store.is_active).toBe(true);
      expect(store.created_at).toBeDefined();

      createdStoreIds.push(store.id);
    });

    it('should create audit log for store creation', async () => {
      const storeData = {
        business_id: testBusinessId,
        name: 'Store with Audit',
        address: 'Audit Test Address',
        city: 'Stockholm',
        phone: '+46701234569'
      };

      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'CREATE_STORE');

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(201);

      createdStoreIds.push(response.body.store.id);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'CREATE_STORE');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'CREATE_STORE')
        .eq('admin_id', testAdminId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.resource_type).toBe('store');
      expect(auditLog.resource_id).toBe(response.body.store.id);
      expect(auditLog.details.store_name).toBe(storeData.name);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        business_id: testBusinessId,
        // Missing required name field
        address: 'Test Address'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should validate business_id exists', async () => {
      const storeData = {
        business_id: 'non-existent-business-id',
        name: 'Test Store',
        address: 'Test Address',
        city: 'Stockholm',
        phone: '+46701234567'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('business');
    });

    it('should validate phone number format', async () => {
      const storeData = {
        business_id: testBusinessId,
        name: 'Test Store',
        address: 'Test Address',
        city: 'Stockholm',
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('phone');
    });

    it('should generate QR code for new store', async () => {
      const storeData = {
        business_id: testBusinessId,
        name: 'QR Test Store',
        address: 'QR Test Address',
        city: 'Stockholm',
        phone: '+46701234570'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(201);

      const store = response.body.store;
      expect(store.qr_code_url).toBeDefined();
      expect(store.qr_code_url).toMatch(/^https?:\/\/.+/);

      createdStoreIds.push(store.id);
    });
  });

  describe('Store Updates', () => {
    let updateStoreId: string;

    beforeAll(async () => {
      // Create a store to update
      const { data: store } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Store to Update',
          address: 'Original Address',
          city: 'Stockholm',
          phone: '+46701234571'
        })
        .select()
        .single();

      updateStoreId = store.id;
      createdStoreIds.push(updateStoreId);
    });

    it('should update store information', async () => {
      const updateData = {
        name: 'Updated Store Name',
        address: 'Updated Address 789',
        city: 'Malmö',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/admin/stores/${updateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.store.name).toBe(updateData.name);
      expect(response.body.store.address).toBe(updateData.address);
      expect(response.body.store.city).toBe(updateData.city);
      expect(response.body.store.description).toBe(updateData.description);
    });

    it('should create audit log for store updates', async () => {
      const updateData = {
        name: 'Audit Updated Store'
      };

      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPDATE_STORE');

      await request(app)
        .put(`/api/admin/stores/${updateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPDATE_STORE');

      expect(afterCount.count! - beforeCount.count!).toBe(1);
    });

    it('should validate update data', async () => {
      const invalidData = {
        phone: 'invalid-phone-format'
      };

      const response = await request(app)
        .put(`/api/admin/stores/${updateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = {
        description: 'Only updating description'
      };

      const response = await request(app)
        .put(`/api/admin/stores/${updateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.store.description).toBe(partialUpdate.description);
      // Other fields should remain unchanged
      expect(response.body.store.name).toBe('Audit Updated Store');
    });
  });

  describe('Store Deactivation', () => {
    let deactivateStoreId: string;

    beforeAll(async () => {
      // Create a store to deactivate
      const { data: store } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Store to Deactivate',
          address: 'Deactivate Address',
          city: 'Stockholm',
          phone: '+46701234572'
        })
        .select()
        .single();

      deactivateStoreId = store.id;
      createdStoreIds.push(deactivateStoreId);
    });

    it('should deactivate store', async () => {
      const response = await request(app)
        .delete(`/api/admin/stores/${deactivateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.store.is_active).toBe(false);
    });

    it('should create audit log for deactivation', async () => {
      // Reactivate first
      await supabase
        .from('stores')
        .update({ is_active: true })
        .eq('id', deactivateStoreId);

      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'DEACTIVATE_STORE');

      await request(app)
        .delete(`/api/admin/stores/${deactivateStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'DEACTIVATE_STORE');

      expect(afterCount.count! - beforeCount.count!).toBe(1);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for store creation', async () => {
      const storeData = {
        business_id: testBusinessId,
        name: 'Unauthorized Store',
        address: 'Test Address',
        city: 'Stockholm'
      };

      await request(app)
        .post('/api/admin/stores')
        .send(storeData)
        .expect(401);
    });

    it('should require authentication for store updates', async () => {
      await request(app)
        .put('/api/admin/stores/some-id')
        .send({ name: 'Updated Name' })
        .expect(401);
    });

    it('should require authentication for store deactivation', async () => {
      await request(app)
        .delete('/api/admin/stores/some-id')
        .expect(401);
    });
  });
});