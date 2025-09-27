/**
 * Contract Test: GET /ai-assistant/conversations/{id}
 * Test ID: T008
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for retrieving a specific AI conversation.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('GET /ai-assistant/conversations/{id}', () => {
  const baseEndpoint = '/api/ai-assistant/conversations';
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let conversationId: string;
  let otherBusinessConversationId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
    conversationId = 'test-conversation-id';
    otherBusinessConversationId = 'other-business-conversation-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should return conversation details', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: expect.any(String),
        store_id: expect.any(String),
        title: expect.any(String),
        status: expect.stringMatching(/^(active|paused|completed|archived)$/),
        completeness_score: expect.any(Number),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate score range
      if (response.body.completeness_score !== null) {
        expect(response.body.completeness_score).toBeGreaterThanOrEqual(0);
        expect(response.body.completeness_score).toBeLessThanOrEqual(100);
      }

      // Validate ISO date format
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.updated_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.last_message_at)).toBeInstanceOf(Date);
    });

    it('should return conversation with null optional fields', async () => {
      const minimalConversationId = 'minimal-conversation-id';

      const response = await request(app)
        .get(`${baseEndpoint}/${minimalConversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: minimalConversationId,
        business_id: expect.any(String),
        store_id: null,
        title: null,
        status: 'active',
        completeness_score: null,
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should support include_messages query parameter', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ include_messages: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: expect.any(String),
        messages: expect.arrayContaining([]),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate message structure if messages exist
      if (response.body.messages.length > 0) {
        const message = response.body.messages[0];
        expect(message).toMatchObject({
          id: expect.any(String),
          conversation_id: conversationId,
          message_type: expect.stringMatching(/^(text|suggestion|validation|context_update)$/),
          sender_type: expect.stringMatching(/^(user|assistant)$/),
          content: expect.any(Object),
          metadata: expect.any(Object),
          sequence_number: expect.any(Number),
          created_at: expect.any(String)
        });
      }
    });

    it('should support include_context query parameter', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ include_context: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: expect.any(String),
        context_entries: expect.arrayContaining([]),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate context entry structure if entries exist
      if (response.body.context_entries.length > 0) {
        const entry = response.body.context_entries[0];
        expect(entry).toMatchObject({
          id: expect.any(String),
          business_id: expect.any(String),
          category: expect.stringMatching(/^(store_profile|personnel|layout|inventory|operations|customer_journey|fraud_detection|seasonal_variations)$/),
          key: expect.any(String),
          value: expect.any(Object),
          confidence_score: expect.any(Number),
          source_type: expect.stringMatching(/^(conversation|ai_inference|manual_input|system_default)$/),
          is_verified: expect.any(Boolean),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        });

        expect(entry.confidence_score).toBeGreaterThanOrEqual(0);
        expect(entry.confidence_score).toBeLessThanOrEqual(1);
      }
    });

    it('should support include_suggestions query parameter', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ include_suggestions: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: expect.any(String),
        suggestions: expect.arrayContaining([]),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate suggestion structure if suggestions exist
      if (response.body.suggestions.length > 0) {
        const suggestion = response.body.suggestions[0];
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          business_id: expect.any(String),
          suggestion_type: expect.stringMatching(/^(context_gap|question_recommendation|fraud_improvement|frequency_optimization|validation_enhancement)$/),
          title: expect.any(String),
          description: expect.any(String),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          status: expect.stringMatching(/^(pending|accepted|rejected|implemented)$/),
          created_at: expect.any(String)
        });
      }
    });

    it('should support multiple include parameters', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ 
          include_messages: 'true',
          include_context: 'true',
          include_suggestions: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: expect.any(String),
        messages: expect.arrayContaining([]),
        context_entries: expect.arrayContaining([]),
        suggestions: expect.arrayContaining([]),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`${baseEndpoint}/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Conversation not found'
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';

      const response = await request(app)
        .get(`${baseEndpoint}/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should return 400 for invalid include parameter values', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ include_messages: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only return conversations for businesses user has access to', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Conversation should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should deny access to conversations from other businesses', async () => {
      const response = await request(app)
        .get(`${baseEndpoint}/${otherBusinessConversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to conversation'
      });
    });

    it('should require write_context permission for conversation access', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';

      const response = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms without includes', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond within 500ms with all includes', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .query({ 
          include_messages: 'true',
          include_context: 'true',
          include_suggestions: 'true'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent conversation data across multiple requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // All responses should be successful
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // All responses should have identical core data
      const firstResponse = responses[0].body;
      responses.slice(1).forEach(response => {
        expect(response.body.id).toBe(firstResponse.id);
        expect(response.body.business_id).toBe(firstResponse.business_id);
        expect(response.body.created_at).toBe(firstResponse.created_at);
        expect(response.body.title).toBe(firstResponse.title);
        expect(response.body.status).toBe(firstResponse.status);
      });
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 20 }, () =>
        request(app)
          .get(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Concurrent requests should not take significantly longer than sequential
      expect(totalTime).toBeLessThan(2000);
    });
  });
});