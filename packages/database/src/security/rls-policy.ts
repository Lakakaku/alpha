/**
 * RLS Policy Database Model
 * Task: T037 - RLSPolicy model in packages/database/src/security/rls-policy.ts
 * 
 * Manages Row Level Security (RLS) policies for data protection and access control.
 * Provides dynamic policy management and enforcement across all database tables.
 */

import { supabase } from '../client/supabase';
import { 
  RLSPolicy, 
  PolicyType, 
  UserType,
  RLSPolicyStatus,
  CreateRLSPolicyRequest,
  UpdateRLSPolicyRequest,
  RLSPolicyStatistics,
  PolicyValidationResult,
  PolicyEnforcementResult
} from '../../types/security';

export class RLSPolicyModel {
  /**
   * Create a new RLS policy
   */
  static async create(data: CreateRLSPolicyRequest): Promise<RLSPolicy> {
    try {
      // Validate policy syntax
      const validation = await this.validatePolicySQL(data.policy_sql);
      if (!validation.is_valid) {
        throw new Error(`Invalid policy SQL: ${validation.error_message}`);
      }

      const newPolicy: Omit<RLSPolicy, 'id' | 'created_at' | 'updated_at'> = {
        policy_name: data.policy_name.trim(),
        table_name: data.table_name.trim(),
        policy_type: data.policy_type,
        target_user_type: data.target_user_type,
        policy_sql: data.policy_sql.trim(),
        description: data.description?.trim() || null,
        is_active: data.is_active ?? true,
        auto_apply: data.auto_apply ?? false,
        priority_order: data.priority_order ?? 100,
        conditions: data.conditions || {},
        enforcement_level: data.enforcement_level || 'strict',
        status: 'pending_activation'
      };

      const { data: policy, error } = await supabase
        .from('rls_policies')
        .insert(newPolicy)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create RLS policy: ${error.message}`);
      }

      // Auto-apply if requested
      if (newPolicy.auto_apply) {
        await this.applyPolicy(policy.id);
      }

      return policy;
    } catch (error) {
      throw new Error(`RLS policy creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get RLS policy by ID
   */
  static async getById(policyId: string): Promise<RLSPolicy | null> {
    try {
      const { data, error } = await supabase
        .from('rls_policies')
        .select('*')
        .eq('id', policyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch RLS policy: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      throw new Error(`RLS policy retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all policies for a specific table
   */
  static async getByTable(tableName: string): Promise<RLSPolicy[]> {
    try {
      const { data, error } = await supabase
        .from('rls_policies')
        .select('*')
        .eq('table_name', tableName)
        .eq('is_active', true)
        .order('priority_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch table policies: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Table policies retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get policies by user type
   */
  static async getByUserType(userType: UserType): Promise<RLSPolicy[]> {
    try {
      const { data, error } = await supabase
        .from('rls_policies')
        .select('*')
        .or(`target_user_type.eq.${userType},target_user_type.eq.all`)
        .eq('is_active', true)
        .order('table_name', { ascending: true })
        .order('priority_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch user type policies: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`User type policies retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active policies with filtering
   */
  static async getActivePolicies(filters: {
    table_name?: string;
    policy_type?: PolicyType;
    target_user_type?: UserType;
    enforcement_level?: 'strict' | 'moderate' | 'permissive';
  } = {}): Promise<RLSPolicy[]> {
    try {
      let query = supabase
        .from('rls_policies')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'active');

      if (filters.table_name) {
        query = query.eq('table_name', filters.table_name);
      }

      if (filters.policy_type) {
        query = query.eq('policy_type', filters.policy_type);
      }

      if (filters.target_user_type) {
        query = query.or(`target_user_type.eq.${filters.target_user_type},target_user_type.eq.all`);
      }

      if (filters.enforcement_level) {
        query = query.eq('enforcement_level', filters.enforcement_level);
      }

      const { data, error } = await query
        .order('table_name', { ascending: true })
        .order('priority_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch active policies: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Active policies retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update RLS policy
   */
  static async update(policyId: string, updates: UpdateRLSPolicyRequest): Promise<RLSPolicy> {
    try {
      // Validate policy SQL if being updated
      if (updates.policy_sql) {
        const validation = await this.validatePolicySQL(updates.policy_sql);
        if (!validation.is_valid) {
          throw new Error(`Invalid policy SQL: ${validation.error_message}`);
        }
      }

      const updateData: Partial<RLSPolicy> = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Clean undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const { data, error } = await supabase
        .from('rls_policies')
        .update(updateData)
        .eq('id', policyId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update RLS policy: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`RLS policy update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply policy to database
   */
  static async applyPolicy(policyId: string): Promise<PolicyEnforcementResult> {
    try {
      const policy = await this.getById(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      if (policy.status === 'active') {
        return {
          success: true,
          policy_id: policyId,
          message: 'Policy already active',
          applied_at: new Date().toISOString()
        };
      }

      // Execute policy SQL to create/enable RLS policy
      const { error } = await supabase.rpc('apply_rls_policy', {
        p_table_name: policy.table_name,
        p_policy_name: policy.policy_name,
        p_policy_sql: policy.policy_sql,
        p_policy_type: policy.policy_type
      });

      if (error) {
        await this.update(policyId, { 
          status: 'failed_activation',
          conditions: {
            ...policy.conditions,
            last_error: error.message,
            last_attempt: new Date().toISOString()
          }
        });
        throw new Error(`Policy application failed: ${error.message}`);
      }

      // Update policy status to active
      await this.update(policyId, { 
        status: 'active',
        conditions: {
          ...policy.conditions,
          applied_at: new Date().toISOString(),
          last_error: null
        }
      });

      return {
        success: true,
        policy_id: policyId,
        message: 'Policy applied successfully',
        applied_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        policy_id: policyId,
        message: error instanceof Error ? error.message : 'Unknown error',
        applied_at: new Date().toISOString()
      };
    }
  }

  /**
   * Remove policy from database
   */
  static async removePolicy(policyId: string): Promise<PolicyEnforcementResult> {
    try {
      const policy = await this.getById(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Execute policy removal
      const { error } = await supabase.rpc('remove_rls_policy', {
        p_table_name: policy.table_name,
        p_policy_name: policy.policy_name
      });

      if (error) {
        await this.update(policyId, { 
          status: 'failed_removal',
          conditions: {
            ...policy.conditions,
            last_error: error.message,
            last_attempt: new Date().toISOString()
          }
        });
        throw new Error(`Policy removal failed: ${error.message}`);
      }

      // Update policy status to inactive
      await this.update(policyId, { 
        status: 'inactive',
        is_active: false,
        conditions: {
          ...policy.conditions,
          removed_at: new Date().toISOString(),
          last_error: null
        }
      });

      return {
        success: true,
        policy_id: policyId,
        message: 'Policy removed successfully',
        applied_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        policy_id: policyId,
        message: error instanceof Error ? error.message : 'Unknown error',
        applied_at: new Date().toISOString()
      };
    }
  }

  /**
   * Validate policy SQL syntax
   */
  static async validatePolicySQL(policySql: string): Promise<PolicyValidationResult> {
    try {
      // Basic SQL injection and syntax validation
      const suspiciousPatterns = [
        /;\s*(drop|delete|truncate|alter)\s+/i,
        /union\s+select/i,
        /--\s*$/, // SQL comments at end
        /<script/i,
        /javascript:/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(policySql)) {
          return {
            is_valid: false,
            error_message: 'Policy contains potentially dangerous SQL patterns',
            warnings: ['SQL injection patterns detected']
          };
        }
      }

      // Check for required RLS policy structure
      if (!policySql.toLowerCase().includes('current_setting')) {
        return {
          is_valid: false,
          error_message: 'Policy must reference current_setting for user context',
          warnings: ['Missing user context validation']
        };
      }

      // Validate using Supabase SQL parser (if available)
      const { error } = await supabase.rpc('validate_rls_policy_sql', {
        sql_text: policySql
      });

      if (error) {
        return {
          is_valid: false,
          error_message: error.message,
          warnings: []
        };
      }

      return {
        is_valid: true,
        error_message: null,
        warnings: []
      };
    } catch (error) {
      return {
        is_valid: false,
        error_message: error instanceof Error ? error.message : 'Validation error',
        warnings: ['Could not validate policy SQL']
      };
    }
  }

  /**
   * Get policy enforcement statistics
   */
  static async getStatistics(): Promise<RLSPolicyStatistics> {
    try {
      const [
        totalPolicies,
        activePolicies,
        policyTypes,
        tablesCovered,
        recentActivity
      ] = await Promise.all([
        // Total policies
        supabase
          .from('rls_policies')
          .select('id', { count: 'exact' }),
        
        // Active policies
        supabase
          .from('rls_policies')
          .select('id', { count: 'exact' })
          .eq('is_active', true)
          .eq('status', 'active'),

        // Policy types breakdown
        supabase
          .from('rls_policies')
          .select('policy_type')
          .eq('is_active', true),

        // Tables covered
        supabase
          .from('rls_policies')
          .select('table_name')
          .eq('is_active', true)
          .eq('status', 'active'),

        // Recent activity (last 7 days)
        supabase
          .from('rls_policies')
          .select('id', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      // Process policy types
      const typeDistribution = (policyTypes.data || []).reduce((acc, policy) => {
        acc[policy.policy_type] = (acc[policy.policy_type] || 0) + 1;
        return acc;
      }, {} as Record<PolicyType, number>);

      // Process unique tables
      const uniqueTables = new Set((tablesCovered.data || []).map(p => p.table_name));

      return {
        total_policies: totalPolicies.count || 0,
        active_policies: activePolicies.count || 0,
        inactive_policies: (totalPolicies.count || 0) - (activePolicies.count || 0),
        tables_covered: uniqueTables.size,
        policy_types: typeDistribution,
        recent_changes: recentActivity.count || 0,
        enforcement_rate: activePolicies.count && totalPolicies.count 
          ? (activePolicies.count / totalPolicies.count) * 100 
          : 0,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get policies that need attention (failed, pending, etc.)
   */
  static async getPoliciesNeedingAttention(): Promise<RLSPolicy[]> {
    try {
      const { data, error } = await supabase
        .from('rls_policies')
        .select('*')
        .in('status', ['pending_activation', 'failed_activation', 'failed_removal'])
        .order('updated_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch policies needing attention: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Attention policies retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk apply multiple policies
   */
  static async bulkApplyPolicies(policyIds: string[]): Promise<PolicyEnforcementResult[]> {
    try {
      const results: PolicyEnforcementResult[] = [];
      
      for (const policyId of policyIds) {
        const result = await this.applyPolicy(policyId);
        results.push(result);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    } catch (error) {
      throw new Error(`Bulk policy application failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a policy permanently
   */
  static async delete(policyId: string): Promise<void> {
    try {
      // First ensure policy is removed from database
      await this.removePolicy(policyId);

      // Then delete the record
      const { error } = await supabase
        .from('rls_policies')
        .delete()
        .eq('id', policyId);

      if (error) {
        throw new Error(`Failed to delete RLS policy: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`RLS policy deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}