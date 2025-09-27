/**
 * QR Code Management API Contract Tests
 * Feature: 004-step-2-2 QR Code Management System
 * 
 * These tests validate API contracts and must fail initially (TDD approach).
 * Tests will pass once implementation is complete.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/testing-library/jest-dom';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/v1';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Test data setup
let testBusinessId: string;
let testStoreId: string;
let testAuthToken: string;

beforeAll(async () => {
  // Setup test business and store
  // This will fail initially until business auth system exists
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test-business@vocilia-test.com',
    password: 'test-password-123'
  });
  
  testAuthToken = authData.session?.access_token!;
  testBusinessId = authData.user?.user_metadata?.business_id!;
  
  // Get test store
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('business_id', testBusinessId)
    .limit(1);
  
  testStoreId = stores?.[0]?.id!;
});

afterAll(async () => {
  await supabase.auth.signOut();
});

describe('QR Code Management API - Contract Tests', () => {
  
  describe('GET /qr/stores/{storeId}', () => {
    test('should return QR code information for valid store', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      
      const qrInfo = await response.json();
      expect(qrInfo).toMatchObject({
        id: expect.any(String),
        storeId: testStoreId,
        qrData: expect.stringContaining('https://customer.vocilia.se/entry/store/'),
        status: expect.stringMatching(/^(active|inactive|pending_regeneration)$/),
        version: expect.any(Number),
        generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        scanCount: expect.any(Number)
      });
    });

    test('should return 404 for non-existent store', async () => {
      const nonExistentStoreId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await fetch(`${API_BASE_URL}/qr/stores/${nonExistentStoreId}`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error).toMatchObject({
        error: expect.any(String),
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    test('should return 403 for unauthorized store access', async () => {
      // This test requires a store from different business
      // Will fail initially until RLS policies are implemented
      const unauthorizedStoreId = '999e9999-e99b-99d9-a999-999999999999';
      const response = await fetch(`${API_BASE_URL}/qr/stores/${unauthorizedStoreId}`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /qr/stores/{storeId}/regenerate', () => {
    test('should regenerate QR code with valid parameters', async () => {
      const regenerateData = {
        reason: 'Contract test regeneration',
        transitionHours: 24
      };

      const response = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(regenerateData)
      });

      expect(response.status).toBe(200);
      
      const qrInfo = await response.json();
      expect(qrInfo).toMatchObject({
        id: expect.any(String),
        storeId: testStoreId,
        qrData: expect.stringContaining('?t='), // Should have timestamp parameter
        status: 'pending_regeneration',
        version: expect.any(Number),
        transitionUntil: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    test('should validate transition hours parameter', async () => {
      const invalidData = {
        reason: 'Test',
        transitionHours: 200 // Invalid: exceeds maximum of 168
      };

      const response = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /qr/stores/{storeId}/download', () => {
    test('should return PDF for QR code download', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/download?format=A4`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toContain('attachment');
      
      const pdfBuffer = await response.arrayBuffer();
      expect(pdfBuffer.byteLength).toBeGreaterThan(1000); // Should be a real PDF
    });

    test('should validate format parameter', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/download?format=invalid`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`
        }
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /qr/analytics/{storeId}', () => {
    test('should return analytics data with correct structure', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/analytics/${testStoreId}?period=day`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      
      const analytics = await response.json();
      expect(analytics).toMatchObject({
        storeId: testStoreId,
        period: 'day',
        totalScans: expect.any(Number),
        uniqueSessions: expect.any(Number),
        averageScansPerHour: expect.any(Number),
        data: expect.arrayContaining([
          expect.objectContaining({
            timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
            scans: expect.any(Number),
            uniqueSessions: expect.any(Number)
          })
        ])
      });
    });

    test('should validate period parameter', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/analytics/${testStoreId}?period=invalid`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(400);
    });

    test('should respect view_analytics permission', async () => {
      // This test requires a user without view_analytics permission
      // Will fail initially until permission system is implemented
      const response = await fetch(`${API_BASE_URL}/qr/analytics/${testStoreId}`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /qr/bulk/regenerate', () => {
    test('should handle bulk QR regeneration', async () => {
      const bulkData = {
        storeIds: [testStoreId],
        operation: 'regenerate',
        reason: 'Bulk contract test',
        transitionHours: 24
      };

      const response = await fetch(`${API_BASE_URL}/qr/bulk/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bulkData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toMatchObject({
        batchId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        operation: 'regenerate',
        totalStores: 1,
        successCount: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            storeId: testStoreId,
            success: true,
            qrCodeInfo: expect.objectContaining({
              storeId: testStoreId,
              status: 'pending_regeneration'
            })
          })
        ])
      });
    });

    test('should validate bulk operation limits', async () => {
      const tooManyStores = Array.from({ length: 101 }, (_, i) => 
        `123e4567-e89b-12d3-a456-42661417${i.toString().padStart(4, '0')}`
      );

      const bulkData = {
        storeIds: tooManyStores,
        operation: 'regenerate',
        reason: 'Too many stores test'
      };

      const response = await fetch(`${API_BASE_URL}/qr/bulk/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bulkData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /qr/scan', () => {
    test('should record QR scan event', async () => {
      const scanData = {
        storeId: testStoreId,
        qrVersion: 1,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        referrer: 'https://google.com',
        sessionId: '123e4567-e89b-12d3-a456-426614174001'
      };

      const response = await fetch(`${API_BASE_URL}/qr/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scanData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result).toMatchObject({
        scanId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      });
    });

    test('should validate scan data', async () => {
      const invalidScanData = {
        storeId: 'invalid-uuid',
        qrVersion: 'not-a-number'
      };

      const response = await fetch(`${API_BASE_URL}/qr/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidScanData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Print Templates API', () => {
    let templateId: string;

    test('GET /qr/templates should list business templates', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/templates`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      
      const templates = await response.json();
      expect(Array.isArray(templates)).toBe(true);
      
      // Should have at least default template
      expect(templates.length).toBeGreaterThanOrEqual(1);
      
      const defaultTemplate = templates.find(t => t.isDefault);
      expect(defaultTemplate).toMatchObject({
        id: expect.any(String),
        businessId: testBusinessId,
        templateName: expect.any(String),
        pageSize: expect.stringMatching(/^(A4|letter|business_card|label_sheet)$/),
        qrSize: expect.any(Number),
        isDefault: true
      });
    });

    test('POST /qr/templates should create custom template', async () => {
      const templateData = {
        templateName: 'Contract Test Template',
        pageSize: 'A4',
        qrSize: 256,
        includeLogo: true,
        customText: 'Test QR Code',
        textColor: '#333333',
        backgroundColor: '#FFFFFF',
        borderStyle: 'thin'
      };

      const response = await fetch(`${API_BASE_URL}/qr/templates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      expect(response.status).toBe(201);
      
      const template = await response.json();
      expect(template).toMatchObject({
        id: expect.any(String),
        businessId: testBusinessId,
        templateName: 'Contract Test Template',
        pageSize: 'A4',
        qrSize: 256,
        includeLogo: true,
        customText: 'Test QR Code',
        textColor: '#333333',
        backgroundColor: '#FFFFFF',
        borderStyle: 'thin',
        isDefault: false
      });

      templateId = template.id;
    });

    test('PUT /qr/templates/{templateId} should update template', async () => {
      const updateData = {
        templateName: 'Updated Contract Test Template',
        customText: 'Updated QR Code Text'
      };

      const response = await fetch(`${API_BASE_URL}/qr/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      
      const template = await response.json();
      expect(template.templateName).toBe('Updated Contract Test Template');
      expect(template.customText).toBe('Updated QR Code Text');
    });

    test('DELETE /qr/templates/{templateId} should delete template', async () => {
      const response = await fetch(`${API_BASE_URL}/qr/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`
        }
      });

      expect(response.status).toBe(204);
    });

    test('should not delete default template', async () => {
      // Get default template ID
      const listResponse = await fetch(`${API_BASE_URL}/qr/templates`, {
        headers: {
          'Authorization': `Bearer ${testAuthToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const templates = await listResponse.json();
      const defaultTemplate = templates.find(t => t.isDefault);

      const response = await fetch(`${API_BASE_URL}/qr/templates/${defaultTemplate.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${testAuthToken}`
        }
      });

      expect(response.status).toBe(400);
    });
  });
});

/**
 * Integration Test Scenarios
 * These test complete user workflows across multiple API calls
 */
