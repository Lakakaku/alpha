// Personnel context database service for business context window feature

import { createClient } from '@supabase/supabase-js';
import { 
  StorePersonnel,
  CreatePersonnelRequest,
  UpdatePersonnelRequest,
  PersonnelShift,
  CreatePersonnelShiftRequest,
  TeamDynamics,
  DayOfWeek,
  PersonnelRole,
  ShiftType
} from '@vocilia/types/context/personnel';

export class PersonnelService {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  // Personnel Operations
  async getStorePersonnel(storeId: string): Promise<StorePersonnel[]> {
    const { data, error } = await this.supabase
      .from('store_context_personnel')
      .select(`
        *,
        shifts:store_personnel_shifts(*)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get store personnel: ${error.message}`);
    }

    // Transform shifts into typical_shifts property
    return (data || []).map(person => ({
      ...person,
      typical_shifts: person.shifts || []
    }));
  }

  async getActivePersonnel(storeId: string): Promise<StorePersonnel[]> {
    const personnel = await this.getStorePersonnel(storeId);
    return personnel.filter(person => person.is_active);
  }

  async getPersonnelById(personnelId: string): Promise<StorePersonnel | null> {
    const { data, error } = await this.supabase
      .from('store_context_personnel')
      .select(`
        *,
        shifts:store_personnel_shifts(*)
      `)
      .eq('id', personnelId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get personnel: ${error.message}`);
    }

    return {
      ...data,
      typical_shifts: data.shifts || []
    };
  }

  async createPersonnel(
    storeId: string,
    personnelData: CreatePersonnelRequest
  ): Promise<StorePersonnel> {
    const { typical_shifts, ...personData } = personnelData;

    // Create person first
    const { data: person, error: personError } = await this.supabase
      .from('store_context_personnel')
      .insert({
        store_id: storeId,
        ...personData
      })
      .select()
      .single();

    if (personError) {
      throw new Error(`Failed to create personnel: ${personError.message}`);
    }

    // Create shifts if provided
    let shifts: PersonnelShift[] = [];
    if (typical_shifts && typical_shifts.length > 0) {
      shifts = await this.createPersonnelShifts(person.id, typical_shifts);
    }

    return {
      ...person,
      typical_shifts: shifts
    };
  }

  async updatePersonnel(
    personnelId: string,
    updates: UpdatePersonnelRequest
  ): Promise<StorePersonnel> {
    const { typical_shifts, ...personUpdates } = updates;

    // Update person data
    const { data: person, error: personError } = await this.supabase
      .from('store_context_personnel')
      .update({
        ...personUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', personnelId)
      .select()
      .single();

    if (personError) {
      throw new Error(`Failed to update personnel: ${personError.message}`);
    }

    // Update shifts if provided
    let shifts: PersonnelShift[] = [];
    if (typical_shifts !== undefined) {
      if (typical_shifts.length === 0) {
        // Delete all shifts
        await this.deletePersonnelShifts(personnelId);
      } else {
        // Replace all shifts
        await this.deletePersonnelShifts(personnelId);
        shifts = await this.createPersonnelShifts(personnelId, typical_shifts);
      }
    } else {
      // Get existing shifts
      shifts = await this.getPersonnelShifts(personnelId);
    }

    return {
      ...person,
      typical_shifts: shifts
    };
  }

  async deletePersonnel(personnelId: string): Promise<void> {
    // Soft delete by setting is_active to false
    const { error } = await this.supabase
      .from('store_context_personnel')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', personnelId);

    if (error) {
      throw new Error(`Failed to delete personnel: ${error.message}`);
    }
  }

  async permanentlyDeletePersonnel(personnelId: string): Promise<void> {
    // Hard delete (will cascade to shifts)
    const { error } = await this.supabase
      .from('store_context_personnel')
      .delete()
      .eq('id', personnelId);

    if (error) {
      throw new Error(`Failed to permanently delete personnel: ${error.message}`);
    }
  }

  // Personnel Shifts Operations
  async getPersonnelShifts(personnelId: string): Promise<PersonnelShift[]> {
    const { data, error } = await this.supabase
      .from('store_personnel_shifts')
      .select('*')
      .eq('personnel_id', personnelId)
      .order('day_of_week');

    if (error) {
      throw new Error(`Failed to get personnel shifts: ${error.message}`);
    }

    return data || [];
  }

  async createPersonnelShifts(
    personnelId: string,
    shiftsData: CreatePersonnelShiftRequest[]
  ): Promise<PersonnelShift[]> {
    const shiftsToInsert = shiftsData.map(shift => ({
      personnel_id: personnelId,
      ...shift
    }));

    const { data, error } = await this.supabase
      .from('store_personnel_shifts')
      .insert(shiftsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to create personnel shifts: ${error.message}`);
    }

    return data;
  }

  async deletePersonnelShifts(personnelId: string): Promise<void> {
    const { error } = await this.supabase
      .from('store_personnel_shifts')
      .delete()
      .eq('personnel_id', personnelId);

    if (error) {
      throw new Error(`Failed to delete personnel shifts: ${error.message}`);
    }
  }

  // Team Dynamics Operations
  async getTeamDynamics(storeId: string): Promise<TeamDynamics | null> {
    const { data, error } = await this.supabase
      .from('store_team_dynamics')
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get team dynamics: ${error.message}`);
    }

    return data;
  }

  async createOrUpdateTeamDynamics(
    storeId: string,
    teamDynamicsData: Omit<TeamDynamics, 'id' | 'store_id' | 'created_at' | 'updated_at'>
  ): Promise<TeamDynamics> {
    const { data, error } = await this.supabase
      .from('store_team_dynamics')
      .upsert({
        store_id: storeId,
        ...teamDynamicsData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create/update team dynamics: ${error.message}`);
    }

    return data;
  }

  // Query and Analysis Functions
  async getPersonnelOnDuty(
    storeId: string,
    dayOfWeek: DayOfWeek,
    time: string
  ): Promise<Array<{
    personnel_id: string;
    name: string;
    role: PersonnelRole;
    shift_type: ShiftType;
  }>> {
    const { data, error } = await this.supabase
      .rpc('get_personnel_on_duty', {
        p_store_id: storeId,
        p_day: dayOfWeek,
        p_time: time
      });

    if (error) {
      throw new Error(`Failed to get personnel on duty: ${error.message}`);
    }

    return data || [];
  }

  async getPersonnelByRole(storeId: string, role: PersonnelRole): Promise<StorePersonnel[]> {
    const personnel = await this.getActivePersonnel(storeId);
    return personnel.filter(person => person.role === role);
  }

  async getPersonnelStatistics(storeId: string): Promise<{
    totalPersonnel: number;
    activePersonnel: number;
    personnelByRole: Record<PersonnelRole, number>;
    averageShiftsPerPerson: number;
    coverageByDay: Record<DayOfWeek, number>;
  }> {
    const allPersonnel = await this.getStorePersonnel(storeId);
    const activePersonnel = allPersonnel.filter(p => p.is_active);

    // Count by role
    const personnelByRole = {} as Record<PersonnelRole, number>;
    Object.values(PersonnelRole).forEach(role => {
      personnelByRole[role] = activePersonnel.filter(p => p.role === role).length;
    });

    // Calculate average shifts per person
    const totalShifts = activePersonnel.reduce((sum, person) => sum + person.typical_shifts.length, 0);
    const averageShiftsPerPerson = activePersonnel.length > 0 ? totalShifts / activePersonnel.length : 0;

    // Calculate coverage by day
    const coverageByDay = {} as Record<DayOfWeek, number>;
    Object.values(DayOfWeek).forEach(day => {
      const personnelWorkingThisDay = activePersonnel.filter(person =>
        person.typical_shifts.some(shift => shift.day_of_week === day)
      ).length;
      coverageByDay[day] = personnelWorkingThisDay;
    });

    return {
      totalPersonnel: allPersonnel.length,
      activePersonnel: activePersonnel.length,
      personnelByRole,
      averageShiftsPerPerson,
      coverageByDay
    };
  }

  async validatePersonnelData(personnelData: CreatePersonnelRequest | UpdatePersonnelRequest): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validate name
    if ('name' in personnelData && personnelData.name) {
      if (personnelData.name.length < 2 || personnelData.name.length > 50) {
        errors.push('Name must be between 2 and 50 characters');
      }
    }

    // Validate skills limit
    if ('skills' in personnelData && personnelData.skills) {
      if (personnelData.skills.length > 15) {
        errors.push('Maximum 15 skills allowed');
      }
    }

    // Validate languages requirement
    if ('languages_spoken' in personnelData && personnelData.languages_spoken) {
      if (personnelData.languages_spoken.length < 1 || personnelData.languages_spoken.length > 10) {
        errors.push('Must specify 1-10 languages spoken');
      }
    }

    // Validate shifts
    if ('typical_shifts' in personnelData && personnelData.typical_shifts) {
      if (personnelData.typical_shifts.length > 7) {
        errors.push('Maximum 7 shifts allowed (one per day)');
      }

      // Check for duplicate days
      const days = personnelData.typical_shifts.map(shift => shift.day_of_week);
      const uniqueDays = new Set(days);
      if (days.length !== uniqueDays.size) {
        errors.push('Cannot have multiple shifts on the same day');
      }

      // Validate shift times
      personnelData.typical_shifts.forEach((shift, index) => {
        if (shift.start_time >= shift.end_time) {
          errors.push(`Shift ${index + 1}: Start time must be before end time`);
        }
        if (shift.break_duration && (shift.break_duration < 0 || shift.break_duration > 480)) {
          errors.push(`Shift ${index + 1}: Break duration must be between 0 and 480 minutes`);
        }
        if (shift.responsibilities && shift.responsibilities.length > 10) {
          errors.push(`Shift ${index + 1}: Maximum 10 responsibilities allowed`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Batch operations
  async batchUpdatePersonnelStatus(
    personnelIds: string[],
    isActive: boolean
  ): Promise<void> {
    const { error } = await this.supabase
      .from('store_context_personnel')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .in('id', personnelIds);

    if (error) {
      throw new Error(`Failed to batch update personnel status: ${error.message}`);
    }
  }

  async getMultipleStorePersonnel(storeIds: string[]): Promise<Record<string, StorePersonnel[]>> {
    if (storeIds.length === 0) return {};

    const { data, error } = await this.supabase
      .from('store_context_personnel')
      .select(`
        *,
        shifts:store_personnel_shifts(*)
      `)
      .in('store_id', storeIds)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get multiple store personnel: ${error.message}`);
    }

    const personnelMap: Record<string, StorePersonnel[]> = {};
    storeIds.forEach(id => personnelMap[id] = []);

    (data || []).forEach(person => {
      const personnel: StorePersonnel = {
        ...person,
        typical_shifts: person.shifts || []
      };
      
      if (!personnelMap[person.store_id]) {
        personnelMap[person.store_id] = [];
      }
      personnelMap[person.store_id].push(personnel);
    });

    return personnelMap;
  }
}