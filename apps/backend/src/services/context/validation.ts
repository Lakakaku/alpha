import { z } from 'zod';
import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  OperatingHours,
  PersonnelShift,
  LayoutDepartment,
  InventoryCategory
} from '@vocilia/types/src/context';

/**
 * Context validation service for business context data
 * Provides comprehensive validation for all context entities
 */

// Store Profile Validation Schema
const OperatingHoursSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  close_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  is_closed: z.boolean(),
});

const StoreProfileSchema = z.object({
  business_name: z.string().min(1).max(255),
  store_name: z.string().min(1).max(255),
  store_type: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  address: z.string().min(1).max(500),
  phone: z.string().regex(/^\+?[\d\s\-\(\)\.]{10,20}$/).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  size_sqft: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  target_demographics: z.string().max(500).optional(),
  operating_hours: z.array(OperatingHoursSchema).length(7),
});

// Personnel Validation Schema
const PersonnelShiftSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  break_duration: z.number().int().min(0).max(480).optional(),
});

const PersonnelSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  seniority_level: z.enum(['entry', 'mid', 'senior', 'manager', 'director']),
  customer_interaction: z.enum(['none', 'minimal', 'moderate', 'high']),
  specializations: z.array(z.string()).optional(),
  shifts: z.array(PersonnelShiftSchema),
});

// Layout Validation Schema
const LayoutDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['retail', 'service', 'storage', 'office', 'dining', 'checkout', 'entrance', 'restroom', 'other']),
  x_position: z.number().min(0).max(100),
  y_position: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  description: z.string().max(300).optional(),
});

const LayoutSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  image_url: z.string().url().optional(),
  departments: z.array(LayoutDepartmentSchema),
  total_area_sqft: z.number().positive().optional(),
});

// Inventory Validation Schema
const InventoryCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parent_category: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  seasonal: z.boolean().optional(),
  target_margin: z.number().min(0).max(100).optional(),
});

const InventorySchema = z.object({
  categories: z.array(InventoryCategorySchema),
  seasonal_patterns: z.string().max(500).optional(),
  supplier_preferences: z.string().max(500).optional(),
  pricing_strategy: z.string().max(500).optional(),
});

/**
 * Validation service for context data
 */
export class ContextValidationService {
  /**
   * Validate store profile data
   */
  static validateStoreProfile(data: unknown): { isValid: boolean; errors: string[]; data?: StoreContextProfile } {
    try {
      const validated = StoreProfileSchema.parse(data);
      
      // Additional business logic validation
      const errors: string[] = [];
      
      // Validate operating hours consistency
      validated.operating_hours.forEach((hours, index) => {
        if (!hours.is_closed && hours.open_time >= hours.close_time) {
          errors.push(`Operating hours for day ${index}: open time must be before close time`);
        }
      });
      
      // Validate business hours coverage
      const openDays = validated.operating_hours.filter(h => !h.is_closed);
      if (openDays.length === 0) {
        errors.push('Store must be open at least one day per week');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? validated as StoreContextProfile : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        isValid: false,
        errors: ['Invalid data format']
      };
    }
  }

