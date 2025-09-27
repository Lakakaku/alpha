/**
 * Contract Test: POST /ai-assistant/conversations/{id}/messages
 * Test ID: T010
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for sending messages in AI conversations.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { SendMessageRequest, SendMessageResponse, MessageType } from '@vocilia/types';

describe('POST /ai-assistant/conversations/{id}/messages', () => {
  const baseEndpoint = '/api/ai-assistant/conversations';
  let authToken: string;
  let businessId: string;
  let conversationId: string;
  let otherBusinessConversationId: string;
  let completedConversationId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    conversationId = 'test-conversation-id';
    otherBusinessConversationId = 'other-business-conversation-id';
    completedConversationId = 'completed-conversation-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Hello, I need help setting up my store context.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Hello, I need help setting up my store context.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', 'Bearer invalid-token')
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should send message and receive AI response', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Hello, I need help setting up my store context for fraud detection.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseBody: SendMessageResponse = response.body;

      // Validate user message
      expect(responseBody.user_message).toMatchObject({
        id: expect.any(String),
        conversation_id: conversationId,
        message_type: 'text',
        sender_type: 'user',
        content: expect.objectContaining({
          text: 'Hello, I need help setting up my store context for fraud detection.'
        }),
        metadata: expect.any(Object),
        sequence_number: expect.any(Number),
        created_at: expect.any(String)
      });

      // Validate AI response message
      expect(responseBody.ai_response).toMatchObject({
        id: expect.any(String),
        conversation_id: conversationId,
        message_type: 'text',
        sender_type: 'assistant',
        content: expect.objectContaining({
          text: expect.any(String)
        }),
        metadata: expect.any(Object),
        sequence_number: expect.any(Number),
        created_at: expect.any(String)
      });

      // AI response should come after user message
      expect(responseBody.ai_response.sequence_number).toBeGreaterThan(
        responseBody.user_message.sequence_number
      );

      // Validate ISO date format
      expect(new Date(responseBody.user_message.created_at)).toBeInstanceOf(Date);
      expect(new Date(responseBody.ai_response.created_at)).toBeInstanceOf(Date);
    });

    it('should handle message with custom metadata', async () => {
      const requestBody: SendMessageRequest = {
        content: 'What information do you need about my restaurant?',
        metadata: {
          client_timestamp: Date.now(),
          session_id: 'abc123',
          user_agent: 'test-agent'
        }
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseBody: SendMessageResponse = response.body;

      expect(responseBody.user_message.metadata).toMatchObject({
        client_timestamp: expect.any(Number),
        session_id: 'abc123',
        user_agent: 'test-agent'
      });
    });

    it('should extract context from user message', async () => {
      const requestBody: SendMessageRequest = {
        content: 'I run a small Italian restaurant downtown with 8 employees. We serve lunch and dinner, and our peak hours are 12-2pm and 6-9pm.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseBody: SendMessageResponse = response.body;

      // Should include extracted context entries
      expect(responseBody.context_updates).toBeDefined();
      expect(Array.isArray(responseBody.context_updates)).toBe(true);

      if (responseBody.context_updates && responseBody.context_updates.length > 0) {
        const contextEntry = responseBody.context_updates[0];
        expect(contextEntry).toMatchObject({
          id: expect.any(String),
          business_id: businessId,
          conversation_id: conversationId,
          category: expect.stringMatching(/^(store_profile|personnel|operations|layout|inventory|customer_journey|fraud_detection|seasonal_variations)$/),
          key: expect.any(String),
          value: expect.any(Object),
          confidence_score: expect.any(Number),
          source_type: 'ai_inference',
          is_verified: false,
          created_at: expect.any(String),
          updated_at: expect.any(String)
        });

        expect(contextEntry.confidence_score).toBeGreaterThanOrEqual(0);
        expect(contextEntry.confidence_score).toBeLessThanOrEqual(1);
      }
    });

    it('should generate suggestions when appropriate', async () => {
      const requestBody: SendMessageRequest = {
        content: 'I think I have everything set up, but I want to make sure my fraud detection is comprehensive.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseBody: SendMessageResponse = response.body;

      // Should include AI-generated suggestions
      expect(responseBody.suggestions).toBeDefined();
      expect(Array.isArray(responseBody.suggestions)).toBe(true);

      if (responseBody.suggestions && responseBody.suggestions.length > 0) {
        const suggestion = responseBody.suggestions[0];
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          business_id: businessId,
          conversation_id: conversationId,
          suggestion_type: expect.stringMatching(/^(context_gap|question_recommendation|fraud_improvement|frequency_optimization|validation_enhancement)$/),
          title: expect.any(String),
          description: expect.any(String),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          status: 'pending',
          created_at: expect.any(String)
        });
      }
    });

    it('should support different message types', async () => {
      const messageTypes: MessageType[] = ['text', 'suggestion', 'validation', 'context_update'];

      for (const messageType of messageTypes) {
        const requestBody: SendMessageRequest = {
          content: `Test message of type ${messageType}`,
          message_type: messageType
        };

        const response = await request(app)
          .post(`${baseEndpoint}/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(requestBody)
          .expect(200);

        expect(response.body.user_message.message_type).toBe(messageType);
      }
    });

    it('should handle long messages efficiently', async () => {
      const longContent = 'This is a very long message. '.repeat(100); // ~3000 characters

      const requestBody: SendMessageRequest = {
        content: longContent
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body.user_message.content.text).toBe(longContent);
      expect(response.body.ai_response.content.text).toBeDefined();
    });
  });

  describe('Streaming Response', () => {
    it('should support streaming AI responses', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Tell me about best practices for fraud detection in restaurants.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(requestBody)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');

      // Response should contain SSE-formatted data
      expect(response.text).toMatch(/^data: /m);
    });

    it('should handle streaming errors gracefully', async () => {
      const requestBody: SendMessageRequest = {
        content: 'This message should trigger a streaming error for testing.'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .send(requestBody);

      // Should handle errors in streaming format
      if (response.status !== 200) {
        expect(response.status).toBe(500);
        expect(response.text).toMatch(/data: {"type":"error"/);
      }
    });
  });

  describe('Validation', () => {
    it('should return 404 for non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const requestBody: SendMessageRequest = {
        content: 'Message to non-existent conversation'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${nonExistentId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Conversation not found'
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      const requestBody: SendMessageRequest = {
        content: 'Message with invalid conversation ID'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${invalidId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject empty message content', async () => {
      const requestBody: SendMessageRequest = {
        content: ''
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject missing content field', async () => {
      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject content longer than 10000 characters', async () => {
      const requestBody: SendMessageRequest = {
        content: 'A'.repeat(10001)
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid message types', async () => {
      const requestBody = {
        content: 'Valid content',
        message_type: 'invalid-type'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only allow messages in conversations user has access to', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Test message for authorization check'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body.user_message.conversation_id).toBe(conversationId);
    });

    it('should deny access to conversations from other businesses', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Unauthorized message attempt'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${otherBusinessConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to conversation'
      });
    });

    it('should require write_context permission', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';
      const requestBody: SendMessageRequest = {
        content: 'Read only user message attempt'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });

    it('should reject messages to completed conversations', async () => {
      const requestBody: SendMessageRequest = {
        content: 'Message to completed conversation'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${completedConversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Cannot send messages to completed conversation',
        details: expect.any(Object)
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 3 seconds for AI processing', async () => {
      const requestBody: SendMessageRequest = {
        content: 'I need comprehensive help setting up fraud detection for my multi-location restaurant chain with complex seasonal variations and diverse customer demographics.'
      };

      const startTime = Date.now();

      await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000);
    });

    it('should handle rate limiting gracefully', async () => {
      // Send multiple rapid requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(`${baseEndpoint}/${conversationId}/messages`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Rapid message ${i + 1}`
          })
      );

      const responses = await Promise.all(requests.map(req => 
        req.catch(err => err.response || { status: 500, body: { error: 'Request failed' } })
      ));

      // Some should succeed, others might be rate limited
      const successful = responses.filter(r => r.status === 200);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(successful.length).toBeGreaterThanOrEqual(1);
      expect(successful.length + rateLimited.length).toBeGreaterThanOrEqual(5);

      // Rate limited responses should include retry-after header
      rateLimited.forEach(response => {
        expect(response.headers).toHaveProperty('retry-after');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json"}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle AI service failures gracefully', async () => {
      const requestBody: SendMessageRequest = {
        content: 'TRIGGER_AI_SERVICE_FAILURE'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'AI service temporarily unavailable',
        retry_after: expect.any(Number)
      });
    });

    it('should handle context extraction failures gracefully', async () => {
      const requestBody: SendMessageRequest = {
        content: 'TRIGGER_CONTEXT_EXTRACTION_FAILURE'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Should still return response even if context extraction fails
      expect(response.body.user_message).toBeDefined();
      expect(response.body.ai_response).toBeDefined();
      expect(response.body.context_updates).toEqual([]);
    });
  });
});