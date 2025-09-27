/**
 * Contract Test: POST /ai-assistant/conversations
 * Test ID: T007
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for creating new AI conversations.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { CreateConversationRequest } from '@vocilia/types';

describe('POST /ai-assistant/conversations', () => {
  const endpoint = '/api/ai-assistant/conversations';
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Test Conversation'
      };

      const response = await request(app)
        .post(endpoint)
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Test Conversation'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', 'Bearer invalid-token')
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should create conversation with minimal data', async () => {
      const requestBody: CreateConversationRequest = {};

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: expect.any(String),
        store_id: null,
        title: null,
        status: 'active',
        completeness_score: null,
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate UUID format
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Validate ISO date format
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.updated_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.last_message_at)).toBeInstanceOf(Date);
    });

    it('should create conversation with title', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Store Context Building Session'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: null,
        title: 'Store Context Building Session',
        status: 'active',
        completeness_score: null,
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should create conversation with store_id', async () => {
      const requestBody: CreateConversationRequest = {
        store_id: storeId,
        title: 'Downtown Store Context'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: storeId,
        title: 'Downtown Store Context',
        status: 'active',
        completeness_score: null,
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should create conversation with initial context', async () => {
      const requestBody: CreateConversationRequest = {
        store_id: storeId,
        title: 'Automated Context Session',
        initial_context: {
          business_type: 'restaurant',
          location: 'downtown',
          size: 'medium'
        }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: storeId,
        title: 'Automated Context Session',
        status: 'active',
        completeness_score: expect.any(Number),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Should have initial completeness score when context provided
      expect(response.body.completeness_score).toBeGreaterThan(0);
      expect(response.body.completeness_score).toBeLessThanOrEqual(100);
    });
  });

  describe('Validation', () => {
    it('should reject invalid store_id format', async () => {
      const requestBody: CreateConversationRequest = {
        store_id: 'not-a-uuid',
        title: 'Test Conversation'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject title longer than 200 characters', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'A'.repeat(201)
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject empty title string', async () => {
      const requestBody: CreateConversationRequest = {
        title: ''
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid initial_context format', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          initial_context: 'should-be-object'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only allow creation for businesses user has access to', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Test Conversation'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      // Created conversation should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should require write_context permission', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';

      const requestBody: CreateConversationRequest = {
        title: 'Test Conversation'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });

    it('should reject access to stores user does not manage', async () => {
      const unauthorizedStoreId = 'unauthorized-store-id';

      const requestBody: CreateConversationRequest = {
        store_id: unauthorizedStoreId,
        title: 'Unauthorized Store Access'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to specified store'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json"}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send('plain text')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle very large request bodies', async () => {
      const largeContext: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeContext[`key_${i}`] = 'A'.repeat(100);
      }

      const requestBody: CreateConversationRequest = {
        title: 'Large Context Test',
        initial_context: largeContext
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(413);

      expect(response.body).toMatchObject({
        error: 'Request entity too large'
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 500ms', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Performance Test Conversation'
      };

      const startTime = Date.now();

      await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle concurrent creation requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Test ${i + 1}`
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          title: expect.stringMatching(/^Concurrent Test \d+$/)
        });
      });

      // All conversations should have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Initial Context Processing', () => {
    it('should process initial context and calculate completeness score', async () => {
      const requestBody: CreateConversationRequest = {
        title: 'Context Processing Test',
        initial_context: {
          store_profile: {
            name: 'Downtown Cafe',
            type: 'restaurant',
            size: 'small'
          },
          personnel: {
            staff_count: 5,
            manager_name: 'John Doe'
          },
          operations: {
            hours: '7am-9pm',
            peak_times: ['lunch', 'dinner']
          }
        }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        completeness_score: expect.any(Number),
        last_message_at: expect.any(String)
      });

      // Should have meaningful completeness score
      expect(response.body.completeness_score).toBeGreaterThan(20);
      expect(response.body.completeness_score).toBeLessThanOrEqual(100);
    });
  });
});