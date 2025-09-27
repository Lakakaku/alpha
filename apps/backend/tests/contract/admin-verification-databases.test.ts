import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/admin/verification/cycles/{id}/databases', () => {
  let adminToken: string;
  let cycleId: string;

  beforeEach(async () => {
    // Get admin token for authentication
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'admin123'
      });
    
    adminToken = loginResponse.body.token;

    // Create a test verification cycle
    const cycleResponse = await request(app)
      .post('/api/admin/verification/cycles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cycle_week: '2024-01-01'
      });
    
    cycleId = cycleResponse.body.id;
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Successful requests', () => {
    it('should return verification databases for valid cycle', async () => {
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Each database should have required fields
      if (response.body.length > 0) {
        const database = response.body[0];
        expect(database).toHaveProperty('id');
        expect(database).toHaveProperty('store_id');
        expect(database).toHaveProperty('business_id');
        expect(database).toHaveProperty('transaction_count');
        expect(database).toHaveProperty('status');
        expect(database).toHaveProperty('deadline_at');
        expect(database).toHaveProperty('verified_count');
        expect(database).toHaveProperty('fake_count');
        expect(database).toHaveProperty('unverified_count');
        
        // Status should be valid enum value
        expect(['preparing', 'ready', 'downloaded', 'submitted', 'processed', 'expired'])
          .toContain(database.status);
      }
    });

    it('should return empty array for cycle with no databases', async () => {
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent cycle', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${fakeId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid cycle ID format', async () => {
      const response = await request(app)
        .get('/api/admin/verification/cycles/invalid-id/databases')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Data validation', () => {
    it('should return databases with correct data types', async () => {
      const response = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.length > 0) {
        const database = response.body[0];
        
        expect(typeof database.id).toBe('string');
        expect(typeof database.store_id).toBe('string');
        expect(typeof database.business_id).toBe('string');
        expect(typeof database.transaction_count).toBe('number');
        expect(typeof database.status).toBe('string');
        expect(typeof database.deadline_at).toBe('string');
        expect(typeof database.verified_count).toBe('number');
        expect(typeof database.fake_count).toBe('number');
        expect(typeof database.unverified_count).toBe('number');
        
        // Validate date format
        expect(new Date(database.deadline_at).toString()).not.toBe('Invalid Date');
      }
    });
  });
});