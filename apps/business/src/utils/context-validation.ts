import { z } from 'zod';
import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  OperatingHours
} from '@vocilia/types/src/context';

// Validation severity levels
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  isValid: boolean;
  severity: ValidationSeverity;
  field?: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ContextValidationReport {
  isValid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  score: number; // 0-100
  completeness: {
    profile: number;
    personnel: number;
    layout: number;
    inventory: number;
    overall: number;
  };
}

// Enhanced validation schemas with custom error messages
const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const websiteRegex = /^https?:\/\/.+\..+/;
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const operatingHoursSchema = z.object({
  day: z.number().min(0).max(6),
  open: z.string().regex(timeRegex, 'Time must be in HH:MM format'),
  close: z.string().regex(timeRegex, 'Time must be in HH:MM format'),
  is_closed: z.boolean(),
}).refine((data) => {
  if (!data.is_closed) {
    const [openHour, openMin] = data.open.split(':').map(Number);
    const [closeHour, closeMin] = data.close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    return openTime < closeTime;
  }
  return true;
}, {
  message: 'Opening time must be before closing time',
  path: ['time_validation'],
});

const storeProfileSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  store_name: z.string().min(2, 'Store name must be at least 2 characters').max(100),
  store_type: z.string().min(1, 'Store type is required'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  address: z.string().min(10, 'Address should be at least 10 characters').max(200),
  phone: z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
  email: z.string().regex(emailRegex, 'Invalid email format').optional(),
  website: z.string().regex(websiteRegex, 'Website must be a valid URL').optional(),
  operating_hours: z.array(operatingHoursSchema).min(1, 'At least one day of operating hours required'),
  size_sqft: z.number().positive('Store size must be positive').optional(),
  capacity: z.number().positive('Capacity must be positive').optional(),
  target_demographics: z.string().max(300).optional(),
  business_model: z.string().max(200).optional(),
  key_differentiators: z.string().max(300).optional(),
});

const personnelSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.string().min(2, 'Role must be at least 2 characters').max(50),
  department: z.string().min(2, 'Department must be at least 2 characters').max(50),
  shift: z.string().min(1, 'Shift is required'),
  responsibilities: z.array(z.string()).min(1, 'At least one responsibility required'),
  is_active: z.boolean(),
  start_date: z.string().datetime('Invalid start date format'),
  end_date: z.string().datetime('Invalid end date format').optional(),
}).refine((data) => {
  if (data.end_date && data.start_date) {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['date_validation'],
});

const layoutSchema = z.object({
  name: z.string().min(2, 'Layout name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  dimensions: z.object({
    width: z.number().positive('Width must be positive'),
    height: z.number().positive('Height must be positive'),
    unit: z.enum(['meters', 'feet']),
  }),
  departments: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1, 'Department name is required'),
    position: z.object({
      x: z.number().min(0, 'X position cannot be negative'),
      y: z.number().min(0, 'Y position cannot be negative'),
      width: z.number().positive('Width must be positive'),
      height: z.number().positive('Height must be positive'),
    }),
  })).min(1, 'At least one department required'),
  is_active: z.boolean(),
});

const inventorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(100),
  category: z.string().min(2, 'Category must be at least 2 characters').max(50),
  subcategories: z.array(z.string()).min(1, 'At least one subcategory required'),
  attributes: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
});

