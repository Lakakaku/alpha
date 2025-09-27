import { CustomQuestion, QuestionCategory, QuestionTrigger } from '@vocilia/types';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface QuestionFormData {
  title: string;
  content: string;
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no';
  categoryId: string;
  priority: number;
  isRequired: boolean;
  maxLength?: number;
  options?: string[];
  ratingScale?: number;
  validFrom?: Date;
  validUntil?: Date;
  frequency: {
    window: 'hourly' | 'daily' | 'weekly';
    maxPresentations: number;
    cooldownMinutes: number;
  };
  triggers: QuestionTrigger[];
  tags: string[];
  isActive: boolean;
}

export interface ValidationOptions {
  categories: QuestionCategory[];
  existingQuestions?: CustomQuestion[];
  mode?: 'create' | 'update';
  currentQuestionId?: string;
}

// Field validators
export const validators = {
  required: (value: any, fieldName: string): ValidationError | null => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return {
        field: fieldName,
        message: `${fieldName} is required`,
        code: 'REQUIRED',
      };
    }
    return null;
  },

  minLength: (value: string, min: number, fieldName: string): ValidationError | null => {
    if (value && value.length < min) {
      return {
        field: fieldName,
        message: `${fieldName} must be at least ${min} characters`,
        code: 'MIN_LENGTH',
      };
    }
    return null;
  },

  maxLength: (value: string, max: number, fieldName: string): ValidationError | null => {
    if (value && value.length > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be ${max} characters or less`,
        code: 'MAX_LENGTH',
      };
    }
    return null;
  },

  range: (value: number, min: number, max: number, fieldName: string): ValidationError | null => {
    if (value < min || value > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be between ${min} and ${max}`,
        code: 'OUT_OF_RANGE',
      };
    }
    return null;
  },

  hexColor: (value: string, fieldName: string): ValidationError | null => {
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (value && !hexRegex.test(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a valid hex color code (e.g., #3B82F6)`,
        code: 'INVALID_HEX_COLOR',
      };
    }
    return null;
  },

  dateRange: (startDate: Date | undefined, endDate: Date | undefined): ValidationError | null => {
    if (startDate && endDate && startDate >= endDate) {
      return {
        field: 'validUntil',
        message: 'End date must be after start date',
        code: 'INVALID_DATE_RANGE',
      };
    }
    return null;
  },

  uniqueArray: (array: string[], fieldName: string): ValidationError | null => {
    const uniqueItems = new Set(array);
    if (uniqueItems.size !== array.length) {
      return {
        field: fieldName,
        message: `${fieldName} contains duplicate items`,
        code: 'DUPLICATE_ITEMS',
      };
    }
    return null;
  },

  url: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      try {
        new URL(value);
      } catch {
        return {
          field: fieldName,
          message: `${fieldName} must be a valid URL`,
          code: 'INVALID_URL',
        };
      }
    }
    return null;
  },
};

