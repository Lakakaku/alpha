export type BusinessPerformanceMetrics = {
    id: string;
    report_date: string;
    store_id: string;
    business_id: string;
    feedback_volume_trend?: number;
    verification_rate?: number;
    customer_satisfaction_score?: number;
    operational_metrics: Record<string, any>;
    created_at: string;
};
export type BusinessPerformanceMetricsInsert = Omit<BusinessPerformanceMetrics, 'id' | 'created_at'> & {
    id?: string;
    created_at?: string;
};
export type BusinessPerformanceMetricsUpdate = Partial<Omit<BusinessPerformanceMetrics, 'id' | 'created_at'>>;
export interface PerformanceData {
    reportDate: string;
    storeId: string;
    businessId: string;
    feedbackVolumeTrend?: number;
    verificationRate?: number;
    customerSatisfactionScore?: number;
    operationalMetrics?: Record<string, any>;
}
export interface PerformanceFilters {
    storeId?: string;
    businessId?: string;
    startDate?: string;
    endDate?: string;
    minSatisfactionScore?: number;
    maxSatisfactionScore?: number;
}
export interface OperationalMetrics {
    responseTime: number;
    uptime: number;
    errorRate: number;
    throughput: number;
    customerRetention: number;
    conversionRate: number;
    [metricName: string]: number;
}
export declare class BusinessPerformanceMetricsModel {
    /**
     * Create or update performance metrics for a store and date
     */
    static upsertMetrics(metricsData: PerformanceData): Promise<BusinessPerformanceMetrics | null>;
    /**
     * Get performance metrics with filtering
     */
    static getMetrics(filters?: PerformanceFilters, page?: number, limit?: number): Promise<{
        metrics: BusinessPerformanceMetrics[];
        total: number;
    }>;
    /**
     * Get metrics by store and date
     */
    static getByStoreAndDate(storeId: string, reportDate: string): Promise<BusinessPerformanceMetrics | null>;
    /**
     * Get performance trends for a store
     */
    static getStorePerformanceTrends(storeId: string, days?: number): Promise<{
        trends: {
            date: string;
            feedbackVolumeTrend: number;
            verificationRate: number;
            customerSatisfactionScore: number;
            operationalScore: number;
        }[];
        summary: {
            avgFeedbackTrend: number;
            avgVerificationRate: number;
            avgSatisfactionScore: number;
            avgOperationalScore: number;
            overallTrend: 'improving' | 'declining' | 'stable';
        };
    }>;
    /**
     * Get comparative performance analysis across stores
     */
    static getComparativeAnalysis(businessId?: string, days?: number): Promise<{
        stores: {
            storeId: string;
            avgSatisfactionScore: number;
            avgVerificationRate: number;
            operationalScore: number;
            performanceRank: number;
            performanceGrade: 'A' | 'B' | 'C' | 'D';
        }[];
        benchmarks: {
            topPerformerSatisfaction: number;
            avgSatisfaction: number;
            topPerformerVerification: number;
            avgVerification: number;
        };
    }>;
    /**
     * Get performance alerts for stores that need attention
     */
    static getPerformanceAlerts(businessId?: string, thresholds?: {
        minSatisfactionScore: number;
        minVerificationRate: number;
        minOperationalScore: number;
    }): Promise<{
        criticalAlerts: {
            storeId: string;
            issues: string[];
            satisfactionScore: number;
            verificationRate: number;
            operationalScore: number;
            lastReportDate: string;
        }[];
        totalAlertsCount: number;
    }>;
    /**
     * Calculate operational score from multiple metrics
     */
    private static calculateOperationalScore;
    /**
     * Generate performance insights for a business
     */
    static generatePerformanceInsights(businessId?: string, days?: number): Promise<{
        summary: {
            totalStores: number;
            avgSatisfactionScore: number;
            avgVerificationRate: number;
            topPerformingStore: string | null;
            underperformingStores: number;
        };
        insights: string[];
        recommendations: string[];
    }>;
    /**
     * Clean up old performance metrics (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
}
//# sourceMappingURL=business-performance-metrics.d.ts.map