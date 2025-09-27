import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../src/app';
import { Application } from 'express';

// Contract tests for Notifications API
// These tests verify API contracts match the specification
// Expected to FAIL initially (TDD approach)

describe('Notifications API Contract Tests', () => {
  let app: Application;
  let server: any;

  beforeAll(async () => {
    app = createServer();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Reset any test state if needed
  });

  describe('POST /api/notifications/send', () => {
    it('should send individual notification to customer', async () => {
      const requestBody = {
        recipient_type: 'customer',
        recipient_id: 'test-customer-uuid',
        notification_type: 'reward_earned',
        channel: 'sms',
        template_variables: {
          reward_amount: '100.50',
          feedback_score: '85',
          payment_date: '2025-09-30'
        }
      };

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: 'pending',
        scheduled_at: expect.any(String),
        estimated_delivery: expect.any(String)
      });
    });

    it('should send individual notification to business', async () => {
      const requestBody = {
        recipient_type: 'business',
        recipient_id: 'test-business-uuid',
        notification_type: 'verification_request',
        channel: 'email',
        template_variables: {
          deadline: '2025-10-05T17:00:00Z'
        }
      };

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: 'pending',
        scheduled_at: expect.any(String),
        estimated_delivery: expect.any(String)
      });
    });

    it('should schedule notification for future delivery', async () => {
      const futureDate = '2025-09-25T10:00:00Z';
      const requestBody = {
        recipient_type: 'customer',
        recipient_id: 'test-customer-uuid',
        notification_type: 'payment_confirmed',
        channel: 'sms',
        template_variables: {
          amount: '50.00',
          transaction_id: 'TXN-123456'
        },
        scheduled_at: futureDate
      };

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.scheduled_at).toBe(futureDate);
    });

    it('should return 400 for invalid recipient_id', async () => {
      const requestBody = {
        recipient_type: 'customer',
        recipient_id: 'invalid-uuid',
        notification_type: 'reward_earned',
        channel: 'sms',
        template_variables: {}
      };

      const response = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String)
          })
        ])
      });
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/notifications/send')
        .send({})
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'unauthorized',
        message: 'Valid authentication required'
      });
    });
  });

  describe('GET /api/notifications/{id}', () => {
    it('should get notification status and delivery details', async () => {
      const notificationId = 'test-notification-uuid';

      const response = await request(app)
        .get(`/api/notifications/${notificationId}`)
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: notificationId,
        recipient_type: expect.stringMatching(/^(customer|business)$/),
        notification_type: expect.any(String),
        channel: expect.stringMatching(/^(sms|email)$/),
        status: expect.stringMatching(/^(pending|sent|delivered|failed|cancelled)$/),
        content: expect.any(String),
        retry_count: expect.any(Number)
      });

      // Optional fields should be present if notification was sent
      if (response.body.status !== 'pending') {
        expect(response.body.sent_at).toBeDefined();
      }
      if (response.body.status === 'delivered') {
        expect(response.body.delivered_at).toBeDefined();
      }
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .get('/api/notifications/non-existent-uuid')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'not_found',
        message: 'Notification not found'
      });
    });
  });

  describe('GET /api/notifications', () => {
    it('should list notifications with default pagination', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        notifications: expect.any(Array),
        total_count: expect.any(Number),
        has_more: expect.any(Boolean)
      });

      if (response.body.notifications.length > 0) {
        expect(response.body.notifications[0]).toMatchObject({
          id: expect.any(String),
          recipient_type: expect.stringMatching(/^(customer|business)$/),
          notification_type: expect.any(String),
          status: expect.any(String),
          retry_count: expect.any(Number)
        });
      }
    });

    it('should filter notifications by recipient_type', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .query({ recipient_type: 'customer' })
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      response.body.notifications.forEach((notification: any) => {
        expect(notification.recipient_type).toBe('customer');
      });
    });

    it('should filter notifications by status', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .query({ status: 'delivered' })
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      response.body.notifications.forEach((notification: any) => {
        expect(notification.status).toBe('delivered');
      });
    });

    it('should respect pagination limits', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .query({ limit: 5, offset: 0 })
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.notifications.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/notifications/{id}/retry', () => {
    it('should retry failed notification (admin only)', async () => {
      const notificationId = 'failed-notification-uuid';

      const response = await request(app)
        .post(`/api/notifications/${notificationId}/retry`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: notificationId,
        status: 'pending',
        retry_count: expect.any(Number),
        next_attempt_at: expect.any(String)
      });
    });

    it('should return 409 when retry limit exceeded', async () => {
      const notificationId = 'max-retries-notification-uuid';

      const response = await request(app)
        .post(`/api/notifications/${notificationId}/retry`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'retry_limit_exceeded',
        message: 'Notification has already reached maximum retry attempts'
      });
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post('/api/notifications/test-id/retry')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'forbidden',
        message: 'Insufficient permissions for this operation'
      });
    });
  });

  describe('DELETE /api/notifications/{id}', () => {
    it('should cancel pending notification (admin only)', async () => {
      const notificationId = 'pending-notification-uuid';

      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: notificationId,
        status: 'cancelled',
        cancelled_at: expect.any(String)
      });
    });

    it('should return 409 when trying to cancel sent notification', async () => {
      const notificationId = 'sent-notification-uuid';

      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'cannot_cancel',
        message: 'Notification has already been sent'
      });
    });
  });

  describe('POST /api/notifications/batch', () => {
    it('should send batch notifications (admin only)', async () => {
      const requestBody = {
        notification_type: 'weekly_summary',
        template_id: 'weekly-summary-template-uuid',
        recipients: [
          {
            recipient_type: 'customer',
            recipient_id: 'customer-1-uuid',
            template_variables: {
              total_rewards: '425.75',
              store_count: 3,
              week_period: '2025-09-16 till 2025-09-22'
            }
          },
          {
            recipient_type: 'customer',
            recipient_id: 'customer-2-uuid',
            template_variables: {
              total_rewards: '150.25',
              store_count: 1,
              week_period: '2025-09-16 till 2025-09-22'
            }
          }
        ],
        scheduled_at: '2025-09-29T06:00:00Z'
      };

      const response = await request(app)
        .post('/api/notifications/batch')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(202);

      expect(response.body).toMatchObject({
        batch_id: expect.any(String),
        total_notifications: requestBody.recipients.length,
        scheduled_at: requestBody.scheduled_at,
        estimated_completion: expect.any(String)
      });
    });
  });

  describe('GET /api/notifications/batch/{batch_id}', () => {
    it('should get batch processing status (admin only)', async () => {
      const batchId = 'test-batch-uuid';

      const response = await request(app)
        .get(`/api/notifications/batch/${batchId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        batch_id: batchId,
        status: expect.stringMatching(/^(pending|processing|completed|failed)$/),
        total_notifications: expect.any(Number),
        sent: expect.any(Number),
        delivered: expect.any(Number),
        failed: expect.any(Number),
        pending: expect.any(Number)
      });
    });
  });

  describe('POST /api/notifications/webhooks/delivery-status', () => {
    it('should process Twilio delivery status webhook', async () => {
      const webhookPayload = {
        MessageSid: 'twilio-message-id-123',
        MessageStatus: 'delivered',
        To: '+46701234567',
        From: '+46812345678'
      };

      const response = await request(app)
        .post('/api/notifications/webhooks/delivery-status')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'processed'
      });
    });

    it('should process failed delivery status with error code', async () => {
      const webhookPayload = {
        MessageSid: 'twilio-message-id-456',
        MessageStatus: 'failed',
        ErrorCode: '30008',
        To: '+46701234567',
        From: '+46812345678'
      };

      const response = await request(app)
        .post('/api/notifications/webhooks/delivery-status')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'processed'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 when rate limit exceeded', async () => {
      // This test would need to send many requests quickly
      // Implementation depends on actual rate limiting setup
      const promises = Array.from({ length: 50 }, () =>
        request(app)
          .post('/api/notifications/send')
          .set('Authorization', 'Bearer valid-jwt-token')
          .send({
            recipient_type: 'customer',
            recipient_id: 'test-uuid',
            notification_type: 'reward_earned',
            channel: 'sms',
            template_variables: {}
          })
      );

      const responses = await Promise.allSettled(promises);
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      // Expect at least some requests to be rate limited
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});