// Specific question field validators
export const questionValidators = {
  validateBasicInfo: (data: QuestionFormData, options: ValidationOptions): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Title validation
    const titleError = validators.required(data.title, 'title');
    if (titleError) errors.push(titleError);
    else {
      const titleLengthError = validators.maxLength(data.title, 100, 'title');
      if (titleLengthError) errors.push(titleLengthError);
    }

    // Content validation
    const contentError = validators.required(data.content, 'content');
    if (contentError) errors.push(contentError);
    else {
      const contentLengthError = validators.maxLength(data.content, 1000, 'content');
      if (contentLengthError) errors.push(contentLengthError);
    }

    // Category validation
    const categoryError = validators.required(data.categoryId, 'category');
    if (categoryError) errors.push(categoryError);
    else if (!options.categories.find(cat => cat.id === data.categoryId)) {
      errors.push({
        field: 'categoryId',
        message: 'Selected category does not exist',
        code: 'INVALID_CATEGORY',
      });
    }

    // Priority validation
    const priorityError = validators.range(data.priority, 1, 10, 'priority');
    if (priorityError) errors.push(priorityError);

    return errors;
  },

  validateQuestionType: (data: QuestionFormData): ValidationError[] => {
    const errors: ValidationError[] = [];

    switch (data.type) {
      case 'multiple_choice':
        if (!data.options || data.options.length < 2) {
          errors.push({
            field: 'options',
            message: 'Multiple choice questions need at least 2 options',
            code: 'INSUFFICIENT_OPTIONS',
          });
        } else if (data.options.length > 10) {
          errors.push({
            field: 'options',
            message: 'Multiple choice questions can have at most 10 options',
            code: 'TOO_MANY_OPTIONS',
          });
        } else {
          const uniqueError = validators.uniqueArray(data.options, 'options');
          if (uniqueError) errors.push(uniqueError);

          // Check for empty options
          if (data.options.some(option => !option.trim())) {
            errors.push({
              field: 'options',
              message: 'All options must have content',
              code: 'EMPTY_OPTION',
            });
          }

          // Check option length
          data.options.forEach((option, index) => {
            const lengthError = validators.maxLength(option, 200, `option ${index + 1}`);
            if (lengthError) errors.push(lengthError);
          });
        }
        break;

      case 'rating':
        if (!data.ratingScale || data.ratingScale < 2 || data.ratingScale > 10) {
          errors.push({
            field: 'ratingScale',
            message: 'Rating scale must be between 2 and 10',
            code: 'INVALID_RATING_SCALE',
          });
        }
        break;

      case 'text':
        if (data.maxLength && data.maxLength < 1) {
          errors.push({
            field: 'maxLength',
            message: 'Maximum length must be positive',
            code: 'INVALID_MAX_LENGTH',
          });
        } else if (data.maxLength && data.maxLength > 10000) {
          errors.push({
            field: 'maxLength',
            message: 'Maximum length cannot exceed 10,000 characters',
            code: 'MAX_LENGTH_TOO_LARGE',
          });
        }
        break;

      case 'yes_no':
        // No specific validation needed for yes/no questions
        break;

      default:
        errors.push({
          field: 'type',
          message: 'Invalid question type',
          code: 'INVALID_TYPE',
        });
    }

    return errors;
  },

  validateFrequency: (data: QuestionFormData): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (data.frequency.maxPresentations < 1) {
      errors.push({
        field: 'frequency.maxPresentations',
        message: 'Maximum presentations must be at least 1',
        code: 'INVALID_MAX_PRESENTATIONS',
      });
    } else if (data.frequency.maxPresentations > 100) {
      errors.push({
        field: 'frequency.maxPresentations',
        message: 'Maximum presentations cannot exceed 100',
        code: 'MAX_PRESENTATIONS_TOO_HIGH',
      });
    }

    if (data.frequency.cooldownMinutes < 0) {
      errors.push({
        field: 'frequency.cooldownMinutes',
        message: 'Cooldown cannot be negative',
        code: 'NEGATIVE_COOLDOWN',
      });
    } else if (data.frequency.cooldownMinutes > 10080) { // 1 week in minutes
      errors.push({
        field: 'frequency.cooldownMinutes',
        message: 'Cooldown cannot exceed 1 week (10,080 minutes)',
        code: 'COOLDOWN_TOO_LONG',
      });
    }

    // Validate date range
    const dateError = validators.dateRange(data.validFrom, data.validUntil);
    if (dateError) errors.push(dateError);

    // Check if dates are in the past
    const now = new Date();
    if (data.validUntil && data.validUntil < now) {
      errors.push({
        field: 'validUntil',
        message: 'End date cannot be in the past',
        code: 'PAST_END_DATE',
      });
    }

    return errors;
  },

  validateTriggers: (data: QuestionFormData): ValidationError[] => {
    const errors: ValidationError[] = [];

    data.triggers.forEach((trigger, index) => {
      const triggerPrefix = `triggers[${index}]`;

      // Check if trigger has conditions
      const conditionCount = Object.keys(trigger.conditions).length;
      if (trigger.isActive && conditionCount === 0) {
        errors.push({
          field: `${triggerPrefix}.conditions`,
          message: `Active trigger ${index + 1} must have at least one condition`,
          code: 'MISSING_TRIGGER_CONDITIONS',
        });
      }

      // Validate individual conditions
      Object.entries(trigger.conditions).forEach(([conditionId, condition], conditionIndex) => {
        const conditionPrefix = `${triggerPrefix}.conditions[${conditionIndex}]`;

        if (!condition.field) {
          errors.push({
            field: `${conditionPrefix}.field`,
            message: `Condition ${conditionIndex + 1} in trigger ${index + 1} must have a field`,
            code: 'MISSING_CONDITION_FIELD',
          });
        }

        if (!condition.operator) {
          errors.push({
            field: `${conditionPrefix}.operator`,
            message: `Condition ${conditionIndex + 1} in trigger ${index + 1} must have an operator`,
            code: 'MISSING_CONDITION_OPERATOR',
          });
        }

        if (condition.valueType === 'number' && isNaN(Number(condition.value))) {
          errors.push({
            field: `${conditionPrefix}.value`,
            message: `Condition ${conditionIndex + 1} in trigger ${index + 1} must have a valid number`,
            code: 'INVALID_NUMBER_VALUE',
          });
        }

        if (condition.valueType === 'datetime' && condition.value && isNaN(Date.parse(String(condition.value)))) {
          errors.push({
            field: `${conditionPrefix}.value`,
            message: `Condition ${conditionIndex + 1} in trigger ${index + 1} must have a valid date`,
            code: 'INVALID_DATE_VALUE',
          });
        }
      });
    });

    return errors;
  },

  validateTags: (data: QuestionFormData): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (data.tags.length > 20) {
      errors.push({
        field: 'tags',
        message: 'Cannot have more than 20 tags',
        code: 'TOO_MANY_TAGS',
      });
    }

    const uniqueError = validators.uniqueArray(data.tags, 'tags');
    if (uniqueError) errors.push(uniqueError);

    data.tags.forEach((tag, index) => {
      if (!tag.trim()) {
        errors.push({
          field: 'tags',
          message: 'Tags cannot be empty',
          code: 'EMPTY_TAG',
        });
      } else if (tag.length > 50) {
        errors.push({
          field: 'tags',
          message: `Tag "${tag}" is too long (max 50 characters)`,
          code: 'TAG_TOO_LONG',
        });
      } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) {
        errors.push({
          field: 'tags',
          message: `Tag "${tag}" contains invalid characters`,
          code: 'INVALID_TAG_CHARACTERS',
        });
      }
    });

    return errors;
  },
};

