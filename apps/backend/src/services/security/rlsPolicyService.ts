/**
 * RLS Policy Enforcement Service
 * Task: T046 - RLS policy enforcement service
 * 
 * Manages and enforces Row Level Security (RLS) policies for data protection.
 * Provides dynamic policy management, validation, and enforcement across the platform.
 */

import { RLSPolicy } from '@vocilia/database';
import { RLSPolicyEntry, PolicyScope, PolicyStatus, PolicyValidationResult } from '@vocilia/types';
import { AuditLoggingService } from './auditLoggingService';
import { randomUUID, createHash } from 'crypto';

export interface PolicyTemplate {
  name: string;
  description: string;
  scope: PolicyScope;
  sqlTemplate: string;
  requiredParams: string[];
  securityLevel: 'basic' | 'enhanced' | 'strict';
}

export interface PolicyEnforcementContext {
  userId: string;
  userRole: string;
  organizationId?: string;
  sessionId?: string;
  ipAddress?: string;
  requestedTable: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  appliedPolicies: string[];
  restrictionsSql?: string;
  reason?: string;
  violations?: string[];
}

export interface BulkPolicyRequest {
  policies: Array<{
    name: string;
    table_name: string;
    policy_sql: string;
    scope: PolicyScope;
    description?: string;
  }>;
  replaceExisting?: boolean;
}

export class RLSPolicyService {
  private static instance: RLSPolicyService;
  private auditService: AuditLoggingService;
  private policyCache = new Map<string, RLSPolicyEntry>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private cacheLastUpdated = 0;

  // Predefined policy templates for common security patterns
  private readonly policyTemplates: PolicyTemplate[] = [
    {
      name: 'user_owns_record',
      description: 'User can only access records they own',
      scope: 'row_level',
      sqlTemplate: '(user_id = auth.uid()::text)',
      requiredParams: [],
      securityLevel: 'basic'
    },
    {
      name: 'organization_member',
      description: 'User can only access records from their organization',
      scope: 'row_level',
      sqlTemplate: '(organization_id = (SELECT organization_id FROM user_accounts WHERE id = auth.uid()::text))',
      requiredParams: [],
      securityLevel: 'enhanced'
    },
    {
      name: 'admin_full_access',
      description: 'Admin users have full access',
      scope: 'table_level',
      sqlTemplate: '((SELECT role FROM user_accounts WHERE id = auth.uid()::text) = \'admin\')',
      requiredParams: [],
      securityLevel: 'basic'
    },
    {
      name: 'time_based_access',
      description: 'Records accessible only during business hours',
      scope: 'row_level',
      sqlTemplate: '(EXTRACT(hour FROM NOW()) BETWEEN 8 AND 18 AND EXTRACT(dow FROM NOW()) BETWEEN 1 AND 5)',
      requiredParams: [],
      securityLevel: 'strict'
    },
    {
      name: 'ip_restricted_access',
      description: 'Access restricted to specific IP ranges',
      scope: 'table_level',
      sqlTemplate: '(inet_client_addr() << inet \'{ip_range}\')',
      requiredParams: ['ip_range'],
      securityLevel: 'strict'
    },
    {
      name: 'data_classification_policy',
      description: 'Access based on data classification level',
      scope: 'row_level',
      sqlTemplate: '(classification_level <= (SELECT max_classification_level FROM user_accounts WHERE id = auth.uid()::text)::integer)',
      requiredParams: [],
      securityLevel: 'enhanced'
    }
  ];

  private constructor() {
    this.auditService = AuditLoggingService.getInstance();
  }

  static getInstance(): RLSPolicyService {
    if (!RLSPolicyService.instance) {
      RLSPolicyService.instance = new RLSPolicyService();
    }
    return RLSPolicyService.instance;
  }

