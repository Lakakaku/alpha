/**
 * Contract Test: POST /ai-assistant/context/entries
 * Test ID: T012
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for creating business context entries.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { CreateContextEntryRequest, ContextCategory } from '@vocilia/types';

describe('POST /ai-assistant/context/entries', () => {
  const endpoint = '/api/ai-assistant/context/entries';
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'business_type',
        value: { type: 'restaurant' }
      };

      const response = await request(app)
        .post(endpoint)
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'business_type',
        value: { type: 'restaurant' }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', 'Bearer invalid-token')
        .send(requestBody)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should create context entry with minimal data', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'business_name',
        value: { name: 'Downtown Cafe' }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: null,
        conversation_id: null,
        category: 'store_profile',
        subcategory: null,
        key: 'business_name',
        value: { name: 'Downtown Cafe' },
        confidence_score: 1.0,
        source_type: 'manual_input',
        is_verified: false,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Validate UUID format
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Validate ISO date format
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);
      expect(new Date(response.body.updated_at)).toBeInstanceOf(Date);
    });

    it('should create context entry with store_id', async () => {
      const requestBody: CreateContextEntryRequest = {
        store_id: storeId,
        category: 'operations',
        key: 'opening_hours',
        value: { 
          monday: '8:00-18:00',
          tuesday: '8:00-18:00',
          wednesday: '8:00-18:00',
          thursday: '8:00-18:00',
          friday: '8:00-20:00',
          saturday: '9:00-20:00',
          sunday: 'closed'
        }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        store_id: storeId,
        category: 'operations',
        key: 'opening_hours',
        value: expect.objectContaining({
          monday: '8:00-18:00',
          sunday: 'closed'
        }),
        source_type: 'manual_input',
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should create context entry with subcategory', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'personnel',
        subcategory: 'management',
        key: 'manager_contact',
        value: {
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com'
        }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        category: 'personnel',
        subcategory: 'management',
        key: 'manager_contact',
        value: expect.objectContaining({
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com'
        }),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should create context entry with custom confidence score', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'fraud_detection',
        key: 'risk_factors',
        value: {
          high_value_threshold: 500,
          suspicious_patterns: ['multiple_cards', 'unusual_timing']
        },
        confidence_score: 0.8
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        category: 'fraud_detection',
        key: 'risk_factors',
        confidence_score: 0.8,
        source_type: 'manual_input',
        is_verified: false,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should create verified context entry', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'verified_address',
        value: {
          street: '123 Main St',
          city: 'Downtown',
          state: 'CA',
          zip: '12345'
        },
        is_verified: true
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        category: 'store_profile',
        key: 'verified_address',
        is_verified: true,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should support all valid categories', async () => {
      const categories: ContextCategory[] = [
        'store_profile',
        'personnel', 
        'layout',
        'inventory',
        'operations',
        'customer_journey',
        'fraud_detection',
        'seasonal_variations'
      ];

      for (const category of categories) {
        const requestBody: CreateContextEntryRequest = {
          category,
          key: `test_${category}`,
          value: { test: true, category }
        };

        const response = await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send(requestBody)
          .expect(201);

        expect(response.body.category).toBe(category);
      }
    });

    it('should handle complex nested value objects', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'layout',
        key: 'seating_arrangement',
        value: {
          zones: [
            {
              name: 'dining_room',
              capacity: 40,
              tables: [
                { id: 1, seats: 4, type: 'booth' },
                { id: 2, seats: 2, type: 'regular' },
                { id: 3, seats: 6, type: 'family' }
              ]
            },
            {
              name: 'bar_area',
              capacity: 12,
              tables: [
                { id: 4, seats: 8, type: 'bar' },
                { id: 5, seats: 4, type: 'high_top' }
              ]
            }
          ],
          total_capacity: 52,
          accessibility: {
            wheelchair_accessible: true,
            accessible_restrooms: true,
            accessible_parking: 2
          }
        }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        business_id: businessId,
        category: 'layout',
        key: 'seating_arrangement',
        value: expect.objectContaining({
          zones: expect.arrayContaining([
            expect.objectContaining({
              name: 'dining_room',
              capacity: 40
            })
          ]),
          total_capacity: 52
        }),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('Validation', () => {
    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid category values', async () => {
      const requestBody = {
        category: 'invalid-category',
        key: 'test_key',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject empty key values', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: '',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject key longer than 100 characters', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'A'.repeat(101),
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid confidence score values', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'test_key',
        value: { test: true },
        confidence_score: 1.5
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject negative confidence scores', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'test_key',
        value: { test: true },
        confidence_score: -0.1
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid store_id format', async () => {
      const requestBody: CreateContextEntryRequest = {
        store_id: 'not-a-uuid',
        category: 'store_profile',
        key: 'test_key',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject subcategory longer than 50 characters', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'personnel',
        subcategory: 'A'.repeat(51),
        key: 'test_key',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject non-object value fields', async () => {
      const requestBody = {
        category: 'store_profile',
        key: 'test_key',
        value: 'should-be-object'
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only allow creation for businesses user has access to', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'test_authorization',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      // Created entry should belong to user's business
      expect(response.body.business_id).toBe(businessId);
    });

    it('should require write_context permission', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';

      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'readonly_test',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });

    it('should reject access to stores user does not manage', async () => {
      const unauthorizedStoreId = 'unauthorized-store-id';

      const requestBody: CreateContextEntryRequest = {
        store_id: unauthorizedStoreId,
        category: 'store_profile',
        key: 'unauthorized_store',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied to specified store'
      });
    });
  });

  describe('Duplicate Handling', () => {
    it('should update existing entry with same business_id, store_id, category, and key', async () => {
      // Create initial entry
      const initialRequest: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'duplicate_test',
        value: { version: 1, data: 'initial' }
      };

      const initialResponse = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(initialRequest)
        .expect(201);

      // Create duplicate entry (should update)
      const updateRequest: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'duplicate_test',
        value: { version: 2, data: 'updated' }
      };

      const updateResponse = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateRequest)
        .expect(200);

      // Should return the same ID but updated content
      expect(updateResponse.body.id).toBe(initialResponse.body.id);
      expect(updateResponse.body.value).toEqual({ version: 2, data: 'updated' });
      
      // updated_at should be more recent
      const initialUpdated = new Date(initialResponse.body.updated_at);
      const updateUpdated = new Date(updateResponse.body.updated_at);
      expect(updateUpdated.getTime()).toBeGreaterThan(initialUpdated.getTime());
    });

    it('should allow separate entries for different stores', async () => {
      const entry1: CreateContextEntryRequest = {
        store_id: storeId,
        category: 'operations',
        key: 'store_specific',
        value: { store: 'store1' }
      };

      const entry2: CreateContextEntryRequest = {
        // No store_id (business-level)
        category: 'operations',
        key: 'store_specific',
        value: { store: 'business_level' }
      };

      const response1 = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(entry1)
        .expect(201);

      const response2 = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(entry2)
        .expect(201);

      // Should create separate entries
      expect(response1.body.id).not.toBe(response2.body.id);
      expect(response1.body.store_id).toBe(storeId);
      expect(response2.body.store_id).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json"}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send('plain text')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle very large value objects', async () => {
      const largeValue: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeValue[`field_${i}`] = 'A'.repeat(100);
      }

      const requestBody: CreateContextEntryRequest = {
        category: 'inventory',
        key: 'large_data_test',
        value: largeValue
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(413);

      expect(response.body).toMatchObject({
        error: 'Request entity too large'
      });
    });

    it('should sanitize special characters in key', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'test-key_with.special@chars#123',
        value: { test: true }
      };

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      // Key should be sanitized
      expect(response.body.key).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms', async () => {
      const requestBody: CreateContextEntryRequest = {
        category: 'store_profile',
        key: 'performance_test',
        value: { test: true, timestamp: Date.now() }
      };

      const startTime = Date.now();

      await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestBody)
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle concurrent creations efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            category: 'store_profile',
            key: `concurrent_test_${i}`,
            value: { index: i, timestamp: Date.now() }
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          key: `concurrent_test_${index}`,
          value: expect.objectContaining({ index })
        });
      });

      // All entries should have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });
});