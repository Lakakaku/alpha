import { supabase } from '../client/supabase';
import type { Database } from '../types';

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

export type ActionType = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'upload' | 'view';
export type ResourceType = 'store' | 'admin' | 'session' | 'upload' | 'system';

export interface AuditLogEntry {
  adminId: string;
  actionType: ActionType;
  resourceType: ResourceType;
  resourceId?: string;
  actionDetails: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogModel {
  /**
   * Log an admin action
   */
  static async log(entry: AuditLogEntry): Promise<AuditLog | null> {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        admin_id: entry.adminId,
        action_type: entry.actionType,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        action_details: {
          description: entry.actionDetails.description || `${entry.actionType} ${entry.resourceType}`,
          ...entry.actionDetails
        },
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        success: entry.success,
        error_message: entry.errorMessage,
        performed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging audit entry:', error);
      return null;
    }

    return data;
  }

  /**
   * Get audit logs with pagination
   */
  static async getAll(
    page = 1, 
    limit = 50, 
    filters?: {
      adminId?: string;
      actionType?: ActionType;
      resourceType?: ResourceType;
      success?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.adminId) {
      query = query.eq('admin_id', filters.adminId);
    }
    if (filters?.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.success !== undefined) {
      query = query.eq('success', filters.success);
    }
    if (filters?.startDate) {
      query = query.gte('performed_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('performed_at', filters.endDate);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('performed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return { logs: [], total: 0 };
    }

    return { 
      logs: data || [], 
      total: count || 0 
    };
  }

  /**
   * Get audit logs for specific admin
   */
  static async getByAdmin(adminId: string, limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs by admin:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get audit logs for specific resource
   */
  static async getByResource(
    resourceType: ResourceType, 
    resourceId: string, 
    limit = 50
  ): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs by resource:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get recent failed actions
   */
  static async getRecentFailures(hours = 24, limit = 100): Promise<AuditLog[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('success', false)
      .gte('performed_at', since.toISOString())
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent failures:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Log login action
   */
  static async logLogin(
    adminId: string, 
    ipAddress: string, 
    userAgent: string, 
    success: boolean,
    errorMessage?: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'login',
      resourceType: 'admin',
      resourceId: adminId,
      actionDetails: {
        description: 'Admin login attempt'
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  /**
   * Log logout action
   */
  static async logLogout(
    adminId: string, 
    ipAddress: string, 
    userAgent: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'logout',
      resourceType: 'admin',
      resourceId: adminId,
      actionDetails: {
        description: 'Admin logout'
      },
      ipAddress,
      userAgent,
      success: true
    });
  }

  /**
   * Log store creation
   */
  static async logStoreCreate(
    adminId: string,
    storeId: string,
    storeData: any,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'create',
      resourceType: 'store',
      resourceId: storeId,
      actionDetails: {
        description: `Created store: ${storeData.name}`,
        store_name: storeData.name,
        store_email: storeData.business_email
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  /**
   * Log store update
   */
  static async logStoreUpdate(
    adminId: string,
    storeId: string,
    changes: any,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'update',
      resourceType: 'store',
      resourceId: storeId,
      actionDetails: {
        description: 'Updated store information',
        changes
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  /**
   * Log database upload
   */
  static async logDatabaseUpload(
    adminId: string,
    storeId: string,
    uploadDetails: any,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'upload',
      resourceType: 'store',
      resourceId: storeId,
      actionDetails: {
        description: 'Database upload',
        file_name: uploadDetails.fileName,
        record_count: uploadDetails.recordCount,
        week_start: uploadDetails.weekStart
      },
      ipAddress,
      userAgent,
      success,
      errorMessage
    });
  }

  /**
   * Log store view
   */
  static async logStoreView(
    adminId: string,
    storeId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuditLog | null> {
    return this.log({
      adminId,
      actionType: 'view',
      resourceType: 'store',
      resourceId: storeId,
      actionDetails: {
        description: 'Viewed store details'
      },
      ipAddress,
      userAgent,
      success: true
    });
  }

  /**
   * Get audit statistics
   */
  static async getStatistics(days = 7): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionsByType: Record<ActionType, number>;
    actionsByResource: Record<ResourceType, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('audit_logs')
      .select('action_type, resource_type, success')
      .gte('performed_at', since.toISOString());

    if (error) {
      console.error('Error fetching audit statistics:', error);
      return {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        actionsByType: {} as Record<ActionType, number>,
        actionsByResource: {} as Record<ResourceType, number>
      };
    }

    const totalActions = data.length;
    const successfulActions = data.filter(log => log.success).length;
    const failedActions = totalActions - successfulActions;

    const actionsByType: Record<ActionType, number> = {} as Record<ActionType, number>;
    const actionsByResource: Record<ResourceType, number> = {} as Record<ResourceType, number>;

    data.forEach(log => {
      actionsByType[log.action_type] = (actionsByType[log.action_type] || 0) + 1;
      actionsByResource[log.resource_type] = (actionsByResource[log.resource_type] || 0) + 1;
    });

    return {
      totalActions,
      successfulActions,
      failedActions,
      actionsByType,
      actionsByResource
    };
  }

  /**
   * Delete old audit logs (cleanup)
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('performed_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error deleting old audit logs:', error);
      return 0;
    }

    return data?.length || 0;
  }
}