import { supabase } from '../client/supabase';
import type { Database } from '../types';

// Note: These types will be properly typed once the monitoring tables are added to the database schema
export type AlertRule = {
  id: string;
  rule_name: string;
  metric_type: string;
  threshold_value: number;
  comparison_operator: string;
  notification_channels: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AlertRuleInsert = Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type AlertRuleUpdate = Partial<Omit<AlertRule, 'id' | 'created_at'>>;

export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '=';
export type NotificationChannel = 'email' | 'dashboard' | 'sms';
export type MetricType = 'api_response_time' | 'cpu_usage' | 'memory_usage' | 'error_rate';

export interface AlertRuleData {
  ruleName: string;
  metricType: MetricType;
  thresholdValue: number;
  comparisonOperator: ComparisonOperator;
  notificationChannels: NotificationChannel[];
  isActive?: boolean;
  createdBy: string;
}

export interface AlertRuleFilters {
  metricType?: MetricType;
  isActive?: boolean;
  createdBy?: string;
}

export class AlertRuleModel {
  /**
   * Create a new alert rule
   */
  static async create(ruleData: AlertRuleData): Promise<AlertRule | null> {
    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        rule_name: ruleData.ruleName,
        metric_type: ruleData.metricType,
        threshold_value: ruleData.thresholdValue,
        comparison_operator: ruleData.comparisonOperator,
        notification_channels: ruleData.notificationChannels,
        is_active: ruleData.isActive ?? true,
        created_by: ruleData.createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating alert rule:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all alert rules with filtering
   */
  static async getAlertRules(
    filters?: AlertRuleFilters,
    page = 1,
    limit = 50
  ): Promise<{ rules: AlertRule[]; total: number }> {
    let query = supabase
      .from('alert_rules')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.metricType) {
      query = query.eq('metric_type', filters.metricType);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    if (filters?.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching alert rules:', error);
      return { rules: [], total: 0 };
    }

    return {
      rules: data || [],
      total: count || 0
    };
  }

  /**
   * Get alert rule by ID
   */
  static async getById(id: string): Promise<AlertRule | null> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching alert rule by ID:', error);
      return null;
    }

    return data;
  }

  /**
   * Update alert rule
   */
  static async update(
    id: string,
    updates: Partial<AlertRuleData>
  ): Promise<AlertRule | null> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.ruleName !== undefined) updateData.rule_name = updates.ruleName;
    if (updates.metricType !== undefined) updateData.metric_type = updates.metricType;
    if (updates.thresholdValue !== undefined) updateData.threshold_value = updates.thresholdValue;
    if (updates.comparisonOperator !== undefined) updateData.comparison_operator = updates.comparisonOperator;
    if (updates.notificationChannels !== undefined) updateData.notification_channels = updates.notificationChannels;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('alert_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating alert rule:', error);
      return null;
    }

    return data;
  }

  /**
   * Toggle alert rule active status
   */
  static async toggleActive(id: string): Promise<AlertRule | null> {
    // Get current status first
    const current = await this.getById(id);
    if (!current) return null;

    return this.update(id, { isActive: !current.is_active });
  }

  /**
   * Delete alert rule
   */
  static async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting alert rule:', error);
      return false;
    }

    return true;
  }

  /**
   * Get active alert rules for evaluation
   */
  static async getActiveRules(): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active alert rules:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get alert rules by metric type
   */
  static async getByMetricType(metricType: MetricType): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('metric_type', metricType)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alert rules by metric type:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get alert rules created by specific admin
   */
  static async getByCreator(adminId: string): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('created_by', adminId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alert rules by creator:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Evaluate metric value against alert rules
   */
  static async evaluateMetric(
    metricType: MetricType,
    metricValue: number
  ): Promise<AlertRule[]> {
    const rules = await this.getByMetricType(metricType);

    return rules.filter(rule => {
      switch (rule.comparison_operator) {
        case '>':
          return metricValue > rule.threshold_value;
        case '<':
          return metricValue < rule.threshold_value;
        case '>=':
          return metricValue >= rule.threshold_value;
        case '<=':
          return metricValue <= rule.threshold_value;
        case '=':
          return metricValue === rule.threshold_value;
        default:
          return false;
      }
    });
  }

  /**
   * Create default alert rules for new system
   */
  static async createDefaultRules(adminId: string): Promise<AlertRule[]> {
    const defaultRules: AlertRuleData[] = [
      {
        ruleName: 'High API Response Time',
        metricType: 'api_response_time',
        thresholdValue: 2000, // 2 seconds
        comparisonOperator: '>',
        notificationChannels: ['email', 'dashboard'],
        createdBy: adminId
      },
      {
        ruleName: 'High Error Rate',
        metricType: 'error_rate',
        thresholdValue: 5, // 5%
        comparisonOperator: '>',
        notificationChannels: ['email', 'dashboard', 'sms'],
        createdBy: adminId
      },
      {
        ruleName: 'High CPU Usage',
        metricType: 'cpu_usage',
        thresholdValue: 80, // 80%
        comparisonOperator: '>',
        notificationChannels: ['email', 'dashboard'],
        createdBy: adminId
      },
      {
        ruleName: 'High Memory Usage',
        metricType: 'memory_usage',
        thresholdValue: 85, // 85%
        comparisonOperator: '>',
        notificationChannels: ['email', 'dashboard'],
        createdBy: adminId
      },
      {
        ruleName: 'Critical API Response Time',
        metricType: 'api_response_time',
        thresholdValue: 5000, // 5 seconds
        comparisonOperator: '>',
        notificationChannels: ['email', 'dashboard', 'sms'],
        createdBy: adminId
      }
    ];

    const createdRules: AlertRule[] = [];

    for (const ruleData of defaultRules) {
      const rule = await this.create(ruleData);
      if (rule) {
        createdRules.push(rule);
      }
    }

    return createdRules;
  }

  /**
   * Get alert rules summary statistics
   */
  static async getStatistics(): Promise<{
    totalRules: number;
    activeRules: number;
    inactiveRules: number;
    rulesByMetricType: Record<MetricType, number>;
    rulesByNotificationChannel: Record<NotificationChannel, number>;
  }> {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('metric_type, notification_channels, is_active');

    if (error) {
      console.error('Error fetching alert rules statistics:', error);
      return {
        totalRules: 0,
        activeRules: 0,
        inactiveRules: 0,
        rulesByMetricType: {} as Record<MetricType, number>,
        rulesByNotificationChannel: {} as Record<NotificationChannel, number>
      };
    }

    const totalRules = data?.length || 0;
    const activeRules = data?.filter(rule => rule.is_active).length || 0;
    const inactiveRules = totalRules - activeRules;

    const rulesByMetricType: Record<MetricType, number> = {
      'api_response_time': 0,
      'cpu_usage': 0,
      'memory_usage': 0,
      'error_rate': 0
    };

    const rulesByNotificationChannel: Record<NotificationChannel, number> = {
      'email': 0,
      'dashboard': 0,
      'sms': 0
    };

    data?.forEach(rule => {
      rulesByMetricType[rule.metric_type as MetricType]++;

      rule.notification_channels.forEach(channel => {
        rulesByNotificationChannel[channel as NotificationChannel]++;
      });
    });

    return {
      totalRules,
      activeRules,
      inactiveRules,
      rulesByMetricType,
      rulesByNotificationChannel
    };
  }

  /**
   * Bulk update alert rule status
   */
  static async bulkUpdateStatus(
    ruleIds: string[],
    isActive: boolean
  ): Promise<AlertRule[]> {
    const { data, error } = await supabase
      .from('alert_rules')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .in('id', ruleIds)
      .select();

    if (error) {
      console.error('Error bulk updating alert rules:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Validate alert rule configuration
   */
  static validateRule(ruleData: AlertRuleData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate rule name
    if (!ruleData.ruleName || ruleData.ruleName.trim().length === 0) {
      errors.push('Rule name is required');
    }

    // Validate threshold value
    if (ruleData.thresholdValue < 0) {
      errors.push('Threshold value must be non-negative');
    }

    // Validate notification channels
    if (!ruleData.notificationChannels || ruleData.notificationChannels.length === 0) {
      errors.push('At least one notification channel is required');
    }

    // Validate metric-specific thresholds
    if (ruleData.metricType === 'cpu_usage' || ruleData.metricType === 'memory_usage') {
      if (ruleData.thresholdValue > 100) {
        errors.push('CPU and memory usage thresholds cannot exceed 100%');
      }
    }

    if (ruleData.metricType === 'error_rate') {
      if (ruleData.thresholdValue > 100) {
        errors.push('Error rate threshold cannot exceed 100%');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get recently triggered rules (for dashboard)
   */
  static async getRecentlyTriggered(hours = 24): Promise<{
    ruleId: string;
    ruleName: string;
    metricType: MetricType;
    triggerCount: number;
    lastTriggered: string;
  }[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    // This would typically join with alert_notifications table
    // For now, we'll return the alert rules that could be triggered
    const { data, error } = await supabase
      .from('alert_rules')
      .select('id, rule_name, metric_type, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching recently triggered rules:', error);
      return [];
    }

    // This is a placeholder - in real implementation, you'd join with alert_notifications
    return (data || []).map(rule => ({
      ruleId: rule.id,
      ruleName: rule.rule_name,
      metricType: rule.metric_type as MetricType,
      triggerCount: 0, // Would come from notifications count
      lastTriggered: rule.updated_at
    }));
  }
}