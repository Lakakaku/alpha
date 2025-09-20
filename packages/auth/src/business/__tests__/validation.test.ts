import {
  validateBusinessRegistration,
  checkEmailAvailability,
  checkBusinessNameAvailability,
  sanitizeRegistrationData,
  formatValidationErrors,
  ValidationError,
  RegistrationValidationResult
} from '../registration';
import { BusinessRegistrationData } from '../use-business-auth';

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        })),
        ilike: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}));

describe('Business Registration Validation', () => {
  const validRegistrationData: BusinessRegistrationData = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    businessName: 'Test Business AB',
    contactPerson: 'John Doe',
    phone: '+46701234567',
    address: '123 Main Street, Stockholm, Sweden',
    businessType: 'retail',
    estimatedMonthlyCustomers: 150
  };

  describe('validateBusinessRegistration', () => {
    it('should pass validation for valid business data', () => {
      const result = validateBusinessRegistration(validRegistrationData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('Email validation', () => {
      it('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'test@',
          'test.example.com',
          '',
          'test@.com',
          'test@@example.com'
        ];

        invalidEmails.forEach(email => {
          const data = { ...validRegistrationData, email };
          const result = validateBusinessRegistration(data);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === 'email')).toBe(true);
        });
      });

      it('should accept valid email formats', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'admin+test@vocilia.com',
          'contact@business-name.se'
        ];

        validEmails.forEach(email => {
          const data = { ...validRegistrationData, email };
          const result = validateBusinessRegistration(data);
          
          const emailErrors = result.errors.filter(e => e.field === 'email');
          expect(emailErrors).toHaveLength(0);
        });
      });
    });

    describe('Password validation', () => {
      it('should reject passwords shorter than 8 characters', () => {
        const data = { ...validRegistrationData, password: 'Short1!' };
        const result = validateBusinessRegistration(data);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'password' && e.message.includes('8 characters')
        )).toBe(true);
      });

      it('should reject passwords without required character types', () => {
        const weakPasswords = [
          'onlylowercase123',  // No uppercase
          'ONLYUPPERCASE123',  // No lowercase
          'OnlyLettersHere',   // No numbers
          'NoSpecialChars123'  // Valid - has upper, lower, number
        ];

        weakPasswords.slice(0, 3).forEach(password => {
          const data = { ...validRegistrationData, password };
          const result = validateBusinessRegistration(data);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => 
            e.field === 'password' && 
            e.message.includes('uppercase') || 
            e.message.includes('lowercase') || 
            e.message.includes('number')
          )).toBe(true);
        });
      });

      it('should accept strong passwords', () => {
        const strongPasswords = [
          'SecurePass123!',
          'MyStr0ngP@ssw0rd',
          'Business2023!',
          'C0mplex&Secure'
        ];

        strongPasswords.forEach(password => {
          const data = { ...validRegistrationData, password };
          const result = validateBusinessRegistration(data);
          
          const passwordErrors = result.errors.filter(e => e.field === 'password');
          expect(passwordErrors).toHaveLength(0);
        });
      });
    });

    describe('Business name validation', () => {
      it('should reject business names that are too short', () => {
        const data = { ...validRegistrationData, businessName: 'A' };
        const result = validateBusinessRegistration(data);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'businessName' && e.message.includes('2 characters')
        )).toBe(true);
      });

      it('should reject business names that are too long', () => {
        const longName = 'A'.repeat(101);
        const data = { ...validRegistrationData, businessName: longName };
        const result = validateBusinessRegistration(data);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'businessName' && e.message.includes('100 characters')
        )).toBe(true);
      });

      it('should accept valid business names', () => {
        const validNames = [
          'AB Tech Solutions',
          'Café Stockholm',
          'E-Commerce Store 2023',
          'Business Name with Numbers 123'
        ];

        validNames.forEach(businessName => {
          const data = { ...validRegistrationData, businessName };
          const result = validateBusinessRegistration(data);
          
          const nameErrors = result.errors.filter(e => e.field === 'businessName');
          expect(nameErrors).toHaveLength(0);
        });
      });
    });

    describe('Contact person validation', () => {
      it('should reject contact person names that are too short', () => {
        const data = { ...validRegistrationData, contactPerson: 'A' };
        const result = validateBusinessRegistration(data);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'contactPerson' && e.message.includes('2 characters')
        )).toBe(true);
      });

      it('should accept valid contact person names', () => {
        const validNames = [
          'John Doe',
          'Maria García',
          '李小明',
          'O\'Connor'
        ];

        validNames.forEach(contactPerson => {
          const data = { ...validRegistrationData, contactPerson };
          const result = validateBusinessRegistration(data);
          
          const personErrors = result.errors.filter(e => e.field === 'contactPerson');
          expect(personErrors).toHaveLength(0);
        });
      });
    });

    describe('Phone validation', () => {
      it('should reject invalid phone number formats', () => {
        const invalidPhones = [
          '123',           // Too short
          'abc-def-ghij',  // Letters
          '++46701234567', // Double plus
          '070-123'        // Too short
        ];

        invalidPhones.forEach(phone => {
          const data = { ...validRegistrationData, phone };
          const result = validateBusinessRegistration(data);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === 'phone')).toBe(true);
        });
      });

      it('should accept valid phone number formats', () => {
        const validPhones = [
          '+46701234567',
          '070-123-4567',
          '+1 (555) 123-4567',
          '0046701234567'
        ];

        validPhones.forEach(phone => {
          const data = { ...validRegistrationData, phone };
          const result = validateBusinessRegistration(data);
          
          const phoneErrors = result.errors.filter(e => e.field === 'phone');
          expect(phoneErrors).toHaveLength(0);
        });
      });
    });

    describe('Address validation', () => {
      it('should reject addresses that are too short', () => {
        const data = { ...validRegistrationData, address: 'Short' };
        const result = validateBusinessRegistration(data);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => 
          e.field === 'address' && e.message.includes('10 characters')
        )).toBe(true);
      });

      it('should accept valid addresses', () => {
        const validAddresses = [
          '123 Main Street, Stockholm',
          'Drottninggatan 1, 111 51 Stockholm, Sweden',
          'Unit 5, Industrial Park, Göteborg'
        ];

        validAddresses.forEach(address => {
          const data = { ...validRegistrationData, address };
          const result = validateBusinessRegistration(data);
          
          const addressErrors = result.errors.filter(e => e.field === 'address');
          expect(addressErrors).toHaveLength(0);
        });
      });
    });

    describe('Business type validation', () => {
      it('should reject invalid business types', () => {
        const invalidTypes = ['invalid', 'random', 'notexist'];

        invalidTypes.forEach(businessType => {
          const data = { ...validRegistrationData, businessType };
          const result = validateBusinessRegistration(data);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === 'businessType')).toBe(true);
        });
      });

      it('should accept valid business types', () => {
        const validTypes = [
          'restaurant',
          'retail',
          'services',
          'hospitality',
          'healthcare',
          'entertainment',
          'other'
        ];

        validTypes.forEach(businessType => {
          const data = { ...validRegistrationData, businessType };
          const result = validateBusinessRegistration(data);
          
          const typeErrors = result.errors.filter(e => e.field === 'businessType');
          expect(typeErrors).toHaveLength(0);
        });
      });
    });

    describe('Estimated monthly customers validation', () => {
      it('should reject invalid customer counts', () => {
        const invalidCounts = [0, -5, 100001, 1.5];

        invalidCounts.forEach(estimatedMonthlyCustomers => {
          const data = { ...validRegistrationData, estimatedMonthlyCustomers };
          const result = validateBusinessRegistration(data);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === 'estimatedMonthlyCustomers')).toBe(true);
        });
      });

      it('should accept valid customer counts', () => {
        const validCounts = [1, 50, 500, 5000, 50000, 100000];

        validCounts.forEach(estimatedMonthlyCustomers => {
          const data = { ...validRegistrationData, estimatedMonthlyCustomers };
          const result = validateBusinessRegistration(data);
          
          const customerErrors = result.errors.filter(e => e.field === 'estimatedMonthlyCustomers');
          expect(customerErrors).toHaveLength(0);
        });
      });
    });
  });

  describe('sanitizeRegistrationData', () => {
    it('should sanitize and normalize registration data', () => {
      const dirtyData: BusinessRegistrationData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecurePass123!', // Should not be trimmed
        businessName: '  Test Business AB  ',
        contactPerson: '  John Doe  ',
        phone: '+46 (070) 123-4567',
        address: '  123 Main Street, Stockholm  ',
        businessType: 'RETAIL',
        estimatedMonthlyCustomers: 150.7
      };

      const cleaned = sanitizeRegistrationData(dirtyData);

      expect(cleaned.email).toBe('test@example.com');
      expect(cleaned.password).toBe('SecurePass123!'); // Unchanged
      expect(cleaned.businessName).toBe('Test Business AB');
      expect(cleaned.contactPerson).toBe('John Doe');
      expect(cleaned.phone).toBe('+46070123456');
      expect(cleaned.address).toBe('123 Main Street, Stockholm');
      expect(cleaned.businessType).toBe('retail');
      expect(cleaned.estimatedMonthlyCustomers).toBe(150);
    });

    it('should handle negative customer counts', () => {
      const data = { ...validRegistrationData, estimatedMonthlyCustomers: -50 };
      const cleaned = sanitizeRegistrationData(data);
      
      expect(cleaned.estimatedMonthlyCustomers).toBe(50);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format validation errors for display', () => {
      const errors: ValidationError[] = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too weak' },
        { field: 'businessName', message: 'Business name required' }
      ];

      const formatted = formatValidationErrors(errors);
      
      expect(formatted).toContain('email: Invalid email format');
      expect(formatted).toContain('password: Password too weak');
      expect(formatted).toContain('businessName: Business name required');
      expect(formatted.split('\n')).toHaveLength(3);
    });

    it('should handle empty error array', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('');
    });
  });

  describe('checkEmailAvailability', () => {
    const mockSupabase = require('@supabase/auth-helpers-nextjs').createClientComponentClient();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return available true when email does not exist', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const result = await checkEmailAvailability('new@example.com');
      
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return available false when email exists', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { email: 'existing@example.com' },
        error: null
      });

      const result = await checkEmailAvailability('existing@example.com');
      
      expect(result.available).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' }
      });

      const result = await checkEmailAvailability('test@example.com');
      
      expect(result.available).toBe(false);
      expect(result.error).toBe('Unable to check email availability');
    });
  });

  describe('checkBusinessNameAvailability', () => {
    const mockSupabase = require('@supabase/auth-helpers-nextjs').createClientComponentClient();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return available true when business name does not exist', async () => {
      mockSupabase.from().select().ilike().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await checkBusinessNameAvailability('New Business Name');
      
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return available false when business name exists (case insensitive)', async () => {
      mockSupabase.from().select().ilike().single.mockResolvedValue({
        data: { business_name: 'existing business' },
        error: null
      });

      const result = await checkBusinessNameAvailability('Existing Business');
      
      expect(result.available).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle database errors', async () => {
      mockSupabase.from().select().ilike().single.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' }
      });

      const result = await checkBusinessNameAvailability('Test Business');
      
      expect(result.available).toBe(false);
      expect(result.error).toBe('Unable to check business name availability');
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle all empty fields', () => {
      const emptyData: BusinessRegistrationData = {
        email: '',
        password: '',
        businessName: '',
        contactPerson: '',
        phone: '',
        address: '',
        businessType: '',
        estimatedMonthlyCustomers: 0
      };

      const result = validateBusinessRegistration(emptyData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5); // Should have multiple errors
    });

    it('should validate complex real-world data', () => {
      const realWorldData: BusinessRegistrationData = {
        email: 'contact@stockholmcafe.se',
        password: 'Stockholm2023!',
        businessName: 'Stockholm Café & Bistro AB',
        contactPerson: 'Anna Andersson',
        phone: '+46 8 123 456 78',
        address: 'Drottninggatan 45, 111 21 Stockholm, Sweden',
        businessType: 'restaurant',
        estimatedMonthlyCustomers: 2500
      };

      const result = validateBusinessRegistration(realWorldData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle special characters in business names', () => {
      const specialCharData = {
        ...validRegistrationData,
        businessName: 'Café & Restaurant "Stockholm" (Premium)'
      };

      const result = validateBusinessRegistration(specialCharData);
      
      const nameErrors = result.errors.filter(e => e.field === 'businessName');
      expect(nameErrors).toHaveLength(0);
    });
  });
});