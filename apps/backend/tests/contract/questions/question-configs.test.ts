import request from 'supertest';
import { app } from '../../../src/app';

describe('GET /api/questions/configurations - Contract Test', () => {
  // This test MUST FAIL initially since the endpoint doesn't exist yet
  // This is part of the TDD (Test-Driven Development) approach

  describe('Success Cases', () => {
    it('should return 200 with question configurations list', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      // Expected response structure from OpenAPI spec
      expect(response.body).toMatchObject({
        success: true,
        data: {
          configurations: expect.any(Array),
          pagination: {
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
          }
        }
      });

      // Validate configuration structure if any exist
      if (response.body.data.configurations.length > 0) {
        response.body.data.configurations.forEach((config: any) => {
          expect(config).toMatchObject({
            id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            businessId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
            questionText: expect.any(String),
            frequency: expect.any(Number),
            priority: expect.stringMatching(/^(high|medium|low)$/),
            departmentTags: expect.any(Array),
            isActive: expect.any(Boolean),
            maxResponseTime: expect.any(Number),
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          });

          // Validate constraints
          expect(config.questionText.length).toBeGreaterThanOrEqual(10);
          expect(config.questionText.length).toBeLessThanOrEqual(500);
          expect(config.frequency).toBeGreaterThanOrEqual(1);
          expect(config.frequency).toBeLessThanOrEqual(100);
          expect(config.maxResponseTime).toBeGreaterThanOrEqual(10);
          expect(config.maxResponseTime).toBeLessThanOrEqual(60);
          expect(Array.isArray(config.departmentTags)).toBe(true);
          expect(config.departmentTags.length).toBeGreaterThan(0);
        });
      }
    });

    it('should return 200 with empty list when no configurations exist', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          configurations: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      });
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });

    it('should support filtering by active status', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?active=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned configurations should be active
      response.body.data.configurations.forEach((config: any) => {
        expect(config.isActive).toBe(true);
      });
    });

    it('should support filtering by priority', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?priority=high')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned configurations should have high priority
      response.body.data.configurations.forEach((config: any) => {
        expect(config.priority).toBe('high');
      });
    });

    it('should support filtering by department tags', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?department=electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned configurations should include electronics department
      response.body.data.configurations.forEach((config: any) => {
        expect(config.departmentTags).toContain('electronics');
      });
    });

    it('should support multiple filter combinations', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?active=true&priority=high&department=electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All returned configurations should match all filters
      response.body.data.configurations.forEach((config: any) => {
        expect(config.isActive).toBe(true);
        expect(config.priority).toBe('high');
        expect(config.departmentTags).toContain('electronics');
      });
    });

    it('should support sorting by created date', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?sort=createdAt&order=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify descending order if multiple configurations exist
      if (response.body.data.configurations.length > 1) {
        const dates = response.body.data.configurations.map((c: any) => new Date(c.createdAt));
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i-1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
        }
      }
    });

    it('should support sorting by frequency', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?sort=frequency&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify ascending order if multiple configurations exist
      if (response.body.data.configurations.length > 1) {
        const frequencies = response.body.data.configurations.map((c: any) => c.frequency);
        for (let i = 1; i < frequencies.length; i++) {
          expect(frequencies[i]).toBeGreaterThanOrEqual(frequencies[i-1]);
        }
      }
    });
  });

  describe('Validation Cases', () => {
    it('should return 400 for invalid page parameter', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?page=0')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('page'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?limit=0')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('limit');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?limit=101')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid priority filter', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?priority=invalid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('priority'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid active filter', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?active=maybe')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('active');
    });

    it('should return 400 for invalid sort field', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?sort=invalidField')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('sort'),
          details: expect.any(Object)
        }
      });
    });

    it('should return 400 for invalid order parameter', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?order=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('order');
    });
  });

  describe('Business Logic Cases', () => {
    it('should only return configurations for authorized business', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // All configurations should belong to the same business (based on auth)
      if (response.body.data.configurations.length > 0) {
        const businessIds = [...new Set(response.body.data.configurations.map((c: any) => c.businessId))];
        expect(businessIds.length).toBe(1); // Only one business ID should be present
      }
    });

    it('should include active date filtering when appropriate', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check if configurations with date ranges are properly filtered
      response.body.data.configurations.forEach((config: any) => {
        if (config.activeFrom || config.activeUntil) {
          const now = new Date();
          if (config.activeFrom) {
            expect(new Date(config.activeFrom)).toBeLessThanOrEqual(now);
          }
          if (config.activeUntil) {
            expect(new Date(config.activeUntil)).toBeGreaterThan(now);
          }
        }
      });
    });

    it('should handle large result sets with pagination', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.configurations.length).toBeLessThanOrEqual(5);
      
      if (response.body.data.pagination.total > 5) {
        expect(response.body.data.pagination.totalPages).toBeGreaterThan(1);
      }
    });
  });

  describe('Data Integrity Cases', () => {
    it('should return configurations with valid timestamps', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.configurations.forEach((config: any) => {
        // Validate ISO 8601 timestamp format
        expect(config.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(config.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        
        // CreatedAt should be <= UpdatedAt
        expect(new Date(config.createdAt).getTime()).toBeLessThanOrEqual(new Date(config.updatedAt).getTime());
      });
    });

    it('should return configurations with valid department tags', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.configurations.forEach((config: any) => {
        expect(Array.isArray(config.departmentTags)).toBe(true);
        expect(config.departmentTags.length).toBeGreaterThan(0);
        
        config.departmentTags.forEach((tag: string) => {
          expect(typeof tag).toBe('string');
          expect(tag.length).toBeGreaterThan(0);
        });
      });
    });

    it('should include follow-up prompts when available', async () => {
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.configurations.forEach((config: any) => {
        if (config.followUpPrompts) {
          expect(Array.isArray(config.followUpPrompts)).toBe(true);
          config.followUpPrompts.forEach((prompt: string) => {
            expect(typeof prompt).toBe('string');
            expect(prompt.length).toBeGreaterThan(0);
          });
        }
      });
    });
  });

  describe('Performance Cases', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle large page sizes efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/questions/configurations?limit=100')
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds even for large pages
    });
  });

  describe('Edge Cases', () => {
    it('should handle business with no question configurations', async () => {
      // This assumes testing with a business that has no configurations
      const response = await request(app)
        .get('/api/questions/configurations')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          configurations: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      });
    });

    it('should handle filtering that returns no results', async () => {
      const response = await request(app)
        .get('/api/questions/configurations?department=nonexistent')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          configurations: [],
          pagination: expect.objectContaining({
            total: 0,
            totalPages: 0
          })
        }
      });
    });
  });
});