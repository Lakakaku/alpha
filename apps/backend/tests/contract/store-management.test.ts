import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Store Management API Contract', () => {
  let adminToken: string;
  let testStoreId: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Create test admin account and authenticate
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'store.admin@vocilia.com',
      password: 'StoreAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'store_admin',
          full_name: 'Store Administrator',
          email: 'store.admin@vocilia.com',
          is_active: true
        })
        .select()
        .single();

      testAdminId = data?.id;

      // Get admin token
      const loginResponse = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'store_admin',
          password: 'StoreAdmin123!'
        });

      adminToken = loginResponse.body.data?.token;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testStoreId) {
      await supabase
        .from('stores')
        .delete()
        .eq('id', testStoreId);
    }
    
    if (testAdminId) {
      await supabase
        .from('admin_accounts')
        .delete()
        .eq('id', testAdminId);
    }
  });

  describe('GET /api/admin/stores', () => {
    it('should return paginated store list', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          stores: expect.any(Array),
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total_pages: expect.any(Number),
            total_items: expect.any(Number),
            has_next: expect.any(Boolean),
            has_prev: expect.any(Boolean)
          }
        }
      });
    });

    it('should support pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.page).toBe(1);
    });

    it('should support status filtering', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores?status=online')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            online_status: true
          })
        ])
      );
    });

    it('should support search functionality', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores?search=cafe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringMatching(/cafe/i)
          })
        ])
      );
    });

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores?page=0&limit=101')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('POST /api/admin/stores', () => {
    const validStoreData = {
      name: 'Test Café Contract',
      business_email: 'contract@testcafe.se',
      phone_number: '+46 8 555 0123',
      physical_address: 'Testgatan 123, 123 45 Stockholm, Sweden',
      business_registration_number: '556987-6543'
    };

    it('should create store with valid data', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validStoreData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          store: {
            id: expect.any(String),
            name: validStoreData.name,
            business_email: validStoreData.business_email,
            phone_number: validStoreData.phone_number,
            physical_address: validStoreData.physical_address,
            business_registration_number: validStoreData.business_registration_number,
            online_status: false,
            sync_status: 'pending',
            error_count: 0,
            monitoring_enabled: true,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          },
          qr_code: expect.stringMatching(/^vocilia:\/\/store\/[a-f0-9-]+$/)
        }
      });

      testStoreId = response.body.data.store.id;
    });

    it('should validate required fields', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Store'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should validate email format', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validStoreData,
          business_email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should validate Swedish phone number format', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validStoreData,
          phone_number: '123-456-7890' // US format
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should validate Swedish business registration format', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validStoreData,
          business_registration_number: '12345'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should prevent duplicate email addresses', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validStoreData,
          name: 'Duplicate Email Store'
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'DUPLICATE_STORE',
          message: expect.any(String)
        }
      });
    });

    it('should prevent duplicate registration numbers', async () => {
      const response = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validStoreData,
          name: 'Duplicate Registration Store',
          business_email: 'different@testcafe.se'
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'DUPLICATE_REGISTRATION',
          message: expect.any(String)
        }
      });
    });
  });

  describe('GET /api/admin/stores/{storeId}', () => {
    it('should return store details with metrics', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          store: {
            id: testStoreId,
            name: expect.any(String),
            business_email: expect.any(String),
            phone_number: expect.any(String),
            physical_address: expect.any(String),
            business_registration_number: expect.any(String),
            qr_code_data: expect.any(String),
            online_status: expect.any(Boolean),
            sync_status: expect.any(String),
            error_count: expect.any(Number),
            performance_score: expect.anything(),
            monitoring_enabled: expect.any(Boolean),
            total_calls_count: expect.any(Number),
            recent_calls_count: expect.any(Number),
            created_at: expect.any(String),
            updated_at: expect.any(String)
          },
          metrics: expect.any(Array)
        }
      });
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores/550e8400-e29b-41d4-a716-446655440999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'STORE_NOT_FOUND',
          message: expect.any(String)
        }
      });
    });

    it('should validate UUID format', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stores/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('PUT /api/admin/stores/{storeId}', () => {
    it('should update store with valid data', async () => {
      const updateData = {
        name: 'Updated Test Café',
        monitoring_enabled: false
      };

      const response = await request(API_URL)
        .put(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          store: {
            id: testStoreId,
            name: updateData.name,
            monitoring_enabled: updateData.monitoring_enabled,
            updated_at: expect.any(String)
          }
        }
      });
    });

    it('should validate update data types', async () => {
      const response = await request(API_URL)
        .put(`/api/admin/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          monitoring_enabled: 'invalid-boolean'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(API_URL)
        .put('/api/admin/stores/550e8400-e29b-41d4-a716-446655440999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'STORE_NOT_FOUND',
          message: expect.any(String)
        }
      });
    });
  });

  describe('POST /api/admin/stores/{storeId}/upload', () => {
    it('should accept valid CSV upload', async () => {
      const csvContent = 'transaction_id,amount,timestamp,pos_reference\n1,29.50,2025-09-22T10:30:00Z,POS001\n2,45.00,2025-09-22T11:15:00Z,POS002';
      
      const response = await request(API_URL)
        .post(`/api/admin/stores/${testStoreId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvContent), 'verification_data.csv')
        .field('week_start_date', '2025-09-22')
        .field('notes', 'Contract test upload');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          upload_id: expect.any(String),
          records_processed: 2,
          week_start_date: '2025-09-22'
        }
      });
    });

    it('should reject non-CSV files', async () => {
      const response = await request(API_URL)
        .post(`/api/admin/stores/${testStoreId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('{}'), 'data.json')
        .field('week_start_date', '2025-09-22');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: expect.any(String)
        }
      });
    });

    it('should validate required upload fields', async () => {
      const csvContent = 'transaction_id,amount,timestamp,pos_reference\n1,29.50,2025-09-22T10:30:00Z,POS001';
      
      const response = await request(API_URL)
        .post(`/api/admin/stores/${testStoreId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvContent), 'verification_data.csv');
        // Missing week_start_date

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });

    it('should reject files larger than 50MB', async () => {
      // Create a large buffer (simulating >50MB)
      const largeContent = 'x'.repeat(52 * 1024 * 1024); // 52MB
      
      const response = await request(API_URL)
        .post(`/api/admin/stores/${testStoreId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(largeContent), 'large_file.csv')
        .field('week_start_date', '2025-09-22');

      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: expect.any(String)
        }
      });
    });

    it('should validate date format', async () => {
      const csvContent = 'transaction_id,amount,timestamp,pos_reference\n1,29.50,2025-09-22T10:30:00Z,POS001';
      
      const response = await request(API_URL)
        .post(`/api/admin/stores/${testStoreId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csvContent), 'verification_data.csv')
        .field('week_start_date', 'invalid-date');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });
});