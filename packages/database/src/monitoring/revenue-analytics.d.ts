export type RevenueAnalytics = {
    id: string;
    report_date: string;
    store_id: string;
    total_rewards_paid: number;
    admin_fees_collected: number;
    net_revenue: number;
    feedback_volume: number;
    customer_engagement_rate?: number;
    reward_distribution: Record<string, number>;
    created_at: string;
    updated_at: string;
};
export type RevenueAnalyticsInsert = Omit<RevenueAnalytics, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
};
export type RevenueAnalyticsUpdate = Partial<Omit<RevenueAnalytics, 'id' | 'created_at'>>;
export interface RevenueData {
    reportDate: string;
    storeId: string;
    totalRewardsPaid: number;
    adminFeesCollected: number;
    netRevenue: number;
    feedbackVolume: number;
    customerEngagementRate?: number;
    rewardDistribution?: Record<string, number>;
}
export interface RevenueFilters {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    minRevenue?: number;
    maxRevenue?: number;
}
export interface RewardGradeDistribution {
    grade_a: number;
    grade_b: number;
    grade_c: number;
    grade_d: number;
    [gradeName: string]: number;
}
export declare class RevenueAnalyticsModel {
    /**
     * Create or update revenue analytics for a store and date
     */
    static upsertRevenue(revenueData: RevenueData): Promise<RevenueAnalytics | null>;
    /**
     * Get revenue analytics with filtering
     */
    static getRevenueAnalytics(filters?: RevenueFilters, page?: number, limit?: number): Promise<{
        analytics: RevenueAnalytics[];
        total: number;
    }>;
    /**
     * Get revenue analytics by store and date
     */
    static getByStoreAndDate(storeId: string, reportDate: string): Promise<RevenueAnalytics | null>;
    /**
     * Get revenue trends for a store
     */
    static getStoreRevenueTrends(storeId: string, days?: number): Promise<{
        trends: {
            date: string;
            totalRewardsPaid: number;
            adminFeesCollected: number;
            netRevenue: number;
            feedbackVolume: number;
            customerEngagementRate: number;
        }[];
        summary: {
            totalRevenue: number;
            avgDailyRevenue: number;
            totalFeedback: number;
            avgEngagementRate: number;
            revenueGrowth: number;
        };
    }>;
    /**
     * Get aggregated revenue statistics
     */
    static getAggregatedStats(storeIds?: string[], days?: number): Promise<{
        totalRevenue: number;
        totalRewardsPaid: number;
        totalAdminFees: number;
        totalFeedbackVolume: number;
        avgEngagementRate: number;
        topPerformingStores: {
            storeId: string;
            revenue: number;
            feedbackVolume: number;
        }[];
        rewardDistributionSummary: RewardGradeDistribution;
    }>;
    /**
     * Get revenue comparison between periods
     */
    static getRevenueComparison(storeId?: string, currentPeriodDays?: number, previousPeriodDays?: number): Promise<{
        currentPeriod: {
            revenue: number;
            rewardsPaid: number;
            feedbackVolume: number;
            avgDailyRevenue: number;
        };
        previousPeriod: {
            revenue: number;
            rewardsPaid: number;
            feedbackVolume: number;
            avgDailyRevenue: number;
        };
        growth: {
            revenue: number;
            rewardsPaid: number;
            feedbackVolume: number;
        };
    }>;
    /**
     * Get reward distribution analysis
     */
    static getRewardDistributionAnalysis(storeId?: string, days?: number): Promise<{
        totalRewards: number;
        gradeDistribution: RewardGradeDistribution & {
            percentage: RewardGradeDistribution;
        };
        avgRewardPerFeedback: number;
        engagementTrends: {
            date: string;
            engagementRate: number;
            feedbackVolume: number;
        }[];
    }>;
    /**
     * Get profitability analysis
     */
    static getProfitabilityAnalysis(storeId?: string, days?: number): Promise<{
        totalRevenue: number;
        totalCosts: number;
        netProfit: number;
        profitMargin: number;
        costPerFeedback: number;
        revenuePerFeedback: number;
        breakEvenPoint: number;
        profitabilityTrend: 'improving' | 'declining' | 'stable';
    }>;
    /**
     * Generate revenue insights
     */
    static generateRevenueInsights(days?: number): Promise<{
        keyMetrics: {
            totalRevenue: number;
            revenueGrowth: number;
            avgDailyRevenue: number;
            topStore: {
                storeId: string;
                revenue: number;
            } | null;
        };
        insights: string[];
        recommendations: string[];
    }>;
    /**
     * Clean up old revenue analytics (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
}
//# sourceMappingURL=revenue-analytics.d.ts.map