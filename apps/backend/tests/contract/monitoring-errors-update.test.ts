import request from 'supertest';
import { app } from '../../src/app';

describe('PATCH /api/monitoring/errors - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const validErrorId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', 'Bearer invalid-admin-token')
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Request Body Validation', () => {
    it('should accept valid request body with required fields', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      // Should not return 422 for valid request
      expect(response.status).not.toBe(422);
    });

    it('should reject request missing error_id field', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'error_id',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing resolution_status field', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'resolution_status',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject invalid UUID format for error_id', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: 'invalid-uuid',
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'error_id',
            message: expect.stringContaining('UUID')
          })
        ])
      );
    });

    it('should reject invalid resolution_status value', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'invalid_status'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'resolution_status',
            message: expect.stringContaining('enum')
          })
        ])
      );
    });

    it('should accept valid open resolution status', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'open'
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid investigating resolution status', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid resolved resolution status', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'resolved'
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject empty request body', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({});

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'error_id'
          }),
          expect.objectContaining({
            field: 'resolution_status'
          })
        ])
      );
    });

    it('should reject extra unexpected fields', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating',
          unexpected_field: 'should_be_rejected'
        });

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Successful Response', () => {
    it('should return 200 when error status updated successfully', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('updated');
    });

    it('should update error status from open to investigating', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(200);
    });

    it('should update error status from investigating to resolved', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'resolved'
        });

      expect(response.status).toBe(200);
    });

    it('should update error status from resolved back to open', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'open'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when error log not found', async () => {
      const nonExistentErrorId = '550e8400-e29b-41d4-a716-446655440999';

      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: nonExistentErrorId,
          resolution_status: 'investigating'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'text/plain')
        .send('error_id=123&resolution_status=open');

      expect(response.status).toBe(415); // Unsupported Media Type
    });

    it('should accept application/json content type', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          error_id: validErrorId,
          resolution_status: 'investigating'
        }));

      expect(response.status).not.toBe(415);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for error update endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'investigating'
        });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Audit Trail', () => {
    it('should log error status update for audit purposes', async () => {
      const response = await request(app)
        .patch('/api/monitoring/errors')
        .set('Authorization', validAdminAuth)
        .send({
          error_id: validErrorId,
          resolution_status: 'resolved'
        });

      expect(response.status).toBe(200);
      // Audit logging verification would be handled by integration tests
      // This contract test ensures the endpoint accepts the request correctly
    });
  });
});