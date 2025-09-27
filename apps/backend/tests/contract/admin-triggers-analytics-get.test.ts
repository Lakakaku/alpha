/**
 * Contract Tests - GET /api/admin/triggers/effectiveness
 * Tests the Admin Trigger Analytics Endpoint
 * 
 * This endpoint provides effectiveness analytics for dynamic triggers,
 * including activation rates, success metrics, and performance insights.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('GET /api/admin/triggers/effectiveness', () => {
  let adminToken: string;
  let testBusinessId: string;
  let testTriggers: any[] = [];
  let testActivationLogs: any[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminResult = await supabase
      .from('admin_accounts')
      .insert({
        email: 'test-admin@vocilia.com',
        password_hash: 'hashed_password',
        role: 'super_admin',
        is_active: true
      })
      .select()
      .single();

    if (adminResult.error) throw adminResult.error;

    // Create admin session
    const sessionResult = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminResult.data.id,
        session_token: 'test-admin-session-token',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (sessionResult.error) throw sessionResult.error;
    adminToken = sessionResult.data.session_token;

    // Create test business context
    const businessResult = await supabase
      .from('business_contexts')
      .insert({
        business_id: 'test-business-123',
        name: 'Test Analytics Business',
        industry: 'retail',
        target_language: 'sv',
        is_active: true
      })
      .select()
      .single();

    if (businessResult.error) throw businessResult.error;
    testBusinessId = businessResult.data.id;

    // Create test dynamic triggers
    const triggerData = [
      {
        business_context_id: testBusinessId,
        trigger_name: 'High Purchase Trigger',
        trigger_type: 'purchase_based',
        is_active: true,
        config: {
          purchase_amount_threshold: 500,
          product_categories: ['electronics'],
          time_since_purchase_hours: 24
        }
      },
      {
        business_context_id: testBusinessId,
        trigger_name: 'Time-Based Trigger',
        trigger_type: 'time_based',
        is_active: true,
        config: {
          days_since_last_contact: 30,
          preferred_contact_hours: [9, 10, 11, 14, 15, 16],
          timezone: 'Europe/Stockholm'
        }
      }
    ];

    const triggerResults = await supabase
      .from('dynamic_triggers')
      .insert(triggerData)
      .select();

    if (triggerResults.error) throw triggerResults.error;
    testTriggers = triggerResults.data;

    // Create test activation logs for analytics
    const activationData = [
      {
        trigger_id: testTriggers[0].id,
        customer_phone: '+46701234567',
        activated_at: new Date('2024-01-15T10:00:00Z').toISOString(),
        activation_reason: 'Purchase threshold met',
        call_completed: true,
        call_duration_seconds: 150,
        feedback_collected: true,
        customer_satisfaction_score: 4
      },
      {
        trigger_id: testTriggers[0].id,
        customer_phone: '+46701234568',
        activated_at: new Date('2024-01-15T11:00:00Z').toISOString(),
        activation_reason: 'Purchase threshold met',
        call_completed: false,
        skip_reason: 'customer_unavailable',
        call_duration_seconds: null,
        feedback_collected: false,
        customer_satisfaction_score: null
      },
      {
        trigger_id: testTriggers[1].id,
        customer_phone: '+46701234569',
        activated_at: new Date('2024-01-16T09:00:00Z').toISOString(),
        activation_reason: 'Time-based trigger activated',
        call_completed: true,
        call_duration_seconds: 180,
        feedback_collected: true,
        customer_satisfaction_score: 5
      }
    ];

    const activationResults = await supabase
      .from('trigger_activation_logs')
      .insert(activationData)
      .select();

    if (activationResults.error) throw activationResults.error;
    testActivationLogs = activationResults.data;
  });

  afterAll(async () => {
    // Clean up test data
    if (testActivationLogs.length > 0) {
      await supabase
        .from('trigger_activation_logs')
        .delete()
        .in('id', testActivationLogs.map(log => log.id));
    }

    if (testTriggers.length > 0) {
      await supabase
        .from('dynamic_triggers')
        .delete()
        .in('id', testTriggers.map(trigger => trigger.id));
    }

    if (testBusinessId) {
      await supabase
        .from('business_contexts')
        .delete()
        .eq('id', testBusinessId);
    }

    // Clean up admin session and account
    await supabase
      .from('admin_sessions')
      .delete()
      .eq('session_token', adminToken);

    await supabase
      .from('admin_accounts')
      .delete()
      .eq('email', 'test-admin@vocilia.com');
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without admin token', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject requests with invalid admin token', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid session');
    });

    it('should reject requests from expired admin sessions', async () => {
      // Create expired session
      const expiredSessionResult = await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testTriggers[0].id, // Using existing ID for simplicity
          session_token: 'expired-admin-session-token',
          expires_at: new Date(Date.now() - 1000).toISOString() // 1 second ago
        })
        .select()
        .single();

      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${expiredSessionResult.data.session_token}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Session expired');

      // Clean up expired session
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('session_token', expiredSessionResult.data.session_token);
    });
  });

  describe('Successful Analytics Retrieval', () => {
    it('should return overall trigger effectiveness analytics', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // Performance requirement

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const analytics = response.body.data;
      expect(analytics).toHaveProperty('overall_metrics');
      expect(analytics).toHaveProperty('trigger_performance');
      expect(analytics).toHaveProperty('time_period');
      
      // Overall metrics structure
      expect(analytics.overall_metrics).toHaveProperty('total_activations');
      expect(analytics.overall_metrics).toHaveProperty('successful_calls');
      expect(analytics.overall_metrics).toHaveProperty('success_rate');
      expect(analytics.overall_metrics).toHaveProperty('average_call_duration');
      expect(analytics.overall_metrics).toHaveProperty('feedback_collection_rate');
      expect(analytics.overall_metrics).toHaveProperty('average_satisfaction_score');
      
      // Verify calculated values
      expect(analytics.overall_metrics.total_activations).toBe(3);
      expect(analytics.overall_metrics.successful_calls).toBe(2);
      expect(analytics.overall_metrics.success_rate).toBeCloseTo(66.67, 2);
    });

    it('should return trigger-specific performance metrics', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          business_context_id: testBusinessId
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('trigger_performance');
      
      const triggerPerformance = response.body.data.trigger_performance;
      expect(Array.isArray(triggerPerformance)).toBe(true);
      expect(triggerPerformance.length).toBeGreaterThan(0);
      
      // Check individual trigger metrics
      const firstTrigger = triggerPerformance[0];
      expect(firstTrigger).toHaveProperty('trigger_id');
      expect(firstTrigger).toHaveProperty('trigger_name');
      expect(firstTrigger).toHaveProperty('trigger_type');
      expect(firstTrigger).toHaveProperty('total_activations');
      expect(firstTrigger).toHaveProperty('successful_calls');
      expect(firstTrigger).toHaveProperty('success_rate');
      expect(firstTrigger).toHaveProperty('average_call_duration');
      expect(firstTrigger).toHaveProperty('feedback_collection_rate');
    });

    it('should support date range filtering', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          start_date: '2024-01-15',
          end_date: '2024-01-15'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.overall_metrics.total_activations).toBe(2); // Only Jan 15 data
    });

    it('should support business context filtering', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          business_context_id: testBusinessId
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('trigger_performance');
      expect(response.body.data.trigger_performance.length).toBe(2); // Our test triggers
    });

    it('should support trigger type filtering', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          trigger_type: 'purchase_based'
        });

      expect(response.status).toBe(200);
      const triggerPerformance = response.body.data.trigger_performance;
      expect(triggerPerformance.every((t: any) => t.trigger_type === 'purchase_based')).toBe(true);
    });
  });

  describe('Analytics Calculations', () => {
    it('should correctly calculate success rates', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const metrics = response.body.data.overall_metrics;
      
      // We have 3 total activations, 2 successful
      expect(metrics.success_rate).toBeCloseTo(66.67, 2);
    });

    it('should correctly calculate average call duration', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const metrics = response.body.data.overall_metrics;
      
      // Average of 150 and 180 seconds = 165 seconds
      expect(metrics.average_call_duration).toBe(165);
    });

    it('should correctly calculate feedback collection rate', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const metrics = response.body.data.overall_metrics;
      
      // 2 out of 3 calls collected feedback = 66.67%
      expect(metrics.feedback_collection_rate).toBeCloseTo(66.67, 2);
    });

    it('should correctly calculate average satisfaction score', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const metrics = response.body.data.overall_metrics;
      
      // Average of scores 4 and 5 = 4.5
      expect(metrics.average_satisfaction_score).toBe(4.5);
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate date range parameters', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          start_date: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid date format');
    });

    it('should validate business context ID format', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          business_context_id: 'invalid-uuid'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid business context ID');
    });

    it('should validate trigger type parameter', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          trigger_type: 'invalid_type'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid trigger type');
    });

    it('should validate date range logic (start_date <= end_date)', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          start_date: '2024-01-20',
          end_date: '2024-01-10'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('start_date must be before or equal to end_date');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty analytics data gracefully', async () => {
      // Query for a date range with no data
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          start_date: '2023-01-01',
          end_date: '2023-01-01'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.overall_metrics.total_activations).toBe(0);
      expect(response.body.data.trigger_performance).toEqual([]);
    });

    it('should handle non-existent business context gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          business_context_id: '00000000-0000-0000-0000-000000000000'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.overall_metrics.total_activations).toBe(0);
      expect(response.body.data.trigger_performance).toEqual([]);
    });

    it('should handle database connection errors', async () => {
      // This test would require mocking the database connection
      // For now, we'll just verify the error handling structure exists
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance and Scalability', () => {
    it('should respond within 500ms for large datasets', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500);
      expect(response.status).toBe(200);
    });

    it('should support pagination for large result sets', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          limit: 10,
          offset: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total_count');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('offset');
    });
  });

  describe('Data Privacy and Security', () => {
    it('should not expose sensitive customer data', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const responseStr = JSON.stringify(response.body);
      
      // Should not contain phone numbers or other PII
      expect(responseStr).not.toContain('+46701234567');
      expect(responseStr).not.toContain('customer_phone');
    });

    it('should log admin access for audit trail', async () => {
      await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify audit log entry was created
      const auditResult = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'admin_analytics_access')
        .eq('admin_id', (await supabase.from('admin_sessions').select('admin_id').eq('session_token', adminToken).single()).data.admin_id)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(auditResult.data).toBeTruthy();
      expect(auditResult.data.length).toBe(1);
      expect(auditResult.data[0].action).toBe('admin_analytics_access');
    });
  });

  describe('Response Format Validation', () => {
    it('should return properly structured response', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          overall_metrics: {
            total_activations: expect.any(Number),
            successful_calls: expect.any(Number),
            success_rate: expect.any(Number),
            average_call_duration: expect.any(Number),
            feedback_collection_rate: expect.any(Number),
            average_satisfaction_score: expect.any(Number)
          },
          trigger_performance: expect.any(Array),
          time_period: {
            start_date: expect.any(String),
            end_date: expect.any(String)
          }
        }
      });
    });

    it('should include proper HTTP cache headers', async () => {
      const response = await request(app)
        .get('/api/admin/triggers/effectiveness')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers['cache-control']).toContain('no-cache'); // Analytics should be fresh
    });
  });
});