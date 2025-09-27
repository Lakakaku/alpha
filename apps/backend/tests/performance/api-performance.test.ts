import request from 'supertest';
import { app } from '../../src/app';

// Mock dependencies
jest.mock('../../src/services/ai/openaiService');
jest.mock('../../src/services/calls/callManagerService');
jest.mock('../../src/services/feedback-analysis/analysisService');

const PERFORMANCE_THRESHOLD_MS = 500; // <500ms API calls requirement

describe('API Performance Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Mock authentication token
    authToken = 'Bearer test-token';
    
    // Setup performance monitoring
    console.log('Starting API performance tests with threshold:', PERFORMANCE_THRESHOLD_MS, 'ms');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Call Management Endpoints', () => {
    it('should initiate call within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/calls/initiate')
        .set('Authorization', authToken)
        .send({
          customer_verification_id: 'test-verification-123',
          store_id: 'test-store-456',
          phone_number: '+46701234567',
          business_context: {
            storeName: 'Test Store',
            departments: ['Electronics']
          }
        });

      const duration = Date.now() - startTime;

      // Performance assertion
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      
      console.log(`Call initiation took ${duration}ms (threshold: ${PERFORMANCE_THRESHOLD_MS}ms)`);
      
      // Functional assertion (mocked)
      expect(response.status).toBe(201);
    });

    it('should get call status within performance threshold', async () => {
      const sessionId = 'test-session-123';
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/ai/calls/${sessionId}/status`)
        .set('Authorization', authToken);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Call status check took ${duration}ms`);
      
      expect([200, 404]).toContain(response.status);
    });

    it('should handle call retry within performance threshold', async () => {
      const sessionId = 'test-session-123';
      const startTime = Date.now();

      const response = await request(app)
        .put(`/api/ai/calls/${sessionId}/retry`)
        .set('Authorization', authToken);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Call retry took ${duration}ms`);
      
      expect([200, 404, 409]).toContain(response.status);
    });
  });

  describe('Feedback Analysis Endpoints', () => {
    it('should analyze quality within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/analysis/quality')
        .set('Authorization', authToken)
        .send({
          call_session_id: 'test-session-123',
          conversation_transcript: [
            { speaker: 'customer', content: 'Great service!', timestamp: '2025-01-01T10:00:00Z' }
          ],
          business_context: {
            storeName: 'Test Store',
            departments: ['Electronics']
          }
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Quality analysis took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });

    it('should detect fraud within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .set('Authorization', authToken)
        .send({
          call_session_id: 'test-session-123',
          conversation_transcript: [
            { speaker: 'customer', content: 'Generic response', timestamp: '2025-01-01T10:00:00Z' }
          ],
          business_context: {
            storeName: 'Test Store',
            baseline_facts: { products: ['laptops'] }
          }
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Fraud detection took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });

    it('should get analysis metrics within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/ai/analysis/metrics')
        .set('Authorization', authToken)
        .query({
          store_id: 'test-store-456',
          date_from: '2025-01-01',
          date_to: '2025-01-31'
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Metrics retrieval took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Business Intelligence Endpoints', () => {
    it('should generate report within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/business/reports/generate')
        .set('Authorization', authToken)
        .send({
          store_id: 'test-store-456',
          week_start: '2025-01-01',
          week_end: '2025-01-07'
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Report generation took ${duration}ms`);
      
      expect([201, 400]).toContain(response.status);
    });

    it('should search business data within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/ai/business/search')
        .set('Authorization', authToken)
        .query({
          store_id: 'test-store-456',
          query: 'customer service',
          limit: 10
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Business search took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });

    it('should get trends within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/ai/business/trends')
        .set('Authorization', authToken)
        .query({
          store_id: 'test-store-456',
          period: 'monthly',
          metric: 'quality_score'
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Trends analysis took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });

    it('should get recommendations within performance threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/ai/business/recommendations')
        .set('Authorization', authToken)
        .query({
          store_id: 'test-store-456',
          category: 'service_improvement'
        });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      console.log(`Recommendations took ${duration}ms`);
      
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent requests within threshold', async () => {
      const concurrentRequests = 5;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .get('/api/ai/analysis/metrics')
          .set('Authorization', authToken)
          .query({
            store_id: `test-store-${i}`,
            date_from: '2025-01-01',
            date_to: '2025-01-31'
          });
        
        requests.push(promise);
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Each individual request should be fast, but concurrent execution
      // should not significantly degrade performance
      const averageDuration = duration / concurrentRequests;
      
      expect(averageDuration).toBeLessThan(PERFORMANCE_THRESHOLD_MS * 1.5); // Allow 50% degradation for concurrent load
      console.log(`${concurrentRequests} concurrent requests took ${duration}ms total (avg: ${averageDuration}ms per request)`);
      
      // All requests should complete successfully
      responses.forEach(response => {
        expect([200, 400]).toContain(response.status);
      });
    });
  });

  describe('Error Response Performance', () => {
    it('should return errors quickly for invalid requests', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/calls/initiate')
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      const duration = Date.now() - startTime;

      // Error responses should be even faster
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2);
      console.log(`Error response took ${duration}ms`);
      
      expect(response.status).toBe(401);
    });

    it('should handle malformed request bodies quickly', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/analysis/quality')
        .set('Authorization', authToken)
        .send('invalid-json');

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS / 2);
      console.log(`Malformed request handling took ${duration}ms`);
      
      expect(response.status).toBe(400);
    });
  });
});

// Performance benchmark summary
afterAll(() => {
  console.log('\n=== API Performance Test Summary ===');
  console.log(`Performance threshold: ${PERFORMANCE_THRESHOLD_MS}ms`);
  console.log('All tests should complete within the threshold');
  console.log('Concurrent requests allow 50% degradation');
  console.log('Error responses should be 2x faster than success cases');
  console.log('=====================================\n');
});