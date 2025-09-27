/**
 * Integration test for performance validation
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('Performance Validation Integration', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  describe('API Response Time Requirements', () => {
    test('should meet database query performance targets (<200ms)', async () => {
      const endpoints = [
        { method: 'GET', path: `/feedback-analysis/reports/${testStoreId}/current`, target: 200 },
        { method: 'GET', path: `/feedback-analysis/reports/${testStoreId}/historical`, target: 200 },
        { method: 'GET', path: `/feedback-analysis/insights/${testStoreId}`, target: 200 },
        { method: 'GET', path: `/feedback-analysis/temporal/${testStoreId}`, target: 200 }
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        const response = await request(app)
          [endpoint.method.toLowerCase() as 'get'](endpoint.path)
          .set('Authorization', authToken);

        const responseTime = Date.now() - startTime;
        
        // Should meet performance target
        expect(responseTime).toBeLessThan(endpoint.target);
        
        // Should include performance headers
        expect(response.headers['x-response-time']).toBeDefined();
        
        const headerResponseTime = parseInt(response.headers['x-response-time']);
        expect(headerResponseTime).toBeLessThan(endpoint.target);
        
        console.log(`${endpoint.method} ${endpoint.path}: ${responseTime}ms (target: ${endpoint.target}ms)`);
      }
    });

    test('should meet AI processing performance targets (<3s)', async () => {
      const aiEndpoints = [
        { 
          method: 'POST', 
          path: `/feedback-analysis/search/${testStoreId}`,
          body: { query_text: 'Problem med kassa', limit: 20 },
          target: 3000 
        },
        { 
          method: 'POST', 
          path: `/feedback-analysis/reports/${testStoreId}/generate`,
          body: { week_number: 38, year: 2025, force_regenerate: true },
          target: 100 // Job creation should be fast
        }
      ];

      for (const endpoint of aiEndpoints) {
        const startTime = Date.now();
        
        const response = await request(app)
          [endpoint.method.toLowerCase() as 'post'](endpoint.path)
          .set('Authorization', authToken)
          .send(endpoint.body);

        const responseTime = Date.now() - startTime;
        
        // Should meet performance target
        expect(responseTime).toBeLessThan(endpoint.target);
        
        if (endpoint.path.includes('search')) {
          // Search should return results directly
          expect([200, 404]).toContain(response.status);
          
          if (response.status === 200) {
            // Should include execution time metadata
            expect(response.body.execution_time_ms).toBeDefined();
            expect(response.body.execution_time_ms).toBeLessThan(3000);
          }
        } else if (endpoint.path.includes('generate')) {
          // Report generation should return job quickly
          expect(response.status).toBe(202);
          expect(response.body.job_id).toBeDefined();
          expect(response.body.estimated_completion_ms).toBeDefined();
        }
        
        console.log(`${endpoint.method} ${endpoint.path}: ${responseTime}ms (target: ${endpoint.target}ms)`);
      }
    });

    test('should maintain categorization performance target (<2s)', async () => {
      // Test categorization endpoint if it exists separately, or validate within reports
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/feedback-analysis/reports/${testStoreId}/current`)
        .set('Authorization', authToken);

      const responseTime = Date.now() - startTime;
      
      if (response.status === 200 && response.body.total_feedback_count > 0) {
        // Should include categorization timing if available
        const categorizationTime = response.headers['x-categorization-time'];
        if (categorizationTime) {
          expect(parseInt(categorizationTime)).toBeLessThan(2000);
        }
        
        // Overall response should be under 2s for categorized data
        expect(responseTime).toBeLessThan(2000);
        
        // Should have categorized content
        expect(response.body.positive_summary || response.body.negative_summary).toBeDefined();
      }
      
      console.log(`Categorization performance: ${responseTime}ms`);
    });
  });

  describe('Concurrent Load Handling', () => {
    test('should handle concurrent API requests without degradation', async () => {
      const concurrentRequests = 10;
      const endpoint = `/feedback-analysis/reports/${testStoreId}/current`;
      
      // Measure baseline performance
      const baselineStart = Date.now();
      await request(app)
        .get(endpoint)
        .set('Authorization', authToken);
      const baselineTime = Date.now() - baselineStart;
      
      // Execute concurrent requests
      const concurrentStart = Date.now();
      const requests = Array(concurrentRequests).fill(0).map(() =>
        request(app)
          .get(endpoint)
          .set('Authorization', authToken)
      );
      
      const responses = await Promise.all(requests);
      const concurrentTotalTime = Date.now() - concurrentStart;
      const averageConcurrentTime = concurrentTotalTime / concurrentRequests;
      
      // All requests should succeed
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
      
      // Performance should not degrade significantly under load
      const degradationRatio = averageConcurrentTime / baselineTime;
      expect(degradationRatio).toBeLessThan(3); // Max 3x degradation
      
      console.log(`Baseline: ${baselineTime}ms, Concurrent average: ${averageConcurrentTime}ms, Ratio: ${degradationRatio.toFixed(2)}`);
    });

    test('should handle concurrent search requests efficiently', async () => {
      const searchQueries = [
        'Problem med kassa',
        'Köttavdelning kvalitet',
        'Bageri service',
        'Kundservice problem',
        'Parkering svårigheter'
      ];
      
      const startTime = Date.now();
      
      const requests = searchQueries.map(query =>
        request(app)
          .post(`/feedback-analysis/search/${testStoreId}`)
          .set('Authorization', authToken)
          .send({ query_text: query, limit: 10 })
      );
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / searchQueries.length;
      
      // All searches should complete successfully
      responses.forEach((response, index) => {
        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.execution_time_ms).toBeDefined();
          expect(response.body.execution_time_ms).toBeLessThan(5000); // Individual search <5s
        }
        
        console.log(`Search "${searchQueries[index]}": ${response.status} in ${response.body.execution_time_ms || 'N/A'}ms`);
      });
      
      // Average search time should be reasonable
      expect(averageTime).toBeLessThan(4000);
      
      console.log(`Concurrent search average: ${averageTime}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should maintain stable memory usage during extended operations', async () => {
      // Perform multiple operations to test memory stability
      const operations = [
        () => request(app).get(`/feedback-analysis/reports/${testStoreId}/current`).set('Authorization', authToken),
        () => request(app).get(`/feedback-analysis/insights/${testStoreId}`).set('Authorization', authToken),
        () => request(app).get(`/feedback-analysis/temporal/${testStoreId}`).set('Authorization', authToken),
        () => request(app).post(`/feedback-analysis/search/${testStoreId}`).set('Authorization', authToken).send({ query_text: 'test', limit: 20 })
      ];
      
      // Record initial memory if available in headers
      const initialResponse = await operations[0]();
      const initialMemory = initialResponse.headers['x-memory-usage'];
      
      // Perform extended operations
      for (let i = 0; i < 20; i++) {
        const operation = operations[i % operations.length];
        const response = await operation();
        
        expect([200, 202, 404]).toContain(response.status);
        
        // Check for memory leaks if header is available
        const currentMemory = response.headers['x-memory-usage'];
        if (initialMemory && currentMemory) {
          const memoryIncrease = parseInt(currentMemory) - parseInt(initialMemory);
          const memoryIncreasePercent = (memoryIncrease / parseInt(initialMemory)) * 100;
          
          // Memory usage should not increase dramatically
          expect(memoryIncreasePercent).toBeLessThan(50); // Max 50% increase
        }
        
        // Check response times remain consistent
        const responseTime = response.headers['x-response-time'];
        if (responseTime) {
          expect(parseInt(responseTime)).toBeLessThan(5000);
        }
      }
    });

    test('should handle large dataset operations efficiently', async () => {
      // Test with large limit to stress test the system
      const largeSearchRequest = {
        query_text: '*',
        limit: 100, // Maximum allowed
        departments: ['kassa', 'kött', 'bageri'],
        date_range: {
          start_date: '2025-08-01',
          end_date: '2025-09-21'
        }
      };
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/feedback-analysis/search/${testStoreId}`)
        .set('Authorization', authToken)
        .send(largeSearchRequest);
      
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        // Should handle large datasets efficiently
        expect(responseTime).toBeLessThan(10000); // 10s for large dataset
        expect(response.body.execution_time_ms).toBeLessThan(10000);
        
        // Should return data in reasonable structure
        expect(response.body.feedback).toBeDefined();
        expect(Array.isArray(response.body.feedback)).toBe(true);
        expect(response.body.total_count).toBeDefined();
        
        // Results should be properly paginated/limited
        expect(response.body.feedback.length).toBeLessThanOrEqual(100);
        
        console.log(`Large dataset query: ${responseTime}ms, returned ${response.body.feedback.length} items`);
      }
    });
  });

  describe('Database Performance Optimization', () => {
    test('should use database indexes effectively', async () => {
      // Test queries that should benefit from indexes
      const indexedQueries = [
        { path: `/feedback-analysis/reports/${testStoreId}/historical?weeks=4`, expectedTime: 150 },
        { path: `/feedback-analysis/insights/${testStoreId}?status=active`, expectedTime: 200 },
        { path: `/feedback-analysis/temporal/${testStoreId}?weeks_back=2`, expectedTime: 300 }
      ];
      
      for (const query of indexedQueries) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(query.path)
          .set('Authorization', authToken);
        
        const responseTime = Date.now() - startTime;
        
        // Should benefit from database indexes
        expect(responseTime).toBeLessThan(query.expectedTime);
        
        // Should include query execution time in headers
        const dbQueryTime = response.headers['x-db-query-time'];
        if (dbQueryTime) {
          expect(parseInt(dbQueryTime)).toBeLessThan(query.expectedTime * 0.8); // DB time should be less than total
        }
        
        console.log(`Indexed query ${query.path}: ${responseTime}ms (target: ${query.expectedTime}ms)`);
      }
    });

    test('should optimize complex aggregation queries', async () => {
      // Test report generation which involves complex aggregations
      const generateResponse = await request(app)
        .post(`/feedback-analysis/reports/${testStoreId}/generate`)
        .set('Authorization', authToken)
        .send({
          week_number: 38,
          year: 2025,
          force_regenerate: true
        });
      
      expect(generateResponse.status).toBe(202);
      const jobId = generateResponse.body.job_id;
      
      // Monitor job completion time
      const jobStartTime = Date.now();
      let jobCompleted = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max
      
      while (!jobCompleted && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/feedback-analysis/status/${jobId}`)
          .set('Authorization', authToken);
        
        if (statusResponse.body.status === 'completed') {
          jobCompleted = true;
          
          const processingTime = Date.now() - jobStartTime;
          
          // Complex aggregation should complete within 5 minutes
          expect(processingTime).toBeLessThan(300000);
          
          // Should include performance metrics
          expect(statusResponse.body.processing_time_ms).toBeDefined();
          
          console.log(`Report generation: ${processingTime}ms`);
          
        } else if (statusResponse.body.status === 'failed') {
          throw new Error(`Job failed: ${statusResponse.body.error_message}`);
        }
        
        attempts++;
      }
      
      expect(jobCompleted).toBe(true);
    });
  });

  describe('Caching and Optimization', () => {
    test('should leverage caching for repeated requests', async () => {
      const endpoint = `/feedback-analysis/reports/${testStoreId}/current`;
      
      // First request (cold cache)
      const firstStart = Date.now();
      const firstResponse = await request(app)
        .get(endpoint)
        .set('Authorization', authToken);
      const firstTime = Date.now() - firstStart;
      
      // Second request (should hit cache)
      const secondStart = Date.now();
      const secondResponse = await request(app)
        .get(endpoint)
        .set('Authorization', authToken);
      const secondTime = Date.now() - secondStart;
      
      if (firstResponse.status === 200 && secondResponse.status === 200) {
        // Cached request should be significantly faster
        expect(secondTime).toBeLessThan(firstTime * 0.8);
        
        // Should have cache headers
        expect(secondResponse.headers['x-cache-status']).toBeDefined();
        
        // Content should be identical
        expect(secondResponse.body.id).toBe(firstResponse.body.id);
        
        console.log(`Cache performance: First ${firstTime}ms, Second ${secondTime}ms (${((1 - secondTime/firstTime) * 100).toFixed(1)}% improvement)`);
      }
    });

    test('should optimize AI response caching', async () => {
      const searchQuery = { query_text: 'kvalitet problem', limit: 20 };
      
      // First AI-powered search
      const firstStart = Date.now();
      const firstResponse = await request(app)
        .post(`/feedback-analysis/search/${testStoreId}`)
        .set('Authorization', authToken)
        .send(searchQuery);
      const firstTime = Date.now() - firstStart;
      
      // Second identical search (should use cached AI results)
      const secondStart = Date.now();
      const secondResponse = await request(app)
        .post(`/feedback-analysis/search/${testStoreId}`)
        .set('Authorization', authToken)
        .send(searchQuery);
      const secondTime = Date.now() - secondStart;
      
      if (firstResponse.status === 200 && secondResponse.status === 200) {
        // Cached AI response should be much faster
        expect(secondTime).toBeLessThan(firstTime * 0.5);
        
        // Should indicate AI cache hit
        expect(secondResponse.headers['x-ai-cache-status']).toBeDefined();
        
        console.log(`AI cache performance: First ${firstTime}ms, Second ${secondTime}ms`);
      }
    });
  });

  describe('Scalability Validation', () => {
    test('should handle gradual load increase gracefully', async () => {
      const maxConcurrent = 15;
      const endpoint = `/feedback-analysis/insights/${testStoreId}`;
      
      // Test increasing concurrent load
      for (let concurrent = 1; concurrent <= maxConcurrent; concurrent += 2) {
        const startTime = Date.now();
        
        const requests = Array(concurrent).fill(0).map(() =>
          request(app)
            .get(endpoint)
            .set('Authorization', authToken)
        );
        
        const responses = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        const averageTime = totalTime / concurrent;
        
        // All requests should succeed
        responses.forEach(response => {
          expect([200, 404]).toContain(response.status);
        });
        
        // Performance should degrade gracefully
        expect(averageTime).toBeLessThan(5000); // Should not exceed 5s per request
        
        console.log(`${concurrent} concurrent requests: ${averageTime.toFixed(0)}ms average`);
        
        // Brief pause between load tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    test('should validate rate limiting behavior', async () => {
      const endpoint = `/feedback-analysis/search/${testStoreId}`;
      const searchBody = { query_text: 'test', limit: 10 };
      
      // Send rapid requests to test rate limiting
      const rapidRequests = Array(20).fill(0).map(() =>
        request(app)
          .post(endpoint)
          .set('Authorization', authToken)
          .send(searchBody)
      );
      
      const responses = await Promise.all(rapidRequests);
      
      // Some requests should succeed, some might be rate limited
      const successfulRequests = responses.filter(r => r.status === 200);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      // Should have at least some successful requests
      expect(successfulRequests.length).toBeGreaterThan(0);
      
      // Rate limited requests should have appropriate headers
      rateLimitedRequests.forEach(response => {
        expect(response.headers['retry-after']).toBeDefined();
        expect(response.body.message).toMatch(/rate limit/i);
      });
      
      console.log(`Rate limiting: ${successfulRequests.length} successful, ${rateLimitedRequests.length} rate limited`);
    });
  });
});