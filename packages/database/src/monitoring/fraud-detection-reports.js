"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudDetectionReportModel = void 0;
const supabase_1 = require("../client/supabase");
class FraudDetectionReportModel {
    /**
     * Create or update fraud detection report for a store and date
     */
    static async upsertReport(reportData) {
        // First try to get existing report
        const { data: existing } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('id')
            .eq('report_date', reportData.reportDate)
            .eq('store_id', reportData.storeId)
            .single();
        let result;
        if (existing) {
            // Update existing report
            result = await supabase_1.supabase
                .from('fraud_detection_reports')
                .update({
                verification_failure_rate: reportData.verificationFailureRate,
                suspicious_patterns: reportData.suspiciousPatterns || {},
                blocked_transactions: reportData.blockedTransactions,
                false_positive_rate: reportData.falsePositiveRate,
                accuracy_metrics: reportData.accuracyMetrics || {},
                updated_at: new Date().toISOString()
            })
                .eq('id', existing.id)
                .select()
                .single();
        }
        else {
            // Insert new report
            result = await supabase_1.supabase
                .from('fraud_detection_reports')
                .insert({
                report_date: reportData.reportDate,
                store_id: reportData.storeId,
                verification_failure_rate: reportData.verificationFailureRate,
                suspicious_patterns: reportData.suspiciousPatterns || {},
                blocked_transactions: reportData.blockedTransactions,
                false_positive_rate: reportData.falsePositiveRate,
                accuracy_metrics: reportData.accuracyMetrics || {}
            })
                .select()
                .single();
        }
        if (result.error) {
            console.error('Error upserting fraud detection report:', result.error);
            return null;
        }
        return result.data;
    }
    /**
     * Get fraud detection reports with filtering
     */
    static async getReports(filters, page = 1, limit = 50) {
        let query = supabase_1.supabase
            .from('fraud_detection_reports')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.storeId) {
            query = query.eq('store_id', filters.storeId);
        }
        if (filters?.startDate) {
            query = query.gte('report_date', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('report_date', filters.endDate);
        }
        if (filters?.minFailureRate !== undefined) {
            query = query.gte('verification_failure_rate', filters.minFailureRate);
        }
        if (filters?.maxFailureRate !== undefined) {
            query = query.lte('verification_failure_rate', filters.maxFailureRate);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('report_date', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching fraud detection reports:', error);
            return { reports: [], total: 0 };
        }
        return {
            reports: data || [],
            total: count || 0
        };
    }
    /**
     * Get report by store and date
     */
    static async getByStoreAndDate(storeId, reportDate) {
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('*')
            .eq('store_id', storeId)
            .eq('report_date', reportDate)
            .single();
        if (error) {
            console.error('Error fetching fraud report by store and date:', error);
            return null;
        }
        return data;
    }
    /**
     * Get fraud trends for a store
     */
    static async getStoreFraudTrends(storeId, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('report_date, verification_failure_rate, blocked_transactions, false_positive_rate')
            .eq('store_id', storeId)
            .gte('report_date', startDateStr)
            .lte('report_date', endDate)
            .order('report_date', { ascending: true });
        if (error) {
            console.error('Error fetching store fraud trends:', error);
            return {
                trends: [],
                summary: {
                    avgFailureRate: 0,
                    totalBlockedTransactions: 0,
                    avgFalsePositiveRate: 0,
                    trendDirection: 'stable'
                }
            };
        }
        const trends = (data || []).map(report => ({
            date: report.report_date,
            verificationFailureRate: report.verification_failure_rate,
            blockedTransactions: report.blocked_transactions,
            falsePositiveRate: report.false_positive_rate || 0
        }));
        // Calculate summary statistics
        const avgFailureRate = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.verificationFailureRate, 0) / trends.length
            : 0;
        const totalBlockedTransactions = trends.reduce((sum, t) => sum + t.blockedTransactions, 0);
        const avgFalsePositiveRate = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.falsePositiveRate, 0) / trends.length
            : 0;
        // Determine trend direction (compare first half vs second half)
        let trendDirection = 'stable';
        if (trends.length >= 4) {
            const halfPoint = Math.floor(trends.length / 2);
            const firstHalfAvg = trends.slice(0, halfPoint)
                .reduce((sum, t) => sum + t.verificationFailureRate, 0) / halfPoint;
            const secondHalfAvg = trends.slice(halfPoint)
                .reduce((sum, t) => sum + t.verificationFailureRate, 0) / (trends.length - halfPoint);
            if (secondHalfAvg < firstHalfAvg - 1) {
                trendDirection = 'improving'; // Failure rate decreasing
            }
            else if (secondHalfAvg > firstHalfAvg + 1) {
                trendDirection = 'degrading'; // Failure rate increasing
            }
        }
        return {
            trends,
            summary: {
                avgFailureRate: Math.round(avgFailureRate * 100) / 100,
                totalBlockedTransactions,
                avgFalsePositiveRate: Math.round(avgFalsePositiveRate * 100) / 100,
                trendDirection
            }
        };
    }
    /**
     * Get fraud statistics across all stores
     */
    static async getGlobalFraudStats(days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('store_id, verification_failure_rate, blocked_transactions, suspicious_patterns')
            .gte('report_date', startDateStr)
            .lte('report_date', endDate);
        if (error) {
            console.error('Error fetching global fraud stats:', error);
            return {
                totalReports: 0,
                avgFailureRate: 0,
                totalBlockedTransactions: 0,
                storesWithHighFraud: 0,
                topSuspiciousPatterns: []
            };
        }
        const totalReports = data?.length || 0;
        const avgFailureRate = totalReports > 0
            ? data.reduce((sum, r) => sum + r.verification_failure_rate, 0) / totalReports
            : 0;
        const totalBlockedTransactions = data?.reduce((sum, r) => sum + r.blocked_transactions, 0) || 0;
        // Count stores with high fraud (>10% failure rate)
        const storesWithHighFraud = new Set(data?.filter(r => r.verification_failure_rate > 10)
            .map(r => r.store_id)).size;
        // Aggregate suspicious patterns
        const patternStats = {};
        data?.forEach(report => {
            if (report.suspicious_patterns) {
                Object.keys(report.suspicious_patterns).forEach(patternType => {
                    if (!patternStats[patternType]) {
                        patternStats[patternType] = { count: 0, stores: new Set() };
                    }
                    patternStats[patternType].count += report.suspicious_patterns[patternType] || 0;
                    patternStats[patternType].stores.add(report.store_id);
                });
            }
        });
        const topSuspiciousPatterns = Object.keys(patternStats)
            .map(patternType => ({
            patternType,
            totalOccurrences: patternStats[patternType].count,
            affectedStores: patternStats[patternType].stores.size
        }))
            .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
            .slice(0, 10);
        return {
            totalReports,
            avgFailureRate: Math.round(avgFailureRate * 100) / 100,
            totalBlockedTransactions,
            storesWithHighFraud,
            topSuspiciousPatterns
        };
    }
    /**
     * Get stores with concerning fraud patterns
     */
    static async getHighRiskStores(failureRateThreshold = 15, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('store_id, verification_failure_rate, blocked_transactions, report_date')
            .gte('report_date', startDateStr)
            .lte('report_date', endDate)
            .order('report_date', { ascending: false });
        if (error) {
            console.error('Error fetching high risk stores:', error);
            return [];
        }
        // Group by store and calculate metrics
        const storeMetrics = {};
        data?.forEach(report => {
            if (!storeMetrics[report.store_id]) {
                storeMetrics[report.store_id] = {
                    failureRates: [],
                    totalBlocked: 0,
                    lastReportDate: report.report_date
                };
            }
            storeMetrics[report.store_id].failureRates.push(report.verification_failure_rate);
            storeMetrics[report.store_id].totalBlocked += report.blocked_transactions;
            // Update last report date if this is more recent
            if (report.report_date > storeMetrics[report.store_id].lastReportDate) {
                storeMetrics[report.store_id].lastReportDate = report.report_date;
            }
        });
        // Calculate risk levels and filter high-risk stores
        const highRiskStores = Object.keys(storeMetrics)
            .map(storeId => {
            const metrics = storeMetrics[storeId];
            const avgFailureRate = metrics.failureRates.reduce((sum, rate) => sum + rate, 0) / metrics.failureRates.length;
            const latestFailureRate = metrics.failureRates[0]; // Most recent first
            let riskLevel = 'low';
            if (avgFailureRate >= 30) {
                riskLevel = 'critical';
            }
            else if (avgFailureRate >= 20) {
                riskLevel = 'high';
            }
            else if (avgFailureRate >= 10) {
                riskLevel = 'medium';
            }
            return {
                storeId,
                latestFailureRate: Math.round(latestFailureRate * 100) / 100,
                avgFailureRate: Math.round(avgFailureRate * 100) / 100,
                totalBlockedTransactions: metrics.totalBlocked,
                riskLevel,
                lastReportDate: metrics.lastReportDate
            };
        })
            .filter(store => store.avgFailureRate >= failureRateThreshold)
            .sort((a, b) => b.avgFailureRate - a.avgFailureRate);
        return highRiskStores;
    }
    /**
     * Update suspicious patterns for a report
     */
    static async updateSuspiciousPatterns(storeId, reportDate, patterns) {
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .update({
            suspicious_patterns: patterns,
            updated_at: new Date().toISOString()
        })
            .eq('store_id', storeId)
            .eq('report_date', reportDate)
            .select()
            .single();
        if (error) {
            console.error('Error updating suspicious patterns:', error);
            return null;
        }
        return data;
    }
    /**
     * Update accuracy metrics for a report
     */
    static async updateAccuracyMetrics(storeId, reportDate, metrics) {
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .update({
            accuracy_metrics: metrics,
            false_positive_rate: (metrics.falsePositives / (metrics.falsePositives + metrics.trueNegatives)) * 100,
            updated_at: new Date().toISOString()
        })
            .eq('store_id', storeId)
            .eq('report_date', reportDate)
            .select()
            .single();
        if (error) {
            console.error('Error updating accuracy metrics:', error);
            return null;
        }
        return data;
    }
    /**
     * Get fraud detection performance metrics
     */
    static async getPerformanceMetrics(days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .select('accuracy_metrics')
            .gte('report_date', startDateStr)
            .lte('report_date', endDate)
            .not('accuracy_metrics', 'is', null);
        if (error) {
            console.error('Error fetching performance metrics:', error);
            return {
                overallAccuracy: 0,
                avgPrecision: 0,
                avgRecall: 0,
                avgF1Score: 0,
                totalValidated: 0,
                modelPerformance: 'poor'
            };
        }
        let totalTP = 0, totalFP = 0, totalTN = 0, totalFN = 0;
        let totalPrecision = 0, totalRecall = 0, totalF1 = 0;
        let validReports = 0;
        data?.forEach(report => {
            const metrics = report.accuracy_metrics;
            if (metrics) {
                totalTP += metrics.truePositives;
                totalFP += metrics.falsePositives;
                totalTN += metrics.trueNegatives;
                totalFN += metrics.falseNegatives;
                if (metrics.precision !== undefined)
                    totalPrecision += metrics.precision;
                if (metrics.recall !== undefined)
                    totalRecall += metrics.recall;
                if (metrics.f1Score !== undefined)
                    totalF1 += metrics.f1Score;
                validReports++;
            }
        });
        const totalValidated = totalTP + totalFP + totalTN + totalFN;
        const overallAccuracy = totalValidated > 0 ? ((totalTP + totalTN) / totalValidated) * 100 : 0;
        const avgPrecision = validReports > 0 ? totalPrecision / validReports : 0;
        const avgRecall = validReports > 0 ? totalRecall / validReports : 0;
        const avgF1Score = validReports > 0 ? totalF1 / validReports : 0;
        let modelPerformance = 'poor';
        if (avgF1Score >= 0.9) {
            modelPerformance = 'excellent';
        }
        else if (avgF1Score >= 0.8) {
            modelPerformance = 'good';
        }
        else if (avgF1Score >= 0.7) {
            modelPerformance = 'fair';
        }
        return {
            overallAccuracy: Math.round(overallAccuracy * 100) / 100,
            avgPrecision: Math.round(avgPrecision * 100) / 100,
            avgRecall: Math.round(avgRecall * 100) / 100,
            avgF1Score: Math.round(avgF1Score * 100) / 100,
            totalValidated,
            modelPerformance
        };
    }
    /**
     * Generate fraud alert summary
     */
    static async generateAlertSummary() {
        const highRiskStores = await this.getHighRiskStores(20, 7); // 20% threshold, last 7 days
        const globalStats = await this.getGlobalFraudStats(7);
        const criticalAlerts = highRiskStores.filter(store => store.riskLevel === 'critical').length;
        const newHighRiskStores = highRiskStores.filter(store => store.riskLevel === 'high').length;
        const recommendedActions = [];
        if (criticalAlerts > 0) {
            recommendedActions.push(`Immediate review required for ${criticalAlerts} stores with critical fraud levels`);
        }
        if (globalStats.avgFailureRate > 15) {
            recommendedActions.push('System-wide fraud patterns detected - review verification algorithms');
        }
        if (globalStats.totalBlockedTransactions > 1000) {
            recommendedActions.push('High volume of blocked transactions - validate fraud detection rules');
        }
        if (newHighRiskStores > 5) {
            recommendedActions.push('Multiple stores showing elevated fraud - investigate common factors');
        }
        return {
            criticalAlerts,
            newHighRiskStores,
            recentTrendChanges: highRiskStores.filter(s => s.riskLevel !== 'low').length,
            recommendedActions
        };
    }
    /**
     * Clean up old fraud reports (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('fraud_detection_reports')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old fraud reports:', error);
            return 0;
        }
        return data?.length || 0;
    }
}
exports.FraudDetectionReportModel = FraudDetectionReportModel;
//# sourceMappingURL=fraud-detection-reports.js.map