// Main validation function
export function validateQuestion(data: QuestionFormData, options: ValidationOptions): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Run all validations
  errors.push(...questionValidators.validateBasicInfo(data, options));
  errors.push(...questionValidators.validateQuestionType(data));
  errors.push(...questionValidators.validateFrequency(data));
  errors.push(...questionValidators.validateTriggers(data));
  errors.push(...questionValidators.validateTags(data));

  // Check for warnings
  if (data.triggers.length === 0) {
    warnings.push({
      field: 'triggers',
      message: 'Question has no triggers. It will be available based on frequency settings only.',
      code: 'NO_TRIGGERS',
    });
  }

  if (data.priority < 3) {
    warnings.push({
      field: 'priority',
      message: 'Low priority questions may be presented less frequently.',
      code: 'LOW_PRIORITY',
    });
  }

  if (data.frequency.maxPresentations > 5 && data.frequency.window === 'hourly') {
    warnings.push({
      field: 'frequency',
      message: 'High frequency hourly presentations may overwhelm customers.',
      code: 'HIGH_FREQUENCY',
    });
  }

  if (data.type === 'multiple_choice' && data.options && data.options.length > 6) {
    warnings.push({
      field: 'options',
      message: 'Many options may reduce response rates.',
      code: 'MANY_OPTIONS',
    });
  }

  if (data.content.length > 500) {
    warnings.push({
      field: 'content',
      message: 'Long questions may reduce completion rates.',
      code: 'LONG_CONTENT',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Category validation
export function validateCategory(category: {
  name: string;
  description?: string;
  color: string;
}, existingCategories: QuestionCategory[], currentCategoryId?: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Name validation
  const nameError = validators.required(category.name, 'name');
  if (nameError) {
    errors.push(nameError);
  } else {
    const nameLengthError = validators.maxLength(category.name, 50, 'name');
    if (nameLengthError) errors.push(nameLengthError);

    // Check for duplicate names
    const isDuplicate = existingCategories.some(cat => 
      cat.name.toLowerCase() === category.name.toLowerCase() &&
      cat.id !== currentCategoryId
    );
    
    if (isDuplicate) {
      errors.push({
        field: 'name',
        message: 'A category with this name already exists',
        code: 'DUPLICATE_NAME',
      });
    }
  }

  // Description validation
  if (category.description) {
    const descLengthError = validators.maxLength(category.description, 200, 'description');
    if (descLengthError) errors.push(descLengthError);
  }

  // Color validation
  const colorError = validators.hexColor(category.color, 'color');
  if (colorError) errors.push(colorError);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Utility functions
export function getFieldErrors(validationResult: ValidationResult, fieldName: string): ValidationError[] {
  return validationResult.errors.filter(error => 
    error.field === fieldName || error.field.startsWith(`${fieldName}.`)
  );
}

export function getFieldWarnings(validationResult: ValidationResult, fieldName: string): ValidationError[] {
  return validationResult.warnings.filter(warning => 
    warning.field === fieldName || warning.field.startsWith(`${fieldName}.`)
  );
}

export function hasFieldError(validationResult: ValidationResult, fieldName: string): boolean {
  return getFieldErrors(validationResult, fieldName).length > 0;
}

export function getFirstFieldError(validationResult: ValidationResult, fieldName: string): string | null {
  const errors = getFieldErrors(validationResult, fieldName);
  return errors.length > 0 ? errors[0].message : null;
}

// Real-time validation helpers
export function validateFieldOnChange(
  fieldName: string,
  value: any,
  formData: QuestionFormData,
  options: ValidationOptions
): ValidationError[] {
  const partialData = { ...formData, [fieldName]: value };
  const result = validateQuestion(partialData, options);
  return getFieldErrors(result, fieldName);
}

export function validateFormSection(
  section: 'basic' | 'type' | 'frequency' | 'triggers' | 'tags',
  formData: QuestionFormData,
  options: ValidationOptions
): ValidationError[] {
  switch (section) {
    case 'basic':
      return questionValidators.validateBasicInfo(formData, options);
    case 'type':
      return questionValidators.validateQuestionType(formData);
    case 'frequency':
      return questionValidators.validateFrequency(formData);
    case 'triggers':
      return questionValidators.validateTriggers(formData);
    case 'tags':
      return questionValidators.validateTags(formData);
    default:
      return [];
  }
}