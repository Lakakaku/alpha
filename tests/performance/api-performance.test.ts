import { test, expect } from '@jest/globals';
import { SwedishDataGenerator } from '../generators/swedish-data';

describe('API Performance Tests', () => {
  let dataGenerator: SwedishDataGenerator;
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
  
  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    AUTH_ENDPOINTS: 500,
    STORE_ENDPOINTS: 400,
    QR_ENDPOINTS: 300,
    VERIFICATION_ENDPOINTS: 600,
    FEEDBACK_ENDPOINTS: 800,
    ADMIN_ENDPOINTS: 1000
  };

  beforeAll(() => {
    dataGenerator = new SwedishDataGenerator();
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login should respond within 500ms', async () => {
      const credentials = {
        email: 'admin@vocilia.se',
        password: 'SecurePassword123!'
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTH_ENDPOINTS);
    });

    test('POST /api/auth/logout should respond within 500ms', async () => {
      // First login to get token
      const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@vocilia.se',
          password: 'SecurePassword123!'
        })
      });
      
      const { token } = await loginResponse.json();

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTH_ENDPOINTS);
    });

    test('GET /api/auth/verify-token should respond within 500ms', async () => {
      const token = 'mock-jwt-token';

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AUTH_ENDPOINTS);
    });
  });

  describe('Store Management Endpoints', () => {
    test('GET /api/stores should respond within 400ms', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/stores?page=1&limit=20`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS);
    });

    test('POST /api/stores should respond within 400ms', async () => {
      const storeData = dataGenerator.generateStore();

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/stores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-admin-token'
        },
        body: JSON.stringify(storeData)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS);
    });

    test('GET /api/stores/{id} should respond within 400ms', async () => {
      const storeId = 'store-123';

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/stores/${storeId}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS);
    });
  });

  describe('QR Code Endpoints', () => {
    test('POST /api/qr/generate should respond within 300ms', async () => {
      const qrRequest = {
        storeId: 'store-123',
        sessionId: 'session-456',
        expiresIn: 3600
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/qr/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(qrRequest)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.QR_ENDPOINTS);
    });

    test('POST /api/qr/validate should respond within 300ms', async () => {
      const qrPayload = {
        storeId: 'store-123',
        sessionId: 'session-456',
        apiBaseUrl: API_BASE_URL,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        version: '1.0'
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/qr/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload: JSON.stringify(qrPayload) })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.QR_ENDPOINTS);
    });
  });

  describe('Verification Endpoints', () => {
    test('POST /api/verification/initiate should respond within 600ms', async () => {
      const customer = dataGenerator.generateCustomer();
      const verificationData = {
        phoneNumber: customer.phone,
        storeId: 'store-123',
        sessionId: 'session-456'
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/verification/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationData)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VERIFICATION_ENDPOINTS);
    });

    test('POST /api/verification/verify should respond within 600ms', async () => {
      const verificationData = {
        verificationId: 'verification-123',
        code: '123456'
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/verification/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationData)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VERIFICATION_ENDPOINTS);
    });

    test('GET /api/verification/status/{sessionId} should respond within 600ms', async () => {
      const sessionId = 'session-456';

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/verification/status/${sessionId}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VERIFICATION_ENDPOINTS);
    });
  });

  describe('Feedback Processing Endpoints', () => {
    test('POST /api/feedback/submit should respond within 800ms', async () => {
      const feedbackData = {
        sessionId: 'session-456',
        transcript: 'Jag var mycket nöjd med servicen. Personalen var vänlig och hjälpsam.',
        duration: 45000,
        language: 'sv-SE'
      };

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackData)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FEEDBACK_ENDPOINTS);
    });

    test('GET /api/feedback/analysis/{sessionId} should respond within 800ms', async () => {
      const sessionId = 'session-456';

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/feedback/analysis/${sessionId}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FEEDBACK_ENDPOINTS);
    });

    test('GET /api/feedback/store/{storeId} should respond within 800ms', async () => {
      const storeId = 'store-123';

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/feedback/store/${storeId}?page=1&limit=20`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FEEDBACK_ENDPOINTS);
    });
  });

  describe('Admin Dashboard Endpoints', () => {
    test('GET /api/admin/monitoring/health should respond within 1000ms', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/admin/monitoring/health`, {
        headers: {
          'Authorization': 'Bearer mock-admin-token'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ADMIN_ENDPOINTS);
    });

    test('GET /api/admin/monitoring/audit-logs should respond within 1000ms', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/admin/monitoring/audit-logs?page=1&limit=50`, {
        headers: {
          'Authorization': 'Bearer mock-admin-token'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ADMIN_ENDPOINTS);
    });

    test('POST /api/admin/stores/upload should respond within 1000ms', async () => {
      const csvData = dataGenerator.generateBatch('store', 10);

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/admin/stores/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-admin-token'
        },
        body: JSON.stringify({ data: csvData })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ADMIN_ENDPOINTS);
    });
  });

  describe('Concurrent Request Performance', () => {
    test('should handle 10 concurrent store requests within performance threshold', async () => {
      const promises = Array.from({ length: 10 }, () => {
        const startTime = Date.now();
        return fetch(`${API_BASE_URL}/api/stores?page=1&limit=10`)
          .then(response => ({
            status: response.status,
            responseTime: Date.now() - startTime
          }));
      });

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Average response time should be within threshold
      const avgResponseTime = results.reduce((sum, result) => sum + result.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS * 2); // Allow 2x for concurrent load
    });

    test('should handle mixed endpoint requests efficiently', async () => {
      const endpointTests = [
        { url: `${API_BASE_URL}/api/stores`, threshold: PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS },
        { url: `${API_BASE_URL}/api/qr/generate`, method: 'POST', body: { storeId: 'store-123' }, threshold: PERFORMANCE_THRESHOLDS.QR_ENDPOINTS },
        { url: `${API_BASE_URL}/api/verification/status/session-456`, threshold: PERFORMANCE_THRESHOLDS.VERIFICATION_ENDPOINTS },
        { url: `${API_BASE_URL}/api/feedback/store/store-123`, threshold: PERFORMANCE_THRESHOLDS.FEEDBACK_ENDPOINTS }
      ];

      const promises = endpointTests.map(test => {
        const startTime = Date.now();
        const fetchOptions: RequestInit = {
          method: test.method || 'GET',
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (test.body) {
          fetchOptions.body = JSON.stringify(test.body);
        }

        return fetch(test.url, fetchOptions)
          .then(() => ({
            responseTime: Date.now() - startTime,
            threshold: test.threshold,
            url: test.url
          }));
      });

      const results = await Promise.all(promises);

      // Each endpoint should meet its individual threshold
      results.forEach(result => {
        expect(result.responseTime).toBeLessThan(result.threshold * 1.5); // Allow 1.5x for concurrent load
      });
    });
  });

  describe('Database Query Performance', () => {
    test('complex feedback analysis queries should be performant', async () => {
      const storeId = 'store-123';
      const queryParams = new URLSearchParams({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        endDate: new Date().toISOString(),
        includeAnalytics: 'true',
        includeTrends: 'true'
      });

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/feedback/analytics/${storeId}?${queryParams}`);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000); // Complex queries allowed up to 2s
    });

    test('large dataset queries should use pagination efficiently', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/admin/audit-logs?page=1&limit=1000`, {
        headers: {
          'Authorization': 'Bearer mock-admin-token'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(3000); // Large datasets allowed up to 3s
      
      if (response.ok) {
        const data = await response.json();
        expect(data.pagination).toBeDefined();
        expect(data.pagination.total).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Resource Usage Performance', () => {
    test('endpoints should handle large request payloads efficiently', async () => {
      // Generate large CSV upload
      const largeCsvData = dataGenerator.generateBatch('store', 1000);

      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}/api/admin/stores/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-admin-token'
        },
        body: JSON.stringify({ data: largeCsvData })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(30000); // Large uploads allowed up to 30s
    });

    test('endpoints should handle high-frequency requests without degradation', async () => {
      const requestCounts = [1, 5, 10, 20];
      const baselineUrl = `${API_BASE_URL}/api/stores?page=1&limit=5`;
      
      for (const count of requestCounts) {
        const promises = Array.from({ length: count }, () => {
          const startTime = Date.now();
          return fetch(baselineUrl)
            .then(() => Date.now() - startTime);
        });

        const responseTimes = await Promise.all(promises);
        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

        // Response time shouldn't degrade significantly with increased load
        expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.STORE_ENDPOINTS * 2);
      }
    });
  });
});