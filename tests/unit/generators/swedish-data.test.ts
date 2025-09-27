import { describe, expect, it, beforeEach } from '@jest/globals';
import { SwedishDataGenerator } from '../../../tests/generators/swedish-data';
import { faker } from '@faker-js/faker';

describe('SwedishDataGenerator', () => {
  let generator: SwedishDataGenerator;

  beforeEach(() => {
    // Set Swedish locale for consistent testing
    faker.setLocale('sv');
    generator = new SwedishDataGenerator();
  });

  describe('generateCustomer', () => {
    it('should generate valid Swedish customer data', () => {
      const customer = generator.generateCustomer();

      expect(customer).toMatchObject({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        phone: expect.stringMatching(/^\+46[0-9]{8,9}$/),
        personalNumber: expect.stringMatching(/^\d{10}$|^\d{12}$/),
        address: expect.objectContaining({
          street: expect.any(String),
          city: expect.any(String),
          postalCode: expect.stringMatching(/^\d{3}\s?\d{2}$/),
          country: 'Sverige'
        })
      });
    });

    it('should generate valid Swedish personal numbers', () => {
      // Generate multiple customers to test personal number format
      for (let i = 0; i < 10; i++) {
        const customer = generator.generateCustomer();
        const personalNumber = customer.personalNumber;
        
        // Should be either 10 digits (YYMMDDXXXX) or 12 digits (YYYYMMDDXXXX)
        expect(personalNumber).toMatch(/^\d{10}$|^\d{12}$/);
        
        // If 10 digits, extract birth date and validate
        if (personalNumber.length === 10) {
          const year = parseInt(personalNumber.substring(0, 2));
          const month = parseInt(personalNumber.substring(2, 4));
          const day = parseInt(personalNumber.substring(4, 6));
          
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(31);
        }
      }
    });

    it('should generate valid Swedish phone numbers', () => {
      for (let i = 0; i < 10; i++) {
        const customer = generator.generateCustomer();
        const phone = customer.phone;
        
        // Should match Swedish mobile format: +46 followed by 8-9 digits
        expect(phone).toMatch(/^\+46[0-9]{8,9}$/);
        
        // Should start with valid Swedish mobile prefixes
        const prefix = phone.substring(3, 5);
        const validPrefixes = ['70', '72', '73', '76', '79'];
        expect(validPrefixes).toContain(prefix);
      }
    });

    it('should generate valid Swedish postal codes', () => {
      for (let i = 0; i < 10; i++) {
        const customer = generator.generateCustomer();
        const postalCode = customer.address.postalCode;
        
        // Should be 5 digits, optionally with space after 3rd digit
        expect(postalCode).toMatch(/^\d{3}\s?\d{2}$/);
      }
    });

    it('should generate realistic Swedish cities', () => {
      const swedishCities = [
        'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås',
        'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping'
      ];

      for (let i = 0; i < 20; i++) {
        const customer = generator.generateCustomer();
        const city = customer.address.city;
        
        expect(swedishCities).toContain(city);
      }
    });
  });

  describe('generateStore', () => {
    it('should generate valid Swedish store data', () => {
      const store = generator.generateStore();

      expect(store).toMatchObject({
        name: expect.any(String),
        type: expect.any(String),
        address: expect.objectContaining({
          street: expect.any(String),
          city: expect.any(String),
          postalCode: expect.stringMatching(/^\d{3}\s?\d{2}$/),
          country: 'Sverige'
        }),
        phone: expect.stringMatching(/^\+46[0-9]{8,10}$/),
        email: expect.stringMatching(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
        organisationNumber: expect.stringMatching(/^\d{6}-\d{4}$/),
        openingHours: expect.any(Object)
      });
    });

    it('should generate valid Swedish organisation numbers', () => {
      for (let i = 0; i < 10; i++) {
        const store = generator.generateStore();
        const orgNumber = store.organisationNumber;
        
        // Should match format: XXXXXX-XXXX
        expect(orgNumber).toMatch(/^\d{6}-\d{4}$/);
        
        // First digit should be valid for organisation numbers (1, 2, 3, 5, 6, 7, 8, 9)
        const firstDigit = orgNumber.charAt(0);
        expect(['1', '2', '3', '5', '6', '7', '8', '9']).toContain(firstDigit);
      }
    });

    it('should generate realistic Swedish business types', () => {
      const businessTypes = [
        'Restaurang', 'Café', 'Butik', 'Frisör', 'Apotek',
        'Bokhandel', 'Klädbutik', 'Elektronikbutik', 'Bageri', 'Livsmedelsbutik'
      ];

      for (let i = 0; i < 20; i++) {
        const store = generator.generateStore();
        expect(businessTypes).toContain(store.type);
      }
    });

    it('should generate realistic opening hours', () => {
      const store = generator.generateStore();
      const openingHours = store.openingHours;

      expect(openingHours).toHaveProperty('måndag');
      expect(openingHours).toHaveProperty('tisdag');
      expect(openingHours).toHaveProperty('onsdag');
      expect(openingHours).toHaveProperty('torsdag');
      expect(openingHours).toHaveProperty('fredag');
      expect(openingHours).toHaveProperty('lördag');
      expect(openingHours).toHaveProperty('söndag');

      // Each day should have open/close times or be closed
      Object.values(openingHours).forEach(hours => {
        if (hours !== 'Stängt') {
          expect(hours).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
        }
      });
    });
  });

  describe('generateFeedback', () => {
    it('should generate realistic Swedish feedback', () => {
      const feedback = generator.generateFeedback();

      expect(feedback).toMatchObject({
        text: expect.any(String),
        sentiment: expect.stringMatching(/^(positive|negative|neutral)$/),
        categories: expect.arrayContaining([
          expect.stringMatching(/^(service|product|environment|value)$/)
        ]),
        score: expect.any(Number),
        language: 'sv-SE'
      });

      expect(feedback.score).toBeGreaterThanOrEqual(1);
      expect(feedback.score).toBeLessThanOrEqual(100);
    });

    it('should generate feedback matching specified sentiment', () => {
      const positiveFeedback = generator.generateFeedback('positive');
      const negativeFeedback = generator.generateFeedback('negative');
      const neutralFeedback = generator.generateFeedback('neutral');

      expect(positiveFeedback.sentiment).toBe('positive');
      expect(positiveFeedback.score).toBeGreaterThan(70);

      expect(negativeFeedback.sentiment).toBe('negative');
      expect(negativeFeedback.score).toBeLessThan(50);

      expect(neutralFeedback.sentiment).toBe('neutral');
      expect(neutralFeedback.score).toBeGreaterThanOrEqual(50);
      expect(neutralFeedback.score).toBeLessThanOrEqual(70);
    });

    it('should generate authentic Swedish feedback phrases', () => {
      const positivePhrases = [
        'mycket nöjd', 'utmärkt service', 'bra kvalitet', 'vänlig personal',
        'snabb service', 'prisvärd', 'rekommenderar', 'professionell'
      ];

      const negativePhrases = [
        'dålig service', 'långsam', 'oprofessionell', 'dyr', 'besviken',
        'inte nöjd', 'problem', 'kunde vara bättre'
      ];

      // Test positive feedback
      for (let i = 0; i < 10; i++) {
        const positiveFeedback = generator.generateFeedback('positive');
        const hasPositivePhrase = positivePhrases.some(phrase => 
          positiveFeedback.text.toLowerCase().includes(phrase)
        );
        expect(hasPositivePhrase).toBe(true);
      }

      // Test negative feedback
      for (let i = 0; i < 10; i++) {
        const negativeFeedback = generator.generateFeedback('negative');
        const hasNegativePhrase = negativePhrases.some(phrase => 
          negativeFeedback.text.toLowerCase().includes(phrase)
        );
        expect(hasNegativePhrase).toBe(true);
      }
    });
  });

  describe('generateTransaction', () => {
    it('should generate valid transaction data', () => {
      const transaction = generator.generateTransaction();

      expect(transaction).toMatchObject({
        amount: expect.any(Number),
        currency: 'SEK',
        description: expect.any(String),
        timestamp: expect.any(Date),
        paymentMethod: expect.stringMatching(/^(swish|card|cash)$/),
        receiptNumber: expect.stringMatching(/^\d{8}$/)
      });

      expect(transaction.amount).toBeGreaterThan(0);
      expect(transaction.amount % 1).toBe(0); // Should be whole öre (cents)
    });

    it('should generate amounts in realistic Swedish ranges', () => {
      // Test multiple transactions to ensure range validity
      for (let i = 0; i < 50; i++) {
        const transaction = generator.generateTransaction();
        
        // Amount should be between 10 SEK and 5000 SEK (1000 to 500000 öre)
        expect(transaction.amount).toBeGreaterThanOrEqual(1000);
        expect(transaction.amount).toBeLessThanOrEqual(500000);
      }
    });

    it('should generate realistic Swedish transaction descriptions', () => {
      const descriptions = [
        'Lunch', 'Kaffe', 'Middag', 'Frisörbesök', 'Inköp',
        'Apotek', 'Bensin', 'Parkering', 'Kollektivtrafik', 'Bil'
      ];

      for (let i = 0; i < 20; i++) {
        const transaction = generator.generateTransaction();
        const hasValidDescription = descriptions.some(desc => 
          transaction.description.includes(desc)
        );
        expect(hasValidDescription).toBe(true);
      }
    });
  });

  describe('generateBatch', () => {
    it('should generate specified number of items', () => {
      const customers = generator.generateBatch('customer', 5);
      const stores = generator.generateBatch('store', 3);
      const feedback = generator.generateBatch('feedback', 10);

      expect(customers).toHaveLength(5);
      expect(stores).toHaveLength(3);
      expect(feedback).toHaveLength(10);

      customers.forEach(customer => {
        expect(customer).toHaveProperty('firstName');
        expect(customer).toHaveProperty('lastName');
        expect(customer).toHaveProperty('phone');
      });
    });

    it('should maintain consistency with seed values', () => {
      const generator1 = new SwedishDataGenerator(12345);
      const generator2 = new SwedishDataGenerator(12345);

      const batch1 = generator1.generateBatch('customer', 5);
      const batch2 = generator2.generateBatch('customer', 5);

      expect(batch1).toEqual(batch2);
    });

    it('should generate different data with different seeds', () => {
      const generator1 = new SwedishDataGenerator(12345);
      const generator2 = new SwedishDataGenerator(67890);

      const batch1 = generator1.generateBatch('customer', 5);
      const batch2 = generator2.generateBatch('customer', 5);

      expect(batch1).not.toEqual(batch2);
    });
  });

  describe('edge cases and validation', () => {
    it('should handle invalid batch types gracefully', () => {
      expect(() => {
        generator.generateBatch('invalid' as any, 5);
      }).toThrow('Unsupported data type: invalid');
    });

    it('should handle zero batch size', () => {
      const result = generator.generateBatch('customer', 0);
      expect(result).toEqual([]);
    });

    it('should handle large batch sizes efficiently', () => {
      const startTime = Date.now();
      const largeBatch = generator.generateBatch('customer', 1000);
      const endTime = Date.now();

      expect(largeBatch).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});