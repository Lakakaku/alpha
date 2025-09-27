/**
 * Contract Test: POST /ai-assistant/suggestions/{id}/accept
 * Test ID: T014
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for accepting AI suggestions.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { AcceptSuggestionRequest } from '@vocilia/types';

describe('POST /ai-assistant/suggestions/{id}/accept', () => {
  const baseEndpoint = '/api/ai-assistant/suggestions';
  let authToken: string;
  let businessId: string;
  let suggestionId: string;
  let otherBusinessSuggestionId: string;
  let acceptedSuggestionId: string;
  let rejectedSuggestionId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    suggestionId = 'test-suggestion-id';
    otherBusinessSuggestionId = 'other-business-suggestion-id';
    acceptedSuggestionId = 'accepted-suggestion-id';
    rejectedSuggestionId = 'rejected-suggestion-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const requestBody: AcceptSuggestionRequest = {};

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const requestBody: AcceptSuggestionRequest = {};

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', 'Bearer invalid-token')
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should accept suggestion with minimal data', async () => {
      const requestBody: AcceptSuggestionRequest = {};

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: suggestionId,
        business_id: businessId,
        status: 'accepted',
        accepted_at: expect.any(String),
        rejected_at: null,
        created_at: expect.any(String)
      });

      // Validate ISO date format
      expect(new Date(response.body.accepted_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);

      // accepted_at should be more recent than created_at
      const createdAt = new Date(response.body.created_at);
      const acceptedAt = new Date(response.body.accepted_at);
      expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    });

    it('should accept suggestion without immediate implementation', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: false,
        notes: 'Will implement this during the next maintenance window'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: suggestionId,
        business_id: businessId,
        status: 'accepted',
        accepted_at: expect.any(String),
        rejected_at: null
      });

      // Should include acceptance metadata
      expect(response.body.acceptance_notes).toBe('Will implement this during the next maintenance window');
      expect(response.body.auto_implemented).toBe(false);
    });

    it('should accept suggestion with immediate implementation', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'Implementing right away - this is critical for fraud detection'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: suggestionId,
        business_id: businessId,
        status: 'implemented',
        accepted_at: expect.any(String),
        implemented_at: expect.any(String),
        rejected_at: null
      });

      // Should include implementation metadata
      expect(response.body.acceptance_notes).toBe('Implementing right away - this is critical for fraud detection');
      expect(response.body.auto_implemented).toBe(true);

      // implemented_at should be same or very close to accepted_at
      const acceptedAt = new Date(response.body.accepted_at);
      const implementedAt = new Date(response.body.implemented_at);
      const timeDiff = Math.abs(implementedAt.getTime() - acceptedAt.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should handle context_gap suggestion acceptance', async () => {
      const contextGapSuggestionId = 'context-gap-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'Adding missing inventory information'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${contextGapSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: contextGapSuggestionId,
        suggestion_type: 'context_gap',
        status: 'implemented',
        accepted_at: expect.any(String),
        implemented_at: expect.any(String)
      });

      // Should include created context entries
      expect(response.body.created_context_entries).toBeDefined();
      expect(Array.isArray(response.body.created_context_entries)).toBe(true);

      if (response.body.created_context_entries.length > 0) {
        const contextEntry = response.body.created_context_entries[0];
        expect(contextEntry).toMatchObject({
          id: expect.any(String),
          business_id: businessId,
          category: expect.any(String),
          key: expect.any(String),
          value: expect.any(Object),
          source_type: 'ai_inference',
          created_at: expect.any(String)
        });
      }
    });

    it('should handle question_recommendation suggestion acceptance', async () => {
      const questionSuggestionId = 'question-recommendation-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'Adding this question to our feedback collection'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${questionSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: questionSuggestionId,
        suggestion_type: 'question_recommendation',
        status: 'implemented',
        accepted_at: expect.any(String),
        implemented_at: expect.any(String)
      });

      // Should include created questions
      expect(response.body.created_questions).toBeDefined();
      expect(Array.isArray(response.body.created_questions)).toBe(true);

      if (response.body.created_questions.length > 0) {
        const question = response.body.created_questions[0];
        expect(question).toMatchObject({
          id: expect.any(String),
          question_text: expect.any(String),
          category: expect.any(String),
          created_at: expect.any(String)
        });
      }
    });

    it('should handle fraud_improvement suggestion acceptance', async () => {
      const fraudSuggestionId = 'fraud-improvement-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'Updating fraud detection rules based on this recommendation'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${fraudSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: fraudSuggestionId,
        suggestion_type: 'fraud_improvement',
        status: 'implemented',
        accepted_at: expect.any(String),
        implemented_at: expect.any(String)
      });

      // Should include updated fraud settings
      expect(response.body.updated_fraud_settings).toBeDefined();
      expect(response.body.updated_fraud_settings).toMatchObject({
        rules_updated: expect.any(Number),
        thresholds_modified: expect.any(Boolean),
        new_patterns_added: expect.any(Array)
      });
    });

    it('should handle validation_enhancement suggestion acceptance', async () => {
      const validationSuggestionId = 'validation-enhancement-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: false,
        notes: 'Will review validation rules next week'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${validationSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: validationSuggestionId,
        suggestion_type: 'validation_enhancement',
        status: 'accepted',
        accepted_at: expect.any(String),
        implemented_at: null
      });

      // Should include validation impact analysis
      expect(response.body.validation_impact).toBeDefined();
      expect(response.body.validation_impact).toMatchObject({
        score_improvement_estimate: expect.any(Number),
        affected_categories: expect.any(Array),
        implementation_complexity: expect.stringMatching(/^(low|medium|high)$/)
      });
    });

    it('should handle notes with special characters', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: false,
        notes: 'Notes with special chars: àáâãäåæçèéêë & symbols !@#$%^&*()_+-=[]{}|;":,.<>?'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      expect(response.body.acceptance_notes).toBe('Notes with special chars: àáâãäåæçèéêë & symbols !@#$%^&*()_+-=[]{}|;":,.<>?');
    });
  });

  describe('Validation', () => {
    it('should return 404 for non-existent suggestion', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const requestBody: AcceptSuggestionRequest = {};

      const response = await request(app)
        .post(`${baseEndpoint}/${nonExistentId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Suggestion not found'
      });
    });

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      const requestBody: AcceptSuggestionRequest = {};

      const response = await request(app)
        .post(`${baseEndpoint}/${invalidId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject notes longer than 1000 characters', async () => {
      const requestBody: AcceptSuggestionRequest = {
        notes: 'A'.repeat(1001)
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject already accepted suggestions', async () => {
      const requestBody: AcceptSuggestionRequest = {
        notes: 'Trying to accept already accepted suggestion'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${acceptedSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Suggestion already accepted',
        details: expect.objectContaining({
          current_status: 'accepted',
          accepted_at: expect.any(String)
        })
      });
    });

    it('should reject already rejected suggestions', async () => {
      const requestBody: AcceptSuggestionRequest = {
        notes: 'Trying to accept already rejected suggestion'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${rejectedSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Cannot accept rejected suggestion',
        details: expect.objectContaining({
          current_status: 'rejected',
          rejected_at: expect.any(String)
        })
      });
    });

    it('should validate implement_immediately field type', async () => {
      const requestBody = {
        implement_immediately: 'yes' // Should be boolean
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
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
    it('should only allow accepting suggestions user has access to', async () => {
      const requestBody: AcceptSuggestionRequest = {
        notes: 'Accepting suggestion for my business'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Accepted suggestion should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should deny access to suggestions from other businesses', async () => {
      const requestBody: AcceptSuggestionRequest = {
        notes: 'Unauthorized acceptance attempt'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${otherBusinessSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to suggestion'
      });
    });

    it('should require write_context permission', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';
      const requestBody: AcceptSuggestionRequest = {
        notes: 'Read only user acceptance attempt'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
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
        .post(`${baseEndpoint}/${suggestionId}/accept`)
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
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send('plain text')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle empty request body gracefully', async () => {
      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        id: suggestionId,
        status: 'accepted',
        accepted_at: expect.any(String)
      });
    });

    it('should handle implementation failures gracefully', async () => {
      const failingSuggestionId = 'failing-implementation-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'This implementation should fail'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${failingSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Should still accept the suggestion even if implementation fails
      expect(response.body).toMatchObject({
        id: failingSuggestionId,
        status: 'accepted',
        accepted_at: expect.any(String),
        implemented_at: null
      });

      // Should include implementation error details
      expect(response.body.implementation_error).toBeDefined();
      expect(response.body.implementation_error).toMatchObject({
        error: expect.any(String),
        retry_possible: expect.any(Boolean)
      });
    });

    it('should handle concurrent acceptance attempts', async () => {
      const concurrentSuggestionId = 'concurrent-suggestion-id';
      
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post(`${baseEndpoint}/${concurrentSuggestionId}/accept`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            notes: `Concurrent acceptance attempt ${i + 1}`
          })
      );

      const responses = await Promise.all(requests.map(req => 
        req.catch(err => err.response || { status: 500, body: { error: 'Request failed' } })
      ));

      // Only one should succeed, others should get conflict errors
      const successful = responses.filter(r => r.status === 200);
      const conflicts = responses.filter(r => r.status === 409);

      expect(successful.length).toBe(1);
      expect(conflicts.length).toBe(4);

      // The successful response should show accepted status
      expect(successful[0].body.status).toBe('accepted');

      // Conflict responses should indicate already accepted
      conflicts.forEach(response => {
        expect(response.body).toMatchObject({
          error: 'Suggestion already accepted'
        });
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 500ms for simple acceptance', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: false,
        notes: 'Performance test acceptance'
      };

      const startTime = Date.now();

      await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });

    it('should respond within 2 seconds for immediate implementation', async () => {
      const implementationSuggestionId = 'performance-implementation-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'Performance test with implementation'
      };

      const startTime = Date.now();

      await request(app)
        .post(`${baseEndpoint}/${implementationSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000);
    });
  });

  describe('Side Effects', () => {
    it('should trigger conversation completeness score recalculation', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'This should trigger score recalculation'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Should include updated completeness information
      expect(response.body.completeness_update).toBeDefined();
      expect(response.body.completeness_update).toMatchObject({
        previous_score: expect.any(Number),
        new_score: expect.any(Number),
        score_improvement: expect.any(Number)
      });

      expect(response.body.completeness_update.new_score).toBeGreaterThanOrEqual(0);
      expect(response.body.completeness_update.new_score).toBeLessThanOrEqual(100);
    });

    it('should create audit log entry', async () => {
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: false,
        notes: 'Testing audit logging'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${suggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Should include audit information
      expect(response.body.audit_entry_id).toBeDefined();
      expect(response.body.audit_entry_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate follow-up suggestions when appropriate', async () => {
      const followupSuggestionId = 'followup-generating-suggestion-id';
      const requestBody: AcceptSuggestionRequest = {
        implement_immediately: true,
        notes: 'This should generate follow-up suggestions'
      };

      const response = await request(app)
        .post(`${baseEndpoint}/${followupSuggestionId}/accept`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(200);

      // Should include any generated follow-up suggestions
      if (response.body.generated_followup_suggestions) {
        expect(Array.isArray(response.body.generated_followup_suggestions)).toBe(true);
        
        response.body.generated_followup_suggestions.forEach((suggestion: any) => {
          expect(suggestion).toMatchObject({
            id: expect.any(String),
            suggestion_type: expect.any(String),
            title: expect.any(String),
            description: expect.any(String),
            priority: expect.any(String),
            status: 'pending'
          });
        });
      }
    });
  });
});