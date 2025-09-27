export type FraudDetectionReport = {
    id: string;
    report_date: string;
    store_id: string;
    verification_failure_rate: number;
    suspicious_patterns: Record<string, any>;
    blocked_transactions: number;
    false_positive_rate?: number;
    accuracy_metrics: Record<string, any>;
    created_at: string;
    updated_at: string;
};
export type FraudDetectionReportInsert = Omit<FraudDetectionReport, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
};
export type FraudDetectionReportUpdate = Partial<Omit<FraudDetectionReport, 'id' | 'created_at'>>;
export interface FraudReportData {
    reportDate: string;
    storeId: string;
    verificationFailureRate: number;
    suspiciousPatterns?: Record<string, any>;
    blockedTransactions: number;
    falsePositiveRate?: number;
    accuracyMetrics?: Record<string, any>;
}
export interface FraudReportFilters {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    minFailureRate?: number;
    maxFailureRate?: number;
}
export interface SuspiciousPattern {
    patternType: 'multiple_submissions' | 'rapid_succession' | 'invalid_data' | 'suspicious_timing' | 'location_anomaly';
    count: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
}
export interface AccuracyMetric {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1Score: number;
}
export declare class FraudDetectionReportModel {
    /**
     * Create or update fraud detection report for a store and date
     */
    static upsertReport(reportData: FraudReportData): Promise<FraudDetectionReport | null>;
    /**
     * Get fraud detection reports with filtering
     */
    static getReports(filters?: FraudReportFilters, page?: number, limit?: number): Promise<{
        reports: FraudDetectionReport[];
        total: number;
    }>;
    /**
     * Get report by store and date
     */
    static getByStoreAndDate(storeId: string, reportDate: string): Promise<FraudDetectionReport | null>;
    /**
     * Get fraud trends for a store
     */
    static getStoreFraudTrends(storeId: string, days?: number): Promise<{
        trends: {
            date: string;
            verificationFailureRate: number;
            blockedTransactions: number;
            falsePositiveRate: number;
        }[];
        summary: {
            avgFailureRate: number;
            totalBlockedTransactions: number;
            avgFalsePositiveRate: number;
            trendDirection: 'improving' | 'degrading' | 'stable';
        };
    }>;
    /**
     * Get fraud statistics across all stores
     */
    static getGlobalFraudStats(days?: number): Promise<{
        totalReports: number;
        avgFailureRate: number;
        totalBlockedTransactions: number;
        storesWithHighFraud: number;
        topSuspiciousPatterns: {
            patternType: string;
            totalOccurrences: number;
            affectedStores: number;
        }[];
    }>;
    /**
     * Get stores with concerning fraud patterns
     */
    static getHighRiskStores(failureRateThreshold?: number, days?: number): Promise<{
        storeId: string;
        latestFailureRate: number;
        avgFailureRate: number;
        totalBlockedTransactions: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        lastReportDate: string;
    }[]>;
    /**
     * Update suspicious patterns for a report
     */
    static updateSuspiciousPatterns(storeId: string, reportDate: string, patterns: Record<string, number>): Promise<FraudDetectionReport | null>;
    /**
     * Update accuracy metrics for a report
     */
    static updateAccuracyMetrics(storeId: string, reportDate: string, metrics: AccuracyMetric): Promise<FraudDetectionReport | null>;
    /**
     * Get fraud detection performance metrics
     */
    static getPerformanceMetrics(days?: number): Promise<{
        overallAccuracy: number;
        avgPrecision: number;
        avgRecall: number;
        avgF1Score: number;
        totalValidated: number;
        modelPerformance: 'excellent' | 'good' | 'fair' | 'poor';
    }>;
    /**
     * Generate fraud alert summary
     */
    static generateAlertSummary(): Promise<{
        criticalAlerts: number;
        newHighRiskStores: number;
        recentTrendChanges: number;
        recommendedActions: string[];
    }>;
    /**
     * Clean up old fraud reports (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
}
//# sourceMappingURL=fraud-detection-reports.d.ts.map