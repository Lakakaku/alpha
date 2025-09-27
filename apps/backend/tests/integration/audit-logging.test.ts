import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Audit Logging Integration', () => {
  const supabase = createSupabaseClient();
  let authToken: string;
  let testAdminId: string;
  let testBusinessId: string;
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

    testBusinessId = businessData.id;

    const { data: storeData } = await supabase
      .from('stores')
      .insert({
        business_id: testBusinessId,
        name: 'Test Store',
        address: 'Test Address 123',
        city: 'Stockholm',
        phone: '+46701234567'
      })
      .select()
      .single();

    testStoreId = storeData.id;

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
    await supabase.from('audit_logs').delete().eq('admin_id', testAdminId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  beforeEach(async () => {
    // Clean up audit logs before each test
    await supabase.from('audit_logs').delete().eq('admin_id', testAdminId);
  });

  describe('Authentication Audit Logs', () => {
    it('should log successful login', async () => {
      // Logout first to test fresh login
      await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGIN');

      // Login
      const loginResponse = await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'testpassword'
        })
        .expect(200);

      authToken = loginResponse.body.session_token;

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGIN');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'LOGIN')
        .eq('admin_id', testAdminId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.admin_id).toBe(testAdminId);
      expect(auditLog.action).toBe('LOGIN');
      expect(auditLog.resource_type).toBe('session');
      expect(auditLog.details.username).toBe('testadmin');
      expect(auditLog.details.ip_address).toBeDefined();
      expect(auditLog.created_at).toBeDefined();
    });

    it('should log failed login attempts', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGIN_FAILED');

      await request(app)
        .post('/api/admin/auth/login')
        .send({
          username: 'testadmin',
          password: 'wrongpassword'
        })
        .expect(401);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGIN_FAILED');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'LOGIN_FAILED')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.admin_id).toBeNull(); // No admin ID for failed login
      expect(auditLog.action).toBe('LOGIN_FAILED');
      expect(auditLog.details.username).toBe('testadmin');
      expect(auditLog.details.reason).toBe('invalid_credentials');
    });

    it('should log logout', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGOUT');

      await request(app)
        .post('/api/admin/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'LOGOUT');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'LOGOUT')
        .eq('admin_id', testAdminId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.admin_id).toBe(testAdminId);
      expect(auditLog.action).toBe('LOGOUT');
      expect(auditLog.resource_type).toBe('session');
    });
  });

  describe('Store Management Audit Logs', () => {
    it('should log store creation', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'CREATE_STORE');

      const storeData = {
        business_id: testBusinessId,
        name: 'Audit Test Store',
        address: 'Audit Address',
        city: 'Stockholm',
        phone: '+46701234569'
      };

      const response = await request(app)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .send(storeData)
        .expect(201);

      const createdStoreId = response.body.store.id;

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
      expect(auditLog.resource_id).toBe(createdStoreId);
      expect(auditLog.details.store_name).toBe(storeData.name);
      expect(auditLog.details.business_id).toBe(testBusinessId);

      // Clean up
      await supabase.from('stores').delete().eq('id', createdStoreId);
    });

    it('should log store updates', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPDATE_STORE');

      const updateData = {
        name: 'Updated Store Name',
        description: 'Updated description'
      };

      await request(app)
        .put(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPDATE_STORE');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'UPDATE_STORE')
        .eq('admin_id', testAdminId)
        .eq('resource_id', testStoreId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.resource_type).toBe('store');
      expect(auditLog.details.changes).toBeDefined();
      expect(auditLog.details.changes.name).toBe(updateData.name);
    });

    it('should log store deactivation', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'DEACTIVATE_STORE');

      await request(app)
        .delete(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'DEACTIVATE_STORE');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'DEACTIVATE_STORE')
        .eq('admin_id', testAdminId)
        .eq('resource_id', testStoreId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.resource_type).toBe('store');
      expect(auditLog.details.previous_status).toBe('active');

      // Reactivate for other tests
      await supabase
        .from('stores')
        .update({ is_active: true })
        .eq('id', testStoreId);
    });
  });

  describe('Data Upload Audit Logs', () => {
    it('should log data uploads', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPLOAD_DATA');

      // Create test CSV content
      const csvContent = `store_id,metric_type,value,recorded_at
${testStoreId},qr_scans,150,2024-01-01T10:00:00Z`;

      // Create temporary file
      const fs = require('fs');
      const path = require('path');
      const testFile = path.join(__dirname, '../fixtures/test-audit.csv');
      
      // Ensure directory exists
      const dir = path.dirname(testFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(testFile, csvContent);

      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFile)
        .expect(200);

      const uploadId = response.body.upload_id;

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPLOAD_DATA');

      expect(afterCount.count! - beforeCount.count!).toBe(1);

      // Verify audit log details
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'UPLOAD_DATA')
        .eq('admin_id', testAdminId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(auditLog.resource_type).toBe('data_upload');
      expect(auditLog.resource_id).toBe(uploadId);
      expect(auditLog.details.filename).toBe('test-audit.csv');
      expect(auditLog.details.records_count).toBeDefined();

      // Clean up
      fs.unlinkSync(testFile);
    });
  });

  describe('Audit Log Retrieval', () => {
    beforeEach(async () => {
      // Create some test audit logs
      const testLogs = [
        {
          admin_id: testAdminId,
          action: 'LOGIN',
          resource_type: 'session',
          resource_id: 'session-1',
          details: { username: 'testadmin', ip_address: '127.0.0.1' },
          created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        },
        {
          admin_id: testAdminId,
          action: 'CREATE_STORE',
          resource_type: 'store',
          resource_id: testStoreId,
          details: { store_name: 'Test Store' },
          created_at: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
        },
        {
          admin_id: testAdminId,
          action: 'UPDATE_STORE',
          resource_type: 'store',
          resource_id: testStoreId,
          details: { changes: { name: 'Updated Name' } },
          created_at: new Date(Date.now() - 900000).toISOString() // 15 minutes ago
        }
      ];

      await supabase.from('audit_logs').insert(testLogs);
    });

    it('should retrieve audit logs with pagination', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?limit=2&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.logs.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?action=CREATE_STORE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeGreaterThan(0);
      response.body.logs.forEach((log: any) => {
        expect(log.action).toBe('CREATE_STORE');
      });
    });

    it('should filter audit logs by resource type', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?resource_type=store')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeGreaterThan(0);
      response.body.logs.forEach((log: any) => {
        expect(log.resource_type).toBe('store');
      });
    });

    it('should filter audit logs by date range', async () => {
      const fromDate = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
      const toDate = new Date().toISOString(); // now

      const response = await request(app)
        .get(`/api/admin/audit-logs?from=${fromDate}&to=${toDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeGreaterThan(0);
      response.body.logs.forEach((log: any) => {
        const logDate = new Date(log.created_at);
        expect(logDate.getTime()).toBeGreaterThanOrEqual(new Date(fromDate).getTime());
        expect(logDate.getTime()).toBeLessThanOrEqual(new Date(toDate).getTime());
      });
    });

    it('should filter audit logs by admin', async () => {
      const response = await request(app)
        .get(`/api/admin/audit-logs?admin_id=${testAdminId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeGreaterThan(0);
      response.body.logs.forEach((log: any) => {
        expect(log.admin_id).toBe(testAdminId);
      });
    });

    it('should sort audit logs by date (newest first)', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.logs.length).toBeGreaterThan(1);
      
      for (let i = 1; i < response.body.logs.length; i++) {
        const currentDate = new Date(response.body.logs[i].created_at);
        const previousDate = new Date(response.body.logs[i - 1].created_at);
        expect(currentDate.getTime()).toBeLessThanOrEqual(previousDate.getTime());
      }
    });

    it('should include admin information in logs', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const logsWithAdmin = response.body.logs.filter((log: any) => log.admin_id);
      expect(logsWithAdmin.length).toBeGreaterThan(0);

      logsWithAdmin.forEach((log: any) => {
        expect(log.admin).toBeDefined();
        expect(log.admin.username).toBeDefined();
        expect(log.admin.full_name).toBeDefined();
      });
    });

    it('should handle invalid filter parameters', async () => {
      const response = await request(app)
        .get('/api/admin/audit-logs?limit=invalid&offset=abc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Audit Log Security', () => {
    it('should require authentication for audit log access', async () => {
      await request(app)
        .get('/api/admin/audit-logs')
        .expect(401);
    });

    it('should not allow modification of audit logs', async () => {
      // Try to update an audit log (should not have this endpoint)
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('admin_id', testAdminId)
        .limit(1)
        .single();

      if (auditLog) {
        await request(app)
          .put(`/api/admin/audit-logs/${auditLog.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ action: 'MODIFIED' })
          .expect(404); // Should not exist
      }
    });

    it('should not allow deletion of audit logs', async () => {
      // Try to delete an audit log (should not have this endpoint)
      const { data: auditLog } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('admin_id', testAdminId)
        .limit(1)
        .single();

      if (auditLog) {
        await request(app)
          .delete(`/api/admin/audit-logs/${auditLog.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404); // Should not exist
      }
    });
  });

  describe('Audit Log Data Integrity', () => {
    it('should preserve audit logs across system operations', async () => {
      // Create an audit log
      await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('admin_id', testAdminId);

      // Perform some other operations
      await request(app)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('admin_id', testAdminId);

      // Original logs should still exist
      expect(afterCount.count!).toBeGreaterThanOrEqual(beforeCount.count!);
    });

    it('should handle high-volume audit logging', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/admin/stores')
          .set('Authorization', `Bearer ${authToken}`)
      );

      await Promise.all(requests);

      // All requests should succeed and generate logs
      const { count } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('admin_id', testAdminId);

      expect(count).toBeGreaterThan(0);
    });
  });
});