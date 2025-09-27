export type UsageAnalytics = {
    id: string;
    date: string;
    service_name: string;
    daily_active_users: number;
    api_call_volume: number;
    feature_usage: Record<string, number>;
    created_at: string;
};
export type UsageAnalyticsInsert = Omit<UsageAnalytics, 'id' | 'created_at'> & {
    id?: string;
    created_at?: string;
};
export type UsageAnalyticsUpdate = Partial<Omit<UsageAnalytics, 'id' | 'created_at'>>;
export type ServiceName = 'backend' | 'customer_app' | 'business_app' | 'admin_app';
export interface UsageData {
    date: string;
    serviceName: ServiceName;
    dailyActiveUsers: number;
    apiCallVolume: number;
    featureUsage?: Record<string, number>;
}
export interface UsageFilters {
    serviceName?: ServiceName;
    startDate?: string;
    endDate?: string;
}
export interface FeatureUsageStats {
    qrScans?: number;
    feedbackCalls?: number;
    storeCreations?: number;
    adminLogins?: number;
    databaseUploads?: number;
    verificationRequests?: number;
    [featureName: string]: number | undefined;
}
export declare class UsageAnalyticsModel {
    /**
     * Upsert daily usage analytics
     */
    static upsertDailyUsage(usageData: UsageData): Promise<UsageAnalytics | null>;
    /**
     * Get usage analytics with filtering
     */
    static getUsageAnalytics(filters?: UsageFilters, page?: number, limit?: number): Promise<{
        analytics: UsageAnalytics[];
        total: number;
    }>;
    /**
     * Get usage analytics for a specific date and service
     */
    static getByDateAndService(date: string, serviceName: ServiceName): Promise<UsageAnalytics | null>;
    /**
     * Get aggregated usage statistics for a time period
     */
    static getAggregatedStats(serviceName?: ServiceName, days?: number): Promise<{
        totalDailyActiveUsers: number;
        totalApiCalls: number;
        avgDailyActiveUsers: number;
        avgApiCalls: number;
        featureUsageTotals: FeatureUsageStats;
    }>;
    /**
     * Get usage trends by service
     */
    static getUsageTrends(days?: number): Promise<{
        [serviceName: string]: {
            dates: string[];
            dailyActiveUsers: number[];
            apiCallVolume: number[];
        };
    }>;
    /**
     * Get top features by usage
     */
    static getTopFeatures(serviceName?: ServiceName, days?: number, limit?: number): Promise<{
        featureName: string;
        totalUsage: number;
        avgDailyUsage: number;
    }[]>;
    /**
     * Update feature usage for today
     */
    static updateFeatureUsage(serviceName: ServiceName, featureName: string, incrementValue?: number): Promise<UsageAnalytics | null>;
    /**
     * Record daily active user count
     */
    static recordDailyActiveUsers(serviceName: ServiceName, userCount: number, date?: string): Promise<UsageAnalytics | null>;
    /**
     * Record API call volume
     */
    static recordApiCallVolume(serviceName: ServiceName, callCount: number, date?: string): Promise<UsageAnalytics | null>;
    /**
     * Get usage comparison between periods
     */
    static getUsageComparison(serviceName: ServiceName, currentPeriodDays?: number, previousPeriodDays?: number): Promise<{
        currentPeriod: {
            totalUsers: number;
            totalApiCalls: number;
            avgDaily: {
                users: number;
                apiCalls: number;
            };
        };
        previousPeriod: {
            totalUsers: number;
            totalApiCalls: number;
            avgDaily: {
                users: number;
                apiCalls: number;
            };
        };
        growth: {
            users: number;
            apiCalls: number;
        };
    }>;
    /**
     * Clean up old usage analytics (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
}
//# sourceMappingURL=usage-analytics.d.ts.map