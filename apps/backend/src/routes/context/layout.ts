import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextValidationService } from '../../services/context/validation';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface CheckoutLocation {
  id: string;
  position: { x: number; y: number };
  counter_count: number;
  express_lanes: number;
}

interface SpecialArea {
  position: { x: number; y: number };
  size: 'small' | 'medium' | 'large';
}

interface Department {
  department_name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  department_type: 'product' | 'service' | 'mixed';
  adjacency_priority: number;
}

interface LayoutChange {
  change_date: string;
  change_type: string;
  change_description: string;
  affected_departments: string[];
  reason: string;
}

interface LayoutCreateRequest {
  entrance_count: number;
  exit_count: number;
  checkout_locations: CheckoutLocation[];
  customer_flow_pattern: 'clockwise' | 'counterclockwise' | 'linear' | 'mixed';
  special_areas: Record<string, SpecialArea>;
  departments?: Department[];
  layout_changes?: LayoutChange[];
  layout_image_url?: string;
}

interface LayoutResponse {
  success: boolean;
  data: {
    id: string;
    store_id: string;
    entrance_count: number;
    exit_count: number;
    checkout_locations: CheckoutLocation[];
    customer_flow_pattern: string;
    special_areas: Record<string, SpecialArea>;
    departments: Department[];
    layout_changes: LayoutChange[];
    layout_image_url?: string;
    version: number;
    created_at: string;
    updated_at: string;
  };
}

// POST /api/business/stores/{storeId}/context/layout
router.post('/:storeId/context/layout', authMiddleware(['write_context']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const layoutData: LayoutCreateRequest = req.body;
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

  // Validate the layout data
  const validation = contextValidationService.validateLayout(layoutData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Check if layout context already exists
  const { data: existingLayout } = await supabase
    .from('store_context_layouts')
    .select('id, version')
    .eq('store_id', storeId)
    .maybeSingle();

  const isUpdate = !!existingLayout;
  const version = isUpdate ? (existingLayout.version || 1) + 1 : 1;

  // Prepare layout data for database
  const dbLayoutData = {
    store_id: storeId,
    entrance_count: layoutData.entrance_count,
    exit_count: layoutData.exit_count,
    checkout_locations: layoutData.checkout_locations,
    customer_flow_pattern: layoutData.customer_flow_pattern,
    special_areas: layoutData.special_areas,
    departments: layoutData.departments || [],
    layout_changes: layoutData.layout_changes || [],
    layout_image_url: layoutData.layout_image_url || null,
    version,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };

  let layoutResult;
  if (isUpdate) {
    // Update existing layout context
    const { data, error } = await supabase
      .from('store_context_layouts')
      .update(dbLayoutData)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update layout context: ${error.message}`);
    }
    layoutResult = data;
  } else {
    // Create new layout context
    const { data, error } = await supabase
      .from('store_context_layouts')
      .insert(dbLayoutData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create layout context: ${error.message}`);
    }
    layoutResult = data;
  }

  // Format response
  const response: LayoutResponse = {
    success: true,
    data: {
      id: layoutResult.id,
      store_id: layoutResult.store_id,
      entrance_count: layoutResult.entrance_count,
      exit_count: layoutResult.exit_count,
      checkout_locations: layoutResult.checkout_locations,
      customer_flow_pattern: layoutResult.customer_flow_pattern,
      special_areas: layoutResult.special_areas,
      departments: layoutResult.departments,
      layout_changes: layoutResult.layout_changes,
      layout_image_url: layoutResult.layout_image_url,
      version: layoutResult.version,
      created_at: layoutResult.created_at,
      updated_at: layoutResult.updated_at
    }
  };

  const statusCode = isUpdate ? 200 : 201;
  res.status(statusCode).json(response);
}));

export default router;