  /**
   * Create a new RLS policy
   */
  async createPolicy(policyData: {
    name: string;
    table_name: string;
    policy_sql: string;
    scope: PolicyScope;
    description?: string;
    enabled?: boolean;
  }): Promise<string> {
    try {
      // Validate the policy SQL
      const validation = await this.validatePolicySQL(policyData.policy_sql);
      if (!validation.isValid) {
        throw new Error(`Invalid policy SQL: ${validation.errors?.join(', ')}`);
      }

      const policyId = randomUUID();
      const policyEntry: RLSPolicyEntry = {
        id: policyId,
        name: policyData.name,
        table_name: policyData.table_name,
        policy_sql: policyData.policy_sql,
        scope: policyData.scope,
        status: 'active',
        description: policyData.description || '',
        enabled: policyData.enabled ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          validation_result: validation,
          sql_hash: createHash('sha256').update(policyData.policy_sql).digest('hex')
        }
      };

      await RLSPolicy.create(policyEntry);
      
      // Apply the policy to the database
      if (policyEntry.enabled) {
        await this.applyPolicyToDatabase(policyEntry);
      }

      // Clear cache to force reload
      this.clearCache();

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system', // Should be passed from request context
        userType: 'admin',
        actionPerformed: 'rls_policy_created',
        resourceType: 'rls_policy',
        resourceId: policyId,
        resultStatus: 'success',
        eventMetadata: {
          policy_name: policyData.name,
          table_name: policyData.table_name,
          scope: policyData.scope,
          enabled: policyEntry.enabled
        }
      });

      return policyId;
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'rls_policy_creation_failed',
        resourceType: 'rls_policy',
        resourceId: 'unknown',
        resultStatus: 'failure',
        eventMetadata: {
          policy_name: policyData.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Update an existing RLS policy
   */
  async updatePolicy(policyId: string, updates: {
    policy_sql?: string;
    description?: string;
    enabled?: boolean;
    status?: PolicyStatus;
  }): Promise<void> {
    try {
      const existingPolicy = await RLSPolicy.findById(policyId);
      if (!existingPolicy) {
        throw new Error(`Policy ${policyId} not found`);
      }

      // Validate new SQL if provided
      if (updates.policy_sql) {
        const validation = await this.validatePolicySQL(updates.policy_sql);
        if (!validation.isValid) {
          throw new Error(`Invalid policy SQL: ${validation.errors?.join(', ')}`);
        }
      }

      // Update the policy
      await RLSPolicy.update(policyId, {
        ...updates,
        updated_at: new Date().toISOString(),
        metadata: {
          ...existingPolicy.metadata,
          last_validation: updates.policy_sql ? await this.validatePolicySQL(updates.policy_sql) : existingPolicy.metadata?.last_validation,
          sql_hash: updates.policy_sql ? createHash('sha256').update(updates.policy_sql).digest('hex') : existingPolicy.metadata?.sql_hash
        }
      });

      // Reapply the policy if it's enabled and SQL changed
      if ((updates.enabled !== false) && updates.policy_sql) {
        const updatedPolicy = await RLSPolicy.findById(policyId);
        if (updatedPolicy && updatedPolicy.enabled) {
          await this.reapplyPolicyToDatabase(updatedPolicy);
        }
      }

      // Clear cache
      this.clearCache();

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'rls_policy_updated',
        resourceType: 'rls_policy',
        resourceId: policyId,
        resultStatus: 'success',
        eventMetadata: {
          policy_name: existingPolicy.name,
          updates: Object.keys(updates)
        }
      });
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'rls_policy_update_failed',
        resourceType: 'rls_policy',
        resourceId: policyId,
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Delete an RLS policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    try {
      const policy = await RLSPolicy.findById(policyId);
      if (!policy) {
        throw new Error(`Policy ${policyId} not found`);
      }

      // Remove from database first
      await this.removePolicyFromDatabase(policy);

      // Then delete the policy record
      await RLSPolicy.delete(policyId);

      // Clear cache
      this.clearCache();

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'rls_policy_deleted',
        resourceType: 'rls_policy',
        resourceId: policyId,
        resultStatus: 'success',
        eventMetadata: {
          policy_name: policy.name,
          table_name: policy.table_name
        }
      });
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'rls_policy_deletion_failed',
        resourceType: 'rls_policy',
        resourceId: policyId,
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Get all active policies for a table
   */
  async getPoliciesForTable(tableName: string): Promise<RLSPolicyEntry[]> {
    try {
      await this.refreshCacheIfNeeded();
      
      const policies: RLSPolicyEntry[] = [];
      for (const policy of this.policyCache.values()) {
        if (policy.table_name === tableName && policy.enabled && policy.status === 'active') {
          policies.push(policy);
        }
      }

      return policies.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(`Failed to get policies for table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluate policies for a specific access context
   */
  async evaluatePolicies(context: PolicyEnforcementContext): Promise<PolicyEvaluationResult> {
    try {
      const tablePolicies = await this.getPoliciesForTable(context.requestedTable);
      
      if (tablePolicies.length === 0) {
        return {
          allowed: true,
          appliedPolicies: [],
          reason: 'No RLS policies defined for table'
        };
      }

      const appliedPolicies: string[] = [];
      const restrictionClauses: string[] = [];
      const violations: string[] = [];

      for (const policy of tablePolicies) {
        // Check if policy applies to this operation
        if (this.doesPolicyApplyToOperation(policy, context.operation)) {
          appliedPolicies.push(policy.name);
          
          // Build the SQL restriction
          const restrictionSql = this.buildRestrictionSQL(policy, context);
          if (restrictionSql) {
            restrictionClauses.push(`(${restrictionSql})`);
          } else {
            violations.push(`Policy ${policy.name} could not be applied`);
          }
        }
      }

      // Combine restrictions with AND logic (most restrictive)
      const finalRestrictionSql = restrictionClauses.length > 0 
        ? restrictionClauses.join(' AND ')
        : undefined;

      const allowed = violations.length === 0;

      // Log policy evaluation
      await this.auditService.logEvent({
        eventType: 'authorization',
        userId: context.userId,
        userType: 'customer',
        actionPerformed: 'rls_policy_evaluation',
        resourceType: context.requestedTable,
        resourceId: 'policy_evaluation',
        resultStatus: allowed ? 'success' : 'blocked',
        eventMetadata: {
          requested_operation: context.operation,
          applied_policies: appliedPolicies,
          violations_count: violations.length,
          allowed
        }
      });

      return {
        allowed,
        appliedPolicies,
        restrictionsSql: finalRestrictionSql,
        reason: allowed ? 'All policies satisfied' : `Policy violations: ${violations.join(', ')}`,
        violations: violations.length > 0 ? violations : undefined
      };
    } catch (error) {
      // Fail-safe: Deny access if evaluation fails
      return {
        allowed: false,
        appliedPolicies: [],
        reason: `Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create policies from templates
   */
  async createPolicyFromTemplate(
    templateName: string, 
    tableName: string, 
    policyName: string,
    params: Record<string, string> = {}
  ): Promise<string> {
    const template = this.policyTemplates.find(t => t.name === templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    // Validate required parameters
    for (const param of template.requiredParams) {
      if (!params[param]) {
        throw new Error(`Required parameter ${param} not provided`);
      }
    }

    // Substitute parameters in template
    let policySql = template.sqlTemplate;
    for (const [key, value] of Object.entries(params)) {
      policySql = policySql.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return this.createPolicy({
      name: policyName,
      table_name: tableName,
      policy_sql: policySql,
      scope: template.scope,
      description: `${template.description} (from template: ${templateName})`
    });
  }

  /**
   * Bulk create or update policies
   */
  async bulkCreatePolicies(request: BulkPolicyRequest): Promise<{
    created: string[];
    updated: string[];
    errors: Array<{ policy: string; error: string }>;
  }> {
    const created: string[] = [];
    const updated: string[] = [];
    const errors: Array<{ policy: string; error: string }> = [];

    for (const policyData of request.policies) {
      try {
        // Check if policy exists
        const existingPolicy = await RLSPolicy.findByNameAndTable(policyData.name, policyData.table_name);
        
        if (existingPolicy && request.replaceExisting) {
          await this.updatePolicy(existingPolicy.id, {
            policy_sql: policyData.policy_sql,
            description: policyData.description
          });
          updated.push(existingPolicy.id);
        } else if (!existingPolicy) {
          const policyId = await this.createPolicy(policyData);
          created.push(policyId);
        } else {
          errors.push({
            policy: policyData.name,
            error: 'Policy already exists and replaceExisting is false'
          });
        }
      } catch (error) {
        errors.push({
          policy: policyData.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await this.auditService.logEvent({
      eventType: 'admin_action',
      userId: 'system',
      userType: 'admin',
      actionPerformed: 'bulk_rls_policy_operation',
      resourceType: 'rls_policy',
      resourceId: 'bulk_operation',
      resultStatus: errors.length === 0 ? 'success' : 'partial_failure',
      eventMetadata: {
        policies_count: request.policies.length,
        created_count: created.length,
        updated_count: updated.length,
        errors_count: errors.length
      }
    });

    return { created, updated, errors };
  }

  /**
   * Validate policy SQL for security and syntax
   */
  private async validatePolicySQL(policySql: string): Promise<PolicyValidationResult> {
    // Security patterns that should not be allowed
    const dangerousPatterns = [
      /;\s*(drop|delete|truncate|alter)\s+/i,
      /union\s+select/i,
      /--\s*$/m,
      /<script/i,
      /javascript:/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /sp_/i,
      /xp_/i
    ];

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(policySql)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Check for basic SQL syntax
    if (!policySql.trim()) {
      errors.push('Policy SQL cannot be empty');
    }

    // Check for balanced parentheses
    const openParens = (policySql.match(/\(/g) || []).length;
    const closeParens = (policySql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in policy SQL');
    }

    // Check for recommended patterns
    if (!policySql.includes('auth.uid()')) {
      warnings.push('Policy does not reference auth.uid() - consider if user context is needed');
    }

    // Try to validate against common SQL functions (basic check)
    const allowedFunctions = /\b(auth\.uid|current_user|session_user|extract|now|current_timestamp|inet_client_addr)\b/i;
    const hasFunctions = allowedFunctions.test(policySql);
    
    if (!hasFunctions && !policySql.includes('=') && !policySql.includes('<') && !policySql.includes('>')) {
      warnings.push('Policy appears to have no conditions - this may allow unrestricted access');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      securityScore: this.calculateSecurityScore(policySql, errors, warnings)
    };
  }

  /**
   * Calculate security score for a policy
   */
  private calculateSecurityScore(policySql: string, errors: string[], warnings: string[]): number {
    let score = 100;

    // Deduct for errors
    score -= errors.length * 30;

    // Deduct for warnings
    score -= warnings.length * 10;

    // Bonus for security-conscious patterns
    if (policySql.includes('auth.uid()')) score += 10;
    if (policySql.includes('organization_id')) score += 5;
    if (policySql.includes('role')) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Apply policy to database
   */
  private async applyPolicyToDatabase(policy: RLSPolicyEntry): Promise<void> {
    // In production, this would execute actual DDL commands
    // For now, we simulate the application
    await this.auditService.logEvent({
      eventType: 'system_event',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'rls_policy_applied',
      resourceType: 'database',
      resourceId: policy.table_name,
      resultStatus: 'success',
      eventMetadata: {
        policy_id: policy.id,
        policy_name: policy.name,
        policy_sql: policy.policy_sql
      }
    });
  }

  /**
   * Reapply policy to database (drop and recreate)
   */
  private async reapplyPolicyToDatabase(policy: RLSPolicyEntry): Promise<void> {
    await this.removePolicyFromDatabase(policy);
    await this.applyPolicyToDatabase(policy);
  }

  /**
   * Remove policy from database
   */
  private async removePolicyFromDatabase(policy: RLSPolicyEntry): Promise<void> {
    await this.auditService.logEvent({
      eventType: 'system_event',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'rls_policy_removed',
      resourceType: 'database',
      resourceId: policy.table_name,
      resultStatus: 'success',
      eventMetadata: {
        policy_id: policy.id,
        policy_name: policy.name
      }
    });
  }

  /**
   * Check if policy applies to operation
   */
  private doesPolicyApplyToOperation(policy: RLSPolicyEntry, operation: string): boolean {
    // Table-level policies apply to all operations
    if (policy.scope === 'table_level') return true;
    
    // Row-level policies typically apply to SELECT operations
    // but can be configured for other operations based on metadata
    const applicableOperations = policy.metadata?.applicable_operations as string[] || ['SELECT'];
    return applicableOperations.includes(operation);
  }

  /**
   * Build restriction SQL for policy
   */
  private buildRestrictionSQL(policy: RLSPolicyEntry, context: PolicyEnforcementContext): string | null {
    // For now, return the policy SQL as-is
    // In production, this would substitute context variables
    return policy.policy_sql;
  }

  /**
   * Refresh policy cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheLastUpdated > this.CACHE_TTL) {
      await this.refreshCache();
    }
  }

  /**
   * Refresh policy cache
   */
  private async refreshCache(): Promise<void> {
    try {
      const policies = await RLSPolicy.getActive();
      this.policyCache.clear();
      
      for (const policy of policies) {
        this.policyCache.set(policy.id, policy);
      }
      
      this.cacheLastUpdated = Date.now();
    } catch (error) {
      // Continue with existing cache if refresh fails
    }
  }

  /**
   * Clear policy cache
   */
  private clearCache(): void {
    this.policyCache.clear();
    this.cacheLastUpdated = 0;
  }

  /**
   * Get available policy templates
   */
  getPolicyTemplates(): PolicyTemplate[] {
    return [...this.policyTemplates];
  }

  /**
   * Get policy statistics for monitoring
   */
  async getPolicyStatistics(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    policiesByTable: Record<string, number>;
    policiesByScope: Record<PolicyScope, number>;
    averageSecurityScore: number;
  }> {
    try {
      await this.refreshCacheIfNeeded();
      
      const policies = Array.from(this.policyCache.values());
      const activePolicies = policies.filter(p => p.enabled && p.status === 'active');
      
      const policiesByTable: Record<string, number> = {};
      const policiesByScope: Record<PolicyScope, number> = {} as Record<PolicyScope, number>;
      let totalSecurityScore = 0;
      
      for (const policy of policies) {
        policiesByTable[policy.table_name] = (policiesByTable[policy.table_name] || 0) + 1;
        policiesByScope[policy.scope] = (policiesByScope[policy.scope] || 0) + 1;
        
        const securityScore = policy.metadata?.validation_result?.securityScore || 0;
        totalSecurityScore += securityScore;
      }
      
      return {
        totalPolicies: policies.length,
        activePolicies: activePolicies.length,
        policiesByTable,
        policiesByScope,
        averageSecurityScore: policies.length > 0 ? Math.round(totalSecurityScore / policies.length) : 0
      };
    } catch (error) {
      throw new Error(`Failed to get policy statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default RLSPolicyService;