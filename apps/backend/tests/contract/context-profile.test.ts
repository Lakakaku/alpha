import request from 'supertest';
import { app } from '../../src/server';
import { createTestBusiness, cleanupTestData } from '../helpers/test-helpers';

describe('POST /api/business/stores/{storeId}/context/profile', () => {
  let businessId: string;
  let storeId: string;
  let authToken: string;

  const validProfileData = {
    storeType: 'grocery',
    storeSubtype: 'supermarket',
    squareFootage: 500,
    departmentCount: 8,
    layoutType: 'grid',
    address: {
      line1: 'Test Street 123',
      line2: 'Building A',
      city: 'Stockholm',
      postalCode: '12345'
    },
    operatingHours: [
      {
        dayOfWeek: 1, // Monday
        openTime: '08:00',
        closeTime: '20:00',
        isSpecialHours: false
      },
      {
        dayOfWeek: 0, // Sunday  
        openTime: '10:00',
        closeTime: '18:00',
        isSpecialHours: false
      },
      {
        dayOfWeek: 1,
        openTime: '09:00',
        closeTime: '15:00',
        isSpecialHours: true,
        specialDate: '2024-12-24',
        notes: 'Christmas Eve'
      }
    ],
    parkingAvailable: true,
    accessibilityFeatures: ['wheelchair_access', 'audio_assistance', 'braille_signage']
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

  describe('successful profile creation', () => {
    it('should create new store profile with 201 status', async () => {
      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProfileData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        storeType: 'grocery',
        storeSubtype: 'supermarket',
        squareFootage: 500,
        departmentCount: 8,
        layoutType: 'grid',
        address: {
          line1: 'Test Street 123',
          line2: 'Building A',
          city: 'Stockholm',
          postalCode: '12345'
        },
        operatingHours: expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 1,
            openTime: '08:00',
            closeTime: '20:00',
            isSpecialHours: false
          })
        ]),
        parkingAvailable: true,
        accessibilityFeatures: ['wheelchair_access', 'audio_assistance', 'braille_signage'],
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should update existing profile with 200 status', async () => {
      // Create initial profile
      await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProfileData);

      // Update profile
      const updatedData = {
        ...validProfileData,
        squareFootage: 600,
        departmentCount: 10
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData)
        .expect(200);

      expect(response.body.squareFootage).toBe(600);
      expect(response.body.departmentCount).toBe(10);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should handle minimal required data', async () => {
      const minimalData = {
        storeType: 'electronics',
        squareFootage: 200,
        departmentCount: 3,
        layoutType: 'linear',
        address: {
          line1: 'Minimal Street 1',
          city: 'Göteborg',
          postalCode: '54321'
        }
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(minimalData)
        .expect(201);

      expect(response.body).toMatchObject(minimalData);
      expect(response.body.storeSubtype).toBeNull();
      expect(response.body.parkingAvailable).toBe(false);
      expect(response.body.accessibilityFeatures).toEqual([]);
    });
  });

  describe('validation errors', () => {
    it('should reject invalid store type', async () => {
      const invalidData = {
        ...validProfileData,
        storeType: 'invalid_store_type'
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'storeType',
            message: expect.stringContaining('must be one of')
          })
        ])
      );
    });

    it('should reject negative square footage', async () => {
      const invalidData = {
        ...validProfileData,
        squareFootage: -50
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'squareFootage',
            message: expect.stringContaining('must be positive')
          })
        ])
      );
    });

    it('should reject zero department count', async () => {
      const invalidData = {
        ...validProfileData,
        departmentCount: 0
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'departmentCount',
            message: expect.stringContaining('must be at least 1')
          })
        ])
      );
    });

    it('should reject invalid layout type', async () => {
      const invalidData = {
        ...validProfileData,
        layoutType: 'invalid_layout'
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'layoutType',
            message: expect.stringContaining('must be one of')
          })
        ])
      );
    });

    it('should reject invalid day of week in operating hours', async () => {
      const invalidData = {
        ...validProfileData,
        operatingHours: [
          {
            dayOfWeek: 7, // Invalid (should be 0-6)
            openTime: '08:00',
            closeTime: '20:00'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('operatingHours'),
            message: expect.stringContaining('dayOfWeek must be between 0 and 6')
          })
        ])
      );
    });

    it('should reject close time before open time', async () => {
      const invalidData = {
        ...validProfileData,
        operatingHours: [
          {
            dayOfWeek: 1,
            openTime: '20:00',
            closeTime: '08:00' // Invalid
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
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

    it('should reject missing special date when special hours enabled', async () => {
      const invalidData = {
        ...validProfileData,
        operatingHours: [
          {
            dayOfWeek: 1,
            openTime: '09:00',
            closeTime: '15:00',
            isSpecialHours: true
            // Missing specialDate
          }
        ]
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('specialDate'),
            message: expect.stringContaining('required when special hours enabled')
          })
        ])
      );
    });

    it('should reject missing required address fields', async () => {
      const invalidData = {
        ...validProfileData,
        address: {
          line1: 'Test Street',
          // Missing city and postalCode
        }
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.validationErrors.length).toBeGreaterThan(0);
      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('city')
          }),
          expect.objectContaining({
            field: expect.stringContaining('postalCode')
          })
        ])
      );
    });
  });

  describe('authorization', () => {
    it('should require valid authentication', async () => {
      await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .send(validProfileData)
        .expect(401);
    });

    it('should require manage_context permission', async () => {
      const limitedUserData = await createTestBusiness({ permissions: ['read_feedback'] });
      
      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${limitedUserData.authToken}`)
        .send(validProfileData)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to modify context');
      
      await cleanupTestData(limitedUserData.businessId);
    });

    it('should respect RLS policies between businesses', async () => {
      const otherBusinessData = await createTestBusiness();
      
      const response = await request(app)
        .post(`/api/business/stores/${otherBusinessData.storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProfileData)
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions to modify context');
      
      await cleanupTestData(otherBusinessData.businessId);
    });
  });

  describe('input sanitization', () => {
    it('should sanitize HTML in text fields', async () => {
      const dataWithHtml = {
        ...validProfileData,
        storeSubtype: '<script>alert("xss")</script>supermarket',
        address: {
          ...validProfileData.address,
          line1: 'Test Street <b>123</b>',
          line2: '<em>Building A</em>'
        }
      };

      const response = await request(app)
        .post(`/api/business/stores/${storeId}/context/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(dataWithHtml)
        .expect(201);

      expect(response.body.storeSubtype).not.toContain('<script>');
      expect(response.body.address.line1).not.toContain('<b>');
      expect(response.body.address.line2).not.toContain('<em>');
    });
  });
});