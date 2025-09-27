/**
 * Contract tests for Test Suites API endpoints
 * These tests validate API contracts without implementation
 */

import { describe, test, expect } from '@jest/globals';
import type { TestSuite, CreateTestSuiteRequest, TestSuiteDetails } from '../../../packages/types/src/testing';

describe('Test Suites API Contract', () => {
  const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';

  describe('GET /api/test/suites', () => {
    test('should return list of test suites with valid schema', async () => {
      // This test will fail until implementation exists
      const response = await fetch(`${API_BASE}/api/test/suites`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const suites: TestSuite[] = await response.json();

      // Validate response schema
      expect(Array.isArray(suites)).toBe(true);

      if (suites.length > 0) {
        const suite = suites[0];
        expect(suite).toHaveProperty('id');
        expect(suite).toHaveProperty('name');
        expect(suite).toHaveProperty('type');
        expect(suite).toHaveProperty('component');
        expect(suite).toHaveProperty('priority');
        expect(suite).toHaveProperty('coverageTarget');
        expect(suite).toHaveProperty('enabled');
        expect(suite).toHaveProperty('createdAt');
        expect(suite).toHaveProperty('updatedAt');

        // Validate enum values
        expect(['unit', 'integration', 'e2e', 'performance']).toContain(suite.type);
        expect(['critical', 'high', 'medium', 'low']).toContain(suite.priority);
        expect(typeof suite.coverageTarget).toBe('number');
        expect(suite.coverageTarget).toBeGreaterThanOrEqual(0);
        expect(suite.coverageTarget).toBeLessThanOrEqual(100);
      }
    });

    test('should filter by component parameter', async () => {
      const response = await fetch(`${API_BASE}/api/test/suites?component=customer-app`);

      expect(response.status).toBe(200);

      const suites: TestSuite[] = await response.json();

      // All returned suites should match the filter
      suites.forEach(suite => {
        expect(suite.component).toBe('customer-app');
      });
    });

    test('should filter by type parameter', async () => {
      const response = await fetch(`${API_BASE}/api/test/suites?type=unit`);

      expect(response.status).toBe(200);

      const suites: TestSuite[] = await response.json();

      suites.forEach(suite => {
        expect(suite.type).toBe('unit');
      });
    });

    test('should filter by enabled parameter', async () => {
      const response = await fetch(`${API_BASE}/api/test/suites?enabled=true`);

      expect(response.status).toBe(200);

      const suites: TestSuite[] = await response.json();

      suites.forEach(suite => {
        expect(suite.enabled).toBe(true);
      });
    });
  });

  describe('POST /api/test/suites', () => {
    test('should create test suite with valid request', async () => {
      const createRequest: CreateTestSuiteRequest = {
        name: 'QR Code Generation Tests',
        type: 'unit',
        component: 'customer-app',
        priority: 'high',
        coverageTarget: 85
      };

      const response = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(createRequest)
      });

      expect(response.status).toBe(201);

      const suite: TestSuite = await response.json();

      // Validate created suite matches request
      expect(suite.name).toBe(createRequest.name);
      expect(suite.type).toBe(createRequest.type);
      expect(suite.component).toBe(createRequest.component);
      expect(suite.priority).toBe(createRequest.priority);
      expect(suite.coverageTarget).toBe(createRequest.coverageTarget);
      expect(suite.enabled).toBe(true); // Default value

      // Validate auto-generated fields
      expect(suite.id).toBeDefined();
      expect(suite.createdAt).toBeDefined();
      expect(suite.updatedAt).toBeDefined();
    });

    test('should reject invalid type', async () => {
      const invalidRequest = {
        name: 'Invalid Test Suite',
        type: 'invalid-type',
        component: 'customer-app'
      };

      const response = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);
    });

    test('should reject missing required fields', async () => {
      const incompleteRequest = {
        name: 'Incomplete Test Suite'
        // Missing type and component
      };

      const response = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(incompleteRequest)
      });

      expect(response.status).toBe(400);
    });

    test('should reject invalid coverage target', async () => {
      const invalidRequest: CreateTestSuiteRequest = {
        name: 'Invalid Coverage Suite',
        type: 'unit',
        component: 'customer-app',
        coverageTarget: 150 // Invalid: > 100
      };

      const response = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/test/suites/{suiteId}', () => {
    test('should return test suite details with test cases', async () => {
      // First create a suite to get details for
      const createRequest: CreateTestSuiteRequest = {
        name: 'Detail Test Suite',
        type: 'integration',
        component: 'backend-api'
      };

      const createResponse = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(createRequest)
      });

      const createdSuite: TestSuite = await createResponse.json();

      // Now get details
      const response = await fetch(`${API_BASE}/api/test/suites/${createdSuite.id}`);

      expect(response.status).toBe(200);

      const suiteDetails: TestSuiteDetails = await response.json();

      // Validate suite details structure
      expect(suiteDetails.id).toBe(createdSuite.id);
      expect(suiteDetails.name).toBe(createdSuite.name);
      expect(suiteDetails).toHaveProperty('testCases');
      expect(Array.isArray(suiteDetails.testCases)).toBe(true);
    });

    test('should return 404 for non-existent suite', async () => {
      const response = await fetch(`${API_BASE}/api/test/suites/non-existent-id`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/test/suites/{suiteId}', () => {
    test('should update test suite properties', async () => {
      // First create a suite to update
      const createRequest: CreateTestSuiteRequest = {
        name: 'Update Test Suite',
        type: 'unit',
        component: 'customer-app'
      };

      const createResponse = await fetch(`${API_BASE}/api/test/suites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(createRequest)
      });

      const createdSuite: TestSuite = await createResponse.json();

      // Update the suite
      const updateRequest = {
        name: 'Updated Test Suite Name',
        priority: 'critical' as const,
        coverageTarget: 95,
        enabled: false
      };

      const updateResponse = await fetch(`${API_BASE}/api/test/suites/${createdSuite.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(updateRequest)
      });

      expect(updateResponse.status).toBe(200);

      const updatedSuite: TestSuite = await updateResponse.json();

      // Validate updates
      expect(updatedSuite.name).toBe(updateRequest.name);
      expect(updatedSuite.priority).toBe(updateRequest.priority);
      expect(updatedSuite.coverageTarget).toBe(updateRequest.coverageTarget);
      expect(updatedSuite.enabled).toBe(updateRequest.enabled);

      // Validate unchanged fields
      expect(updatedSuite.id).toBe(createdSuite.id);
      expect(updatedSuite.type).toBe(createdSuite.type);
      expect(updatedSuite.component).toBe(createdSuite.component);

      // Validate updatedAt changed
      expect(new Date(updatedSuite.updatedAt).getTime()).toBeGreaterThan(
        new Date(createdSuite.updatedAt).getTime()
      );
    });

    test('should return 404 for non-existent suite', async () => {
      const updateRequest = {
        name: 'Updated Name'
      };

      const response = await fetch(`${API_BASE}/api/test/suites/non-existent-id`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(updateRequest)
      });

      expect(response.status).toBe(404);
    });
  });
});