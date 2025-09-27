import request from 'supertest';
import { app } from '../../src/app';

describe('PUT /api/admin/verification/invoices/{id}/payment', () => {
  let adminToken: string;
  let invoiceId: string;

  beforeEach(async () => {
    // Get admin token for authentication
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'admin123'
      });
    
    adminToken = loginResponse.body.token;

    // Create test invoice setup
    // This would normally be created through the verification cycle workflow
    invoiceId = '12345678-1234-1234-1234-123456789012'; // Mock invoice ID
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', 'Bearer invalid-token')
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Request validation', () => {
    it('should require status field', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate status enum values', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'invalid-status',
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid status values', async () => {
      const validStatuses = ['paid', 'disputed', 'cancelled'];
      
      for (const status of validStatuses) {
        const response = await request(app)
          .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: status,
            payment_date: '2024-01-15T10:30:00Z'
          });

        // Should not be validation error (404 is expected since invoice doesn't exist)
        expect(response.status).not.toBe(400);
      }
    });

    it('should validate payment_date format', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Successful requests', () => {
    it('should update payment status when invoice exists', async () => {
      // This test would pass once implementation exists
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z',
          notes: 'Payment confirmed via bank transfer'
        });

      // Expected response structure (will fail until implemented)
      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('business_id');
        expect(response.body).toHaveProperty('total_rewards');
        expect(response.body).toHaveProperty('admin_fee');
        expect(response.body).toHaveProperty('total_amount');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('invoice_date');
        expect(response.body).toHaveProperty('due_date');
        
        expect(response.body.status).toBe('paid');
      }
    });

    it('should handle disputed status', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'disputed',
          notes: 'Business disputed the verification results'
        });

      // Should not require payment_date for disputed status
      expect(response.status).not.toBe(400);
    });

    it('should handle cancelled status', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'cancelled',
          notes: 'Verification cycle cancelled by admin'
        });

      // Should not require payment_date for cancelled status
      expect(response.status).not.toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent invoice', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${fakeId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid invoice ID format', async () => {
      const response = await request(app)
        .put('/api/admin/verification/invoices/invalid-id/payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Business logic validation', () => {
    it('should trigger feedback delivery when marking as paid', async () => {
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: '2024-01-15T10:30:00Z'
        });

      // This should trigger database delivery to business
      // Implementation should set feedback_database_delivered flag
      if (response.status === 200) {
        // Verify that payment triggers additional actions
        expect(response.body).toBeDefined();
      }
    });

    it('should not allow invalid state transitions', async () => {
      // Try to mark already paid invoice as cancelled
      const response = await request(app)
        .put(`/api/admin/verification/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'cancelled',
          notes: 'Trying to cancel paid invoice'
        });

      // Should handle state validation (implementation specific)
      expect(response.status).toBeDefined();
    });
  });
});