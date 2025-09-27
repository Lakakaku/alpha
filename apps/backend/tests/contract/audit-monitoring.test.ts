import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Audit & Monitoring API Contract', () => {
  let adminToken: string;
  let testAdminId: string;
  let testStoreId: string;

  beforeAll(async () => {
    // Create test admin account and authenticate
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'audit.admin@vocilia.com',
      password: 'AuditAdmin123!',
      email_confirm: true
    });

    if (authUser.user) {
      const { data } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: authUser.user.id,
          username: 'audit_admin',
          full_name: 'Audit Administrator',
          email: 'audit.admin@vocilia.com',
          is_active: true
        })
        .select()
        .single();

      testAdminId = data?.id;

      // Get admin token
      const loginResponse = await request(API_URL)
        .post('/api/admin/auth/login')
        .send({
          username: 'audit_admin',
          password: 'AuditAdmin123!'
        });

      adminToken = loginResponse.body.data?.token;

      // Create test store for monitoring tests
      const storeResponse = await request(API_URL)
        .post('/api/admin/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Test Store',
          business_email: 'audit@teststore.se',
          phone_number: '+46 8 555 0199',
          physical_address: 'Auditgatan 456, 123 45 Stockholm, Sweden',
          business_registration_number: '556999-7777'
        });

      testStoreId = storeResponse.body.data?.store?.id;
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

  describe('GET /api/admin/audit', () => {
    it('should return paginated audit logs', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          logs: expect.any(Array),
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total_pages: expect.any(Number),
            total_items: expect.any(Number),
            has_next: expect.any(Boolean),
            has_prev: expect.any(Boolean)
          },
          summary: {
            total_actions: expect.any(Number),
            successful_actions: expect.any(Number),
            failed_actions: expect.any(Number),
            unique_admins: expect.any(Number),
            most_common_action: expect.any(String),
            period_start: expect.any(String),
            period_end: expect.any(String)
          }
        }
      });

      // Verify audit log structure
      if (response.body.data.logs.length > 0) {
        expect(response.body.data.logs[0]).toMatchObject({
          id: expect.any(String),
          admin_id: expect.any(String),
          admin_username: expect.any(String),
          action_type: expect.stringMatching(/^(login|logout|create|update|delete|upload|view)$/),
          resource_type: expect.stringMatching(/^(store|admin|session|upload|system)$/),
          action_details: expect.objectContaining({
            description: expect.any(String)
          }),
          ip_address: expect.any(String),
          user_agent: expect.any(String),
          performed_at: expect.any(String),
          success: expect.any(Boolean)
        });
      }
    });

    it('should support pagination parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.logs.length).toBeLessThanOrEqual(10);
    });

    it('should support action_type filtering', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit?action_type=login')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          expect(log.action_type).toBe('login');
        });
      }
    });

    it('should support resource_type filtering', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit?resource_type=store')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          expect(log.resource_type).toBe('store');
        });
      }
    });

    it('should support admin_id filtering', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/audit?admin_id=${testAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          expect(log.admin_id).toBe(testAdminId);
        });
      }
    });

    it('should support date range filtering', async () => {
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
      const toDate = new Date().toISOString();

      const response = await request(API_URL)
        .get(`/api/admin/audit?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          const logDate = new Date(log.performed_at);
          expect(logDate.getTime()).toBeGreaterThanOrEqual(new Date(fromDate).getTime());
          expect(logDate.getTime()).toBeLessThanOrEqual(new Date(toDate).getTime());
        });
      }
    });

    it('should support success_only filtering', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit?success_only=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          expect(log.success).toBe(true);
        });
      }
    });

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit');

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
        .get('/api/admin/audit?page=0&limit=101')
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

    it('should validate enum parameters', async () => {
      const response = await request(API_URL)
        .get('/api/admin/audit?action_type=invalid_action')
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

  describe('GET /api/admin/monitoring/dashboard', () => {
    it('should return comprehensive monitoring data', async () => {
      const response = await request(API_URL)
        .get('/api/admin/monitoring/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          system_health: {
            overall_status: expect.stringMatching(/^(healthy|warning|critical)$/),
            uptime_percentage: expect.any(Number),
            total_stores: expect.any(Number),
            online_stores: expect.any(Number),
            offline_stores: expect.any(Number),
            stores_with_errors: expect.any(Number),
            avg_performance_score: expect.any(Number),
            last_updated: expect.any(String)
          },
          store_metrics: {
            sync_success_rate: expect.any(Number),
            avg_sync_time_minutes: expect.any(Number),
            total_errors_24h: expect.any(Number),
            performance_distribution: {
              excellent: expect.any(Number),
              good: expect.any(Number),
              fair: expect.any(Number),
              poor: expect.any(Number)
            }
          },
          recent_activity: expect.any(Array)
        }
      });

      // Validate system health constraints
      expect(response.body.data.system_health.uptime_percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.data.system_health.uptime_percentage).toBeLessThanOrEqual(100);
      
      // Validate store metrics constraints
      expect(response.body.data.store_metrics.sync_success_rate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.store_metrics.sync_success_rate).toBeLessThanOrEqual(1);

      // Validate recent activity structure
      if (response.body.data.recent_activity.length > 0) {
        expect(response.body.data.recent_activity[0]).toMatchObject({
          id: expect.any(String),
          activity_type: expect.stringMatching(/^(store_created|store_updated|upload_completed|error_resolved|admin_login)$/),
          description: expect.any(String),
          admin_username: expect.any(String),
          timestamp: expect.any(String)
        });
      }
    });

    it('should require authentication', async () => {
      const response = await request(API_URL)
        .get('/api/admin/monitoring/dashboard');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('GET /api/admin/monitoring/stores/{storeId}/metrics', () => {
    it('should return store metrics history', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          store_id: testStoreId,
          metrics: expect.any(Array),
          summary: {
            metric_type: expect.any(String),
            period_hours: expect.any(Number),
            min_value: expect.any(Number),
            max_value: expect.any(Number),
            avg_value: expect.any(Number),
            data_points: expect.any(Number),
            trend: expect.stringMatching(/^(improving|stable|declining)$/)
          }
        }
      });

      // Validate metrics structure
      if (response.body.data.metrics.length > 0) {
        expect(response.body.data.metrics[0]).toMatchObject({
          timestamp: expect.any(String),
          metric_type: expect.stringMatching(/^(sync|error|performance|availability)$/),
          value: expect.any(Number),
          unit: expect.any(String)
        });
      }
    });

    it('should support metric_type filtering', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?metric_type=performance`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.data.metrics.length > 0) {
        response.body.data.metrics.forEach((metric: any) => {
          expect(metric.metric_type).toBe('performance');
        });
      }
    });

    it('should support hours parameter', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?hours=12`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary.period_hours).toBe(12);
    });

    it('should support granularity parameter', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?granularity=hour`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Note: granularity affects data point spacing but structure remains the same
    });

    it('should return 404 for non-existent store', async () => {
      const response = await request(API_URL)
        .get('/api/admin/monitoring/stores/550e8400-e29b-41d4-a716-446655440999/metrics')
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
        .get('/api/admin/monitoring/stores/invalid-uuid/metrics')
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

    it('should validate hours parameter range', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?hours=200`)
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

    it('should validate granularity enum', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?granularity=second`)
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

    it('should validate metric_type enum', async () => {
      const response = await request(API_URL)
        .get(`/api/admin/monitoring/stores/${testStoreId}/metrics?metric_type=invalid_type`)
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
});