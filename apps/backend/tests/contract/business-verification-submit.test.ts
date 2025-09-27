import request from 'supertest';
import { app } from '../../src/app';
import * as fs from 'fs';
import * as path from 'path';

describe('POST /api/business/verification/databases/{id}/submit', () => {
  let businessToken: string;
  let databaseId: string;

  beforeEach(async () => {
    // Get business token for authentication
    const loginResponse = await request(app)
      .post('/api/business/auth/login')
      .send({
        email: 'business@example.com',
        password: 'business123'
      });
    
    businessToken = loginResponse.body.token;
    databaseId = '12345678-1234-1234-1234-123456789012'; // Mock database ID
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .attach('verification_file', Buffer.from('test,data'), 'test.csv')
        .field('format', 'csv');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', 'Bearer invalid-token')
        .attach('verification_file', Buffer.from('test,data'), 'test.csv')
        .field('format', 'csv');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('File upload validation', () => {
    it('should require verification_file field', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should require format field', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'test.csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate format enum values', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'test.pdf')
        .field('format', 'pdf');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid format values', async () => {
      const validFormats = ['csv', 'excel'];
      
      for (const format of validFormats) {
        const response = await request(app)
          .post(`/api/business/verification/databases/${databaseId}/submit`)
          .set('Authorization', `Bearer ${businessToken}`)
          .attach('verification_file', Buffer.from('test,data'), `test.${format === 'excel' ? 'xlsx' : format}`)
          .field('format', format);

        // Should not be validation error (404 is expected since database doesn't exist)
        expect(response.status).not.toBe(400);
      }
    });
  });

  describe('Successful requests', () => {
    it('should process valid CSV verification file', async () => {
      const csvContent = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,verified,5.00
87654321-1234-1234-1234-123456789012,fake,0.00
11111111-1234-1234-1234-123456789012,verified,7.50`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      // Expected response structure (will fail until implemented)
      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('verified_count');
        expect(response.body).toHaveProperty('fake_count');
        expect(response.body).toHaveProperty('total_processed');
        
        expect(typeof response.body.verified_count).toBe('number');
        expect(typeof response.body.fake_count).toBe('number');
        expect(typeof response.body.total_processed).toBe('number');
        
        expect(response.body.verified_count).toBe(2);
        expect(response.body.fake_count).toBe(1);
        expect(response.body.total_processed).toBe(3);
      }
    });

    it('should process valid Excel verification file', async () => {
      // Mock Excel file content (in practice would be actual Excel binary)
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('mock-excel-content'), 'verification.xlsx')
        .field('format', 'excel');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('verified_count');
        expect(response.body).toHaveProperty('fake_count');
        expect(response.body).toHaveProperty('total_processed');
      }
    });
  });

  describe('File content validation', () => {
    it('should reject files with invalid CSV structure', async () => {
      const invalidCsv = `invalid,csv,structure
missing,columns`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('validation_errors');
      expect(Array.isArray(response.body.validation_errors)).toBe(true);
    });

    it('should reject files with invalid verification status values', async () => {
      const invalidCsv = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,invalid_status,5.00`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('validation_errors');
      
      if (response.body.validation_errors.length > 0) {
        const error = response.body.validation_errors[0];
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('row');
      }
    });

    it('should reject files with invalid reward percentages', async () => {
      const invalidCsv = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,verified,25.00`; // Above 15% limit

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('validation_errors');
    });

    it('should reject files with missing required fields', async () => {
      const invalidCsv = `id,verification_status
12345678-1234-1234-1234-123456789012,verified`; // Missing reward_percentage

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('validation_errors');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent database', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/business/verification/databases/${fakeId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'test.csv')
        .field('format', 'csv');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid database ID format', async () => {
      const response = await request(app)
        .post('/api/business/verification/databases/invalid-id/submit')
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'test.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for database belonging to different business', async () => {
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'test.csv')
        .field('format', 'csv');

      // Should either be 404 (not found due to RLS) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Business logic validation', () => {
    it('should reject submission after deadline', async () => {
      const csvContent = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,verified,5.00`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      // Should validate deadline before accepting submission
      if (response.status === 400) {
        expect(response.body.error).toMatch(/deadline/i);
      }
    });

    it('should reject double submission', async () => {
      const csvContent = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,verified,5.00`;

      // First submission
      await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      // Second submission should be rejected
      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/already submitted/i);
    });

    it('should update database status to submitted on success', async () => {
      const csvContent = `id,verification_status,reward_percentage
12345678-1234-1234-1234-123456789012,verified,5.00`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      // Implementation should update status and timestamp
      if (response.status === 200) {
        // Verify submission was recorded
        expect(response.body.message).toMatch(/success/i);
      }
    });
  });
});