// Context profile database service for business context window feature

import { createClient } from '@supabase/supabase-js';
import { 
  StoreProfile, 
  CreateStoreProfileRequest, 
  UpdateStoreProfileRequest,
  OperatingHours,
  CreateOperatingHoursRequest,
  UpdateOperatingHoursRequest,
  DayOfWeek
} from '@vocilia/types/context/profile';

export class ProfilesService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  // Store Profile Operations
  async getStoreProfile(storeId: string): Promise<StoreProfile | null> {
    const { data, error } = await this.supabase
      .from('store_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw new Error(`Failed to get store profile: ${error.message}`);
    }

    return data;
  }

  async createStoreProfile(
    storeId: string, 
    profileData: CreateStoreProfileRequest
  ): Promise<StoreProfile> {
    const { data, error } = await this.supabase
      .from('store_context_profiles')
      .insert({
        store_id: storeId,
        ...profileData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create store profile: ${error.message}`);
    }

    return data;
  }

  async updateStoreProfile(
    storeId: string, 
    updates: UpdateStoreProfileRequest
  ): Promise<StoreProfile> {
    const { version, ...updateData } = updates;
    
    const { data, error } = await this.supabase
      .from('store_context_profiles')
      .update({
        ...updateData,
        version: version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .eq('version', version) // Optimistic concurrency control
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Profile version conflict. Please refresh and try again.');
      }
      throw new Error(`Failed to update store profile: ${error.message}`);
    }

    return data;
  }

  async deleteStoreProfile(storeId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_context_profiles')
      .delete()
      .eq('store_id', storeId);

    if (error) {
      throw new Error(`Failed to delete store profile: ${error.message}`);
    }
  }

  // Operating Hours Operations
  async getOperatingHours(storeId: string): Promise<OperatingHours[]> {
    const { data, error } = await this.supabase
      .from('store_operating_hours')
      .select('*')
      .eq('store_id', storeId)
      .order('day_of_week');

    if (error) {
      throw new Error(`Failed to get operating hours: ${error.message}`);
    }

    return data || [];
  }

  async getOperatingHoursForDay(
    storeId: string, 
    dayOfWeek: DayOfWeek
  ): Promise<OperatingHours | null> {
    const { data, error } = await this.supabase
      .from('store_operating_hours')
      .select('*')
      .eq('store_id', storeId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get operating hours for ${dayOfWeek}: ${error.message}`);
    }

    return data;
  }

  async setOperatingHours(
    storeId: string,
    hoursData: CreateOperatingHoursRequest[]
  ): Promise<OperatingHours[]> {
    // Delete existing hours and insert new ones in a transaction
    const { error: deleteError } = await this.supabase
      .from('store_operating_hours')
      .delete()
      .eq('store_id', storeId);

    if (deleteError) {
      throw new Error(`Failed to clear existing operating hours: ${deleteError.message}`);
    }

    const hoursToInsert = hoursData.map(hours => ({
      store_id: storeId,
      ...hours
    }));

    const { data, error } = await this.supabase
      .from('store_operating_hours')
      .insert(hoursToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to set operating hours: ${error.message}`);
    }

    return data;
  }

  async updateOperatingHoursForDay(
    storeId: string,
    dayOfWeek: DayOfWeek,
    updates: UpdateOperatingHoursRequest
  ): Promise<OperatingHours> {
    const { data, error } = await this.supabase
      .from('store_operating_hours')
      .upsert({
        store_id: storeId,
        day_of_week: dayOfWeek,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update operating hours for ${dayOfWeek}: ${error.message}`);
    }

    return data;
  }

  async deleteOperatingHoursForDay(
    storeId: string,
    dayOfWeek: DayOfWeek
  ): Promise<void> {
    const { error } = await this.supabase
      .from('store_operating_hours')
      .delete()
      .eq('store_id', storeId)
      .eq('day_of_week', dayOfWeek);

    if (error) {
      throw new Error(`Failed to delete operating hours for ${dayOfWeek}: ${error.message}`);
    }
  }

  // Helper functions
  async isStoreCurrentlyOpen(storeId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('is_store_currently_open', { p_store_id: storeId });

    if (error) {
      throw new Error(`Failed to check if store is open: ${error.message}`);
    }

    return data;
  }

  async validateProfileData(profileData: CreateStoreProfileRequest | UpdateStoreProfileRequest): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate name length
    if ('name' in profileData && profileData.name) {
      if (profileData.name.length < 2 || profileData.name.length > 100) {
        errors.push('Store name must be between 2 and 100 characters');
      }
    }

    // Validate target demographic
    if ('target_demographic' in profileData && profileData.target_demographic) {
      if (profileData.target_demographic.length < 1 || profileData.target_demographic.length > 5) {
        errors.push('Target demographic must have 1-5 items');
      }
    }

    // Validate unique selling points
    if ('unique_selling_points' in profileData && profileData.unique_selling_points) {
      if (profileData.unique_selling_points.length < 1 || profileData.unique_selling_points.length > 10) {
        errors.push('Unique selling points must have 1-10 items');
      }
    }

    // Validate brand voice structure
    if ('brand_voice' in profileData && profileData.brand_voice) {
      const { brand_voice } = profileData;
      if (!brand_voice.tone) {
        errors.push('Brand voice tone is required');
      }
      if (!brand_voice.communication_style) {
        errors.push('Brand voice communication style is required');
      }
    }

    // Validate price range structure
    if ('price_range' in profileData && profileData.price_range) {
      const { price_range } = profileData;
      if (!price_range.category) {
        errors.push('Price range category is required');
      }
      if (price_range.average_transaction && price_range.average_transaction < 0) {
        errors.push('Average transaction amount must be positive');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async getProfileCompleteness(storeId: string): Promise<{
    hasProfile: boolean;
    hasOperatingHours: boolean;
    operatingHoursDaysConfigured: number;
    completenessPercentage: number;
    missingFields: string[];
  }> {
    const [profile, operatingHours] = await Promise.all([
      this.getStoreProfile(storeId),
      this.getOperatingHours(storeId)
    ]);

    const missingFields: string[] = [];
    let completenessScore = 0;

    // Check profile completeness (80% of total score)
    if (profile) {
      completenessScore += 20; // Base profile exists

      if (profile.target_demographic?.length > 0) completenessScore += 15;
      else missingFields.push('target_demographic');

      if (profile.unique_selling_points?.length > 0) completenessScore += 15;
      else missingFields.push('unique_selling_points');

      if (profile.brand_voice && Object.keys(profile.brand_voice).length > 0) completenessScore += 15;
      else missingFields.push('brand_voice');

      if (profile.location_context && Object.keys(profile.location_context).length > 0) completenessScore += 15;
      else missingFields.push('location_context');
    } else {
      missingFields.push('store_profile');
    }

    // Check operating hours completeness (20% of total score)
    const operatingHoursDaysConfigured = operatingHours.length;
    if (operatingHoursDaysConfigured >= 7) {
      completenessScore += 20; // All days configured
    } else if (operatingHoursDaysConfigured >= 5) {
      completenessScore += 15; // Weekdays configured
    } else if (operatingHoursDaysConfigured > 0) {
      completenessScore += 10; // Some days configured
    } else {
      missingFields.push('operating_hours');
    }

    return {
      hasProfile: !!profile,
      hasOperatingHours: operatingHours.length > 0,
      operatingHoursDaysConfigured,
      completenessPercentage: Math.min(completenessScore, 100),
      missingFields
    };
  }

  // Batch operations for efficiency
  async batchUpdateOperatingHours(
    storeId: string,
    updates: Array<{ dayOfWeek: DayOfWeek; data: UpdateOperatingHoursRequest }>
  ): Promise<OperatingHours[]> {
    const updatePromises = updates.map(({ dayOfWeek, data }) =>
      this.updateOperatingHoursForDay(storeId, dayOfWeek, data)
    );

    return Promise.all(updatePromises);
  }

  async getMultipleStoreProfiles(storeIds: string[]): Promise<Record<string, StoreProfile | null>> {
    if (storeIds.length === 0) return {};

    const { data, error } = await this.supabase
      .from('store_context_profiles')
      .select('*')
      .in('store_id', storeIds);

    if (error) {
      throw new Error(`Failed to get multiple store profiles: ${error.message}`);
    }

    const profileMap: Record<string, StoreProfile | null> = {};
    storeIds.forEach(id => profileMap[id] = null);
    
    data?.forEach(profile => {
      profileMap[profile.store_id] = profile;
    });

    return profileMap;
  }
}