import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../src/app';
import { Application } from 'express';

// Contract tests for Support API
// These tests verify API contracts match the specification
// Expected to FAIL initially (TDD approach)

describe('Support API Contract Tests', () => {
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

  describe('POST /api/support/tickets', () => {
    it('should create new support ticket', async () => {
      const requestBody = {
        category: 'payment',
        subject: 'Payment not received for feedback',
        description: 'I submitted feedback 3 days ago but haven\'t received my payment yet.',
        contact_method: 'email',
        contact_details: 'customer@example.com'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        ticket_number: expect.stringMatching(/^SUP-\d{4}-\d{6}$/),
        status: 'open',
        priority: expect.stringMatching(/^(low|normal|high|urgent)$/),
        sla_deadline: expect.any(String),
        created_at: expect.any(String),
        estimated_response_time: expect.any(String)
      });
    });

    it('should auto-calculate priority for payment category', async () => {
      const requestBody = {
        category: 'payment',
        subject: 'Missing payment',
        description: 'Payment issue description',
        contact_method: 'phone',
        contact_details: '+46701234567'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.priority).toBe('high');
    });

    it('should accept manual priority override', async () => {
      const requestBody = {
        category: 'general',
        subject: 'General inquiry',
        description: 'General question',
        contact_method: 'web_chat',
        contact_details: 'customer@example.com',
        priority: 'urgent'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.priority).toBe('urgent');
    });

    it('should return 400 for invalid contact details', async () => {
      const requestBody = {
        category: 'technical',
        subject: 'Test subject',
        description: 'Test description',
        contact_method: 'email',
        contact_details: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/support/tickets')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'contact_details',
            message: expect.any(String)
          })
        ])
      });
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .send({})
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'unauthorized',
        message: 'Valid authentication required'
      });
    });
  });

  describe('GET /api/support/tickets/{id}', () => {
    it('should get support ticket details with conversation history', async () => {
      const ticketId = 'test-ticket-uuid';

      const response = await request(app)
        .get(`/api/support/tickets/${ticketId}`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: ticketId,
        ticket_number: expect.stringMatching(/^SUP-\d{4}-\d{6}$/),
        requester_type: expect.stringMatching(/^(customer|business)$/),
        category: expect.stringMatching(/^(payment|verification|technical|feedback|general)$/),
        priority: expect.stringMatching(/^(low|normal|high|urgent)$/),
        status: expect.stringMatching(/^(open|in_progress|pending_customer|resolved|closed)$/),
        subject: expect.any(String),
        description: expect.any(String),
        sla_deadline: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
        messages: expect.any(Array)
      });

      // Check message structure if messages exist
      if (response.body.messages.length > 0) {
        expect(response.body.messages[0]).toMatchObject({
          id: expect.any(String),
          sender_type: expect.stringMatching(/^(customer|business|admin|system)$/),
          sender_name: expect.any(String),
          message_content: expect.any(String),
          is_internal: expect.any(Boolean),
          created_at: expect.any(String)
        });
      }

      // Optional fields should be present when ticket is assigned
      if (response.body.assigned_to) {
        expect(response.body.assigned_to).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String)
        });
      }
    });

    it('should get ticket by ticket number', async () => {
      const ticketNumber = 'SUP-2025-001234';

      const response = await request(app)
        .get(`/api/support/tickets/${ticketNumber}`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      expect(response.body.ticket_number).toBe(ticketNumber);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .get('/api/support/tickets/non-existent-uuid')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'ticket_not_found',
        message: 'Support ticket not found'
      });
    });

    it('should return 403 when accessing other user\'s ticket', async () => {
      const response = await request(app)
        .get('/api/support/tickets/other-user-ticket')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'forbidden',
        message: 'Cannot access tickets for other users'
      });
    });
  });

  describe('GET /api/support/tickets', () => {
    it('should list support tickets with default pagination', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        tickets: expect.any(Array),
        total_count: expect.any(Number),
        has_more: expect.any(Boolean)
      });

      if (response.body.tickets.length > 0) {
        expect(response.body.tickets[0]).toMatchObject({
          id: expect.any(String),
          ticket_number: expect.any(String),
          category: expect.any(String),
          priority: expect.any(String),
          status: expect.any(String),
          subject: expect.any(String),
          sla_deadline: expect.any(String),
          created_at: expect.any(String)
        });
      }
    });

    it('should filter tickets by status', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .query({ status: 'open' })
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      response.body.tickets.forEach((ticket: any) => {
        expect(ticket.status).toBe('open');
      });
    });

    it('should filter tickets by category', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .query({ category: 'payment' })
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      response.body.tickets.forEach((ticket: any) => {
        expect(ticket.category).toBe('payment');
      });
    });

    it('should respect pagination limits', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .query({ limit: 5, offset: 0 })
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(200);

      expect(response.body.tickets.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/support/tickets/{id}/messages', () => {
    it('should add message to support ticket', async () => {
      const ticketId = 'test-ticket-uuid';
      const requestBody = {
        message_content: 'Thank you for the update. I understand the delay.',
        is_internal: false
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/messages`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        message_content: requestBody.message_content,
        sender_type: 'customer',
        sender_name: expect.any(String),
        is_internal: false,
        created_at: expect.any(String)
      });
    });

    it('should add message with attachments', async () => {
      const ticketId = 'test-ticket-uuid';
      const requestBody = {
        message_content: 'Here is the screenshot of the issue.',
        attachments: ['https://example.com/screenshot.png']
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/messages`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.attachments).toEqual(requestBody.attachments);
    });

    it('should allow admin to add internal notes', async () => {
      const ticketId = 'test-ticket-uuid';
      const requestBody = {
        message_content: 'Customer called and confirmed issue resolved.',
        is_internal: true
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/messages`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.is_internal).toBe(true);
      expect(response.body.sender_type).toBe('admin');
    });
  });

  describe('PUT /api/support/tickets/{id}/status', () => {
    it('should update ticket status (admin only)', async () => {
      const ticketId = 'test-ticket-uuid';
      const requestBody = {
        status: 'resolved',
        internal_notes: 'Customer issue resolved, refund processed'
      };

      const response = await request(app)
        .put(`/api/support/tickets/${ticketId}/status`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ticketId,
        status: 'resolved',
        resolved_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put('/api/support/tickets/test-id/status')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send({ status: 'resolved' })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'forbidden',
        message: expect.any(String)
      });
    });

    it('should return 409 for invalid status transition', async () => {
      const ticketId = 'resolved-ticket-uuid';
      const requestBody = {
        status: 'open'
      };

      const response = await request(app)
        .put(`/api/support/tickets/${ticketId}/status`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'invalid_status_transition',
        message: expect.any(String)
      });
    });
  });

  describe('PUT /api/support/tickets/{id}/assign', () => {
    it('should assign ticket to admin user', async () => {
      const ticketId = 'test-ticket-uuid';
      const adminUserId = 'admin-user-uuid';
      const requestBody = {
        assigned_to: adminUserId
      };

      const response = await request(app)
        .put(`/api/support/tickets/${ticketId}/assign`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ticketId,
        assigned_to: {
          id: adminUserId,
          name: expect.any(String),
          email: expect.any(String)
        },
        status: 'in_progress',
        updated_at: expect.any(String)
      });
    });

    it('should unassign ticket when assigned_to is null', async () => {
      const ticketId = 'assigned-ticket-uuid';
      const requestBody = {
        assigned_to: null
      };

      const response = await request(app)
        .put(`/api/support/tickets/${ticketId}/assign`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body.assigned_to).toBeNull();
    });
  });

  describe('PUT /api/support/tickets/{id}/priority', () => {
    it('should update ticket priority and SLA deadline', async () => {
      const ticketId = 'test-ticket-uuid';
      const requestBody = {
        priority: 'urgent',
        reason: 'Customer is VIP business partner'
      };

      const response = await request(app)
        .put(`/api/support/tickets/${ticketId}/priority`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ticketId,
        priority: 'urgent',
        sla_deadline: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .put('/api/support/tickets/test-id/priority')
        .set('Authorization', 'Bearer customer-jwt-token')
        .send({ priority: 'high' })
        .expect(403);
    });
  });

  describe('POST /api/support/tickets/{id}/satisfaction', () => {
    it('should submit customer satisfaction rating', async () => {
      const ticketId = 'resolved-ticket-uuid';
      const requestBody = {
        rating: 5,
        feedback: 'Great support, quick resolution!'
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/satisfaction`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ticketId,
        satisfaction_rating: 5,
        satisfaction_feedback: 'Great support, quick resolution!',
        updated_at: expect.any(String)
      });
    });

    it('should return 409 for non-resolved tickets', async () => {
      const ticketId = 'open-ticket-uuid';
      const requestBody = {
        rating: 4
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/satisfaction`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'invalid_status',
        message: 'Can only rate resolved tickets'
      });
    });

    it('should validate rating range', async () => {
      const ticketId = 'resolved-ticket-uuid';
      const requestBody = {
        rating: 6 // Invalid: should be 1-5
      };

      const response = await request(app)
        .post(`/api/support/tickets/${ticketId}/satisfaction`)
        .set('Authorization', 'Bearer customer-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'rating',
            message: expect.stringContaining('1-5')
          })
        ])
      });
    });
  });

  describe('GET /api/support/sla-report', () => {
    it('should get SLA performance report (admin only)', async () => {
      const response = await request(app)
        .get('/api/support/sla-report')
        .query({
          start_date: '2025-09-01T00:00:00Z',
          end_date: '2025-09-25T23:59:59Z'
        })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        period: {
          start_date: expect.any(String),
          end_date: expect.any(String)
        },
        total_tickets: expect.any(Number),
        sla_performance: {
          within_sla: expect.any(Number),
          breached_sla: expect.any(Number),
          sla_percentage: expect.any(Number)
        },
        average_response_time: expect.any(String),
        average_resolution_time: expect.any(String),
        by_category: expect.any(Array)
      });

      if (response.body.by_category.length > 0) {
        expect(response.body.by_category[0]).toMatchObject({
          category: expect.any(String),
          total: expect.any(Number),
          sla_percentage: expect.any(Number),
          avg_response_time: expect.any(String)
        });
      }
    });

    it('should filter SLA report by category', async () => {
      const response = await request(app)
        .get('/api/support/sla-report')
        .query({ category: 'payment' })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      response.body.by_category.forEach((category: any) => {
        expect(category.category).toBe('payment');
      });
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/support/sla-report')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(403);
    });
  });

  describe('GET /api/support/templates', () => {
    it('should get support response templates (admin only)', async () => {
      const response = await request(app)
        .get('/api/support/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        templates: expect.any(Array)
      });

      if (response.body.templates.length > 0) {
        expect(response.body.templates[0]).toMatchObject({
          id: expect.any(String),
          category: expect.any(String),
          title: expect.any(String),
          content: expect.any(String),
          variables: expect.any(Array)
        });
      }
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/support/templates')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(403);
    });
  });
});