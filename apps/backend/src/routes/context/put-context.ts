import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextValidationService } from '../../services/context/validation';
import { contextCompletenessService } from '../../services/context/completeness';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface ContextUpdateRequest {
  profile?: any;
  personnel?: any;
  layout?: any;
  inventory?: any;
  changeSummary: string;
}

interface ContextUpdateResponse {
  storeId: string;
  completenessScore: number;
  version: number;
  profile?: any;
  personnel?: any;
  layout?: any;
  inventory?: any;
  updatedAt: string;
}

// PUT /api/business/stores/{storeId}/context
router.put('/:storeId/context', authMiddleware(['write_context']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const updateData: ContextUpdateRequest = req.body;
  const { userId, userRole, userBusinessId } = req.auth!;

  if (!updateData.changeSummary) {
    throw new ValidationError([{
      field: 'changeSummary',
      message: 'Change summary is required'
    }]);
  }

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

  // Validate the context data using our validation service
  if (updateData.profile) {
    const profileValidation = contextValidationService.validateStoreProfile(updateData.profile);
    if (!profileValidation.isValid) {
      throw new ValidationError(profileValidation.errors);
    }
  }

  if (updateData.personnel) {
    const personnelValidation = contextValidationService.validatePersonnel(updateData.personnel);
    if (!personnelValidation.isValid) {
      throw new ValidationError(personnelValidation.errors);
    }
  }

  if (updateData.layout) {
    const layoutValidation = contextValidationService.validateLayout(updateData.layout);
    if (!layoutValidation.isValid) {
      throw new ValidationError(layoutValidation.errors);
    }
  }

  if (updateData.inventory) {
    const inventoryValidation = contextValidationService.validateInventory(updateData.inventory);
    if (!inventoryValidation.isValid) {
      throw new ValidationError(inventoryValidation.errors);
    }
  }

  // Start transaction for atomicity
  const updatePromises: Promise<any>[] = [];
  let version = 1;

  // Check if context already exists to determine version
  const { data: existingProfile } = await supabase
    .from('store_context_profiles')
    .select('version')
    .eq('store_id', storeId)
    .maybeSingle();

  if (existingProfile) {
    version = (existingProfile.version || 1) + 1;
  }

  // Update profile data if provided
  if (updateData.profile) {
    const profileData = {
      store_id: storeId,
      version,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      change_summary: updateData.changeSummary,
      ...updateData.profile
    };

    if (existingProfile) {
      updatePromises.push(
        supabase
          .from('store_context_profiles')
          .update(profileData)
          .eq('store_id', storeId)
      );
    } else {
      updatePromises.push(
        supabase
          .from('store_context_profiles')
          .insert(profileData)
      );
    }

    // Handle operating hours if provided in profile
    if (updateData.profile.operatingHours) {
      // Delete existing hours
      updatePromises.push(
        supabase
          .from('store_operating_hours')
          .delete()
          .eq('store_id', storeId)
      );

      // Insert new hours
      const hoursData = updateData.profile.operatingHours.map((hour: any) => ({
        store_id: storeId,
        day_of_week: hour.dayOfWeek,
        open_time: hour.openTime,
        close_time: hour.closeTime,
        is_closed: hour.isClosed || false,
        is_special_hours: hour.isSpecialHours || false,
        special_hours_note: hour.specialHoursNote,
        updated_by: userId,
        updated_at: new Date().toISOString()
      }));

      updatePromises.push(
        supabase
          .from('store_operating_hours')
          .insert(hoursData)
      );
    }
  }

  // Update personnel data if provided
  if (updateData.personnel) {
    // Handle as array or single object
    const personnelArray = Array.isArray(updateData.personnel) ? updateData.personnel : [updateData.personnel];
    
    for (const person of personnelArray) {
      const personnelData = {
        store_id: storeId,
        version,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        is_active: true,
        ...person
      };

      if (person.id) {
        // Update existing personnel
        updatePromises.push(
          supabase
            .from('store_context_personnel')
            .update(personnelData)
            .eq('id', person.id)
            .eq('store_id', storeId)
        );
      } else {
        // Insert new personnel
        updatePromises.push(
          supabase
            .from('store_context_personnel')
            .insert(personnelData)
        );
      }
    }
  }

  // Update layout data if provided
  if (updateData.layout) {
    const layoutData = {
      store_id: storeId,
      version,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      ...updateData.layout
    };

    const { data: existingLayout } = await supabase
      .from('store_context_layouts')
      .select('id')
      .eq('store_id', storeId)
      .maybeSingle();

    if (existingLayout) {
      updatePromises.push(
        supabase
          .from('store_context_layouts')
          .update(layoutData)
          .eq('store_id', storeId)
      );
    } else {
      updatePromises.push(
        supabase
          .from('store_context_layouts')
          .insert(layoutData)
      );
    }
  }

  // Update inventory data if provided
  if (updateData.inventory) {
    const inventoryData = {
      store_id: storeId,
      version,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      ...updateData.inventory
    };

    const { data: existingInventory } = await supabase
      .from('store_context_inventory')
      .select('id')
      .eq('store_id', storeId)
      .maybeSingle();

    if (existingInventory) {
      updatePromises.push(
        supabase
          .from('store_context_inventory')
          .update(inventoryData)
          .eq('store_id', storeId)
      );
    } else {
      updatePromises.push(
        supabase
          .from('store_context_inventory')
          .insert(inventoryData)
      );
    }
  }

  // Execute all updates
  const results = await Promise.all(updatePromises);

  // Check for any errors
  for (const result of results) {
    if (result.error) {
      throw new Error(`Database update failed: ${result.error.message}`);
    }
  }

  // Fetch the updated context data
  const updatedContext: any = {
    storeId,
    version,
    updatedAt: new Date().toISOString()
  };

  // Fetch updated profile data
  if (updateData.profile) {
    const { data: profileData } = await supabase
      .from('store_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (profileData) {
      updatedContext.profile = profileData;

      // Also fetch operating hours
      const { data: hoursData } = await supabase
        .from('store_operating_hours')
        .select('*')
        .eq('store_id', storeId)
        .order('day_of_week');

      if (hoursData) {
        updatedContext.profile.operatingHours = hoursData;
      }
    }
  }

  // Fetch updated personnel data
  if (updateData.personnel) {
    const { data: personnelData } = await supabase
      .from('store_context_personnel')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('role');

    if (personnelData) {
      updatedContext.personnel = personnelData;
    }
  }

  // Fetch updated layout data
  if (updateData.layout) {
    const { data: layoutData } = await supabase
      .from('store_context_layouts')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (layoutData) {
      updatedContext.layout = layoutData;
    }
  }

  // Fetch updated inventory data
  if (updateData.inventory) {
    const { data: inventoryData } = await supabase
      .from('store_context_inventory')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (inventoryData) {
      updatedContext.inventory = inventoryData;
    }
  }

  // Calculate completeness score
  try {
    const completenessData = await contextCompletenessService.calculateCompleteness(storeId);
    updatedContext.completenessScore = completenessData.overallScore;
  } catch (error) {
    // If completeness calculation fails, default to basic calculation
    updatedContext.completenessScore = 0;
    if (updatedContext.profile) updatedContext.completenessScore += 25;
    if (updatedContext.personnel) updatedContext.completenessScore += 25;
    if (updatedContext.layout) updatedContext.completenessScore += 25;
    if (updatedContext.inventory) updatedContext.completenessScore += 25;
  }

  res.status(200).json(updatedContext);
}));

export default router;