  /**
   * Validate personnel data
   */
  static validatePersonnel(data: unknown): { isValid: boolean; errors: string[]; data?: StoreContextPersonnel } {
    try {
      const validated = PersonnelSchema.parse(data);
      
      const errors: string[] = [];
      
      // Validate shift times
      validated.shifts.forEach((shift, index) => {
        if (shift.start_time >= shift.end_time) {
          errors.push(`Shift ${index}: start time must be before end time`);
        }
      });
      
      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? validated as StoreContextPersonnel : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        isValid: false,
        errors: ['Invalid data format']
      };
    }
  }

  /**
   * Validate layout data
   */
  static validateLayout(data: unknown): { isValid: boolean; errors: string[]; data?: StoreContextLayout } {
    try {
      const validated = LayoutSchema.parse(data);
      
      const errors: string[] = [];
      
      // Validate department positioning
      validated.departments.forEach((dept, index) => {
        // Check if department extends beyond boundaries
        if (dept.x_position + dept.width > 100) {
          errors.push(`Department ${index} (${dept.name}): extends beyond right boundary`);
        }
        if (dept.y_position + dept.height > 100) {
          errors.push(`Department ${index} (${dept.name}): extends beyond bottom boundary`);
        }
      });
      
      // Check for overlapping departments
      for (let i = 0; i < validated.departments.length; i++) {
        for (let j = i + 1; j < validated.departments.length; j++) {
          const dept1 = validated.departments[i];
          const dept2 = validated.departments[j];
          
          if (this.departmentsOverlap(dept1, dept2)) {
            errors.push(`Departments ${dept1.name} and ${dept2.name} overlap`);
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? validated as StoreContextLayout : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        isValid: false,
        errors: ['Invalid data format']
      };
    }
  }

  /**
   * Validate inventory data
   */
  static validateInventory(data: unknown): { isValid: boolean; errors: string[]; data?: StoreContextInventory } {
    try {
      const validated = InventorySchema.parse(data);
      
      const errors: string[] = [];
      
      // Validate category hierarchy
      const categoryNames = validated.categories.map(c => c.name);
      validated.categories.forEach((category, index) => {
        if (category.parent_category && !categoryNames.includes(category.parent_category)) {
          errors.push(`Category ${index} (${category.name}): parent category "${category.parent_category}" does not exist`);
        }
      });
      
      // Check for circular dependencies in category hierarchy
      if (this.hasCircularDependencies(validated.categories)) {
        errors.push('Circular dependencies detected in category hierarchy');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? validated as StoreContextInventory : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        isValid: false,
        errors: ['Invalid data format']
      };
    }
  }

  /**
   * Check if two departments overlap
   */
  private static departmentsOverlap(dept1: LayoutDepartment, dept2: LayoutDepartment): boolean {
    return !(
      dept1.x_position + dept1.width <= dept2.x_position ||
      dept2.x_position + dept2.width <= dept1.x_position ||
      dept1.y_position + dept1.height <= dept2.y_position ||
      dept2.y_position + dept2.height <= dept1.y_position
    );
  }

  /**
   * Check for circular dependencies in category hierarchy
   */
  private static hasCircularDependencies(categories: InventoryCategory[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (categoryName: string): boolean => {
      if (recursionStack.has(categoryName)) {
        return true;
      }
      if (visited.has(categoryName)) {
        return false;
      }
      
      visited.add(categoryName);
      recursionStack.add(categoryName);
      
      const category = categories.find(c => c.name === categoryName);
      if (category && category.parent_category) {
        if (hasCycle(category.parent_category)) {
          return true;
        }
      }
      
      recursionStack.delete(categoryName);
      return false;
    };
    
    for (const category of categories) {
      if (hasCycle(category.name)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate complete context data for a store
   */
  static validateCompleteContext(data: {
    profile?: unknown;
    personnel?: unknown[];
    layouts?: unknown[];
    inventory?: unknown;
  }): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate profile
    if (data.profile) {
      const profileValidation = this.validateStoreProfile(data.profile);
      if (!profileValidation.isValid) {
        errors.push(...profileValidation.errors.map(e => `Profile: ${e}`));
      }
    } else {
      warnings.push('Store profile is missing');
    }

    // Validate personnel
    if (data.personnel && data.personnel.length > 0) {
      data.personnel.forEach((person, index) => {
        const personnelValidation = this.validatePersonnel(person);
        if (!personnelValidation.isValid) {
          errors.push(...personnelValidation.errors.map(e => `Personnel[${index}]: ${e}`));
        }
      });
    } else {
      warnings.push('No personnel data provided');
    }

    // Validate layouts
    if (data.layouts && data.layouts.length > 0) {
      data.layouts.forEach((layout, index) => {
        const layoutValidation = this.validateLayout(layout);
        if (!layoutValidation.isValid) {
          errors.push(...layoutValidation.errors.map(e => `Layout[${index}]: ${e}`));
        }
      });
    } else {
      warnings.push('No layout data provided');
    }

    // Validate inventory
    if (data.inventory) {
      const inventoryValidation = this.validateInventory(data.inventory);
      if (!inventoryValidation.isValid) {
        errors.push(...inventoryValidation.errors.map(e => `Inventory: ${e}`));
      }
    } else {
      warnings.push('No inventory data provided');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}