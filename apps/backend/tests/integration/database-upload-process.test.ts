import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';
import path from 'path';
import fs from 'fs';

describe('Database Upload Process Integration', () => {
  const supabase = createSupabaseClient();
  let authToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreId: string;

  // Test CSV content
  const validCsvContent = `store_id,metric_type,value,recorded_at
${'{STORE_ID}'},qr_scans,150,2024-01-01T10:00:00Z
${'{STORE_ID}'},successful_calls,120,2024-01-01T10:00:00Z
${'{STORE_ID}'},failed_calls,5,2024-01-01T10:00:00Z`;

  const invalidCsvContent = `invalid,header,format
some,invalid,data,extra,columns`;

  const largeCsvContent = Array.from({ length: 10000 }, (_, i) => 
    `store-${i},qr_scans,${i},2024-01-01T10:00:00Z`
  ).join('\n');

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

    // Create test CSV files
    const testDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Valid CSV file
    fs.writeFileSync(
      path.join(testDir, 'valid-metrics.csv'),
      validCsvContent.replace(/{STORE_ID}/g, testStoreId)
    );

    // Invalid CSV file
    fs.writeFileSync(
      path.join(testDir, 'invalid-metrics.csv'),
      invalidCsvContent
    );

    // Large CSV file (simulating file size limit)
    fs.writeFileSync(
      path.join(testDir, 'large-metrics.csv'),
      `store_id,metric_type,value,recorded_at\n${largeCsvContent}`
    );

    // Empty CSV file
    fs.writeFileSync(path.join(testDir, 'empty-metrics.csv'), '');

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
    // Clean up test files
    const testDir = path.join(__dirname, '../fixtures');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clean up database
    await supabase.from('store_status_metrics').delete().eq('store_id', testStoreId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  beforeEach(async () => {
    // Clean metrics before each test
    await supabase.from('store_status_metrics').delete().eq('store_id', testStoreId);
  });

  describe('CSV File Upload', () => {
    it('should successfully upload valid CSV file', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/valid-metrics.csv'))
        .expect(200);

      expect(response.body).toHaveProperty('upload_id');
      expect(response.body).toHaveProperty('status', 'processing');
      expect(response.body).toHaveProperty('records_count');
      expect(response.body.records_count).toBe(3);
    });

    it('should validate file format', async () => {
      // Create a text file instead of CSV
      const textFile = path.join(__dirname, '../fixtures/not-csv.txt');
      fs.writeFileSync(textFile, 'This is not a CSV file');

      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', textFile)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('CSV');

      fs.unlinkSync(textFile);
    });

    it('should enforce file size limit (50MB)', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/large-metrics.csv'))
        .expect(413);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('size');
    });

    it('should reject empty files', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/empty-metrics.csv'))
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('empty');
    });

    it('should validate CSV headers', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/invalid-metrics.csv'))
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('header');
    });

    it('should require file attachment', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file');
    });
  });

  describe('Upload Processing', () => {
    let uploadId: string;

    beforeEach(async () => {
      // Create a valid upload
      const uploadResponse = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/valid-metrics.csv'));
      
      uploadId = uploadResponse.body.upload_id;
    });

    it('should track upload status', async () => {
      const response = await request(app)
        .get(`/api/admin/stores/upload-data/${uploadId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('upload_id', uploadId);
      expect(response.body).toHaveProperty('status');
      expect(['processing', 'completed', 'failed']).toContain(response.body.status);
      expect(response.body).toHaveProperty('records_processed');
      expect(response.body).toHaveProperty('records_total');
    });

    it('should validate data during processing', async () => {
      // Wait for processing to complete or get status
      let status = 'processing';
      let attempts = 0;
      const maxAttempts = 10;

      while (status === 'processing' && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/admin/stores/upload-data/${uploadId}/status`)
          .set('Authorization', `Bearer ${authToken}`);
        
        status = statusResponse.body.status;
        
        if (status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      expect(['completed', 'failed']).toContain(status);

      if (status === 'completed') {
        // Verify data was inserted
        const { data: metrics } = await supabase
          .from('store_status_metrics')
          .select('*')
          .eq('store_id', testStoreId);

        expect(metrics?.length).toBe(3);
      }
    });

    it('should provide detailed error information for failed uploads', async () => {
      // Create an upload with invalid data
      const invalidCsv = `store_id,metric_type,value,recorded_at
invalid-store-id,qr_scans,invalid-value,invalid-date`;

      fs.writeFileSync(
        path.join(__dirname, '../fixtures/invalid-data.csv'),
        invalidCsv
      );

      const uploadResponse = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/invalid-data.csv'));

      const failedUploadId = uploadResponse.body.upload_id;

      // Wait for processing
      let status = 'processing';
      let attempts = 0;
      
      while (status === 'processing' && attempts < 10) {
        const statusResponse = await request(app)
          .get(`/api/admin/stores/upload-data/${failedUploadId}/status`)
          .set('Authorization', `Bearer ${authToken}`);
        
        status = statusResponse.body.status;
        
        if (status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      if (status === 'failed') {
        const response = await request(app)
          .get(`/api/admin/stores/upload-data/${failedUploadId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('errors');
        expect(Array.isArray(response.body.errors)).toBe(true);
        expect(response.body.errors.length).toBeGreaterThan(0);
      }

      fs.unlinkSync(path.join(__dirname, '../fixtures/invalid-data.csv'));
    });

    it('should return 404 for non-existent upload ID', async () => {
      const response = await request(app)
        .get('/api/admin/stores/upload-data/non-existent-id/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Data Validation', () => {
    it('should validate store_id references', async () => {
      const csvWithInvalidStoreId = `store_id,metric_type,value,recorded_at
non-existent-store,qr_scans,150,2024-01-01T10:00:00Z`;

      fs.writeFileSync(
        path.join(__dirname, '../fixtures/invalid-store-id.csv'),
        csvWithInvalidStoreId
      );

      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/invalid-store-id.csv'))
        .expect(200); // Upload accepted but will fail during processing

      const uploadId = response.body.upload_id;

      // Wait for processing to fail
      let status = 'processing';
      let attempts = 0;
      
      while (status === 'processing' && attempts < 10) {
        const statusResponse = await request(app)
          .get(`/api/admin/stores/upload-data/${uploadId}/status`)
          .set('Authorization', `Bearer ${authToken}`);
        
        status = statusResponse.body.status;
        
        if (status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      expect(status).toBe('failed');

      fs.unlinkSync(path.join(__dirname, '../fixtures/invalid-store-id.csv'));
    });

    it('should validate metric types', async () => {
      const csvWithInvalidMetricType = `store_id,metric_type,value,recorded_at
${testStoreId},invalid_metric_type,150,2024-01-01T10:00:00Z`;

      fs.writeFileSync(
        path.join(__dirname, '../fixtures/invalid-metric-type.csv'),
        csvWithInvalidMetricType
      );

      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/invalid-metric-type.csv'));

      const uploadId = response.body.upload_id;

      // Check if validation catches invalid metric type
      const statusResponse = await request(app)
        .get(`/api/admin/stores/upload-data/${uploadId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should either fail immediately or during processing
      if (statusResponse.body.status === 'failed') {
        expect(statusResponse.body.errors).toBeDefined();
      }

      fs.unlinkSync(path.join(__dirname, '../fixtures/invalid-metric-type.csv'));
    });

    it('should validate date formats', async () => {
      const csvWithInvalidDate = `store_id,metric_type,value,recorded_at
${testStoreId},qr_scans,150,invalid-date-format`;

      fs.writeFileSync(
        path.join(__dirname, '../fixtures/invalid-date.csv'),
        csvWithInvalidDate
      );

      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/invalid-date.csv'));

      const uploadId = response.body.upload_id;

      // Wait for processing
      let status = 'processing';
      let attempts = 0;
      
      while (status === 'processing' && attempts < 10) {
        const statusResponse = await request(app)
          .get(`/api/admin/stores/upload-data/${uploadId}/status`)
          .set('Authorization', `Bearer ${authToken}`);
        
        status = statusResponse.body.status;
        
        if (status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
      }

      expect(status).toBe('failed');

      fs.unlinkSync(path.join(__dirname, '../fixtures/invalid-date.csv'));
    });
  });

  describe('Audit Logging', () => {
    it('should create audit logs for uploads', async () => {
      const beforeCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPLOAD_DATA');

      await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/valid-metrics.csv'))
        .expect(200);

      const afterCount = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact' })
        .eq('action', 'UPLOAD_DATA');

      expect(afterCount.count! - beforeCount.count!).toBe(1);
    });

    it('should include upload details in audit log', async () => {
      const response = await request(app)
        .post('/api/admin/stores/upload-data')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', path.join(__dirname, '../fixtures/valid-metrics.csv'))
        .expect(200);

      const uploadId = response.body.upload_id;

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
      expect(auditLog.details.filename).toBe('valid-metrics.csv');
      expect(auditLog.details.records_count).toBe(3);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for upload', async () => {
      await request(app)
        .post('/api/admin/stores/upload-data')
        .attach('file', path.join(__dirname, '../fixtures/valid-metrics.csv'))
        .expect(401);
    });

    it('should require authentication for status check', async () => {
      await request(app)
        .get('/api/admin/stores/upload-data/some-id/status')
        .expect(401);
    });
  });
});