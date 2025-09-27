import request from 'supertest';
import { app } from '../../src/app';
import { createSupabaseClient } from '@vocilia/database';

describe('Monitoring Dashboard Integration', () => {
  const supabase = createSupabaseClient();
  let authToken: string;
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreIds: string[] = [];

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
        name: 'Test Business',
        email: 'test@business.local',
        phone: '+46701234567'
      })
      .select()
      .single();

    testBusinessId = businessData.id;

    // Create multiple test stores
    const storeInserts = [
      {
        business_id: testBusinessId,
        name: 'Store Alpha',
        address: 'Address Alpha',
        city: 'Stockholm',
        phone: '+46701234567'
      },
      {
        business_id: testBusinessId,
        name: 'Store Beta',
        address: 'Address Beta',
        city: 'Gothenburg',
        phone: '+46701234568'
      },
      {
        business_id: testBusinessId,
        name: 'Store Gamma',
        address: 'Address Gamma',
        city: 'Malmö',
        phone: '+46701234569'
      }
    ];

    const { data: stores } = await supabase
      .from('stores')
      .insert(storeInserts)
      .select('id');

    testStoreIds = stores?.map(s => s.id) || [];

    // Create comprehensive test metrics
    const metricsInserts = [];
    const now = new Date();
    
    for (let i = 0; i < testStoreIds.length; i++) {
      const storeId = testStoreIds[i];
      
      // Create metrics for the last 7 days
      for (let day = 0; day < 7; day++) {
        const date = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000));
        
        metricsInserts.push(
          {
            store_id: storeId,
            metric_type: 'qr_scans',
            value: 100 + (i * 50) + Math.floor(Math.random() * 50),
            recorded_at: date.toISOString()
          },
          {
            store_id: storeId,
            metric_type: 'successful_calls',
            value: 80 + (i * 40) + Math.floor(Math.random() * 40),
            recorded_at: date.toISOString()
          },
          {
            store_id: storeId,
            metric_type: 'failed_calls',
            value: 5 + Math.floor(Math.random() * 10),
            recorded_at: date.toISOString()
          },
          {
            store_id: storeId,
            metric_type: 'response_time_avg',
            value: 2000 + Math.floor(Math.random() * 1000),
            recorded_at: date.toISOString()
          }
        );
      }
    }

    await supabase.from('store_status_metrics').insert(metricsInserts);

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
    await supabase.from('store_status_metrics').delete().in('store_id', testStoreIds);
    await supabase.from('stores').delete().in('id', testStoreIds);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('admin_sessions').delete().eq('admin_id', testAdminId);
    await supabase.from('admin_accounts').delete().eq('id', testAdminId);
  });

  describe('System Overview', () => {
    it('should provide comprehensive system overview', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('system_status');
      expect(response.body).toHaveProperty('total_stores');
      expect(response.body).toHaveProperty('active_stores');
      expect(response.body).toHaveProperty('total_calls_today');
      expect(response.body).toHaveProperty('success_rate_24h');
      expect(response.body).toHaveProperty('avg_response_time_24h');
      expect(response.body).toHaveProperty('alerts');

      // Verify data types and ranges
      expect(typeof response.body.total_stores).toBe('number');
      expect(typeof response.body.active_stores).toBe('number');
      expect(typeof response.body.total_calls_today).toBe('number');
      expect(typeof response.body.success_rate_24h).toBe('number');
      expect(typeof response.body.avg_response_time_24h).toBe('number');
      expect(Array.isArray(response.body.alerts)).toBe(true);

      // Basic validation
      expect(response.body.total_stores).toBeGreaterThanOrEqual(testStoreIds.length);
      expect(response.body.active_stores).toBeLessThanOrEqual(response.body.total_stores);
      expect(response.body.success_rate_24h).toBeGreaterThanOrEqual(0);
      expect(response.body.success_rate_24h).toBeLessThanOrEqual(100);
    });

    it('should calculate metrics correctly', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify our test stores are included
      expect(response.body.total_stores).toBeGreaterThanOrEqual(3);

      // Success rate should be reasonable (test data has low failure rates)
      expect(response.body.success_rate_24h).toBeGreaterThan(80);

      // Response time should be in milliseconds
      expect(response.body.avg_response_time_24h).toBeGreaterThan(0);
      expect(response.body.avg_response_time_24h).toBeLessThan(10000); // Less than 10 seconds
    });

    it('should include system health status', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.system_status).toBeDefined();
      expect(['healthy', 'warning', 'critical']).toContain(response.body.system_status);

      if (response.body.system_status !== 'healthy') {
        expect(response.body.alerts.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Store Metrics Dashboard', () => {
    it('should provide detailed store metrics', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stores');
      expect(Array.isArray(response.body.stores)).toBe(true);
      expect(response.body.stores.length).toBeGreaterThanOrEqual(testStoreIds.length);

      const store = response.body.stores[0];
      expect(store).toHaveProperty('id');
      expect(store).toHaveProperty('name');
      expect(store).toHaveProperty('city');
      expect(store).toHaveProperty('metrics');
      
      const metrics = store.metrics;
      expect(metrics).toHaveProperty('qr_scans_24h');
      expect(metrics).toHaveProperty('successful_calls_24h');
      expect(metrics).toHaveProperty('failed_calls_24h');
      expect(metrics).toHaveProperty('success_rate');
      expect(metrics).toHaveProperty('avg_response_time');
      expect(metrics).toHaveProperty('last_activity');
    });

    it('should support filtering by performance', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores?filter=low_performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stores).toBeDefined();
      // All returned stores should have performance issues
      response.body.stores.forEach((store: any) => {
        const metrics = store.metrics;
        const hasLowPerformance = 
          metrics.success_rate < 95 || 
          metrics.avg_response_time > 3000 ||
          metrics.failed_calls_24h > 10;
        
        if (response.body.stores.length > 0) {
          expect(hasLowPerformance).toBe(true);
        }
      });
    });

    it('should support filtering by inactivity', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores?filter=inactive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stores).toBeDefined();
      // All returned stores should be inactive (no recent activity)
      response.body.stores.forEach((store: any) => {
        const lastActivity = new Date(store.metrics.last_activity);
        const hoursAgo = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        expect(hoursAgo).toBeGreaterThan(24);
      });
    });

    it('should support sorting by different metrics', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores?sort=success_rate&order=asc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stores.length).toBeGreaterThan(1);
      
      // Verify ascending order by success rate
      for (let i = 1; i < response.body.stores.length; i++) {
        const current = response.body.stores[i].metrics.success_rate;
        const previous = response.body.stores[i - 1].metrics.success_rate;
        expect(current).toBeGreaterThanOrEqual(previous);
      }
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores?limit=2&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
      expect(response.body.stores.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Time Series Data', () => {
    it('should provide time series metrics', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/metrics/timeseries?period=7d&metric=qr_scans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data_points');
      expect(Array.isArray(response.body.data_points)).toBe(true);
      expect(response.body).toHaveProperty('metric');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('aggregation');

      // Should have data points for the requested period
      expect(response.body.data_points.length).toBeGreaterThan(0);
      
      const dataPoint = response.body.data_points[0];
      expect(dataPoint).toHaveProperty('timestamp');
      expect(dataPoint).toHaveProperty('value');
      expect(typeof dataPoint.value).toBe('number');
    });

    it('should support different time periods', async () => {
      const periods = ['24h', '7d', '30d'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/admin/monitoring/metrics/timeseries?period=${period}&metric=successful_calls`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.period).toBe(period);
        expect(response.body.data_points.length).toBeGreaterThan(0);
      }
    });

    it('should support different metrics', async () => {
      const metrics = ['qr_scans', 'successful_calls', 'failed_calls', 'response_time_avg'];
      
      for (const metric of metrics) {
        const response = await request(app)
          .get(`/api/admin/monitoring/metrics/timeseries?period=24h&metric=${metric}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.metric).toBe(metric);
        expect(response.body.data_points.length).toBeGreaterThan(0);
      }
    });

    it('should support different aggregations', async () => {
      const aggregations = ['sum', 'avg', 'min', 'max'];
      
      for (const aggregation of aggregations) {
        const response = await request(app)
          .get(`/api/admin/monitoring/metrics/timeseries?period=24h&metric=qr_scans&aggregation=${aggregation}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.aggregation).toBe(aggregation);
      }
    });

    it('should handle store-specific time series', async () => {
      const storeId = testStoreIds[0];
      
      const response = await request(app)
        .get(`/api/admin/monitoring/metrics/timeseries?period=7d&metric=qr_scans&store_id=${storeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.store_id).toBe(storeId);
      expect(response.body.data_points.length).toBeGreaterThan(0);
    });
  });

  describe('Alert System', () => {
    it('should detect performance alerts', async () => {
      // Create a store with poor performance metrics
      const { data: poorStore } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Poor Performance Store',
          address: 'Poor Address',
          city: 'Stockholm',
          phone: '+46701234570'
        })
        .select()
        .single();

      // Add poor performance metrics
      await supabase
        .from('store_status_metrics')
        .insert([
          {
            store_id: poorStore.id,
            metric_type: 'successful_calls',
            value: 10,
            recorded_at: new Date().toISOString()
          },
          {
            store_id: poorStore.id,
            metric_type: 'failed_calls',
            value: 20, // High failure rate
            recorded_at: new Date().toISOString()
          },
          {
            store_id: poorStore.id,
            metric_type: 'response_time_avg',
            value: 8000, // Very slow response
            recorded_at: new Date().toISOString()
          }
        ]);

      const response = await request(app)
        .get('/api/admin/monitoring/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(Array.isArray(response.body.alerts)).toBe(true);

      // Should have alerts for the poor performing store
      const storeAlerts = response.body.alerts.filter((alert: any) => 
        alert.resource_id === poorStore.id
      );
      
      expect(storeAlerts.length).toBeGreaterThan(0);

      const alert = storeAlerts[0];
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('resource_type', 'store');
      expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);

      // Clean up
      await supabase.from('store_status_metrics').delete().eq('store_id', poorStore.id);
      await supabase.from('stores').delete().eq('id', poorStore.id);
    });

    it('should categorize alerts by severity', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('critical');
      expect(response.body.summary).toHaveProperty('high');
      expect(response.body.summary).toHaveProperty('medium');
      expect(response.body.summary).toHaveProperty('low');

      const summary = response.body.summary;
      expect(typeof summary.critical).toBe('number');
      expect(typeof summary.high).toBe('number');
      expect(typeof summary.medium).toBe('number');
      expect(typeof summary.low).toBe('number');
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/alerts?severity=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.alerts.forEach((alert: any) => {
        expect(['high', 'critical']).toContain(alert.severity);
      });
    });

    it('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/alerts?type=performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.alerts.forEach((alert: any) => {
        expect(alert.type).toBe('performance');
      });
    });
  });

  describe('Real-time Monitoring', () => {
    it('should provide real-time system status', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/realtime/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('active_calls');
      expect(response.body).toHaveProperty('queue_size');
      expect(response.body).toHaveProperty('system_load');
      expect(response.body).toHaveProperty('error_rate_1min');
      expect(response.body).toHaveProperty('response_time_p95');

      // Verify timestamp is recent (within last minute)
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThan(1);

      // Verify numeric values
      expect(typeof response.body.active_calls).toBe('number');
      expect(typeof response.body.queue_size).toBe('number');
      expect(typeof response.body.system_load).toBe('number');
      expect(typeof response.body.error_rate_1min).toBe('number');
      expect(typeof response.body.response_time_p95).toBe('number');
    });

    it('should track active connections', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/realtime/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_connections');
      expect(response.body).toHaveProperty('active_calls');
      expect(response.body).toHaveProperty('recent_connections');

      expect(typeof response.body.total_connections).toBe('number');
      expect(typeof response.body.active_calls).toBe('number');
      expect(Array.isArray(response.body.recent_connections)).toBe(true);
    });
  });

  describe('Performance Analytics', () => {
    it('should provide detailed performance analysis', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/performance/analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overall_health_score');
      expect(response.body).toHaveProperty('performance_trends');
      expect(response.body).toHaveProperty('bottlenecks');
      expect(response.body).toHaveProperty('recommendations');

      // Health score should be 0-100
      expect(response.body.overall_health_score).toBeGreaterThanOrEqual(0);
      expect(response.body.overall_health_score).toBeLessThanOrEqual(100);

      // Trends should be an object with trend data
      expect(typeof response.body.performance_trends).toBe('object');
      
      // Bottlenecks should be an array
      expect(Array.isArray(response.body.bottlenecks)).toBe(true);
      
      // Recommendations should be an array
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should identify top performing stores', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/performance/top-stores?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stores');
      expect(Array.isArray(response.body.stores)).toBe(true);
      expect(response.body.stores.length).toBeLessThanOrEqual(5);

      // Should be sorted by performance score (descending)
      for (let i = 1; i < response.body.stores.length; i++) {
        const current = response.body.stores[i].performance_score;
        const previous = response.body.stores[i - 1].performance_score;
        expect(current).toBeLessThanOrEqual(previous);
      }
    });

    it('should identify underperforming stores', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/performance/underperforming?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stores');
      expect(Array.isArray(response.body.stores)).toBe(true);

      // Each store should have performance issues identified
      response.body.stores.forEach((store: any) => {
        expect(store).toHaveProperty('performance_score');
        expect(store).toHaveProperty('issues');
        expect(Array.isArray(store.issues)).toBe(true);
        expect(store.performance_score).toBeLessThan(70); // Threshold for underperforming
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all monitoring endpoints', async () => {
      const endpoints = [
        '/api/admin/monitoring/overview',
        '/api/admin/monitoring/stores',
        '/api/admin/monitoring/alerts',
        '/api/admin/monitoring/metrics/timeseries',
        '/api/admin/monitoring/realtime/status',
        '/api/admin/monitoring/performance/analysis'
      ];

      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });

    it('should reject invalid auth tokens', async () => {
      await request(app)
        .get('/api/admin/monitoring/overview')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/stores?limit=invalid&offset=abc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid metric types', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/metrics/timeseries?metric=invalid_metric&period=24h')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('metric');
    });

    it('should handle invalid time periods', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/metrics/timeseries?metric=qr_scans&period=invalid_period')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('period');
    });

    it('should handle non-existent store IDs', async () => {
      const response = await request(app)
        .get('/api/admin/monitoring/metrics/timeseries?metric=qr_scans&period=24h&store_id=non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});