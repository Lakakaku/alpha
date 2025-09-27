import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/errors - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Query Parameters', () => {
    it('should accept valid severity filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?severity=critical')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid severity parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?severity=invalid_severity')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid service filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?service=backend')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept search parameter for error message filtering', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?search=database connection')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid status filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?status=open')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid status parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?status=invalid_status')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should accept valid limit parameter within bounds', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?limit=25')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject limit parameter exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?limit=150')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should reject limit parameter below minimum', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?limit=0')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should accept valid offset parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?offset=10')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject negative offset parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?offset=-5')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should use default limit of 50 when not specified', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', validAdminAuth);

      if (response.status === 200) {
        expect(response.body.pagination.limit).toBe(50);
      }
    });

    it('should use default offset of 0 when not specified', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', validAdminAuth);

      if (response.status === 200) {
        expect(response.body.pagination.offset).toBe(0);
      }
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid error logs data structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('pagination');

      // Validate errors array structure
      expect(Array.isArray(response.body.errors)).toBe(true);

      if (response.body.errors.length > 0) {
        const errorLog = response.body.errors[0];

        // Required fields
        expect(errorLog).toHaveProperty('id');
        expect(errorLog).toHaveProperty('timestamp');
        expect(errorLog).toHaveProperty('severity');
        expect(errorLog).toHaveProperty('error_message');
        expect(errorLog).toHaveProperty('service_name');
        expect(errorLog).toHaveProperty('resolution_status');

        // Optional fields
        expect(errorLog).toHaveProperty('stack_trace');
        expect(errorLog).toHaveProperty('endpoint');
        expect(errorLog).toHaveProperty('user_context');

        // Validate field types
        expect(typeof errorLog.id).toBe('string');
        expect(typeof errorLog.timestamp).toBe('string');
        expect(typeof errorLog.severity).toBe('string');
        expect(typeof errorLog.error_message).toBe('string');
        expect(typeof errorLog.service_name).toBe('string');
        expect(typeof errorLog.resolution_status).toBe('string');

        // Validate enum values
        expect(['critical', 'warning', 'info']).toContain(errorLog.severity);
        expect(['open', 'investigating', 'resolved']).toContain(errorLog.resolution_status);

        // Validate UUID format for id
        expect(errorLog.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate timestamp format (ISO 8601)
        expect(new Date(errorLog.timestamp)).toBeInstanceOf(Date);
        expect(isNaN(new Date(errorLog.timestamp).getTime())).toBe(false);
      }

      // Validate pagination structure
      const pagination = response.body.pagination;
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('offset');
      expect(pagination).toHaveProperty('has_more');

      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.limit).toBe('number');
      expect(typeof pagination.offset).toBe('number');
      expect(typeof pagination.has_more).toBe('boolean');
    });

    it('should return filtered results when severity parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?severity=critical')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.errors.length > 0) {
        response.body.errors.forEach((errorLog: any) => {
          expect(errorLog.severity).toBe('critical');
        });
      }
    });

    it('should return filtered results when service parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?service=backend')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.errors.length > 0) {
        response.body.errors.forEach((errorLog: any) => {
          expect(errorLog.service_name).toBe('backend');
        });
      }
    });

    it('should return filtered results when status parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?status=open')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.errors.length > 0) {
        response.body.errors.forEach((errorLog: any) => {
          expect(errorLog.resolution_status).toBe('open');
        });
      }
    });

    it('should return search results when search parameter provided', async () => {
      const searchTerm = 'database';
      const response = await request(app)
        .get(`/api/monitoring/errors?search=${searchTerm}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.errors.length > 0) {
        response.body.errors.forEach((errorLog: any) => {
          expect(errorLog.error_message.toLowerCase()).toContain(searchTerm.toLowerCase());
        });
      }
    });

    it('should respect limit parameter', async () => {
      const limit = 10;
      const response = await request(app)
        .get(`/api/monitoring/errors?limit=${limit}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.errors.length).toBeLessThanOrEqual(limit);
      expect(response.body.pagination.limit).toBe(limit);
    });

    it('should handle pagination correctly with offset', async () => {
      const offset = 5;
      const response = await request(app)
        .get(`/api/monitoring/errors?offset=${offset}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.pagination.offset).toBe(offset);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for error logs endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/errors')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?search=nonexistent_error_pattern')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.errors).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.has_more).toBe(false);
    });

    it('should handle multiple filter parameters correctly', async () => {
      const response = await request(app)
        .get('/api/monitoring/errors?severity=critical&service=backend&status=open')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.errors.length > 0) {
        response.body.errors.forEach((errorLog: any) => {
          expect(errorLog.severity).toBe('critical');
          expect(errorLog.service_name).toBe('backend');
          expect(errorLog.resolution_status).toBe('open');
        });
      }
    });
  });
});