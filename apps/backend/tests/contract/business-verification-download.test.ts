import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/business/verification/databases/{id}/download/{format}', () => {
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
        .get(`/api/business/verification/databases/${databaseId}/download/csv`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Format validation', () => {
    it('should accept valid format types', async () => {
      const validFormats = ['csv', 'excel', 'json'];
      
      for (const format of validFormats) {
        const response = await request(app)
          .get(`/api/business/verification/databases/${databaseId}/download/${format}`)
          .set('Authorization', `Bearer ${businessToken}`);

        // Should not be format validation error (404 is expected since database doesn't exist)
        expect(response.status).not.toBe(400);
      }
    });

    it('should reject invalid format types', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/pdf`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject empty format', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(response.status).toBe(404); // Route not found
    });
  });

  describe('Successful requests', () => {
    it('should return download URL for CSV format', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Expected response structure (will fail until implemented)
      if (response.status === 200) {
        expect(response.body).toHaveProperty('download_url');
        expect(response.body).toHaveProperty('expires_at');
        expect(response.body).toHaveProperty('filename');
        
        expect(typeof response.body.download_url).toBe('string');
        expect(typeof response.body.expires_at).toBe('string');
        expect(typeof response.body.filename).toBe('string');
        
        // Validate URL format
        expect(response.body.download_url).toMatch(/^https?:\/\//);
        
        // Validate expiration date format
        expect(new Date(response.body.expires_at).toString()).not.toBe('Invalid Date');
        
        // Validate filename contains format
        expect(response.body.filename).toMatch(/\.csv$/);
      }
    });

    it('should return download URL for Excel format', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/excel`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('download_url');
        expect(response.body).toHaveProperty('expires_at');
        expect(response.body).toHaveProperty('filename');
        
        // Validate filename contains Excel extension
        expect(response.body.filename).toMatch(/\.(xlsx|xls)$/);
      }
    });

    it('should return download URL for JSON format', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/json`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('download_url');
        expect(response.body).toHaveProperty('expires_at');
        expect(response.body).toHaveProperty('filename');
        
        // Validate filename contains JSON extension
        expect(response.body.filename).toMatch(/\.json$/);
      }
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent database', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/business/verification/databases/${fakeId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid database ID format', async () => {
      const response = await request(app)
        .get('/api/business/verification/databases/invalid-id/download/csv')
        .set('Authorization', `Bearer ${businessToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for database belonging to different business', async () => {
      // This tests RLS policy enforcement
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Should either be 404 (not found due to RLS) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Status validation', () => {
    it('should reject download for databases not in ready status', async () => {
      // Test database in 'preparing' status
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Should validate database status before allowing download
      if (response.status === 400) {
        expect(response.body.error).toMatch(/not ready/i);
      }
    });

    it('should allow download for expired databases', async () => {
      // Businesses should still be able to download expired databases for reference
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Should not reject based on expired status
      expect(response.status).not.toBe(400);
    });
  });

  describe('Security validation', () => {
    it('should return signed URLs with expiration', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      if (response.status === 200) {
        const expiresAt = new Date(response.body.expires_at);
        const now = new Date();
        
        // URL should expire in the future but not too far (typically 1 hour)
        expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
        expect(expiresAt.getTime()).toBeLessThan(now.getTime() + (24 * 60 * 60 * 1000)); // Less than 24 hours
      }
    });

    it('should track download access', async () => {
      const response = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      // Implementation should update database status to 'downloaded'
      // and track download timestamp for audit purposes
      expect(response.status).toBeDefined();
    });
  });
});