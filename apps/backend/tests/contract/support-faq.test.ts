/**
 * Contract Test: GET /api/support/faq
 * Test ID: T012
 * Feature: Customer Support System (FAQ Management)
 *
 * This test validates the API contract for retrieving FAQ entries.
 * Should FAIL until the endpoint is implemented (TDD requirement).
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('Support FAQ API Contract Tests', () => {
  const baseEndpoint = '/api/support/faq';
  let authToken: string;

  beforeAll(async () => {
    // Setup test authentication
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
  });

  describe('GET /api/support/faq', () => {
    describe('Success Cases', () => {
      it('should return all FAQs without filters', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .expect(200);

        expect(response.body).toMatchObject({
          faqs: expect.arrayContaining([])
        });

        // Validate FAQ structure if entries exist
        if (response.body.faqs.length > 0) {
          const faq = response.body.faqs[0];
          expect(faq).toMatchObject({
            id: expect.any(String),
            question: expect.any(String),
            answer: expect.any(String),
            category: expect.any(String),
            language: expect.any(String)
          });

          // Validate question and answer are non-empty
          expect(faq.question.trim()).toBeTruthy();
          expect(faq.answer.trim()).toBeTruthy();

          // Validate category is one of allowed values
          expect(faq.category).toMatch(/^(technical|account|reward|general)$/);

          // Validate language is one of supported values
          expect(faq.language).toMatch(/^(sv|en)$/);
        }
      });

      it('should filter FAQs by technical category', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'technical' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        // All returned FAQs should have technical category
        response.body.faqs.forEach((faq: any) => {
          expect(faq.category).toBe('technical');
        });
      });

      it('should filter FAQs by account category', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'account' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.category).toBe('account');
        });
      });

      it('should filter FAQs by reward category', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'reward' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.category).toBe('reward');
        });
      });

      it('should filter FAQs by general category', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'general' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.category).toBe('general');
        });
      });

      it('should filter FAQs by Swedish language', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ language: 'sv' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.language).toBe('sv');
        });
      });

      it('should filter FAQs by English language', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ language: 'en' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.language).toBe('en');
        });
      });

      it('should filter FAQs by both category and language', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'technical', language: 'sv' })
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        response.body.faqs.forEach((faq: any) => {
          expect(faq.category).toBe('technical');
          expect(faq.language).toBe('sv');
        });
      });

      it('should return empty results for valid but non-matching filters', async () => {
        // Assuming this combination doesn't exist
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'account', language: 'en' })
          .expect(200);

        expect(response.body).toMatchObject({
          faqs: []
        });
      });

      it('should return FAQs in correct order (by category then language)', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .expect(200);

        expect(response.body.faqs).toEqual(expect.any(Array));

        // If multiple FAQs exist, verify ordering
        if (response.body.faqs.length > 1) {
          for (let i = 0; i < response.body.faqs.length - 1; i++) {
            const current = response.body.faqs[i];
            const next = response.body.faqs[i + 1];

            // Category order: account, general, reward, technical
            const categoryOrder = ['account', 'general', 'reward', 'technical'];
            const currentCategoryIndex = categoryOrder.indexOf(current.category);
            const nextCategoryIndex = categoryOrder.indexOf(next.category);

            expect(currentCategoryIndex).toBeLessThanOrEqual(nextCategoryIndex);
          }
        }
      });
    });

    describe('Validation', () => {
      it('should reject invalid category parameter', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: 'invalid-category' })
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('category')
        });
      });

      it('should reject invalid language parameter', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ language: 'fr' })
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('language')
        });
      });

      it('should reject empty category parameter', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ category: '' })
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('category')
        });
      });

      it('should reject empty language parameter', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .query({ language: '' })
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('language')
        });
      });
    });

    describe('Content Validation', () => {
      it('should return properly sanitized FAQ content', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .expect(200);

        response.body.faqs.forEach((faq: any) => {
          // Ensure no script tags or dangerous HTML
          expect(faq.question).not.toMatch(/<script/i);
          expect(faq.answer).not.toMatch(/<script/i);
          expect(faq.question).not.toMatch(/javascript:/i);
          expect(faq.answer).not.toMatch(/javascript:/i);

          // Ensure basic HTML formatting is preserved (if any)
          // But dangerous attributes are removed
          expect(faq.answer).not.toMatch(/onclick=/i);
          expect(faq.answer).not.toMatch(/onload=/i);
        });
      });

      it('should validate all required FAQ fields are present', async () => {
        const response = await request(app)
          .get(baseEndpoint)
          .expect(200);

        response.body.faqs.forEach((faq: any) => {
          expect(faq).toHaveProperty('id');
          expect(faq).toHaveProperty('question');
          expect(faq).toHaveProperty('answer');
          expect(faq).toHaveProperty('category');
          expect(faq).toHaveProperty('language');

          // Validate data types
          expect(typeof faq.id).toBe('string');
          expect(typeof faq.question).toBe('string');
          expect(typeof faq.answer).toBe('string');
          expect(typeof faq.category).toBe('string');
          expect(typeof faq.language).toBe('string');

          // Validate non-empty strings
          expect(faq.id.trim()).toBeTruthy();
          expect(faq.question.trim()).toBeTruthy();
          expect(faq.answer.trim()).toBeTruthy();
          expect(faq.category.trim()).toBeTruthy();
          expect(faq.language.trim()).toBeTruthy();
        });
      });
    });
  });

  describe('GET /api/support/faq/{id}', () => {
    const faqId = 'test-faq-id-123';

    describe('Success Cases', () => {
      it('should return specific FAQ by ID', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/${faqId}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          question: expect.any(String),
          answer: expect.any(String),
          category: expect.any(String),
          language: expect.any(String)
        });

        // Validate extended properties for single FAQ
        expect(response.body).toHaveProperty('helpful');
        expect(response.body).toHaveProperty('lastUpdated');

        if (response.body.helpful !== null) {
          expect(typeof response.body.helpful).toBe('boolean');
        }

        if (response.body.lastUpdated) {
          expect(new Date(response.body.lastUpdated)).toBeInstanceOf(Date);
        }
      });

      it('should return FAQ with proper structure and data types', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/${faqId}`)
          .expect(200);

        const faq = response.body;

        // Required fields
        expect(typeof faq.id).toBe('string');
        expect(typeof faq.question).toBe('string');
        expect(typeof faq.answer).toBe('string');
        expect(typeof faq.category).toBe('string');
        expect(typeof faq.language).toBe('string');

        // Optional fields
        if (faq.helpful !== undefined && faq.helpful !== null) {
          expect(typeof faq.helpful).toBe('boolean');
        }

        if (faq.lastUpdated) {
          expect(typeof faq.lastUpdated).toBe('string');
          expect(new Date(faq.lastUpdated)).toBeInstanceOf(Date);
        }

        // Validate enum values
        expect(faq.category).toMatch(/^(technical|account|reward|general)$/);
        expect(faq.language).toMatch(/^(sv|en)$/);
      });
    });

    describe('Error Cases', () => {
      it('should return 404 for non-existent FAQ ID', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/non-existent-faq-id`)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.stringMatching(/not found|does not exist/i)
        });
      });

      it('should return 404 for empty FAQ ID', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/`)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String)
        });
      });

      it('should handle malformed FAQ ID gracefully', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/invalid-id-format-###`)
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.any(String),
          message: expect.any(String)
        });
      });
    });

    describe('Content Validation', () => {
      it('should return sanitized content for single FAQ', async () => {
        const response = await request(app)
          .get(`${baseEndpoint}/${faqId}`)
          .expect(200);

        const faq = response.body;

        // Ensure no script tags or dangerous HTML
        expect(faq.question).not.toMatch(/<script/i);
        expect(faq.answer).not.toMatch(/<script/i);
        expect(faq.question).not.toMatch(/javascript:/i);
        expect(faq.answer).not.toMatch(/javascript:/i);

        // Ensure dangerous attributes are removed
        expect(faq.answer).not.toMatch(/onclick=/i);
        expect(faq.answer).not.toMatch(/onload=/i);
        expect(faq.answer).not.toMatch(/onerror=/i);
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms for FAQ list', async () => {
      const startTime = Date.now();

      await request(app)
        .get(baseEndpoint)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond within 100ms for single FAQ', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`${baseEndpoint}/test-faq-id`)
        .catch(() => {}); // Ignore 404 for performance test

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent FAQ requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get(baseEndpoint)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('faqs');
        expect(Array.isArray(response.body.faqs)).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple query parameters gracefully', async () => {
      const response = await request(app)
        .get(baseEndpoint)
        .query({
          category: 'technical',
          language: 'sv',
          unknown_param: 'should-be-ignored'
        })
        .expect(200);

      expect(response.body).toHaveProperty('faqs');
      expect(Array.isArray(response.body.faqs)).toBe(true);
    });

    it('should handle special characters in query parameters', async () => {
      const response = await request(app)
        .get(baseEndpoint)
        .query({ category: 'technical%20test' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should maintain consistent response format even with empty results', async () => {
      // Test with filters that return no results
      const response = await request(app)
        .get(baseEndpoint)
        .query({ category: 'technical', language: 'en' })
        .expect(200);

      expect(response.body).toEqual({
        faqs: []
      });
    });
  });

  describe('Security', () => {
    it('should not expose sensitive internal information', async () => {
      const response = await request(app)
        .get(baseEndpoint)
        .expect(200);

      response.body.faqs.forEach((faq: any) => {
        // Ensure no internal database fields are exposed
        expect(faq).not.toHaveProperty('created_by');
        expect(faq).not.toHaveProperty('updated_by');
        expect(faq).not.toHaveProperty('internal_notes');
        expect(faq).not.toHaveProperty('database_id');
      });
    });

    it('should handle SQL injection attempts in FAQ ID', async () => {
      const maliciousId = "'; DROP TABLE faqs; --";

      const response = await request(app)
        .get(`${baseEndpoint}/${encodeURIComponent(maliciousId)}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('should handle XSS attempts in query parameters', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .get(baseEndpoint)
        .query({ category: xssPayload })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String)
      });

      // Ensure the XSS payload is not reflected in the response
      expect(JSON.stringify(response.body)).not.toContain('<script>');
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent FAQ structure across all endpoints', async () => {
      // Get all FAQs
      const listResponse = await request(app)
        .get(baseEndpoint)
        .expect(200);

      if (listResponse.body.faqs.length > 0) {
        const firstFaq = listResponse.body.faqs[0];

        // Get the same FAQ by ID
        const singleResponse = await request(app)
          .get(`${baseEndpoint}/${firstFaq.id}`)
          .expect(200);

        // Core fields should match
        expect(singleResponse.body.id).toBe(firstFaq.id);
        expect(singleResponse.body.question).toBe(firstFaq.question);
        expect(singleResponse.body.answer).toBe(firstFaq.answer);
        expect(singleResponse.body.category).toBe(firstFaq.category);
        expect(singleResponse.body.language).toBe(firstFaq.language);
      }
    });

    it('should maintain FAQ ordering consistency across requests', async () => {
      // Make two identical requests
      const firstResponse = await request(app)
        .get(baseEndpoint)
        .query({ category: 'technical' })
        .expect(200);

      const secondResponse = await request(app)
        .get(baseEndpoint)
        .query({ category: 'technical' })
        .expect(200);

      // Results should be in the same order
      expect(firstResponse.body.faqs).toEqual(secondResponse.body.faqs);
    });
  });
});