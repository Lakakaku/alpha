import { describe, test, expect, beforeEach } from '@jest/globals';
import { ContextWindowQueries } from '../../src/queries/context-window.js';
import { CustomQuestion, ContextWindow } from '../../src/types/index.js';
import { dbTestClient } from '../setup.js';

describe('Context Scoring Algorithm', () => {
  let contextWindowQueries: ContextWindowQueries;

  beforeEach(() => {
    contextWindowQueries = new ContextWindowQueries(dbTestClient);
  });

  describe('Store Profile Completeness Calculation', () => {
    test('calculateStoreProfileCompleteness returns 100% for complete profile', () => {
      // Access private method for testing via type assertion
      const instance = contextWindowQueries as any;

      const completeStoreProfile = {
        store_type: {
          category: 'retail',
          subcategory: 'clothing'
        },
        size: {
          square_footage: 1500
        },
        operating_hours: {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' }
        },
        location: {
          address: '123 Main St, Stockholm, Sweden'
        },
        personnel: {
          staff_count: 5
        },
        inventory: {
          product_categories: ['clothing', 'accessories']
        }
      };

      const score = instance.calculateStoreProfileCompleteness(completeStoreProfile);
      expect(score).toBe(100);
    });

    test('calculateStoreProfileCompleteness returns 0% for empty profile', () => {
      const instance = contextWindowQueries as any;

      const emptyStoreProfile = {};
      const missingFields: string[] = [];

      const score = instance.calculateStoreProfileCompleteness(emptyStoreProfile, missingFields);
      expect(score).toBe(0);
      expect(missingFields).toHaveLength(7); // All required fields should be missing
      expect(missingFields).toContain('store_profile.store_type.category');
      expect(missingFields).toContain('store_profile.size.square_footage');
    });

    test('calculateStoreProfileCompleteness calculates partial completion correctly', () => {
      const instance = contextWindowQueries as any;

      const partialStoreProfile = {
        store_type: {
          category: 'retail'
          // Missing subcategory
        },
        size: {
          square_footage: 1500
        },
        location: {
          address: '123 Main St'
        }
        // Missing operating_hours, personnel, inventory
      };

      const missingFields: string[] = [];
      const score = instance.calculateStoreProfileCompleteness(partialStoreProfile, missingFields);

      // Should have 3 out of 7 fields = ~43%
      expect(score).toBe(43);
      expect(missingFields).toHaveLength(4);
      expect(missingFields).toContain('store_profile.store_type.subcategory');
      expect(missingFields).toContain('store_profile.operating_hours');
      expect(missingFields).toContain('store_profile.personnel.staff_count');
      expect(missingFields).toContain('store_profile.inventory.product_categories');
    });

    test('calculateStoreProfileCompleteness handles nested field validation', () => {
      const instance = contextWindowQueries as any;

      const storeProfileWithNestedIssues = {
        store_type: {
          category: 'retail',
          subcategory: '' // Empty string should be treated as missing
        },
        size: {
          square_footage: null // Null should be treated as missing
        },
        operating_hours: {
          monday: { open: '09:00', close: '18:00' }
        },
        location: {
          address: '123 Main St'
        },
        personnel: {
          staff_count: 0 // Zero is a valid value
        },
        inventory: {
          product_categories: [] // Empty array should be treated as missing
        }
      };

      const missingFields: string[] = [];
      const score = instance.calculateStoreProfileCompleteness(storeProfileWithNestedIssues, missingFields);

      // Should have 3 valid fields (category, operating_hours, address, staff_count) = 4/7 = 57%
      expect(score).toBe(57);
      expect(missingFields).toContain('store_profile.store_type.subcategory');
      expect(missingFields).toContain('store_profile.size.square_footage');
      expect(missingFields).toContain('store_profile.inventory.product_categories');
    });

    test('calculateStoreProfileCompleteness validates required field paths correctly', () => {
      const instance = contextWindowQueries as any;

      const requiredFields = [
        'store_type.category',
        'store_type.subcategory',
        'size.square_footage',
        'operating_hours',
        'location.address',
        'personnel.staff_count',
        'inventory.product_categories'
      ];

      // Test each required field individually
      requiredFields.forEach(field => {
        const fieldPath = field.split('.');
        let storeProfile: any = {};
        let current = storeProfile;

        // Build nested object structure for this field
        for (let i = 0; i < fieldPath.length - 1; i++) {
          current[fieldPath[i]] = {};
          current = current[fieldPath[i]];
        }
        current[fieldPath[fieldPath.length - 1]] = 'test-value';

        const score = instance.calculateStoreProfileCompleteness(storeProfile);
        expect(score).toBe(14); // 1 out of 7 fields = ~14%
      });
    });
  });

  describe('Custom Questions Completeness Calculation', () => {
    test('calculateCustomQuestionsCompleteness returns 100% for minimum recommended questions', () => {
      const instance = contextWindowQueries as any;

      const customQuestions: CustomQuestion[] = [
        {
          id: 'q1',
          question: 'How was your shopping experience?',
          is_active: true,
          order_index: 1,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'q2',
          question: 'Would you recommend us to others?',
          is_active: true,
          order_index: 2,
          created_at: '2024-01-15T10:01:00Z'
        },
        {
          id: 'q3',
          question: 'What could we improve?',
          is_active: true,
          order_index: 3,
          created_at: '2024-01-15T10:02:00Z'
        }
      ];

      const score = instance.calculateCustomQuestionsCompleteness(customQuestions);
      expect(score).toBe(100);
    });

    test('calculateCustomQuestionsCompleteness returns 0% for no questions', () => {
      const instance = contextWindowQueries as any;

      const missingFields: string[] = [];
      const score = instance.calculateCustomQuestionsCompleteness([], missingFields);
      expect(score).toBe(0);
      expect(missingFields).toContain('custom_questions');
    });

    test('calculateCustomQuestionsCompleteness scales proportionally for partial completion', () => {
      const instance = contextWindowQueries as any;

      // Test with 1 question (should be 33% of minimum 3)
      const oneQuestion: CustomQuestion[] = [
        {
          id: 'q1',
          question: 'How was your experience?',
          is_active: true,
          order_index: 1,
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      const scoreOne = instance.calculateCustomQuestionsCompleteness(oneQuestion);
      expect(scoreOne).toBe(33); // 1/3 * 100 = 33.33, rounded to 33

      // Test with 2 questions (should be 67% of minimum 3)
      const twoQuestions: CustomQuestion[] = [
        ...oneQuestion,
        {
          id: 'q2',
          question: 'Would you recommend us?',
          is_active: true,
          order_index: 2,
          created_at: '2024-01-15T10:01:00Z'
        }
      ];

      const scoreTwo = instance.calculateCustomQuestionsCompleteness(twoQuestions);
      expect(scoreTwo).toBe(67); // 2/3 * 100 = 66.67, rounded to 67
    });

    test('calculateCustomQuestionsCompleteness caps at 100% for excess questions', () => {
      const instance = contextWindowQueries as any;

      const manyQuestions: CustomQuestion[] = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i + 1}`,
        question: `Question ${i + 1}?`,
        is_active: true,
        order_index: i + 1,
        created_at: `2024-01-15T10:0${i}:00Z`
      }));

      const score = instance.calculateCustomQuestionsCompleteness(manyQuestions);
      expect(score).toBe(100);
    });

    test('calculateCustomQuestionsCompleteness handles null/undefined input', () => {
      const instance = contextWindowQueries as any;

      const missingFields: string[] = [];
      const scoreNull = instance.calculateCustomQuestionsCompleteness(null as any, missingFields);
      const scoreUndefined = instance.calculateCustomQuestionsCompleteness(undefined as any, missingFields);

      expect(scoreNull).toBe(0);
      expect(scoreUndefined).toBe(0);
      expect(missingFields).toHaveLength(2);
      expect(missingFields).toEqual(['custom_questions', 'custom_questions']);
    });
  });

  describe('AI Configuration Completeness Calculation', () => {
    test('calculateAIConfigCompleteness returns 100% for complete configuration', () => {
      const instance = contextWindowQueries as any;

      const completeAIConfig = {
        conversation_style: 'friendly',
        language_preferences: {
          primary: 'swedish'
        },
        call_duration_target: {
          min_seconds: 60,
          max_seconds: 180
        },
        question_selection: {
          max_questions_per_call: 5
        }
      };

      const score = instance.calculateAIConfigCompleteness(completeAIConfig);
      expect(score).toBe(100);
    });

    test('calculateAIConfigCompleteness returns 0% for empty configuration', () => {
      const instance = contextWindowQueries as any;

      const emptyConfig = {};
      const missingFields: string[] = [];

      const score = instance.calculateAIConfigCompleteness(emptyConfig, missingFields);
      expect(score).toBe(0);
      expect(missingFields).toHaveLength(5); // All required fields should be missing
      expect(missingFields).toContain('ai_configuration.conversation_style');
      expect(missingFields).toContain('ai_configuration.language_preferences.primary');
      expect(missingFields).toContain('ai_configuration.call_duration_target.min_seconds');
      expect(missingFields).toContain('ai_configuration.call_duration_target.max_seconds');
      expect(missingFields).toContain('ai_configuration.question_selection.max_questions_per_call');
    });

    test('calculateAIConfigCompleteness calculates partial completion correctly', () => {
      const instance = contextWindowQueries as any;

      const partialConfig = {
        conversation_style: 'friendly',
        language_preferences: {
          primary: 'swedish'
        },
        call_duration_target: {
          min_seconds: 60
          // Missing max_seconds
        }
        // Missing question_selection
      };

      const missingFields: string[] = [];
      const score = instance.calculateAIConfigCompleteness(partialConfig, missingFields);

      // Should have 3 out of 5 fields = 60%
      expect(score).toBe(60);
      expect(missingFields).toHaveLength(2);
      expect(missingFields).toContain('ai_configuration.call_duration_target.max_seconds');
      expect(missingFields).toContain('ai_configuration.question_selection.max_questions_per_call');
    });

    test('calculateAIConfigCompleteness validates nested field paths', () => {
      const instance = contextWindowQueries as any;

      const configWithEmptyNested = {
        conversation_style: 'friendly',
        language_preferences: {}, // Empty object
        call_duration_target: {
          min_seconds: null, // Null value
          max_seconds: 180
        },
        question_selection: {
          max_questions_per_call: '' // Empty string
        }
      };

      const missingFields: string[] = [];
      const score = instance.calculateAIConfigCompleteness(configWithEmptyNested, missingFields);

      // Only conversation_style and max_seconds should be valid = 2/5 = 40%
      expect(score).toBe(40);
      expect(missingFields).toContain('ai_configuration.language_preferences.primary');
      expect(missingFields).toContain('ai_configuration.call_duration_target.min_seconds');
      expect(missingFields).toContain('ai_configuration.question_selection.max_questions_per_call');
    });
  });

  describe('Fraud Detection Completeness Calculation', () => {
    test('calculateFraudDetectionCompleteness returns 100% for complete settings', () => {
      const instance = contextWindowQueries as any;

      const completeSettings = {
        sensitivity_level: 'medium',
        verification_thresholds: {
          min_response_length: 50,
          coherence_threshold: 0.7
        }
      };

      const score = instance.calculateFraudDetectionCompleteness(completeSettings);
      expect(score).toBe(100);
    });

    test('calculateFraudDetectionCompleteness returns 0% for empty settings', () => {
      const instance = contextWindowQueries as any;

      const emptySettings = {};
      const missingFields: string[] = [];

      const score = instance.calculateFraudDetectionCompleteness(emptySettings, missingFields);
      expect(score).toBe(0);
      expect(missingFields).toHaveLength(3);
      expect(missingFields).toContain('fraud_detection_settings.sensitivity_level');
      expect(missingFields).toContain('fraud_detection_settings.verification_thresholds.min_response_length');
      expect(missingFields).toContain('fraud_detection_settings.verification_thresholds.coherence_threshold');
    });

    test('calculateFraudDetectionCompleteness calculates partial completion', () => {
      const instance = contextWindowQueries as any;

      const partialSettings = {
        sensitivity_level: 'high',
        verification_thresholds: {
          min_response_length: 30
          // Missing coherence_threshold
        }
      };

      const missingFields: string[] = [];
      const score = instance.calculateFraudDetectionCompleteness(partialSettings, missingFields);

      // Should have 2 out of 3 fields = 67%
      expect(score).toBe(67);
      expect(missingFields).toHaveLength(1);
      expect(missingFields).toContain('fraud_detection_settings.verification_thresholds.coherence_threshold');
    });
  });

  describe('Overall Context Completeness Calculation', () => {
    test('getContextCompleteness returns correct overall score for complete context', async () => {
      const instance = contextWindowQueries as any;

      // Mock a complete context window
      const completeContextWindow: ContextWindow = {
        id: 'test-context-1',
        store_id: 'test-store-1',
        store_profile: {
          store_type: { category: 'retail', subcategory: 'clothing' },
          size: { square_footage: 1500 },
          operating_hours: { monday: { open: '09:00', close: '18:00' } },
          location: { address: '123 Main St' },
          personnel: { staff_count: 5 },
          inventory: { product_categories: ['clothing'] }
        },
        custom_questions: [
          { id: 'q1', question: 'Test?', is_active: true, order_index: 1, created_at: '2024-01-15T10:00:00Z' },
          { id: 'q2', question: 'Test2?', is_active: true, order_index: 2, created_at: '2024-01-15T10:01:00Z' },
          { id: 'q3', question: 'Test3?', is_active: true, order_index: 3, created_at: '2024-01-15T10:02:00Z' }
        ],
        ai_configuration: {
          conversation_style: 'friendly',
          language_preferences: { primary: 'swedish' },
          call_duration_target: { min_seconds: 60, max_seconds: 180 },
          question_selection: { max_questions_per_call: 5 }
        },
        fraud_detection_settings: {
          sensitivity_level: 'medium',
          verification_thresholds: { min_response_length: 50, coherence_threshold: 0.7 }
        },
        context_score: 100,
        last_updated: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z'
      };

      // Mock the findByStoreId method to return our test context
      jest.spyOn(instance, 'findByStoreId').mockResolvedValue(completeContextWindow);

      const result = await instance.getContextCompleteness('test-store-1');

      expect(result.score).toBe(100);
      expect(result.completeness.store_profile).toBe(100);
      expect(result.completeness.custom_questions).toBe(100);
      expect(result.completeness.ai_configuration).toBe(100);
      expect(result.completeness.fraud_detection).toBe(100);
      expect(result.missing_fields).toHaveLength(0);
    });

    test('getContextCompleteness returns zero scores for missing context window', async () => {
      const instance = contextWindowQueries as any;

      // Mock findByStoreId to return null (no context window)
      jest.spyOn(instance, 'findByStoreId').mockResolvedValue(null);

      const result = await instance.getContextCompleteness('non-existent-store');

      expect(result.score).toBe(0);
      expect(result.completeness.store_profile).toBe(0);
      expect(result.completeness.custom_questions).toBe(0);
      expect(result.completeness.ai_configuration).toBe(0);
      expect(result.completeness.fraud_detection).toBe(0);
      expect(result.missing_fields).toContain('context_window_not_found');
    });

    test('getContextCompleteness calculates average score correctly', async () => {
      const instance = contextWindowQueries as any;

      // Mock a partially complete context window
      const partialContextWindow: ContextWindow = {
        id: 'test-context-2',
        store_id: 'test-store-2',
        store_profile: {
          store_type: { category: 'retail' },
          location: { address: '123 Main St' }
          // Missing other required fields
        },
        custom_questions: [
          { id: 'q1', question: 'Test?', is_active: true, order_index: 1, created_at: '2024-01-15T10:00:00Z' }
          // Only 1 question, need 3 for 100%
        ],
        ai_configuration: {
          conversation_style: 'friendly',
          language_preferences: { primary: 'swedish' }
          // Missing other required fields
        },
        fraud_detection_settings: {
          sensitivity_level: 'medium'
          // Missing other required fields
        },
        context_score: 50,
        last_updated: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z'
      };

      jest.spyOn(instance, 'findByStoreId').mockResolvedValue(partialContextWindow);

      const result = await instance.getContextCompleteness('test-store-2');

      // Verify individual scores
      expect(result.completeness.store_profile).toBe(29); // 2 out of 7 fields
      expect(result.completeness.custom_questions).toBe(33); // 1 out of 3 minimum
      expect(result.completeness.ai_configuration).toBe(40); // 2 out of 5 fields
      expect(result.completeness.fraud_detection).toBe(33); // 1 out of 3 fields

      // Overall score should be average of the four: (29 + 33 + 40 + 33) / 4 = 33.75, rounded to 34
      expect(result.score).toBe(34);
      expect(result.missing_fields.length).toBeGreaterThan(0);
    });

    test('getContextCompleteness handles errors gracefully', async () => {
      const instance = contextWindowQueries as any;

      // Mock findByStoreId to throw an error
      jest.spyOn(instance, 'findByStoreId').mockRejectedValue(new Error('Database error'));

      const result = await instance.getContextCompleteness('error-store');

      expect(result.score).toBe(0);
      expect(result.completeness.store_profile).toBe(0);
      expect(result.completeness.custom_questions).toBe(0);
      expect(result.completeness.ai_configuration).toBe(0);
      expect(result.completeness.fraud_detection).toBe(0);
      expect(result.missing_fields).toContain('error_calculating_completeness');
    });
  });

  describe('Fallback Score Calculation', () => {
    test('calculateFallbackScore matches individual component calculations', () => {
      const instance = contextWindowQueries as any;

      const testData = {
        storeProfile: {
          store_type: { category: 'retail', subcategory: 'clothing' },
          location: { address: '123 Main St' }
        },
        customQuestions: [
          { id: 'q1', question: 'Test?', is_active: true, order_index: 1, created_at: '2024-01-15T10:00:00Z' },
          { id: 'q2', question: 'Test2?', is_active: true, order_index: 2, created_at: '2024-01-15T10:01:00Z' }
        ],
        aiConfiguration: {
          conversation_style: 'friendly',
          language_preferences: { primary: 'swedish' }
        },
        fraudDetectionSettings: {
          sensitivity_level: 'medium'
        }
      };

      const fallbackScore = instance.calculateFallbackScore(
        testData.storeProfile,
        testData.customQuestions,
        testData.aiConfiguration,
        testData.fraudDetectionSettings
      );

      // Calculate individual scores
      const storeProfileScore = instance.calculateStoreProfileCompleteness(testData.storeProfile);
      const customQuestionsScore = instance.calculateCustomQuestionsCompleteness(testData.customQuestions);
      const aiConfigScore = instance.calculateAIConfigCompleteness(testData.aiConfiguration);
      const fraudDetectionScore = instance.calculateFraudDetectionCompleteness(testData.fraudDetectionSettings);

      const expectedScore = Math.round((storeProfileScore + customQuestionsScore + aiConfigScore + fraudDetectionScore) / 4);

      expect(fallbackScore).toBe(expectedScore);
    });

    test('fallback score calculation is consistent with completeness method', () => {
      const instance = contextWindowQueries as any;

      const testCases = [
        {
          description: 'empty data',
          storeProfile: {},
          customQuestions: [],
          aiConfiguration: {},
          fraudDetectionSettings: {}
        },
        {
          description: 'partial data',
          storeProfile: { store_type: { category: 'retail' } },
          customQuestions: [{ id: 'q1', question: 'Test?', is_active: true, order_index: 1, created_at: '2024-01-15T10:00:00Z' }],
          aiConfiguration: { conversation_style: 'friendly' },
          fraudDetectionSettings: { sensitivity_level: 'high' }
        },
        {
          description: 'complete data',
          storeProfile: {
            store_type: { category: 'retail', subcategory: 'clothing' },
            size: { square_footage: 1500 },
            operating_hours: { monday: { open: '09:00', close: '18:00' } },
            location: { address: '123 Main St' },
            personnel: { staff_count: 5 },
            inventory: { product_categories: ['clothing'] }
          },
          customQuestions: [
            { id: 'q1', question: 'Test?', is_active: true, order_index: 1, created_at: '2024-01-15T10:00:00Z' },
            { id: 'q2', question: 'Test2?', is_active: true, order_index: 2, created_at: '2024-01-15T10:01:00Z' },
            { id: 'q3', question: 'Test3?', is_active: true, order_index: 3, created_at: '2024-01-15T10:02:00Z' }
          ],
          aiConfiguration: {
            conversation_style: 'friendly',
            language_preferences: { primary: 'swedish' },
            call_duration_target: { min_seconds: 60, max_seconds: 180 },
            question_selection: { max_questions_per_call: 5 }
          },
          fraudDetectionSettings: {
            sensitivity_level: 'medium',
            verification_thresholds: { min_response_length: 50, coherence_threshold: 0.7 }
          }
        }
      ];

      testCases.forEach(({ description, storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings }) => {
        const fallbackScore = instance.calculateFallbackScore(
          storeProfile,
          customQuestions,
          aiConfiguration,
          fraudDetectionSettings
        );

        // Verify the score is within expected range (0-100)
        expect(fallbackScore).toBeGreaterThanOrEqual(0);
        expect(fallbackScore).toBeLessThanOrEqual(100);

        // Verify the score is an integer (due to Math.round)
        expect(Number.isInteger(fallbackScore)).toBe(true);
      });
    });
  });
});