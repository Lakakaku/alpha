// Layout context database service for business context window feature

import { createClient } from '@supabase/supabase-js';
import { 
  StoreLayout,
  CreateStoreLayoutRequest,
  UpdateStoreLayoutRequest,
  Department,
  CreateDepartmentRequest,
  SeasonalVariation,
  CreateSeasonalVariationRequest,
  DepartmentCategory,
  LayoutType
} from '@vocilia/types/context/layout';

export class LayoutsService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  // Store Layout Operations
  async getStoreLayout(storeId: string): Promise<StoreLayout | null> {
    const { data, error } = await this.supabase
      .from('store_context_layouts')
      .select(`
        *,
        departments:store_layout_departments(*),
        seasonal_variations:store_layout_seasonal_variations(*)
      `)
      .eq('store_id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get store layout: ${error.message}`);
    }

    return {
      ...data,
      departments: data.departments || [],
      seasonal_variations: data.seasonal_variations || []
    };
  }

  async createStoreLayout(
    storeId: string,
    layoutData: CreateStoreLayoutRequest
  ): Promise<StoreLayout> {
    const { departments, seasonal_variations, ...layoutInfo } = layoutData;

    // Create layout first
    const { data: layout, error: layoutError } = await this.supabase
      .from('store_context_layouts')
      .insert({
        store_id: storeId,
        ...layoutInfo
      })
      .select()
      .single();

    if (layoutError) {
      throw new Error(`Failed to create store layout: ${layoutError.message}`);
    }

    // Create departments
    let createdDepartments: Department[] = [];
    if (departments && departments.length > 0) {
      createdDepartments = await this.createDepartments(layout.id, departments);
    }

    // Create seasonal variations
    let createdSeasonalVariations: SeasonalVariation[] = [];
    if (seasonal_variations && seasonal_variations.length > 0) {
      createdSeasonalVariations = await this.createSeasonalVariations(
        layout.id, 
        seasonal_variations
      );
    }

    return {
      ...layout,
      departments: createdDepartments,
      seasonal_variations: createdSeasonalVariations
    };
  }

  async updateStoreLayout(
    storeId: string,
    updates: UpdateStoreLayoutRequest
  ): Promise<StoreLayout> {
    const { version, departments, seasonal_variations, ...layoutUpdates } = updates;

    // Update layout with version check
    const { data: layout, error: layoutError } = await this.supabase
      .from('store_context_layouts')
      .update({
        ...layoutUpdates,
        version: version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .eq('version', version)
      .select()
      .single();

    if (layoutError) {
      if (layoutError.code === 'PGRST116') {
        throw new Error('Layout version conflict. Please refresh and try again.');
      }
      throw new Error(`Failed to update store layout: ${layoutError.message}`);
    }

    // Update departments if provided
    let updatedDepartments: Department[] = [];
    if (departments !== undefined) {
      if (departments.length === 0) {
        await this.deleteDepartments(layout.id);
      } else {
        await this.deleteDepartments(layout.id);
        updatedDepartments = await this.createDepartments(layout.id, departments);
      }
    } else {
      updatedDepartments = await this.getDepartments(layout.id);
    }

    // Update seasonal variations if provided
    let updatedSeasonalVariations: SeasonalVariation[] = [];
    if (seasonal_variations !== undefined) {
      if (seasonal_variations.length === 0) {
        await this.deleteSeasonalVariations(layout.id);
      } else {
        await this.deleteSeasonalVariations(layout.id);
        updatedSeasonalVariations = await this.createSeasonalVariations(
          layout.id, 
          seasonal_variations
        );
      }
    } else {
      updatedSeasonalVariations = await this.getSeasonalVariations(layout.id);
    }

    return {
      ...layout,
      departments: updatedDepartments,
      seasonal_variations: updatedSeasonalVariations
    };
  }

  async deleteStoreLayout(storeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_context_layouts')
      .delete()
      .eq('store_id', storeId);

    if (error) {
      throw new Error(`Failed to delete store layout: ${error.message}`);
    }
  }

  // Department Operations
  async getDepartments(layoutId: string): Promise<Department[]> {
    const { data, error } = await this.supabase
      .from('store_layout_departments')
      .select('*')
      .eq('layout_id', layoutId)
      .order('created_at');

    if (error) {
      throw new Error(`Failed to get departments: ${error.message}`);
    }

    return data || [];
  }

  async createDepartments(
    layoutId: string,
    departmentsData: CreateDepartmentRequest[]
  ): Promise<Department[]> {
    const departmentsToInsert = departmentsData.map(dept => ({
      layout_id: layoutId,
      ...dept
    }));

    const { data, error } = await this.supabase
      .from('store_layout_departments')
      .insert(departmentsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to create departments: ${error.message}`);
    }

    return data;
  }

  async updateDepartment(
    departmentId: string,
    updates: Partial<CreateDepartmentRequest>
  ): Promise<Department> {
    const { data, error } = await this.supabase
      .from('store_layout_departments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', departmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update department: ${error.message}`);
    }

    return data;
  }

  async deleteDepartments(layoutId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_layout_departments')
      .delete()
      .eq('layout_id', layoutId);

    if (error) {
      throw new Error(`Failed to delete departments: ${error.message}`);
    }
  }

  async deleteDepartment(departmentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_layout_departments')
      .delete()
      .eq('id', departmentId);

    if (error) {
      throw new Error(`Failed to delete department: ${error.message}`);
    }
  }

  // Seasonal Variations Operations
  async getSeasonalVariations(layoutId: string): Promise<SeasonalVariation[]> {
    const { data, error } = await this.supabase
      .from('store_layout_seasonal_variations')
      .select('*')
      .eq('layout_id', layoutId)
      .order('start_date');

    if (error) {
      throw new Error(`Failed to get seasonal variations: ${error.message}`);
    }

    return data || [];
  }

  async createSeasonalVariations(
    layoutId: string,
    variationsData: CreateSeasonalVariationRequest[]
  ): Promise<SeasonalVariation[]> {
    const variationsToInsert = variationsData.map(variation => ({
      layout_id: layoutId,
      ...variation
    }));

    const { data, error } = await this.supabase
      .from('store_layout_seasonal_variations')
      .insert(variationsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to create seasonal variations: ${error.message}`);
    }

    return data;
  }

  async deleteSeasonalVariations(layoutId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_layout_seasonal_variations')
      .delete()
      .eq('layout_id', layoutId);

    if (error) {
      throw new Error(`Failed to delete seasonal variations: ${error.message}`);
    }
  }

  async getCurrentSeasonalVariation(layoutId: string): Promise<SeasonalVariation | null> {
    const { data, error } = await this.supabase
      .rpc('get_current_seasonal_variation', { p_layout_id: layoutId })
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get current seasonal variation: ${error.message}`);
    }

    return data;
  }

  // Query and Analysis Functions
  async getDepartmentsByCategory(
    layoutId: string,
    category: DepartmentCategory
  ): Promise<Department[]> {
    const { data, error } = await this.supabase
      .from('store_layout_departments')
      .select('*')
      .eq('layout_id', layoutId)
      .eq('category', category);

    if (error) {
      throw new Error(`Failed to get departments by category: ${error.message}`);
    }

    return data || [];
  }

  async getLayoutStatistics(storeId: string): Promise<{
    totalSquareFootage: number;
    departmentCount: number;
    departmentsByCategory: Record<DepartmentCategory, number>;
    averageDepartmentSize: number;
    utilizationPercentage: number;
    hasSeasonalVariations: boolean;
    seasonalVariationCount: number;
  } | null> {
    const layout = await this.getStoreLayout(storeId);
    if (!layout) return null;

    const departments = layout.departments;
    const departmentsByCategory = {} as Record<DepartmentCategory, number>;
    
    Object.values(DepartmentCategory).forEach(category => {
      departmentsByCategory[category] = departments.filter(d => d.category === category).length;
    });

    const totalDepartmentSquareFootage = departments.reduce(
      (sum, dept) => sum + dept.square_footage, 
      0
    );

    const averageDepartmentSize = departments.length > 0 
      ? totalDepartmentSquareFootage / departments.length 
      : 0;

    const utilizationPercentage = layout.total_square_footage > 0
      ? (totalDepartmentSquareFootage / layout.total_square_footage) * 100
      : 0;

    return {
      totalSquareFootage: layout.total_square_footage,
      departmentCount: departments.length,
      departmentsByCategory,
      averageDepartmentSize,
      utilizationPercentage,
      hasSeasonalVariations: layout.seasonal_variations.length > 0,
      seasonalVariationCount: layout.seasonal_variations.length
    };
  }

  async validateLayoutData(layoutData: CreateStoreLayoutRequest | UpdateStoreLayoutRequest): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if ('name' in layoutData && layoutData.name) {
      if (layoutData.name.length < 2 || layoutData.name.length > 100) {
        errors.push('Layout name must be between 2 and 100 characters');
      }
    }

    // Validate total square footage
    if ('total_square_footage' in layoutData && layoutData.total_square_footage) {
      if (layoutData.total_square_footage < 50 || layoutData.total_square_footage > 1000000) {
        errors.push('Total square footage must be between 50 and 1,000,000');
      }
    }

    // Validate departments
    if ('departments' in layoutData && layoutData.departments) {
      if (layoutData.departments.length > 50) {
        errors.push('Maximum 50 departments allowed');
      }

      const totalDeptSquareFootage = layoutData.departments.reduce(
        (sum, dept) => sum + dept.square_footage, 
        0
      );

      if ('total_square_footage' in layoutData && layoutData.total_square_footage) {
        if (totalDeptSquareFootage > layoutData.total_square_footage) {
          errors.push('Total department square footage exceeds store total');
        } else if (totalDeptSquareFootage < layoutData.total_square_footage * 0.7) {
          warnings.push('Department coverage is less than 70% of total space');
        }
      }

      // Check for department positioning conflicts
      const positions = layoutData.departments.map(dept => dept.position);
      // TODO: Add overlap detection logic based on position coordinates

      // Validate adjacency preferences
      layoutData.departments.forEach((dept, index) => {
        if (dept.adjacency_preferences && dept.adjacency_preferences.length > 10) {
          errors.push(`Department ${index + 1}: Maximum 10 adjacency preferences allowed`);
        }
        if (dept.adjacency_restrictions && dept.adjacency_restrictions.length > 10) {
          errors.push(`Department ${index + 1}: Maximum 10 adjacency restrictions allowed`);
        }
      });
    }

    // Validate seasonal variations
    if ('seasonal_variations' in layoutData && layoutData.seasonal_variations) {
      layoutData.seasonal_variations.forEach((variation, index) => {
        if (variation.season_name.length < 2 || variation.season_name.length > 50) {
          errors.push(`Seasonal variation ${index + 1}: Name must be between 2 and 50 characters`);
        }
        if (variation.decoration_themes && variation.decoration_themes.length > 20) {
          errors.push(`Seasonal variation ${index + 1}: Maximum 20 decoration themes allowed`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Layout comparison and optimization
  async compareLayouts(
    layoutId1: string,
    layoutId2: string
  ): Promise<{
    differenceCount: number;
    departmentDifferences: Array<{
      type: 'added' | 'removed' | 'modified';
      department: string;
      details: string;
    }>;
    spaceUtilizationComparison: {
      layout1: number;
      layout2: number;
      difference: number;
    };
  }> {
    // This would be a complex comparison function
    // For now, return a placeholder structure
    return {
      differenceCount: 0,
      departmentDifferences: [],
      spaceUtilizationComparison: {
        layout1: 0,
        layout2: 0,
        difference: 0
      }
    };
  }

  // Batch operations
  async getMultipleStoreLayouts(storeIds: string[]): Promise<Record<string, StoreLayout | null>> {
    if (storeIds.length === 0) return {};

    const { data, error } = await this.supabase
      .from('store_context_layouts')
      .select(`
        *,
        departments:store_layout_departments(*),
        seasonal_variations:store_layout_seasonal_variations(*)
      `)
      .in('store_id', storeIds);

    if (error) {
      throw new Error(`Failed to get multiple store layouts: ${error.message}`);
    }

    const layoutMap: Record<string, StoreLayout | null> = {};
    storeIds.forEach(id => layoutMap[id] = null);

    (data || []).forEach(layout => {
      layoutMap[layout.store_id] = {
        ...layout,
        departments: layout.departments || [],
        seasonal_variations: layout.seasonal_variations || []
      };
    });

    return layoutMap;
  }

  async batchUpdateDepartmentPositions(
    updates: Array<{
      departmentId: string;
      position: Department['position'];
    }>
  ): Promise<void> {
    const updatePromises = updates.map(({ departmentId, position }) =>
      this.updateDepartment(departmentId, { position })
    );

    await Promise.all(updatePromises);
  }
}