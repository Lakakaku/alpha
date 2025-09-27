import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

/**
 * Contract Test: GET /business/stores/{storeId}/context/export
 *
 * API Contract:
 * - Endpoint: GET /api/business/stores/{storeId}/context/export
 * - Purpose: Export store context data for AI integration in multiple formats
 * - Authentication: Required (business auth)
 * - Authorization: Required (store access permissions)
 * - Performance: <300ms response time
 * - Formats: structured (JSON), narrative (text), schema (OpenAPI)
 *
 * This test MUST FAIL initially (TDD) - endpoint not implemented yet
 */

describe('GET /business/stores/{storeId}/context/export', () => {
  const TEST_STORE_ID = 'test-store-export-123';
  const TEST_BUSINESS_ID = 'test-business-export-456';
  let authToken: string;
  let app: any;

  beforeAll(async () => {
    // Initialize test app (will fail until backend implemented)
    try {
      app = (await import('../../src/app')).default;
    } catch (error) {
      console.log('Expected failure: Backend app not implemented yet');
      app = null;
    }

    // Mock auth token for business
    authToken = 'mock-business-auth-token';
  });

  describe('Structured Format Export', () => {
    test('should export complete context in structured JSON format', async () => {
      if (!app) {
        expect(true).toBe(false); // Fail until implemented
        return;
      }

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(300);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toMatchObject({
        success: true,
        data: {
          store_id: TEST_STORE_ID,
          export_format: "structured",
          export_timestamp: expect.any(String),
          completeness_score: expect.any(Number),
          context: {
            profile: {
              store_type: expect.any(String),
              size_sqm: expect.any(Number),
              departments: expect.any(Number),
              layout_type: expect.any(String),
              location: expect.any(Object),
              operating_hours: expect.any(Array),
              accessibility: expect.any(Array)
            },
            personnel: {
              total_staff: expect.any(Number),
              management: expect.any(Object),
              service_points: expect.any(Array),
              shifts: expect.any(Array),
              expertise_areas: expect.any(Array)
            },
            layout: {
              entrances: expect.any(Number),
              exits: expect.any(Number),
              customer_flow: expect.any(String),
              checkouts: expect.any(Array),
              departments: expect.any(Array),
              special_areas: expect.any(Object)
            },
            inventory: {
              categories: expect.any(Array),
              payment_methods: expect.any(Array),
              price_range: expect.any(String),
              brand_focus: expect.any(String),
              loyalty_programs: expect.any(Object),
              seasonal_variations: expect.any(Object),
              special_services: expect.any(Array)
            }
          },
          metadata: {
            last_updated: expect.any(String),
            version: expect.any(Number),
            ai_integration_ready: expect.any(Boolean)
          }
        }
      });
    });

    test('should export partial context when incomplete', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/partial-store-123/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        completeness_score: expect.any(Number),
        context: {
          profile: expect.any(Object),
          personnel: null, // Not configured yet
          layout: null,    // Not configured yet
          inventory: null  // Not configured yet
        },
        metadata: {
          ai_integration_ready: false,
          missing_sections: expect.arrayContaining(["personnel", "layout", "inventory"])
        }
      });
    });

    test('should include AI optimization hints in structured format', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured&include_ai_hints=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        ai_hints: {
          customer_journey_insights: expect.any(Array),
          optimization_opportunities: expect.any(Array),
          fraud_detection_baseline: expect.any(Object),
          question_generation_context: expect.any(Object)
        }
      });
    });
  });

  describe('Narrative Format Export', () => {
    test('should export context as narrative text for AI consumption', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=narrative`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('STORE CONTEXT SUMMARY');
      expect(response.text).toContain('Store Profile:');
      expect(response.text).toContain('Personnel Structure:');
      expect(response.text).toContain('Physical Layout:');
      expect(response.text).toContain('Inventory & Services:');
      expect(response.text).toMatch(/This is a \w+ store/);
      expect(response.text).toMatch(/The store operates \d+ days per week/);
    });

    test('should customize narrative style with query parameters', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=narrative&style=detailed&perspective=customer`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('From a customer perspective');
      expect(response.text).toMatch(/When you enter.*store/);
      expect(response.text).toContain('customer experience');
    });

    test('should generate AI-friendly narrative for fraud detection', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=narrative&purpose=fraud_detection`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('FRAUD DETECTION CONTEXT');
      expect(response.text).toContain('typical customer behavior');
      expect(response.text).toContain('normal operational patterns');
      expect(response.text).toContain('baseline expectations');
    });
  });

  describe('Schema Format Export', () => {
    test('should export OpenAPI schema for context endpoints', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=schema`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toMatchObject({
        openapi: "3.0.0",
        info: {
          title: expect.stringContaining("Store Context API"),
          version: expect.any(String)
        },
        paths: expect.objectContaining({
          "/context/profile": expect.any(Object),
          "/context/personnel": expect.any(Object),
          "/context/layout": expect.any(Object),
          "/context/inventory": expect.any(Object)
        }),
        components: {
          schemas: expect.objectContaining({
            StoreProfile: expect.any(Object),
            PersonnelContext: expect.any(Object),
            LayoutContext: expect.any(Object),
            InventoryContext: expect.any(Object)
          })
        }
      });
    });

    test('should include validation schemas in schema export', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=schema&include_validation=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.components.schemas.StoreProfile).toMatchObject({
        type: "object",
        required: expect.any(Array),
        properties: expect.any(Object)
      });
    });
  });

  describe('Version and Diff Support', () => {
    test('should export specific context version', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured&version=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.metadata.version).toBe(5);
      expect(response.body.data.metadata.is_historical_version).toBe(true);
    });

    test('should export context diff between versions', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=diff&from_version=3&to_version=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        from_version: 3,
        to_version: 5,
        changes: expect.any(Array),
        summary: expect.any(String),
        sections_changed: expect.any(Array)
      });
    });

    test('should handle version not found gracefully', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured&version=999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('VERSION_NOT_FOUND');
    });
  });

  describe('Query Parameters Validation', () => {
    test('should reject invalid format parameter', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: expect.stringContaining('supported formats'),
          details: {
            supported_formats: ["structured", "narrative", "schema", "diff"]
          }
        }
      });
    });

    test('should use structured format as default', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.data.export_format).toBe('structured');
    });

    test('should validate narrative style parameters', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=narrative&style=invalid_style`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_NARRATIVE_STYLE');
    });

    test('should validate version parameters', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured&version=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_VERSION_FORMAT');
    });
  });

  describe('Authentication & Authorization', () => {
    test('should reject unauthenticated requests', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export`);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });

    test('should reject invalid auth tokens', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should enforce store permissions (RLS)', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const otherStoreId = 'unauthorized-store-789';

      const response = await request(app)
        .get(`/api/business/stores/${otherStoreId}/context/export`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('store access')
        }
      });
    });

    test('should allow read-only access for export', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const readOnlyToken = 'mock-readonly-token';

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export`)
        .set('Authorization', `Bearer ${readOnlyToken}`);

      expect(response.status).toBe(200);
      // Export should work with read-only permissions
    });

    test('should restrict historical version access', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const limitedToken = 'mock-limited-token';

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?version=1`)
        .set('Authorization', `Bearer ${limitedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HISTORICAL_ACCESS_DENIED');
    });
  });

  describe('Performance Requirements', () => {
    test('should respond within 300ms for structured export', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(300);
    });

    test('should handle large context data efficiently', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      // Mock store with complex context
      const complexStoreId = 'complex-store-large-context';

      const startTime = Date.now();
      const response = await request(app)
        .get(`/api/business/stores/${complexStoreId}/context/export?format=narrative&style=detailed`)
        .set('Authorization', `Bearer ${authToken}`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // Higher limit for detailed narrative
    });

    test('should optimize repeated export requests', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      // First request
      const firstStart = Date.now();
      const firstResponse = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);
      const firstTime = Date.now() - firstStart;

      // Second identical request (should use cache)
      const secondStart = Date.now();
      const secondResponse = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);
      const secondTime = Date.now() - secondStart;

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(secondTime).toBeLessThanOrEqual(firstTime); // Cache should help
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent store gracefully', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get('/api/business/stores/non-existent-store/context/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'STORE_NOT_FOUND',
          message: 'Store not found or access denied'
        }
      });
    });

    test('should return proper error for invalid store ID format', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get('/api/business/stores/invalid-uuid/context/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_STORE_ID');
    });

    test('should handle export generation failures gracefully', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      // Mock store that causes export errors
      const errorStoreId = 'error-prone-store';

      const response = await request(app)
        .get(`/api/business/stores/${errorStoreId}/context/export`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('EXPORT_GENERATION_FAILED');
    });
  });

  describe('Response Headers & Metadata', () => {
    test('should include appropriate content headers', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('content-length');
      expect(response.headers).toHaveProperty('last-modified');
      expect(response.headers).toHaveProperty('etag');
    });

    test('should support content disposition for downloads', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured&download=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('context-export');
    });

    test('should include AI integration metadata', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .get(`/api/business/stores/${TEST_STORE_ID}/context/export?format=structured`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['x-ai-integration']).toBe('ready');
      expect(response.headers['x-context-version']).toMatch(/^\d+$/);
      expect(response.headers['x-completeness-score']).toMatch(/^\d+$/);
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
    if (app) {
      // Clean up any test data created during tests
    }
  });
});