describe('QR Code Management - Integration Tests', () => {
  
  test('Complete QR regeneration workflow', async () => {
    // 1. Get current QR info
    const currentResponse = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}`, {
      headers: { 'Authorization': `Bearer ${testAuthToken}` }
    });
    const currentQR = await currentResponse.json();
    const originalVersion = currentQR.version;

    // 2. Regenerate QR code
    const regenerateResponse = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/regenerate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAuthToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'Integration test' })
    });
    const newQR = await regenerateResponse.json();

    // 3. Verify new QR has incremented version
    expect(newQR.version).toBe(originalVersion + 1);
    expect(newQR.status).toBe('pending_regeneration');

    // 4. Download PDF for new QR
    const downloadResponse = await fetch(`${API_BASE_URL}/qr/stores/${testStoreId}/download`, {
      headers: { 'Authorization': `Bearer ${testAuthToken}` }
    });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-type')).toBe('application/pdf');

    // 5. Record a scan for the new QR
    const scanResponse = await fetch(`${API_BASE_URL}/qr/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: testStoreId,
        qrVersion: newQR.version,
        userAgent: 'Integration Test Agent',
        sessionId: '123e4567-e89b-12d3-a456-426614174002'
      })
    });
    expect(scanResponse.status).toBe(201);

    // 6. Verify analytics include the new scan
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for analytics aggregation
    
    const analyticsResponse = await fetch(`${API_BASE_URL}/qr/analytics/${testStoreId}?period=hour`, {
      headers: { 'Authorization': `Bearer ${testAuthToken}` }
    });
    const analytics = await analyticsResponse.json();
    expect(analytics.totalScans).toBeGreaterThan(0);
  });

  test('Bulk operations with mixed permissions', async () => {
    // This test validates bulk operations handle permission failures gracefully
    const bulkData = {
      storeIds: [testStoreId, '999e9999-e99b-99d9-a999-999999999999'], // One valid, one invalid
      operation: 'regenerate',
      reason: 'Mixed permissions test'
    };

    const response = await fetch(`${API_BASE_URL}/qr/bulk/regenerate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testAuthToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bulkData)
    });

    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.totalStores).toBe(2);
    expect(result.successCount).toBe(1);
    
    const validResult = result.results.find(r => r.storeId === testStoreId);
    const invalidResult = result.results.find(r => r.storeId === '999e9999-e99b-99d9-a999-999999999999');
    
    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeTruthy();
  });
});

/**
 * NOTE: These tests will fail initially as the implementation doesn't exist yet.
 * This is expected behavior for Test-Driven Development (TDD).
 * 
 * Tests validate:
 * 1. API contract compliance (request/response schemas)
 * 2. Authentication and authorization
 * 3. Data validation and error handling
 * 4. Complete user workflows
 * 5. Permission-based access control
 * 
 * Implementation should make these tests pass while maintaining the exact contracts.
 */