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
export declare class AlertRuleModel {
    /**
     * Create a new alert rule
     */
    static create(ruleData: AlertRuleData): Promise<AlertRule | null>;
    /**
     * Get all alert rules with filtering
     */
    static getAlertRules(filters?: AlertRuleFilters, page?: number, limit?: number): Promise<{
        rules: AlertRule[];
        total: number;
    }>;
    /**
     * Get alert rule by ID
     */
    static getById(id: string): Promise<AlertRule | null>;
    /**
     * Update alert rule
     */
    static update(id: string, updates: Partial<AlertRuleData>): Promise<AlertRule | null>;
    /**
     * Toggle alert rule active status
     */
    static toggleActive(id: string): Promise<AlertRule | null>;
    /**
     * Delete alert rule
     */
    static delete(id: string): Promise<boolean>;
    /**
     * Get active alert rules for evaluation
     */
    static getActiveRules(): Promise<AlertRule[]>;
    /**
     * Get alert rules by metric type
     */
    static getByMetricType(metricType: MetricType): Promise<AlertRule[]>;
    /**
     * Get alert rules created by specific admin
     */
    static getByCreator(adminId: string): Promise<AlertRule[]>;
    /**
     * Evaluate metric value against alert rules
     */
    static evaluateMetric(metricType: MetricType, metricValue: number): Promise<AlertRule[]>;
    /**
     * Create default alert rules for new system
     */
    static createDefaultRules(adminId: string): Promise<AlertRule[]>;
    /**
     * Get alert rules summary statistics
     */
    static getStatistics(): Promise<{
        totalRules: number;
        activeRules: number;
        inactiveRules: number;
        rulesByMetricType: Record<MetricType, number>;
        rulesByNotificationChannel: Record<NotificationChannel, number>;
    }>;
    /**
     * Bulk update alert rule status
     */
    static bulkUpdateStatus(ruleIds: string[], isActive: boolean): Promise<AlertRule[]>;
    /**
     * Validate alert rule configuration
     */
    static validateRule(ruleData: AlertRuleData): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Get recently triggered rules (for dashboard)
     */
    static getRecentlyTriggered(hours?: number): Promise<{
        ruleId: string;
        ruleName: string;
        metricType: MetricType;
        triggerCount: number;
        lastTriggered: string;
    }[]>;
}
//# sourceMappingURL=alert-rules.d.ts.map