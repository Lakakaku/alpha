import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, cleanupTestData } from '../helpers/test-helpers';

describe('AI Assistant Performance Tests', () => {
  let authToken: string;
  let storeId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Setup test user and store
    const testUser = await createTestUser();
    authToken = testUser.token;
    storeId = testUser.storeId;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('AI Response Performance (<3s requirement)', () => {
    it('should respond to AI messages within 3 seconds', async () => {
      // Create a conversation first
      const conversationResponse = await request(app)
        .post('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Performance Test Conversation',
          storeId: storeId
        });

      conversationId = conversationResponse.body.id;

      const startTime = Date.now();

      const response = await request(app)
        .post(`/ai-assistant/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'What information do you need about my restaurant?',
          role: 'user'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(3000); // Must be under 3 seconds
      expect(response.body).toHaveProperty('content');
      expect(response.body.role).toBe('assistant');
    }, 10000); // Allow 10s for the test itself

    it('should handle streaming responses within performance limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post(`/ai-assistant/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send({
          content: 'Tell me about setting up a customer feedback system for my store.',
          role: 'user',
          stream: true
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000); // Total streaming time under 3s
      expect(response.headers['content-type']).toContain('text/event-stream');
    }, 10000);

    it('should maintain performance under concurrent AI requests', async () => {
      const concurrentRequests = 5;
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post(`/ai-assistant/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Performance test message ${i + 1}`,
            role: 'user'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(10000); // All requests under 10s total
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('content');
        expect(response.body.role).toBe('assistant');
      });
    }, 15000);
  });

  describe('Context Validation Performance (<2s requirement)', () => {
    it('should calculate validation scores within 2 seconds', async () => {
      // Create some context entries first
      await request(app)
        .post('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeId: storeId,
          category: 'business_info',
          key: 'business_type',
          value: 'Restaurant',
          priority: 'high'
        });

      await request(app)
        .post('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeId: storeId,
          category: 'products_services',
          key: 'menu_items',
          value: 'Pizza, Pasta, Salads',
          priority: 'medium'
        });

      const startTime = Date.now();

      const response = await request(app)
        .get('/ai-assistant/validation/score')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ storeId: storeId });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Must be under 2 seconds
      expect(response.body).toHaveProperty('overallScore');
      expect(response.body).toHaveProperty('categoryScores');
      expect(response.body).toHaveProperty('missingFields');
      expect(response.body).toHaveProperty('recommendations');
    }, 5000);

    it('should handle large context datasets efficiently', async () => {
      // Create a large number of context entries
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < batchSize; i++) {
        const createPromise = request(app)
          .post('/ai-assistant/context/entries')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            storeId: storeId,
            category: ['business_info', 'products_services', 'policies', 'staff_training', 'goals_metrics'][i % 5],
            key: `performance_test_key_${i}`,
            value: `Performance test value ${i}`,
            priority: ['high', 'medium', 'low'][i % 3]
          });
        batches.push(createPromise);
      }

      await Promise.all(batches);

      const startTime = Date.now();

      const response = await request(app)
        .get('/ai-assistant/validation/score')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ storeId: storeId });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Still under 2 seconds with large dataset
      expect(response.body.overallScore).toBeGreaterThan(0);
    }, 10000);

    it('should cache validation results for improved performance', async () => {
      // First call - full calculation
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get('/ai-assistant/validation/score')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ storeId: storeId });
      const duration1 = Date.now() - startTime1;

      // Second call - should use cache
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get('/ai-assistant/validation/score')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ storeId: storeId });
      const duration2 = Date.now() - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.overallScore).toBe(response2.body.overallScore);
      expect(duration2).toBeLessThan(duration1); // Cached response should be faster
      expect(duration2).toBeLessThan(500); // Cached response under 500ms
    }, 5000);
  });

  describe('Suggestion Generation Performance', () => {
    it('should generate suggestions within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/ai-assistant/suggestions/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          storeId: storeId,
          category: 'business_info',
          context: 'Restaurant needs help with customer service policies'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(5000); // Suggestion generation under 5s
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    }, 8000);

    it('should list existing suggestions quickly', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/ai-assistant/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ storeId: storeId });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // List suggestions under 1s
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    }, 3000);
  });

  describe('Real-time Performance', () => {
    it('should handle auto-save operations efficiently', async () => {
      const saves = [];
      const startTime = Date.now();

      // Simulate rapid auto-save operations
      for (let i = 0; i < 10; i++) {
        const savePromise = request(app)
          .post('/ai-assistant/context/entries')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            storeId: storeId,
            category: 'business_info',
            key: `auto_save_test_${i}`,
            value: `Auto save value ${i}`,
            priority: 'medium'
          });
        saves.push(savePromise);
      }

      const results = await Promise.all(saves);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(5000); // All auto-saves under 5s
      results.forEach(result => {
        expect(result.status).toBe(201);
      });
    }, 8000);

    it('should maintain responsiveness during peak usage', async () => {
      const operations = [];
      const startTime = Date.now();

      // Mix of different operations
      operations.push(
        request(app)
          .get('/ai-assistant/conversations')
          .set('Authorization', `Bearer ${authToken}`)
      );

      operations.push(
        request(app)
          .get('/ai-assistant/validation/score')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ storeId: storeId })
      );

      operations.push(
        request(app)
          .get('/ai-assistant/suggestions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ storeId: storeId })
      );

      operations.push(
        request(app)
          .get('/ai-assistant/context/entries')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ storeId: storeId })
      );

      const results = await Promise.all(operations);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(3000); // All operations under 3s
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    }, 5000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during extended usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate extended usage
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post(`/ai-assistant/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Memory test message ${i}`,
            role: 'user'
          });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 30000);

    it('should handle database connection pooling efficiently', async () => {
      const concurrentQueries = 20;
      const promises = [];
      const startTime = Date.now();

      // Create many concurrent database queries
      for (let i = 0; i < concurrentQueries; i++) {
        promises.push(
          request(app)
            .get('/ai-assistant/context/entries')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ storeId: storeId })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(5000); // All queries under 5s
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
    }, 8000);
  });
});