export class ContextValidator {
  /**
   * Validate store profile data
   */
  static validateStoreProfile(data: Partial<StoreContextProfile>): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    try {
      storeProfileSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          results.push({
            isValid: false,
            severity: 'error',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            suggestion: this.getSuggestionForField(err.path.join('.'), err.code),
          });
        });
      }
    }

    // Additional business logic validation
    results.push(...this.validateBusinessLogic(data));
    
    return results;
  }

  /**
   * Validate personnel data
   */
  static validatePersonnel(data: Partial<StoreContextPersonnel>): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    try {
      personnelSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          results.push({
            isValid: false,
            severity: 'error',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            suggestion: this.getSuggestionForField(err.path.join('.'), err.code),
          });
        });
      }
    }

    return results;
  }

  /**
   * Validate layout data
   */
  static validateLayout(data: Partial<StoreContextLayout>): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    try {
      layoutSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          results.push({
            isValid: false,
            severity: 'error',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            suggestion: this.getSuggestionForField(err.path.join('.'), err.code),
          });
        });
      }
    }

    // Validate department overlaps
    if (data.departments && data.departments.length > 1) {
      results.push(...this.validateDepartmentOverlaps(data.departments));
    }

    // Validate departments fit within layout dimensions
    if (data.departments && data.dimensions) {
      results.push(...this.validateDepartmentBounds(data.departments, data.dimensions));
    }

    return results;
  }

  /**
   * Validate inventory data
   */
  static validateInventory(data: Partial<StoreContextInventory>): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    try {
      inventorySchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          results.push({
            isValid: false,
            severity: 'error',
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            suggestion: this.getSuggestionForField(err.path.join('.'), err.code),
          });
        });
      }
    }

    return results;
  }

  /**
   * Generate comprehensive validation report
   */
  static generateValidationReport(contextData: {
    profile?: Partial<StoreContextProfile>;
    personnel?: Partial<StoreContextPersonnel>[];
    layouts?: Partial<StoreContextLayout>[];
    inventory?: Partial<StoreContextInventory>[];
  }): ContextValidationReport {
    const allResults: ValidationResult[] = [];

    // Validate each section
    if (contextData.profile) {
      allResults.push(...this.validateStoreProfile(contextData.profile));
    }

    if (contextData.personnel) {
      contextData.personnel.forEach((person, index) => {
        const results = this.validatePersonnel(person);
        results.forEach(result => {
          result.field = `personnel[${index}].${result.field}`;
        });
        allResults.push(...results);
      });
    }

    if (contextData.layouts) {
      contextData.layouts.forEach((layout, index) => {
        const results = this.validateLayout(layout);
        results.forEach(result => {
          result.field = `layouts[${index}].${result.field}`;
        });
        allResults.push(...results);
      });
    }

    if (contextData.inventory) {
      contextData.inventory.forEach((item, index) => {
        const results = this.validateInventory(item);
        results.forEach(result => {
          result.field = `inventory[${index}].${result.field}`;
        });
        allResults.push(...results);
      });
    }

    // Calculate completeness scores
    const completeness = this.calculateCompleteness(contextData);

    // Categorize results
    const errors = allResults.filter(r => r.severity === 'error');
    const warnings = allResults.filter(r => r.severity === 'warning');
    const infos = allResults.filter(r => r.severity === 'info');

    // Calculate overall score
    const score = this.calculateValidationScore(errors, warnings, infos, completeness);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      infos,
      score,
      completeness,
    };
  }

  /**
   * Additional business logic validation
   */
  private static validateBusinessLogic(data: Partial<StoreContextProfile>): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check operating hours coverage
    if (data.operating_hours) {
      const hasWeekendHours = data.operating_hours.some(h => 
        (h.day === 0 || h.day === 6) && !h.is_closed
      );
      
      if (!hasWeekendHours) {
        results.push({
          isValid: true,
          severity: 'info',
          field: 'operating_hours',
          message: 'Consider adding weekend operating hours to increase customer accessibility',
          code: 'weekend_hours_recommendation',
          suggestion: 'Weekend hours can significantly increase customer engagement',
        });
      }

      // Check for reasonable hours (not too early/late)
      const unusualHours = data.operating_hours.filter(h => {
        if (h.is_closed) return false;
        const [openHour] = h.open.split(':').map(Number);
        const [closeHour] = h.close.split(':').map(Number);
        return openHour < 6 || closeHour > 23;
      });

      if (unusualHours.length > 0) {
        results.push({
          isValid: true,
          severity: 'warning',
          field: 'operating_hours',
          message: 'Some operating hours appear unusual (very early opening or very late closing)',
          code: 'unusual_hours_warning',
          suggestion: 'Verify these hours are correct as they may affect customer expectations',
        });
      }
    }

    // Check contact information completeness
    if (!data.phone && !data.email) {
      results.push({
        isValid: false,
        severity: 'warning',
        field: 'contact_info',
        message: 'Either phone number or email should be provided for customer contact',
        code: 'missing_contact_info',
        suggestion: 'Add at least one contact method to improve customer service',
      });
    }

    // Check size and capacity ratio
    if (data.size_sqft && data.capacity) {
      const sqftPerPerson = data.size_sqft / data.capacity;
      if (sqftPerPerson < 10) {
        results.push({
          isValid: true,
          severity: 'warning',
          field: 'capacity',
          message: 'Capacity seems high relative to store size (less than 10 sq ft per person)',
          code: 'high_density_warning',
          suggestion: 'Consider if this capacity is realistic for customer comfort and safety',
        });
      } else if (sqftPerPerson > 100) {
        results.push({
          isValid: true,
          severity: 'info',
          field: 'capacity',
          message: 'Large amount of space per customer - consider if capacity could be higher',
          code: 'low_density_info',
          suggestion: 'You might be able to accommodate more customers comfortably',
        });
      }
    }

    return results;
  }

  /**
   * Validate department overlaps in layout
   */
  private static validateDepartmentOverlaps(departments: any[]): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (let i = 0; i < departments.length; i++) {
      for (let j = i + 1; j < departments.length; j++) {
        const dept1 = departments[i];
        const dept2 = departments[j];

        if (this.doRectanglesOverlap(dept1.position, dept2.position)) {
          results.push({
            isValid: false,
            severity: 'error',
            field: `departments`,
            message: `Departments "${dept1.name}" and "${dept2.name}" overlap`,
            code: 'department_overlap',
            suggestion: 'Adjust department positions to eliminate overlaps',
          });
        }
      }
    }

    return results;
  }

  /**
   * Validate departments fit within layout bounds
   */
  private static validateDepartmentBounds(departments: any[], dimensions: any): ValidationResult[] {
    const results: ValidationResult[] = [];

    departments.forEach((dept, index) => {
      const { x, y, width, height } = dept.position;
      
      if (x + width > dimensions.width || y + height > dimensions.height) {
        results.push({
          isValid: false,
          severity: 'error',
          field: `departments[${index}].position`,
          message: `Department "${dept.name}" extends beyond layout boundaries`,
          code: 'department_out_of_bounds',
          suggestion: 'Resize or reposition the department to fit within the layout',
        });
      }
    });

    return results;
  }

  /**
   * Check if two rectangles overlap
   */
  private static doRectanglesOverlap(rect1: any, rect2: any): boolean {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    );
  }

  /**
   * Calculate completeness scores
   */
  private static calculateCompleteness(contextData: any): ContextValidationReport['completeness'] {
    const profileScore = this.calculateProfileCompleteness(contextData.profile);
    const personnelScore = this.calculatePersonnelCompleteness(contextData.personnel);
    const layoutScore = this.calculateLayoutCompleteness(contextData.layouts);
    const inventoryScore = this.calculateInventoryCompleteness(contextData.inventory);

    const overall = (profileScore + personnelScore + layoutScore + inventoryScore) / 4;

    return {
      profile: profileScore,
      personnel: personnelScore,
      layout: layoutScore,
      inventory: inventoryScore,
      overall,
    };
  }

  private static calculateProfileCompleteness(profile: any): number {
    if (!profile) return 0;
    
    const requiredFields = ['business_name', 'store_name', 'store_type', 'address'];
    const optionalFields = ['description', 'phone', 'email', 'website', 'size_sqft', 'capacity'];
    
    const requiredScore = requiredFields.reduce((score, field) => {
      return score + (profile[field] ? 20 : 0);
    }, 0);
    
    const optionalScore = optionalFields.reduce((score, field) => {
      return score + (profile[field] ? 3.33 : 0);
    }, 0);

    return Math.min(100, requiredScore + optionalScore);
  }

  private static calculatePersonnelCompleteness(personnel: any[]): number {
    if (!personnel || personnel.length === 0) return 0;
    
    // Basic completion if any personnel exist
    let score = 40;
    
    // Additional points for having multiple roles
    const uniqueRoles = new Set(personnel.map(p => p.role));
    score += Math.min(30, uniqueRoles.size * 10);
    
    // Points for active personnel
    const activePersonnel = personnel.filter(p => p.is_active);
    score += Math.min(30, (activePersonnel.length / personnel.length) * 30);

    return Math.min(100, score);
  }

  private static calculateLayoutCompleteness(layouts: any[]): number {
    if (!layouts || layouts.length === 0) return 0;
    
    // Basic completion for having a layout
    let score = 50;
    
    // Active layout
    const hasActiveLayout = layouts.some(l => l.is_active);
    if (hasActiveLayout) score += 25;
    
    // Layout with departments
    const layoutsWithDepts = layouts.filter(l => l.departments && l.departments.length > 0);
    score += Math.min(25, (layoutsWithDepts.length / layouts.length) * 25);

    return Math.min(100, score);
  }

  private static calculateInventoryCompleteness(inventory: any[]): number {
    if (!inventory || inventory.length === 0) return 0;
    
    // Basic completion for having inventory categories
    let score = 30;
    
    // Points for multiple categories
    score += Math.min(40, inventory.length * 10);
    
    // Points for active categories
    const activeCategories = inventory.filter(i => i.is_active);
    score += Math.min(30, (activeCategories.length / inventory.length) * 30);

    return Math.min(100, score);
  }

  /**
   * Calculate overall validation score
   */
  private static calculateValidationScore(
    errors: ValidationResult[], 
    warnings: ValidationResult[], 
    infos: ValidationResult[],
    completeness: ContextValidationReport['completeness']
  ): number {
    let score = 100;
    
    // Deduct for errors (severe penalty)
    score -= errors.length * 15;
    
    // Deduct for warnings (moderate penalty)
    score -= warnings.length * 5;
    
    // Factor in completeness (weighted average)
    const completenessScore = completeness.overall;
    score = (score * 0.7) + (completenessScore * 0.3);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get suggestion for specific field validation errors
   */
  private static getSuggestionForField(field: string, code: string): string {
    const suggestions: Record<string, string> = {
      'business_name': 'Use your official business name as registered',
      'store_name': 'Use a clear, descriptive name for this store location',
      'phone': 'Include country code for international numbers (e.g., +1-555-123-4567)',
      'email': 'Use a business email address that customers can contact',
      'website': 'Include the full URL starting with https:// or http://',
      'address': 'Provide a complete address including street, city, state/province',
      'operating_hours': 'Use 24-hour format (HH:MM) for consistency',
      'size_sqft': 'Measure the customer-accessible floor space',
      'capacity': 'Consider fire safety limits and customer comfort',
      'responsibilities': 'List specific duties and tasks for this role',
      'dimensions': 'Measure the total layout area accurately',
      'departments': 'Ensure departments represent distinct areas of your store',
    };

    return suggestions[field] || 'Please review the field requirements and try again';
  }
}

export default ContextValidator;