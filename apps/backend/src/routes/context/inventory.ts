import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextValidationService } from '../../services/context/validation';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface LoyaltyProgram {
  active: boolean;
  discount_rate: number;
  point_multiplier: number;
  annual_fee?: number;
  verification_required?: boolean;
}

interface SeasonalVariation {
  categories: string[];
  peak_months: number[];
  inventory_increase: number;
}

interface ProductCategory {
  category_name: string;
  subcategories: string[];
  department_location: string;
  seasonal_availability?: Record<string, string[]> | null;
  staff_expertise_required: boolean;
}

interface SpecialService {
  service_name: string;
  service_type: 'delivery' | 'installation' | 'repair' | 'consultation';
  availability_schedule: {
    days: string[];
    hours: string;
    zones?: string[];
    appointment_required?: boolean;
  };
  cost_structure: 'fee_based' | 'purchase_dependent' | 'free' | 'subscription';
  staff_requirements?: string | null;
}

interface InventoryCreateRequest {
  primary_categories: string[];
  payment_methods: string[];
  loyalty_programs?: Record<string, LoyaltyProgram>;
  seasonal_variations?: Record<string, SeasonalVariation>;
  price_range: 'budget' | 'mid-range' | 'premium' | 'luxury';
  brand_focus: 'store_brands' | 'national_brands' | 'premium_brands' | 'mixed';
  product_categories?: ProductCategory[];
  special_services?: SpecialService[];
}

interface InventoryResponse {
  success: boolean;
  data: {
    id: string;
    store_id: string;
    primary_categories: string[];
    payment_methods: string[];
    loyalty_programs: Record<string, LoyaltyProgram>;
    seasonal_variations: Record<string, SeasonalVariation>;
    price_range: string;
    brand_focus: string;
    product_categories: ProductCategory[];
    special_services: SpecialService[];
    version: number;
    created_at: string;
    updated_at: string;
  };
}

// POST /api/business/stores/{storeId}/context/inventory
router.post('/:storeId/context/inventory', authMiddleware(['write_context']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const inventoryData: InventoryCreateRequest = req.body;
  const { userId, userRole, userBusinessId } = req.auth!;

  const supabase = database.createClient();

  // Verify store exists and get business_id
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, business_id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  // Check business access permissions
  if (userRole === 'business_account' && userBusinessId !== store.business_id) {
    throw new AuthorizationError('Access denied to this store');
  }

  // Validate the inventory data
  const validation = contextValidationService.validateInventory(inventoryData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Check if inventory context already exists
  const { data: existingInventory } = await supabase
    .from('store_context_inventory')
    .select('id, version')
    .eq('store_id', storeId)
    .maybeSingle();

  const isUpdate = !!existingInventory;
  const version = isUpdate ? (existingInventory.version || 1) + 1 : 1;

  // Prepare inventory data for database
  const dbInventoryData = {
    store_id: storeId,
    primary_categories: inventoryData.primary_categories,
    payment_methods: inventoryData.payment_methods,
    loyalty_programs: inventoryData.loyalty_programs || {},
    seasonal_variations: inventoryData.seasonal_variations || {},
    price_range: inventoryData.price_range,
    brand_focus: inventoryData.brand_focus,
    product_categories: inventoryData.product_categories || [],
    special_services: inventoryData.special_services || [],
    version,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };

  let inventoryResult;
  if (isUpdate) {
    // Update existing inventory context
    const { data, error } = await supabase
      .from('store_context_inventory')
      .update(dbInventoryData)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update inventory context: ${error.message}`);
    }
    inventoryResult = data;
  } else {
    // Create new inventory context
    const { data, error } = await supabase
      .from('store_context_inventory')
      .insert(dbInventoryData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create inventory context: ${error.message}`);
    }
    inventoryResult = data;
  }

  // Format response
  const response: InventoryResponse = {
    success: true,
    data: {
      id: inventoryResult.id,
      store_id: inventoryResult.store_id,
      primary_categories: inventoryResult.primary_categories,
      payment_methods: inventoryResult.payment_methods,
      loyalty_programs: inventoryResult.loyalty_programs,
      seasonal_variations: inventoryResult.seasonal_variations,
      price_range: inventoryResult.price_range,
      brand_focus: inventoryResult.brand_focus,
      product_categories: inventoryResult.product_categories,
      special_services: inventoryResult.special_services,
      version: inventoryResult.version,
      created_at: inventoryResult.created_at,
      updated_at: inventoryResult.updated_at
    }
  };

  const statusCode = isUpdate ? 200 : 201;
  res.status(statusCode).json(response);
}));

export default router;