import {
  validateQuestionData,
  validateTriggerConditions,
  validateFrequencyConfig,
  validateQuestionOptions,
  validateBusinessPermissions,
  QuestionValidationError,
} from '../../src/utils/questionValidation';
import { QuestionFormData, TriggerCondition, FrequencyConfig } from '@vocilia/types';
import { mockQuestionFormData, mockTriggerConditions } from '../fixtures/questionFixtures';

describe('Question Validation Utils', () => {
  describe('validateQuestionData', () => {
    it('should validate correct question data', () => {
      const validData: QuestionFormData = {
        ...mockQuestionFormData,
        title: 'Valid Question Title',
        type: 'text',
      };

      expect(() => validateQuestionData(validData)).not.toThrow();
    });

    it('should require title', () => {
      const invalidData = { ...mockQuestionFormData, title: '' };

      expect(() => validateQuestionData(invalidData))
        .toThrow(QuestionValidationError);
      expect(() => validateQuestionData(invalidData))
        .toThrow('Question title is required');
    });

    it('should validate title length', () => {
      const longTitle = 'a'.repeat(201); // Over 200 characters
      const invalidData = { ...mockQuestionFormData, title: longTitle };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Question title must be 200 characters or less');
    });

    it('should validate description length', () => {
      const longDescription = 'a'.repeat(1001); // Over 1000 characters
      const invalidData = { ...mockQuestionFormData, description: longDescription };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Question description must be 1000 characters or less');
    });

    it('should validate question type', () => {
      const invalidData = { ...mockQuestionFormData, type: 'invalid_type' as any };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Invalid question type');
    });

    it('should validate position is positive', () => {
      const invalidData = { ...mockQuestionFormData, position: -1 };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Question position must be a positive number');
    });

    it('should validate tags format', () => {
      const invalidData = { ...mockQuestionFormData, tags: [''] };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Tags cannot be empty');
    });

    it('should limit number of tags', () => {
      const tooManyTags = Array(21).fill('tag'); // Over 20 tags
      const invalidData = { ...mockQuestionFormData, tags: tooManyTags };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Maximum 20 tags allowed');
    });

    it('should validate tag length', () => {
      const longTag = 'a'.repeat(51); // Over 50 characters
      const invalidData = { ...mockQuestionFormData, tags: [longTag] };

      expect(() => validateQuestionData(invalidData))
        .toThrow('Tag must be 50 characters or less');
    });
  });

  describe('validateQuestionOptions', () => {
    it('should validate multiple choice options', () => {
      const validOptions = [
        { id: '1', text: 'Option 1', value: 'opt1' },
        { id: '2', text: 'Option 2', value: 'opt2' },
      ];

      expect(() => validateQuestionOptions('multiple_choice', validOptions)).not.toThrow();
    });

    it('should require options for multiple choice', () => {
      expect(() => validateQuestionOptions('multiple_choice', []))
        .toThrow('Multiple choice questions must have at least 2 options');

      expect(() => validateQuestionOptions('multiple_choice', [
        { id: '1', text: 'Only one', value: 'one' }
      ])).toThrow('Multiple choice questions must have at least 2 options');
    });

    it('should limit multiple choice options', () => {
      const tooManyOptions = Array(21).fill(null).map((_, i) => ({
        id: i.toString(),
        text: `Option ${i}`,
        value: `opt${i}`,
      }));

      expect(() => validateQuestionOptions('multiple_choice', tooManyOptions))
        .toThrow('Maximum 20 options allowed for multiple choice questions');
    });

    it('should validate option text length', () => {
      const longTextOption = {
        id: '1',
        text: 'a'.repeat(201), // Over 200 characters
        value: 'opt1',
      };

      expect(() => validateQuestionOptions('multiple_choice', [longTextOption, { id: '2', text: 'Option 2', value: 'opt2' }]))
        .toThrow('Option text must be 200 characters or less');
    });

    it('should validate unique option values', () => {
      const duplicateOptions = [
        { id: '1', text: 'Option 1', value: 'same' },
        { id: '2', text: 'Option 2', value: 'same' },
      ];

      expect(() => validateQuestionOptions('multiple_choice', duplicateOptions))
        .toThrow('Option values must be unique');
    });

    it('should validate yes/no options', () => {
      const validYesNoOptions = [
        { id: 'yes', text: 'Yes', value: 'yes' },
        { id: 'no', text: 'No', value: 'no' },
      ];

      expect(() => validateQuestionOptions('yes_no', validYesNoOptions)).not.toThrow();
    });

    it('should require exactly 2 options for yes/no', () => {
      expect(() => validateQuestionOptions('yes_no', []))
        .toThrow('Yes/No questions must have exactly 2 options');

      const threeOptions = [
        { id: '1', text: 'Yes', value: 'yes' },
        { id: '2', text: 'No', value: 'no' },
        { id: '3', text: 'Maybe', value: 'maybe' },
      ];

      expect(() => validateQuestionOptions('yes_no', threeOptions))
        .toThrow('Yes/No questions must have exactly 2 options');
    });

    it('should allow empty options for text and rating', () => {
      expect(() => validateQuestionOptions('text', [])).not.toThrow();
      expect(() => validateQuestionOptions('rating', [])).not.toThrow();
    });

    it('should validate required option fields', () => {
      const invalidOption = { id: '1', text: '', value: 'empty' };

      expect(() => validateQuestionOptions('multiple_choice', [invalidOption, { id: '2', text: 'Valid', value: 'valid' }]))
        .toThrow('Option text is required');
    });

    it('should validate option value format', () => {
      const invalidOption = { id: '1', text: 'Valid text', value: '' };

      expect(() => validateQuestionOptions('multiple_choice', [invalidOption, { id: '2', text: 'Valid', value: 'valid' }]))
        .toThrow('Option value is required');
    });
  });

  describe('validateTriggerConditions', () => {
    it('should validate correct trigger conditions', () => {
      const validConditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['09:00', '17:00'],
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 3,
        },
      ];

      expect(() => validateTriggerConditions(validConditions)).not.toThrow();
    });

    it('should validate trigger type', () => {
      const invalidCondition: TriggerCondition = {
        type: 'invalid_type' as any,
        field: 'test',
        operator: 'eq',
        value: 'test',
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Invalid trigger type: invalid_type');
    });

    it('should validate field for trigger type', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'invalid_field' as any,
        operator: 'eq',
        value: 'test',
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Invalid field for time_based trigger: invalid_field');
    });

    it('should validate operator for trigger type', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'contains' as any,
        value: '12:00',
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Invalid operator for time_based trigger: contains');
    });

    it('should validate time format for time_based triggers', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'gte',
        value: '25:00', // Invalid time
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Invalid time format: 25:00');
    });

    it('should validate time range for between operator', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'between',
        value: ['17:00', '09:00'], // End time before start time
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('End time must be after start time for between operator');
    });

    it('should validate numeric values for frequency triggers', () => {
      const invalidCondition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: 'not_a_number' as any,
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Frequency based triggers require numeric values');
    });

    it('should validate positive numbers for count fields', () => {
      const invalidCondition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: -1,
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Visit count must be a positive number');
    });

    it('should validate day format', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_day',
        operator: 'eq',
        value: 'invalid_day',
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Invalid day format. Use: monday, tuesday, etc.');
    });

    it('should validate array values for in/nin operators', () => {
      const invalidCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_day',
        operator: 'in',
        value: 'not_an_array' as any,
      };

      expect(() => validateTriggerConditions([invalidCondition]))
        .toThrow('Operator "in" requires an array value');
    });

    it('should limit number of trigger conditions', () => {
      const tooManyConditions = Array(11).fill(null).map((): TriggerCondition => ({
        type: 'time_based',
        field: 'current_time',
        operator: 'gte',
        value: '09:00',
      }));

      expect(() => validateTriggerConditions(tooManyConditions))
        .toThrow('Maximum 10 trigger conditions allowed');
    });
  });

  describe('validateFrequencyConfig', () => {
    it('should validate correct frequency config', () => {
      const validConfig: FrequencyConfig = {
        enabled: true,
        window: 'daily',
        max_frequency: 3,
      };

      expect(() => validateFrequencyConfig(validConfig)).not.toThrow();
    });

    it('should validate frequency window', () => {
      const invalidConfig: FrequencyConfig = {
        enabled: true,
        window: 'invalid' as any,
        max_frequency: 1,
      };

      expect(() => validateFrequencyConfig(invalidConfig))
        .toThrow('Invalid frequency window');
    });

    it('should validate max frequency is positive', () => {
      const invalidConfig: FrequencyConfig = {
        enabled: true,
        window: 'daily',
        max_frequency: 0,
      };

      expect(() => validateFrequencyConfig(invalidConfig))
        .toThrow('Max frequency must be a positive number');
    });

    it('should validate max frequency limit', () => {
      const invalidConfig: FrequencyConfig = {
        enabled: true,
        window: 'hourly',
        max_frequency: 101, // Over 100
      };

      expect(() => validateFrequencyConfig(invalidConfig))
        .toThrow('Max frequency cannot exceed 100');
    });

    it('should allow disabled frequency config', () => {
      const disabledConfig: FrequencyConfig = {
        enabled: false,
        window: 'daily',
        max_frequency: 1,
      };

      expect(() => validateFrequencyConfig(disabledConfig)).not.toThrow();
    });

    it('should validate reasonable limits for different windows', () => {
      const hourlyConfig: FrequencyConfig = {
        enabled: true,
        window: 'hourly',
        max_frequency: 50, // Should be reasonable
      };

      const weeklyConfig: FrequencyConfig = {
        enabled: true,
        window: 'weekly',
        max_frequency: 20,
      };

      expect(() => validateFrequencyConfig(hourlyConfig)).not.toThrow();
      expect(() => validateFrequencyConfig(weeklyConfig)).not.toThrow();
    });
  });

  describe('validateBusinessPermissions', () => {
    const mockPermissions = {
      read_feedback: true,
      write_context: true,
      manage_qr: false,
      view_analytics: true,
      admin: false,
    };

    it('should validate sufficient permissions for question creation', () => {
      expect(() => validateBusinessPermissions(mockPermissions, 'create_question')).not.toThrow();
    });

    it('should require write_context permission for question creation', () => {
      const insufficientPermissions = { ...mockPermissions, write_context: false };

      expect(() => validateBusinessPermissions(insufficientPermissions, 'create_question'))
        .toThrow('Insufficient permissions: write_context required for question creation');
    });

    it('should validate permissions for question modification', () => {
      expect(() => validateBusinessPermissions(mockPermissions, 'modify_question')).not.toThrow();
    });

    it('should require admin permission for bulk operations', () => {
      expect(() => validateBusinessPermissions(mockPermissions, 'bulk_operation'))
        .toThrow('Insufficient permissions: admin required for bulk operations');
    });

    it('should validate permissions for analytics access', () => {
      expect(() => validateBusinessPermissions(mockPermissions, 'view_analytics')).not.toThrow();
    });

    it('should reject analytics access without permission', () => {
      const noAnalyticsPermissions = { ...mockPermissions, view_analytics: false };

      expect(() => validateBusinessPermissions(noAnalyticsPermissions, 'view_analytics'))
        .toThrow('Insufficient permissions: view_analytics required');
    });

    it('should handle invalid operation type', () => {
      expect(() => validateBusinessPermissions(mockPermissions, 'invalid_operation' as any))
        .toThrow('Invalid operation type: invalid_operation');
    });
  });

  describe('QuestionValidationError', () => {
    it('should create validation error with message', () => {
      const error = new QuestionValidationError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('QuestionValidationError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create validation error with field', () => {
      const error = new QuestionValidationError('Invalid title', 'title');

      expect(error.message).toBe('Invalid title');
      expect(error.field).toBe('title');
    });

    it('should create validation error with details', () => {
      const details = { code: 'INVALID_LENGTH', maxLength: 200 };
      const error = new QuestionValidationError('Title too long', 'title', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('comprehensive validation scenarios', () => {
    it('should validate complete question with all components', () => {
      const complexQuestion: QuestionFormData = {
        title: 'How would you rate our service?',
        description: 'Please provide your honest feedback about our service quality',
        type: 'rating',
        required: true,
        category_id: 'cat-123',
        tags: ['service', 'quality', 'rating'],
        position: 1,
        active: true,
        options: [],
        triggers: [
          {
            type: 'time_based',
            field: 'current_time',
            operator: 'between',
            value: ['09:00', '18:00'],
          },
          {
            type: 'frequency_based',
            field: 'visit_count',
            operator: 'gte',
            value: 2,
          },
        ],
        frequency_config: {
          enabled: true,
          window: 'daily',
          max_frequency: 1,
        },
      };

      expect(() => validateQuestionData(complexQuestion)).not.toThrow();
      expect(() => validateTriggerConditions(complexQuestion.triggers)).not.toThrow();
      expect(() => validateFrequencyConfig(complexQuestion.frequency_config)).not.toThrow();
    });

    it('should validate multiple choice question with complete data', () => {
      const multipleChoiceQuestion: QuestionFormData = {
        title: 'What is your preferred contact method?',
        description: 'Select your preferred way to be contacted',
        type: 'multiple_choice',
        required: true,
        category_id: 'cat-456',
        tags: ['contact', 'preference'],
        position: 2,
        active: true,
        options: [
          { id: 'email', text: 'Email', value: 'email' },
          { id: 'phone', text: 'Phone', value: 'phone' },
          { id: 'sms', text: 'SMS', value: 'sms' },
          { id: 'mail', text: 'Physical Mail', value: 'mail' },
        ],
        triggers: [],
        frequency_config: {
          enabled: false,
          window: 'daily',
          max_frequency: 1,
        },
      };

      expect(() => validateQuestionData(multipleChoiceQuestion)).not.toThrow();
      expect(() => validateQuestionOptions(multipleChoiceQuestion.type, multipleChoiceQuestion.options)).not.toThrow();
    });

    it('should catch multiple validation errors', () => {
      const invalidQuestion: QuestionFormData = {
        title: '', // Invalid - empty
        description: 'a'.repeat(1001), // Invalid - too long
        type: 'invalid' as any, // Invalid - wrong type
        required: true,
        category_id: 'cat-123',
        tags: [''], // Invalid - empty tag
        position: -1, // Invalid - negative
        active: true,
        options: [],
        triggers: [
          {
            type: 'time_based',
            field: 'invalid_field' as any, // Invalid field
            operator: 'eq',
            value: 'test',
          },
        ],
        frequency_config: {
          enabled: true,
          window: 'invalid' as any, // Invalid window
          max_frequency: 0, // Invalid - zero
        },
      };

      // Should catch the first validation error
      expect(() => validateQuestionData(invalidQuestion)).toThrow('Question title is required');
    });
  });

  describe('edge cases', () => {
    it('should handle empty trigger conditions array', () => {
      expect(() => validateTriggerConditions([])).not.toThrow();
    });

    it('should handle null and undefined values', () => {
      const questionWithNulls = {
        ...mockQuestionFormData,
        description: null,
        tags: undefined,
      };

      // Should handle gracefully or throw appropriate errors
      expect(() => validateQuestionData(questionWithNulls as any)).toThrow();
    });

    it('should validate special characters in text fields', () => {
      const questionWithSpecialChars = {
        ...mockQuestionFormData,
        title: 'How was your café experience? 🤔',
        description: 'Please rate 1-5 stars ⭐️',
        tags: ['café', 'experience', 'feedback'],
      };

      expect(() => validateQuestionData(questionWithSpecialChars)).not.toThrow();
    });

    it('should handle very long but valid data', () => {
      const questionWithLongValidData = {
        ...mockQuestionFormData,
        title: 'a'.repeat(200), // Exactly at limit
        description: 'b'.repeat(1000), // Exactly at limit
        tags: Array(20).fill('tag'), // Exactly at limit
      };

      expect(() => validateQuestionData(questionWithLongValidData)).not.toThrow();
    });
  });
});