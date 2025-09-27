import request from 'supertest';
import { app } from '../../src/server';
import { createTestStoreContext, createTestBusiness, cleanupTestData } from '../helpers/test-helpers';

describe('GET /api/business/stores/{storeId}/context', () => {
  let businessId: string;
  let storeId: string;
  let authToken: string;

  beforeEach(async () => {
    // Setup test business and store
    const testData = await createTestBusiness();
    businessId = testData.businessId;
    storeId = testData.storeId;
    authToken = testData.authToken;
  });

  afterEach(async () => {
    await cleanupTestData(businessId);
  });

  describe('when context exists', () => {
    beforeEach(async () => {
      await createTestStoreContext(storeId);
    });

    it('should return complete store context with 200 status', async () => {
      const response = await request(app)
        .get(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        storeId: expect.any(String),
        completenessScore: expect.any(Number),
        lastUpdated: expect.any(String),
        version: expect.any(Number),
        profile: expect.objectContaining({
          storeType: expect.any(String),
          squareFootage: expect.any(Number),
          departmentCount: expect.any(Number),
          layoutType: expect.any(String),
          address: expect.objectContaining({
            line1: expect.any(String),
            city: expect.any(String),
            postalCode: expect.any(String)
          })
        }),
        personnel: expect.objectContaining({
          totalStaffCount: expect.any(Number),
          managerName: expect.any(String),
          customerServicePoints: expect.any(Array)
        }),
        layout: expect.objectContaining({
          entranceCount: expect.any(Number),
          exitCount: expect.any(Number),
          checkoutLocations: expect.any(Array),
          customerFlowPattern: expect.any(String)
        }),
        inventory: expect.objectContaining({
          primaryCategories: expect.any(Array),
          paymentMethods: expect.any(Array),
          priceRange: expect.any(String),
          brandFocus: expect.any(String)
        })
      });
    });

    it('should return specific version when version parameter provided', async () => {
      const response = await request(app)
        .get(`/api/business/stores/${storeId}/context?version=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.version).toBe(1);
    });

    it('should respect RLS policies and only return own business context', async () => {
      const otherBusinessData = await createTestBusiness();
      
      const response = await request(app)
        .get(`/api/business/stores/${otherBusinessData.storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to access store context');
      
      await cleanupTestData(otherBusinessData.businessId);
    });
  });

  describe('when context does not exist', () => {
    it('should return 404 with appropriate error message', async () => {
      const response = await request(app)
        .get(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Store not found or no context configured',
        message: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when no auth token provided', async () => {
      await request(app)
        .get(`/api/business/stores/${storeId}/context`)
        .expect(401);
    });

    it('should return 403 when token is invalid', async () => {
      await request(app)
        .get(`/api/business/stores/${storeId}/context`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });

    it('should return 403 when user lacks context read permissions', async () => {
      // Create user with limited permissions
      const limitedUserData = await createTestBusiness({ permissions: ['read_feedback'] });
      
      const response = await request(app)
        .get(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${limitedUserData.authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to access store context');
      
      await cleanupTestData(limitedUserData.businessId);
    });
  });

  describe('input validation', () => {
    it('should return 400 for invalid store ID format', async () => {
      await request(app)
        .get('/api/business/stores/invalid-uuid/context')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 400 for invalid version parameter', async () => {
      await request(app)
        .get(`/api/business/stores/${storeId}/context?version=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 400 for negative version parameter', async () => {
      await request(app)
        .get(`/api/business/stores/${storeId}/context?version=-1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });
});