import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

/**
 * Contract Test: POST /business/stores/{storeId}/context/personnel
 *
 * API Contract:
 * - Endpoint: POST /api/business/stores/{storeId}/context/personnel
 * - Purpose: Configure store personnel information and shift management
 * - Authentication: Required (business auth)
 * - Authorization: Required (store management permissions)
 * - Performance: <200ms response time
 *
 * This test MUST FAIL initially (TDD) - endpoint not implemented yet
 */

describe('POST /business/stores/{storeId}/context/personnel', () => {
  const TEST_STORE_ID = 'test-store-personnel-123';
  const TEST_BUSINESS_ID = 'test-business-personnel-456';
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

  describe('Success Cases', () => {
    test('should create new personnel context successfully', async () => {
      if (!app) {
        expect(true).toBe(false); // Fail until implemented
        return;
      }

      const personnelData = {
        total_staff_count: 12,
        manager_name: "Anna Svensson",
        assistant_manager_name: "Erik Johansson",
        customer_service_points: [
          {
            location: "main entrance",
            type: "information_desk",
            staff_count: 2,
            hours: "09:00-21:00"
          }
        ],
        department_heads: {
          grocery: "Erik Johansson",
          electronics: "Maria Lindberg",
          customer_service: "Anna Svensson"
        },
        staff_expertise_areas: ["customer_service", "electronics_repair", "grocery_specialist"]
      };

      const startTime = Date.now();
      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(personnelData);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          store_id: TEST_STORE_ID,
          total_staff_count: 12,
          manager_name: "Anna Svensson",
          customer_service_points: expect.any(Array),
          department_heads: expect.any(Object),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        }
      });
    });

    test('should update existing personnel context', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const updateData = {
        total_staff_count: 15,
        manager_name: "Anna Svensson",
        assistant_manager_name: "Erik Johansson",
        customer_service_points: [
          {
            location: "main entrance",
            type: "information_desk",
            staff_count: 3,
            hours: "08:00-22:00"
          }
        ],
        department_heads: {
          grocery: "Erik Johansson",
          electronics: "Maria Lindberg",
          clothing: "Lisa Andersson"
        }
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.total_staff_count).toBe(15);
      expect(response.body.data.customer_service_points[0].staff_count).toBe(3);
    });

    test('should handle personnel with multiple shifts', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const personnelWithShifts = {
        total_staff_count: 20,
        manager_name: "Anna Svensson",
        customer_service_points: [
          {
            location: "main entrance",
            type: "information_desk",
            staff_count: 2,
            hours: "09:00-21:00"
          }
        ],
        department_heads: {
          grocery: "Erik Johansson",
          electronics: "Maria Lindberg"
        },
        shifts: [
          {
            shift_name: "morning",
            start_time: "06:00",
            end_time: "14:00",
            staff_count: 12,
            department_allocation: {
              checkout: 4,
              grocery: 6,
              electronics: 2
            },
            days_of_week: [1, 2, 3, 4, 5]
          },
          {
            shift_name: "afternoon",
            start_time: "14:00",
            end_time: "22:00",
            staff_count: 10,
            department_allocation: {
              checkout: 3,
              grocery: 4,
              electronics: 3
            },
            days_of_week: [1, 2, 3, 4, 5, 6, 0]
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(personnelWithShifts);

      expect(response.status).toBe(201);
      expect(response.body.data.shifts).toHaveLength(2);
      expect(response.body.data.shifts[0].department_allocation).toMatchObject({
        checkout: 4,
        grocery: 6,
        electronics: 2
      });
    });
  });

  describe('Validation Errors', () => {
    test('should reject missing required fields', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const incompleteData = {
        total_staff_count: 5
        // Missing manager_name and customer_service_points
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('manager_name'),
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'manager_name',
              message: expect.any(String)
            })
          ])
        }
      });
    });

    test('should reject invalid staff count', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const invalidData = {
        total_staff_count: 0, // Invalid: must be >= 1
        manager_name: "Anna Svensson",
        customer_service_points: []
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'total_staff_count',
            message: expect.stringContaining('at least 1')
          })
        ])
      );
    });

    test('should reject invalid shift times', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const invalidShiftData = {
        total_staff_count: 10,
        manager_name: "Anna Svensson",
        customer_service_points: [],
        shifts: [
          {
            shift_name: "invalid",
            start_time: "14:00",
            end_time: "12:00", // Invalid: end before start
            staff_count: 5,
            department_allocation: { checkout: 5 },
            days_of_week: [1, 2, 3]
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidShiftData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('end_time must be after start_time');
    });

    test('should reject mismatched shift allocation totals', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const mismatchedData = {
        total_staff_count: 10,
        manager_name: "Anna Svensson",
        customer_service_points: [],
        shifts: [
          {
            shift_name: "morning",
            start_time: "06:00",
            end_time: "14:00",
            staff_count: 8,
            department_allocation: {
              checkout: 4,
              grocery: 6 // Total = 10, but staff_count = 8
            },
            days_of_week: [1, 2, 3, 4, 5]
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(mismatchedData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('department allocation total must equal staff_count');
    });

    test('should sanitize personnel names', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const unsafeData = {
        total_staff_count: 5,
        manager_name: "Anna <script>alert('xss')</script> Svensson",
        customer_service_points: [],
        department_heads: {
          grocery: "Erik <img src=x onerror=alert('xss')> Johansson"
        }
      };

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(unsafeData);

      expect(response.status).toBe(201);
      expect(response.body.data.manager_name).toBe("Anna  Svensson");
      expect(response.body.data.department_heads.grocery).toBe("Erik  Johansson");
    });
  });

  describe('Authentication & Authorization', () => {
    test('should reject unauthenticated requests', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .send({
          total_staff_count: 5,
          manager_name: "Test Manager",
          customer_service_points: []
        });

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
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', 'Bearer invalid-token')
        .send({
          total_staff_count: 5,
          manager_name: "Test Manager",
          customer_service_points: []
        });

      expect(response.status).toBe(401);
    });

    test('should enforce store permissions (RLS)', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const otherStoreId = 'unauthorized-store-789';

      const response = await request(app)
        .post(`/api/business/stores/${otherStoreId}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          total_staff_count: 5,
          manager_name: "Test Manager",
          customer_service_points: []
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('store access')
        }
      });
    });

    test('should require manage_context permission', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const readOnlyToken = 'mock-readonly-token';

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send({
          total_staff_count: 5,
          manager_name: "Test Manager",
          customer_service_points: []
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Performance Requirements', () => {
    test('should respond within 200ms for small personnel data', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const startTime = Date.now();
      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          total_staff_count: 5,
          manager_name: "Anna Svensson",
          customer_service_points: [
            {
              location: "main entrance",
              type: "information_desk",
              staff_count: 1,
              hours: "09:00-17:00"
            }
          ]
        });
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(200);
      expect(response.status).toBeOneOf([200, 201]);
    });

    test('should handle large personnel datasets efficiently', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const largePersonnelData = {
        total_staff_count: 100,
        manager_name: "Anna Svensson",
        customer_service_points: Array.from({ length: 10 }, (_, i) => ({
          location: `service_point_${i}`,
          type: "information_desk",
          staff_count: 2,
          hours: "09:00-21:00"
        })),
        department_heads: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`department_${i}`, `Manager ${i}`])
        ),
        shifts: Array.from({ length: 5 }, (_, i) => ({
          shift_name: `shift_${i}`,
          start_time: `${6 + i * 3}:00`,
          end_time: `${9 + i * 3}:00`,
          staff_count: 20,
          department_allocation: { checkout: 10, floor: 10 },
          days_of_week: [1, 2, 3, 4, 5]
        }))
      };

      const startTime = Date.now();
      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePersonnelData);
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(500); // Slightly higher for large data
      expect(response.status).toBeOneOf([200, 201]);
    });
  });

  describe('Content Type & Error Handling', () => {
    test('should require JSON content type', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CONTENT_TYPE');
    });

    test('should handle malformed JSON gracefully', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .post(`/api/business/stores/${TEST_STORE_ID}/context/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_JSON');
    });

    test('should return proper error for invalid store ID format', async () => {
      if (!app) {
        expect(true).toBe(false);
        return;
      }

      const response = await request(app)
        .post('/api/business/stores/invalid-uuid/context/personnel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          total_staff_count: 5,
          manager_name: "Test Manager",
          customer_service_points: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_STORE_ID');
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
    if (app) {
      // Clean up any test data created during tests
    }
  });
});