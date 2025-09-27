import request from 'supertest';
import { app } from '../../src/server';
import { createTestBusiness, cleanupTestData } from '../helpers/test-helpers';

describe('PUT /api/business/stores/{storeId}/context', () => {
  let businessId: string;
  let storeId: string;
  let authToken: string;

  const validContextUpdate = {
    profile: {
      storeType: 'grocery',
      squareFootage: 500,
      departmentCount: 8,
      layoutType: 'grid',
      address: {
        line1: 'Test Street 123',
        city: 'Stockholm',
        postalCode: '12345'
      },
      operatingHours: [
        {
          dayOfWeek: 1,
          openTime: '08:00',
          closeTime: '20:00',
          isSpecialHours: false
        }
      ],
      parkingAvailable: true,
      accessibilityFeatures: ['wheelchair_access', 'audio_assistance']
    },
    personnel: {
      totalStaffCount: 12,
      managerName: 'Anna Svensson',
      customerServicePoints: [
        {
          location: 'main entrance',
          type: 'information_desk',
          staffCount: 2,
          hours: '08:00-20:00'
        }
      ],
      departmentHeads: {
        grocery: 'Erik Johansson',
        electronics: 'Maria Lindberg'
      },
      shifts: [
        {
          shiftName: 'morning',
          startTime: '06:00',
          endTime: '14:00',
          staffCount: 8,
          departmentAllocation: {
            checkout: 3,
            grocery: 3,
            electronics: 2
          },
          daysOfWeek: [1, 2, 3, 4, 5]
        }
      ]
    },
    layout: {
      entranceCount: 2,
      exitCount: 3,
      checkoutLocations: [
        {
          id: 'main_checkout',
          position: { x: 100, y: 200 },
          counterCount: 8,
          expressLanes: 2
        }
      ],
      customerFlowPattern: 'clockwise',
      specialAreas: {
        customer_service: {
          position: { x: 50, y: 50 },
          size: 'large'
        }
      },
      departments: [
        {
          departmentName: 'grocery',
          position: { x: 0, y: 0 },
          width: 100,
          height: 150,
          departmentType: 'product',
          adjacencyPriority: 1
        }
      ]
    },
    inventory: {
      primaryCategories: ['grocery', 'electronics', 'household'],
      paymentMethods: ['cash', 'card', 'swish', 'klarna'],
      priceRange: 'mid-range',
      brandFocus: 'mixed',
      categories: [
        {
          categoryName: 'Fresh Produce',
          subcategories: ['fruits', 'vegetables'],
          departmentLocation: 'grocery',
          staffExpertiseRequired: false
        }
      ],
      services: [
        {
          serviceName: 'Home Delivery',
          serviceType: 'delivery',
          availabilitySchedule: { 'monday-friday': '09:00-17:00' },
          costStructure: 'fee_based'
        }
      ]
    },
    changeSummary: 'Initial complete context setup'
  };

  beforeEach(async () => {
    const testData = await createTestBusiness();
    businessId = testData.businessId;
    storeId = testData.storeId;
    authToken = testData.authToken;
  });

  afterEach(async () => {
    await cleanupTestData(businessId);
  });

  describe('successful context updates', () => {
    it('should create new context when none exists', async () => {
      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validContextUpdate)
        .expect(200);

      expect(response.body).toMatchObject({
        storeId: storeId,
        completenessScore: 100,
        version: 1,
        profile: expect.objectContaining({
          storeType: 'grocery',
          squareFootage: 500
        }),
        personnel: expect.objectContaining({
          totalStaffCount: 12,
          managerName: 'Anna Svensson'
        }),
        layout: expect.objectContaining({
          entranceCount: 2,
          customerFlowPattern: 'clockwise'
        }),
        inventory: expect.objectContaining({
          primaryCategories: ['grocery', 'electronics', 'household'],
          priceRange: 'mid-range'
        })
      });
    });

    it('should update existing context and increment version', async () => {
      // Create initial context
      await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validContextUpdate);

      // Update context
      const updatedContext = {
        ...validContextUpdate,
        profile: {
          ...validContextUpdate.profile,
          squareFootage: 600
        },
        changeSummary: 'Updated store size'
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedContext)
        .expect(200);

      expect(response.body.version).toBe(2);
      expect(response.body.profile.squareFootage).toBe(600);
    });

    it('should calculate completeness score correctly', async () => {
      const partialContext = {
        profile: validContextUpdate.profile,
        changeSummary: 'Partial context'
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialContext)
        .expect(200);

      expect(response.body.completenessScore).toBe(25); // Only profile section complete
    });
  });

  describe('validation errors', () => {
    it('should return 400 for invalid store type', async () => {
      const invalidContext = {
        ...validContextUpdate,
        profile: {
          ...validContextUpdate.profile,
          storeType: 'invalid_type'
        }
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidContext)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'profile.storeType',
            message: expect.stringContaining('Invalid store type')
          })
        ])
      );
    });

    it('should return 400 for negative square footage', async () => {
      const invalidContext = {
        ...validContextUpdate,
        profile: {
          ...validContextUpdate.profile,
          squareFootage: -100
        }
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidContext)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'profile.squareFootage',
            message: expect.stringContaining('must be positive')
          })
        ])
      );
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteContext = {
        profile: {
          storeType: 'grocery'
          // Missing required fields
        }
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteContext)
        .expect(400);

      expect(response.body.validationErrors.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid operating hours', async () => {
      const invalidContext = {
        ...validContextUpdate,
        profile: {
          ...validContextUpdate.profile,
          operatingHours: [
            {
              dayOfWeek: 1,
              openTime: '20:00',
              closeTime: '08:00' // Close time before open time
            }
          ]
        }
      };

      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidContext)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('operatingHours'),
            message: expect.stringContaining('close time must be after open time')
          })
        ])
      );
    });
  });

  describe('authorization', () => {
    it('should return 403 when user lacks context manage permissions', async () => {
      const limitedUserData = await createTestBusiness({ permissions: ['read_feedback'] });
      
      const response = await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${limitedUserData.authToken}`)
        .send(validContextUpdate)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to modify context');
      
      await cleanupTestData(limitedUserData.businessId);
    });

    it('should respect RLS policies for different businesses', async () => {
      const otherBusinessData = await createTestBusiness();
      
      const response = await request(app)
        .put(`/api/business/stores/${otherBusinessData.storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validContextUpdate)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to modify context');
      
      await cleanupTestData(otherBusinessData.businessId);
    });
  });

  describe('performance requirements', () => {
    it('should complete context update within 200ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .put(`/api/business/stores/${storeId}/context`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validContextUpdate)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(200);
    });
  });
});