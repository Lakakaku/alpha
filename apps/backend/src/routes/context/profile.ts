import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextValidationService } from '../../services/context/validation';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface ProfileCreateRequest {
  storeType: string;
  storeSubtype?: string;
  squareFootage: number;
  departmentCount: number;
  layoutType: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
  };
  operatingHours?: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isSpecialHours?: boolean;
    specialDate?: string;
    notes?: string;
  }>;
  parkingAvailable?: boolean;
  accessibilityFeatures?: string[];
}

interface ProfileResponse {
  id: string;
  storeId: string;
  storeType: string;
  storeSubtype: string | null;
  squareFootage: number;
  departmentCount: number;
  layoutType: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
  };
  operatingHours: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isSpecialHours: boolean;
    specialDate?: string;
    notes?: string;
  }>;
  parkingAvailable: boolean;
  accessibilityFeatures: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

// POST /api/business/stores/{storeId}/context/profile
router.post('/:storeId/context/profile', authMiddleware(['write_context']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const profileData: ProfileCreateRequest = req.body;
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

  // Validate the profile data
  const validation = contextValidationService.validateStoreProfile(profileData);
  if (!validation.isValid) {
    throw new ValidationError(validation.errors);
  }

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('store_context_profiles')
    .select('id, version')
    .eq('store_id', storeId)
    .maybeSingle();

  const isUpdate = !!existingProfile;
  const version = isUpdate ? (existingProfile.version || 1) + 1 : 1;

  // Prepare profile data for database
  const dbProfileData = {
    store_id: storeId,
    store_type: profileData.storeType,
    store_subtype: profileData.storeSubtype || null,
    square_footage: profileData.squareFootage,
    department_count: profileData.departmentCount,
    layout_type: profileData.layoutType,
    address: profileData.address,
    parking_available: profileData.parkingAvailable || false,
    accessibility_features: profileData.accessibilityFeatures || [],
    version,
    updated_by: userId,
    updated_at: new Date().toISOString()
  };

  let profileResult;
  if (isUpdate) {
    // Update existing profile
    const { data, error } = await supabase
      .from('store_context_profiles')
      .update(dbProfileData)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update store profile: ${error.message}`);
    }
    profileResult = data;
  } else {
    // Create new profile
    const { data, error } = await supabase
      .from('store_context_profiles')
      .insert(dbProfileData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store profile: ${error.message}`);
    }
    profileResult = data;
  }

  // Handle operating hours if provided
  let operatingHoursResult = [];
  if (profileData.operatingHours && profileData.operatingHours.length > 0) {
    // Delete existing operating hours
    await supabase
      .from('store_operating_hours')
      .delete()
      .eq('store_id', storeId);

    // Insert new operating hours
    const hoursData = profileData.operatingHours.map(hour => ({
      store_id: storeId,
      day_of_week: hour.dayOfWeek,
      open_time: hour.openTime,
      close_time: hour.closeTime,
      is_special_hours: hour.isSpecialHours || false,
      special_date: hour.specialDate || null,
      notes: hour.notes || null,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }));

    const { data: hoursData, error: hoursError } = await supabase
      .from('store_operating_hours')
      .insert(hoursData)
      .select()
      .order('day_of_week');

    if (hoursError) {
      throw new Error(`Failed to save operating hours: ${hoursError.message}`);
    }
    operatingHoursResult = hoursData || [];
  } else if (isUpdate) {
    // If updating but no hours provided, fetch existing hours
    const { data: existingHours } = await supabase
      .from('store_operating_hours')
      .select('*')
      .eq('store_id', storeId)
      .order('day_of_week');

    operatingHoursResult = existingHours || [];
  }

  // Format response
  const response: ProfileResponse = {
    id: profileResult.id,
    storeId: profileResult.store_id,
    storeType: profileResult.store_type,
    storeSubtype: profileResult.store_subtype,
    squareFootage: profileResult.square_footage,
    departmentCount: profileResult.department_count,
    layoutType: profileResult.layout_type,
    address: profileResult.address,
    operatingHours: operatingHoursResult.map(hour => ({
      dayOfWeek: hour.day_of_week,
      openTime: hour.open_time,
      closeTime: hour.close_time,
      isSpecialHours: hour.is_special_hours,
      specialDate: hour.special_date,
      notes: hour.notes
    })),
    parkingAvailable: profileResult.parking_available,
    accessibilityFeatures: profileResult.accessibility_features,
    version: profileResult.version,
    createdAt: profileResult.created_at,
    updatedAt: profileResult.updated_at
  };

  const statusCode = isUpdate ? 200 : 201;
  res.status(statusCode).json(response);
}));

export default router;