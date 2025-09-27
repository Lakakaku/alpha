import { supabase } from '../client';
import type {
  StoreInventory,
  CreateStoreInventoryRequest,
  UpdateStoreInventoryRequest,
  InventoryCategory,
  CreateInventoryCategoryRequest,
  UpdateInventoryCategoryRequest,
  InventoryItem,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  SupplierRelationship,
  CreateSupplierRelationshipRequest,
  UpdateSupplierRelationshipRequest,
  CustomerPreference,
  CreateCustomerPreferenceRequest,
  UpdateCustomerPreferenceRequest,
  CompetitivePositioning,
  CreateCompetitivePositioningRequest,
  UpdateCompetitivePositioningRequest,
  InventoryQuality,
  PricingStrategy,
  SupplierReliability,
  CustomerDemand,
  SeasonalPattern,
  TrendInfluence
} from '@vocilia/types/context/inventory';

export class InventoryService {
  // Store Inventory Management
  async getStoreInventory(storeId: string): Promise<StoreInventory | null> {
    const { data, error } = await supabase
      .from('store_context_inventory')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get store inventory: ${error.message}`);
    }

    return data;
  }

  async createStoreInventory(storeId: string, inventoryData: CreateStoreInventoryRequest): Promise<StoreInventory> {
    const { data, error } = await supabase
      .from('store_context_inventory')
      .insert({
        store_id: storeId,
        ...inventoryData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store inventory: ${error.message}`);
    }

    return data;
  }

  async updateStoreInventory(storeId: string, inventoryData: UpdateStoreInventoryRequest): Promise<StoreInventory> {
    const { data, error } = await supabase
      .from('store_context_inventory')
      .update({
        ...inventoryData,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update store inventory: ${error.message}`);
    }

    return data;
  }

  async deleteStoreInventory(storeId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_inventory')
      .delete()
      .eq('store_id', storeId);

    if (error) {
      throw new Error(`Failed to delete store inventory: ${error.message}`);
    }
  }

  // Inventory Categories Management
  async getInventoryCategories(storeId: string): Promise<InventoryCategory[]> {
    const { data, error } = await supabase
      .from('store_inventory_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to get inventory categories: ${error.message}`);
    }

    return data;
  }

  async getInventoryCategory(categoryId: string): Promise<InventoryCategory | null> {
    const { data, error } = await supabase
      .from('store_inventory_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get inventory category: ${error.message}`);
    }

    return data;
  }

  async createInventoryCategory(storeId: string, categoryData: CreateInventoryCategoryRequest): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('store_inventory_categories')
      .insert({
        store_id: storeId,
        ...categoryData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create inventory category: ${error.message}`);
    }

    return data;
  }

  async updateInventoryCategory(categoryId: string, categoryData: UpdateInventoryCategoryRequest): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('store_inventory_categories')
      .update({
        ...categoryData,
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update inventory category: ${error.message}`);
    }

    return data;
  }

  async deleteInventoryCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('store_inventory_categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      throw new Error(`Failed to delete inventory category: ${error.message}`);
    }
  }

  // Inventory Items Management
  async getInventoryItems(storeId: string, categoryId?: string): Promise<InventoryItem[]> {
    let query = supabase
      .from('store_inventory_items')
      .select('*')
      .eq('store_id', storeId);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get inventory items: ${error.message}`);
    }

    return data;
  }

  async getInventoryItem(itemId: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('store_inventory_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get inventory item: ${error.message}`);
    }

    return data;
  }

  async createInventoryItem(storeId: string, itemData: CreateInventoryItemRequest): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('store_inventory_items')
      .insert({
        store_id: storeId,
        ...itemData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create inventory item: ${error.message}`);
    }

    return data;
  }

  async updateInventoryItem(itemId: string, itemData: UpdateInventoryItemRequest): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('store_inventory_items')
      .update({
        ...itemData,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update inventory item: ${error.message}`);
    }

    return data;
  }

  async deleteInventoryItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('store_inventory_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to delete inventory item: ${error.message}`);
    }
  }

  // Supplier Relationships Management
  async getSupplierRelationships(storeId: string): Promise<SupplierRelationship[]> {
    const { data, error } = await supabase
      .from('store_supplier_relationships')
      .select('*')
      .eq('store_id', storeId)
      .order('supplier_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get supplier relationships: ${error.message}`);
    }

    return data;
  }

  async getSupplierRelationship(relationshipId: string): Promise<SupplierRelationship | null> {
    const { data, error } = await supabase
      .from('store_supplier_relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get supplier relationship: ${error.message}`);
    }

    return data;
  }

  async createSupplierRelationship(storeId: string, supplierData: CreateSupplierRelationshipRequest): Promise<SupplierRelationship> {
    const { data, error } = await supabase
      .from('store_supplier_relationships')
      .insert({
        store_id: storeId,
        ...supplierData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create supplier relationship: ${error.message}`);
    }

    return data;
  }

  async updateSupplierRelationship(relationshipId: string, supplierData: UpdateSupplierRelationshipRequest): Promise<SupplierRelationship> {
    const { data, error } = await supabase
      .from('store_supplier_relationships')
      .update({
        ...supplierData,
        updated_at: new Date().toISOString()
      })
      .eq('id', relationshipId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update supplier relationship: ${error.message}`);
    }

    return data;
  }

  async deleteSupplierRelationship(relationshipId: string): Promise<void> {
    const { error } = await supabase
      .from('store_supplier_relationships')
      .delete()
      .eq('id', relationshipId);

    if (error) {
      throw new Error(`Failed to delete supplier relationship: ${error.message}`);
    }
  }

  // Customer Preferences Management
  async getCustomerPreferences(storeId: string): Promise<CustomerPreference[]> {
    const { data, error } = await supabase
      .from('store_customer_preferences')
      .select('*')
      .eq('store_id', storeId)
      .order('preference_category', { ascending: true });

    if (error) {
      throw new Error(`Failed to get customer preferences: ${error.message}`);
    }

    return data;
  }

  async getCustomerPreference(preferenceId: string): Promise<CustomerPreference | null> {
    const { data, error } = await supabase
      .from('store_customer_preferences')
      .select('*')
      .eq('id', preferenceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get customer preference: ${error.message}`);
    }

    return data;
  }

  async createCustomerPreference(storeId: string, preferenceData: CreateCustomerPreferenceRequest): Promise<CustomerPreference> {
    const { data, error } = await supabase
      .from('store_customer_preferences')
      .insert({
        store_id: storeId,
        ...preferenceData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create customer preference: ${error.message}`);
    }

    return data;
  }

  async updateCustomerPreference(preferenceId: string, preferenceData: UpdateCustomerPreferenceRequest): Promise<CustomerPreference> {
    const { data, error } = await supabase
      .from('store_customer_preferences')
      .update({
        ...preferenceData,
        updated_at: new Date().toISOString()
      })
      .eq('id', preferenceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update customer preference: ${error.message}`);
    }

    return data;
  }

  async deleteCustomerPreference(preferenceId: string): Promise<void> {
    const { error } = await supabase
      .from('store_customer_preferences')
      .delete()
      .eq('id', preferenceId);

    if (error) {
      throw new Error(`Failed to delete customer preference: ${error.message}`);
    }
  }

  // Competitive Positioning Management
  async getCompetitivePositioning(storeId: string): Promise<CompetitivePositioning[]> {
    const { data, error } = await supabase
      .from('store_competitive_positioning')
      .select('*')
      .eq('store_id', storeId)
      .order('competitor_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get competitive positioning: ${error.message}`);
    }

    return data;
  }

  async getCompetitivePosition(positionId: string): Promise<CompetitivePositioning | null> {
    const { data, error } = await supabase
      .from('store_competitive_positioning')
      .select('*')
      .eq('id', positionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get competitive position: ${error.message}`);
    }

    return data;
  }

  async createCompetitivePosition(storeId: string, positionData: CreateCompetitivePositioningRequest): Promise<CompetitivePositioning> {
    const { data, error } = await supabase
      .from('store_competitive_positioning')
      .insert({
        store_id: storeId,
        ...positionData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create competitive position: ${error.message}`);
    }

    return data;
  }

  async updateCompetitivePosition(positionId: string, positionData: UpdateCompetitivePositioningRequest): Promise<CompetitivePositioning> {
    const { data, error } = await supabase
      .from('store_competitive_positioning')
      .update({
        ...positionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update competitive position: ${error.message}`);
    }

    return data;
  }

  async deleteCompetitivePosition(positionId: string): Promise<void> {
    const { error } = await supabase
      .from('store_competitive_positioning')
      .delete()
      .eq('id', positionId);

    if (error) {
      throw new Error(`Failed to delete competitive position: ${error.message}`);
    }
  }

  // Batch Operations
  async bulkCreateInventoryItems(storeId: string, items: CreateInventoryItemRequest[]): Promise<InventoryItem[]> {
    const itemsWithStoreId = items.map(item => ({
      store_id: storeId,
      ...item
    }));

    const { data, error } = await supabase
      .from('store_inventory_items')
      .insert(itemsWithStoreId)
      .select();

    if (error) {
      throw new Error(`Failed to bulk create inventory items: ${error.message}`);
    }

    return data;
  }

  async bulkUpdateInventoryItems(updates: { id: string; data: UpdateInventoryItemRequest }[]): Promise<InventoryItem[]> {
    const results: InventoryItem[] = [];

    for (const update of updates) {
      const result = await this.updateInventoryItem(update.id, update.data);
      results.push(result);
    }

    return results;
  }

  async bulkDeleteInventoryItems(itemIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('store_inventory_items')
      .delete()
      .in('id', itemIds);

    if (error) {
      throw new Error(`Failed to bulk delete inventory items: ${error.message}`);
    }
  }

  // Analytics and Statistics
  async getInventoryStatistics(storeId: string): Promise<{
    totalCategories: number;
    totalItems: number;
    totalSuppliers: number;
    averageMargin: number;
    topCategories: { category: string; itemCount: number }[];
    qualityDistribution: { quality: InventoryQuality; count: number }[];
    pricingStrategyDistribution: { strategy: PricingStrategy; count: number }[];
  }> {
    const [categories, items, suppliers] = await Promise.all([
      this.getInventoryCategories(storeId),
      this.getInventoryItems(storeId),
      this.getSupplierRelationships(storeId)
    ]);

    const totalCategories = categories.length;
    const totalItems = items.length;
    const totalSuppliers = suppliers.length;

    // Calculate average margin
    const validMargins = items
      .filter(item => item.margin_percentage !== null)
      .map(item => item.margin_percentage!);
    const averageMargin = validMargins.length > 0 
      ? validMargins.reduce((sum, margin) => sum + margin, 0) / validMargins.length 
      : 0;

    // Top categories by item count
    const categoryItemCounts = new Map<string, number>();
    items.forEach(item => {
      const category = categories.find(c => c.id === item.category_id);
      if (category) {
        categoryItemCounts.set(category.name, (categoryItemCounts.get(category.name) || 0) + 1);
      }
    });

    const topCategories = Array.from(categoryItemCounts.entries())
      .map(([category, itemCount]) => ({ category, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 5);

    // Quality distribution
    const qualityDistribution = new Map<InventoryQuality, number>();
    items.forEach(item => {
      if (item.quality) {
        qualityDistribution.set(item.quality, (qualityDistribution.get(item.quality) || 0) + 1);
      }
    });

    // Pricing strategy distribution
    const pricingStrategyDistribution = new Map<PricingStrategy, number>();
    items.forEach(item => {
      if (item.pricing_strategy) {
        pricingStrategyDistribution.set(item.pricing_strategy, (pricingStrategyDistribution.get(item.pricing_strategy) || 0) + 1);
      }
    });

    return {
      totalCategories,
      totalItems,
      totalSuppliers,
      averageMargin,
      topCategories,
      qualityDistribution: Array.from(qualityDistribution.entries()).map(([quality, count]) => ({ quality, count })),
      pricingStrategyDistribution: Array.from(pricingStrategyDistribution.entries()).map(([strategy, count]) => ({ strategy, count }))
    };
  }

  // Validation Methods
  async validateInventoryData(inventoryData: CreateStoreInventoryRequest | UpdateStoreInventoryRequest): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate required fields for create requests
    if ('product_mix_focus' in inventoryData && !inventoryData.product_mix_focus) {
      errors.push('Product mix focus is required');
    }

    // Validate turnover_frequency_days
    if (inventoryData.turnover_frequency_days !== undefined) {
      if (inventoryData.turnover_frequency_days < 1) {
        errors.push('Turnover frequency must be at least 1 day');
      }
      if (inventoryData.turnover_frequency_days > 365) {
        errors.push('Turnover frequency cannot exceed 365 days');
      }
    }

    // Validate average_margin_percentage
    if (inventoryData.average_margin_percentage !== undefined) {
      if (inventoryData.average_margin_percentage < 0) {
        errors.push('Average margin percentage cannot be negative');
      }
      if (inventoryData.average_margin_percentage > 100) {
        errors.push('Average margin percentage cannot exceed 100%');
      }
    }

    // Validate stock_level_management percentages
    if (inventoryData.stock_level_management) {
      const management = inventoryData.stock_level_management;
      if (management.low_stock_threshold !== undefined && (management.low_stock_threshold < 0 || management.low_stock_threshold > 100)) {
        errors.push('Low stock threshold must be between 0 and 100');
      }
      if (management.reorder_point !== undefined && (management.reorder_point < 0 || management.reorder_point > 100)) {
        errors.push('Reorder point must be between 0 and 100');
      }
      if (management.safety_stock_percentage !== undefined && (management.safety_stock_percentage < 0 || management.safety_stock_percentage > 100)) {
        errors.push('Safety stock percentage must be between 0 and 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper Methods
  async getInventoryCompleteness(storeId: string): Promise<{
    completeness: number;
    missingFields: string[];
    recommendations: string[];
  }> {
    const inventory = await this.getStoreInventory(storeId);
    const categories = await this.getInventoryCategories(storeId);
    const items = await this.getInventoryItems(storeId);
    const suppliers = await this.getSupplierRelationships(storeId);

    const missingFields: string[] = [];
    const recommendations: string[] = [];

    if (!inventory) {
      return {
        completeness: 0,
        missingFields: ['store_inventory'],
        recommendations: ['Create store inventory profile to begin tracking inventory data']
      };
    }

    // Check required inventory fields
    const requiredFields = [
      'product_mix_focus',
      'primary_quality_tier',
      'pricing_strategy',
      'stock_level_management',
      'supplier_diversity'
    ];

    requiredFields.forEach(field => {
      if (!inventory[field as keyof StoreInventory]) {
        missingFields.push(field);
      }
    });

    // Check for categories
    if (categories.length === 0) {
      missingFields.push('inventory_categories');
      recommendations.push('Add inventory categories to organize your products');
    }

    // Check for items
    if (items.length === 0) {
      missingFields.push('inventory_items');
      recommendations.push('Add inventory items to track your product offerings');
    } else if (items.length < 10) {
      recommendations.push('Consider adding more inventory items for better insights');
    }

    // Check for suppliers
    if (suppliers.length === 0) {
      missingFields.push('supplier_relationships');
      recommendations.push('Add supplier relationships to track your supply chain');
    }

    // Check item completeness
    const incompleteItems = items.filter(item => 
      !item.quality || !item.pricing_strategy || item.margin_percentage === null
    );

    if (incompleteItems.length > 0) {
      recommendations.push(`Complete missing data for ${incompleteItems.length} inventory items`);
    }

    const totalFields = requiredFields.length + 4; // +4 for categories, items, suppliers, item completeness
    const completedFields = totalFields - missingFields.length;
    const completeness = Math.round((completedFields / totalFields) * 100);

    return {
      completeness,
      missingFields,
      recommendations
    };
  }

  async getItemsBySupplier(storeId: string, supplierId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('store_inventory_items')
      .select('*')
      .eq('store_id', storeId)
      .eq('primary_supplier_id', supplierId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to get items by supplier: ${error.message}`);
    }

    return data;
  }

  async getItemsByCategory(storeId: string, categoryId: string): Promise<InventoryItem[]> {
    return this.getInventoryItems(storeId, categoryId);
  }

  async searchItems(storeId: string, searchTerm: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('store_inventory_items')
      .select('*')
      .eq('store_id', storeId)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to search items: ${error.message}`);
    }

    return data;
  }
}

export const inventoryService = new InventoryService();