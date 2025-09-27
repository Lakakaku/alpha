import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextValidationService } from '../../services/context/validation';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface CustomerServicePoint {
  location: string;
  type: string;
  staff_count: number;
  hours: string;
}

interface Shift {
  shift_name: string;
  start_time: string;
  end_time: string;
  staff_count: number;
  department_allocation: Record<string, number>;
  days_of_week?: number[];
}

interface PersonnelCreateRequest {
  total_staff_count: number;
  manager_name: string;
  assistant_manager_name?: string;
  customer_service_points: CustomerServicePoint[];
  department_heads: Record<string, string>;
  staff_expertise_areas?: string[];
  shifts?: Shift[];
}

interface PersonnelResponse {
  success: boolean;
  data: {
    id: string;
    store_id: string;
    total_staff_count: number;
    manager_name: string;
    assistant_manager_name?: string;
    customer_service_points: CustomerServicePoint[];
    department_heads: Record<string, string>;
    staff_expertise_areas: string[];
    shifts: Shift[];
    version: number;
    created_at: string;
    updated_at: string;
  };
}

// POST /api/business/stores/{storeId}/context/personnel
router.post('/:storeId/context/personnel', authMiddleware(['write_context']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const personnelData: PersonnelCreateRequest = req.body;
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

  // Validate the personnel data
  const validation = contextValidationService.validatePersonnel(personnelData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Check if personnel context already exists
  const { data: existingPersonnel } = await supabase
    .from('store_context_personnel')
    .select('id, version')
    .eq('store_id', storeId)
    .maybeSingle();

  const isUpdate = !!existingPersonnel;
  const version = isUpdate ? (existingPersonnel.version || 1) + 1 : 1;

  // Prepare personnel data for database
  const dbPersonnelData = {
    store_id: storeId,
    total_staff_count: personnelData.total_staff_count,
    manager_name: personnelData.manager_name,
    assistant_manager_name: personnelData.assistant_manager_name || null,
    customer_service_points: personnelData.customer_service_points,
    department_heads: personnelData.department_heads,
    staff_expertise_areas: personnelData.staff_expertise_areas || [],
    shifts: personnelData.shifts || [],
    version,
    updated_by: userId,
    updated_at: new Date().toISOString(),
    is_active: true
  };

  let personnelResult;
  if (isUpdate) {
    // Update existing personnel context
    const { data, error } = await supabase
      .from('store_context_personnel')
      .update(dbPersonnelData)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update personnel context: ${error.message}`);
    }
    personnelResult = data;
  } else {
    // Create new personnel context
    const { data, error } = await supabase
      .from('store_context_personnel')
      .insert(dbPersonnelData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create personnel context: ${error.message}`);
    }
    personnelResult = data;
  }

  // Format response
  const response: PersonnelResponse = {
    success: true,
    data: {
      id: personnelResult.id,
      store_id: personnelResult.store_id,
      total_staff_count: personnelResult.total_staff_count,
      manager_name: personnelResult.manager_name,
      assistant_manager_name: personnelResult.assistant_manager_name,
      customer_service_points: personnelResult.customer_service_points,
      department_heads: personnelResult.department_heads,
      staff_expertise_areas: personnelResult.staff_expertise_areas,
      shifts: personnelResult.shifts,
      version: personnelResult.version,
      created_at: personnelResult.created_at,
      updated_at: personnelResult.updated_at
    }
  };

  const statusCode = isUpdate ? 200 : 201;
  res.status(statusCode).json(response);
}));

export default router;