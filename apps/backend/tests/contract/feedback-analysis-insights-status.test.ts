/**
 * Contract test for PATCH /feedback-analysis/insights/{insightId}/status
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('PATCH /feedback-analysis/insights/{insightId}/status', () => {
  const testInsightId = 'insight-id-123';
  const authToken = 'Bearer test-jwt-token';

  const validStatusUpdate = {
    status: 'acknowledged' as const,
    notes: 'Reviewed and acknowledged by management team',
  };

  it('should update insight status successfully', async () => {
    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate)
      .expect(200);

    // Validate updated insight structure
    expect(response.body).toMatchObject({
      id: testInsightId,
      status: validStatusUpdate.status,
      updated_at: expect.any(String),
    });

    // Should include full insight details
    expect(response.body).toMatchObject({
      store_id: expect.any(String),
      business_id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      priority: expect.stringMatching(/^(low|medium|high|critical)$/),
      department: expect.any(String),
      created_at: expect.any(String),
    });

    // Validate updated_at is recent
    const updatedAt = new Date(response.body.updated_at);
    const now = new Date();
    const timeDiff = now.getTime() - updatedAt.getTime();
    expect(timeDiff).toBeLessThan(60000); // Updated within last minute
  });

  it('should update status to resolved with resolution notes', async () => {
    const resolvedUpdate = {
      status: 'resolved' as const,
      notes: 'Implemented new checkout process improvements',
      resolution_actions: ['Added extra checkout lane', 'Increased staff during peak hours'],
    };

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(resolvedUpdate)
      .expect(200);

    expect(response.body).toMatchObject({
      id: testInsightId,
      status: 'resolved',
      updated_at: expect.any(String),
    });

    // Should track resolution metadata
    if (response.body.resolved_at) {
      expect(response.body.resolved_at).toEqual(expect.any(String));
    }
  });

  it('should update status to dismissed with reason', async () => {
    const dismissedUpdate = {
      status: 'dismissed' as const,
      notes: 'Not actionable - isolated incident',
    };

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(dismissedUpdate)
      .expect(200);

    expect(response.body).toMatchObject({
      id: testInsightId,
      status: 'dismissed',
      updated_at: expect.any(String),
    });
  });

  it('should validate status parameter values', async () => {
    const invalidStatusUpdate = {
      status: 'invalid-status',
      notes: 'Test note',
    };

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(invalidStatusUpdate)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('status'),
    });
  });

  it('should require status field in request body', async () => {
    const incompleteUpdate = {
      notes: 'Missing status field',
    };

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(incompleteUpdate)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('status'),
    });
  });

  it('should validate notes field length', async () => {
    const longNotesUpdate = {
      status: 'acknowledged' as const,
      notes: 'a'.repeat(1001), // Exceeds 1000 char limit
    };

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(longNotesUpdate)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('notes'),
    });
  });

  it('should handle valid status transitions', async () => {
    // Test each valid status transition
    const validTransitions = [
      { from: 'active', to: 'acknowledged' },
      { from: 'acknowledged', to: 'resolved' },
      { from: 'active', to: 'dismissed' },
    ];

    for (const transition of validTransitions) {
      const updateData = {
        status: transition.to as 'acknowledged' | 'resolved' | 'dismissed',
        notes: `Transitioning from ${transition.from} to ${transition.to}`,
      };

      const response = await request(app)
        .patch(`/feedback-analysis/insights/${testInsightId}/status`)
        .set('Authorization', authToken)
        .send(updateData);

      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.status).toBe(transition.to);
      }
    }
  });

  it('should return 404 for non-existent insight', async () => {
    const nonExistentInsightId = 'non-existent-insight-id';

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${nonExistentInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate)
      .expect(404);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 403 when user lacks access to insight', async () => {
    const unauthorizedInsightId = 'unauthorized-insight-id';

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${unauthorizedInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should handle invalid UUID format for insightId', async () => {
    const invalidInsightId = 'not-a-uuid';

    const response = await request(app)
      .patch(`/feedback-analysis/insights/${invalidInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should handle malformed JSON request body', async () => {
    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .set('Content-Type', 'application/json')
      .send('{\"status\": invalid json}')
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('JSON'),
    });
  });

  it('should log status changes for audit trail', async () => {
    const response = await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate)
      .expect(200);

    // Status change should be logged (verified through database integration)
    expect(response.header['x-audit-logged']).toBeDefined();
  });

  it('should maintain response time under 200ms for status updates', async () => {
    const startTime = Date.now();

    await request(app)
      .patch(`/feedback-analysis/insights/${testInsightId}/status`)
      .set('Authorization', authToken)
      .send(validStatusUpdate);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(200);
  });

  it('should handle concurrent status updates safely', async () => {
    const concurrentUpdates = Array(3).fill(0).map((_, index) => ({
      status: 'acknowledged' as const,
      notes: `Concurrent update ${index + 1}`,
    }));

    const requests = concurrentUpdates.map(update =>
      request(app)
        .patch(`/feedback-analysis/insights/${testInsightId}/status`)
        .set('Authorization', authToken)
        .send(update)
    );

    const responses = await Promise.all(requests);

    // At least one should succeed, others may conflict
    const successfulResponses = responses.filter(r => r.status === 200);
    expect(successfulResponses.length).toBeGreaterThanOrEqual(1);
  });

  it('should include priority escalation for critical insights', async () => {
    const criticalInsightId = 'critical-insight-id';
    
    const response = await request(app)
      .patch(`/feedback-analysis/insights/${criticalInsightId}/status`)
      .set('Authorization', authToken)
      .send({
        status: 'acknowledged' as const,
        notes: 'Critical issue acknowledged',
      });

    if (response.status === 200 && response.body.priority === 'critical') {
      // Critical insights should trigger notifications
      expect(response.header['x-notification-sent']).toBeDefined();
    }
  });
});