/**
 * Contract Test: PATCH /ai-assistant/conversations/{id}
 * Test ID: T009
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for updating AI conversations.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { UpdateConversationRequest, ConversationStatus } from '@vocilia/types';

describe('PATCH /ai-assistant/conversations/{id}', () => {
  const baseEndpoint = '/api/ai-assistant/conversations';
  let authToken: string;
  let businessId: string;
  let conversationId: string;
  let otherBusinessConversationId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    conversationId = 'test-conversation-id';
    otherBusinessConversationId = 'other-business-conversation-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should update conversation title', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Conversation Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId,
        title: 'Updated Conversation Title',
        status: expect.any(String),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // updated_at should be more recent than created_at
      const createdAt = new Date(response.body.created_at);
      const updatedAt = new Date(response.body.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    });

    it('should update conversation status', async () => {
      const requestBody: UpdateConversationRequest = {
        status: 'paused' as ConversationStatus
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId,
        status: 'paused',
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should update both title and status', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Completed Store Analysis',
        status: 'completed' as ConversationStatus
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId,
        title: 'Completed Store Analysis',
        status: 'completed',
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should clear title when set to null', async () => {
      const requestBody: UpdateConversationRequest = {
        title: null
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId,
        title: null,
        status: expect.any(String),
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should handle empty update gracefully', async () => {
      const requestBody: UpdateConversationRequest = {};

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId,
        last_message_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // updated_at should still be updated even for empty requests
      const createdAt = new Date(response.body.created_at);
      const updatedAt = new Date(response.body.updated_at);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    });

    it('should support all valid conversation statuses', async () => {
      const statuses: ConversationStatus[] = ['active', 'paused', 'completed', 'archived'];

      for (const status of statuses) {
        const requestBody: UpdateConversationRequest = { status };

        const response = await request(app)
          .patch(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(requestBody)
          .expect(200);

        expect(response.body.status).toBe(status);
      }
    });
  });

  describe('Validation', () => {
    it('should return 404 for non-existent conversation', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Conversation not found'
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid status values', async () => {
      const requestBody = {
        status: 'invalid-status'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject title longer than 200 characters', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'A'.repeat(201)
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject empty title string', async () => {
      const requestBody: UpdateConversationRequest = {
        title: ''
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject updates with no changes', async () => {
      // First, get current conversation state
      const currentResponse = await request(app)
        .get(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to update with same values
      const requestBody: UpdateConversationRequest = {
        title: currentResponse.body.title,
        status: currentResponse.body.status
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'No changes detected',
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only allow updates to conversations user has access to', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Updated conversation should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should deny access to conversations from other businesses', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Unauthorized Update'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${otherBusinessConversationId}`)
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
      const requestBody: UpdateConversationRequest = {
        title: 'Read Only Update Attempt'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
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
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send('plain text')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle unexpected fields gracefully', async () => {
      const requestBody = {
        title: 'Valid Title',
        unexpected_field: 'should be ignored',
        business_id: 'should not be updated'
      };

      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: conversationId,
        business_id: businessId, // Should remain original business_id
        title: 'Valid Title'
      });

      // Should not include unexpected fields in response
      expect(response.body).not.toHaveProperty('unexpected_field');
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms', async () => {
      const requestBody: UpdateConversationRequest = {
        title: 'Performance Test Update'
      };

      const startTime = Date.now();

      await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle concurrent updates with proper locking', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .patch(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Update ${i + 1}`
          })
      );

      const responses = await Promise.all(requests.map(req => 
        req.catch(err => err.response || { status: 500, body: { error: 'Request failed' } })
      ));

      // At least one should succeed, others might fail due to conflicts
      const successful = responses.filter(r => r.status === 200);
      const conflicts = responses.filter(r => r.status === 409);

      expect(successful.length).toBeGreaterThanOrEqual(1);
      expect(successful.length + conflicts.length).toBe(10);

      // The successful update should have one of the concurrent titles
      if (successful.length > 0) {
        const finalTitle = successful[successful.length - 1].body.title;
        expect(finalTitle).toMatch(/^Concurrent Update \d+$/);
      }
    });
  });

  describe('State Transitions', () => {
    it('should allow valid status transitions', async () => {
      // Test valid transitions: active -> paused -> active -> completed -> archived
      const transitions = [
        { from: 'active', to: 'paused' },
        { from: 'paused', to: 'active' },
        { from: 'active', to: 'completed' },
        { from: 'completed', to: 'archived' }
      ];

      for (const transition of transitions) {
        // First set to the 'from' status
        await request(app)
          .patch(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: transition.from })
          .expect(200);

        // Then transition to the 'to' status
        const response = await request(app)
          .patch(`${baseEndpoint}/${conversationId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: transition.to })
          .expect(200);

        expect(response.body.status).toBe(transition.to);
      }
    });

    it('should reject invalid status transitions', async () => {
      // Set conversation to completed
      await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Try to transition back to active (should be forbidden)
      const response = await request(app)
        .patch(`${baseEndpoint}/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'active' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid status transition',
        details: expect.objectContaining({
          current_status: 'completed',
          requested_status: 'active'
        })
      });
    });
  });
});