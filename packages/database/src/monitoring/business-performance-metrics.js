"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessPerformanceMetricsModel = void 0;
const supabase_1 = require("../client/supabase");
class BusinessPerformanceMetricsModel {
    /**
     * Create or update performance metrics for a store and date
     */
    static async upsertMetrics(metricsData) {
        // First try to get existing record
        const { data: existing } = await supabase_1.supabase
            .from('business_performance_metrics')
            .select('id')
            .eq('report_date', metricsData.reportDate)
            .eq('store_id', metricsData.storeId)
            .single();
        let result;
        if (existing) {
            // Update existing record
            result = await supabase_1.supabase
                .from('business_performance_metrics')
                .update({
                feedback_volume_trend: metricsData.feedbackVolumeTrend,
                verification_rate: metricsData.verificationRate,
                customer_satisfaction_score: metricsData.customerSatisfactionScore,
                operational_metrics: metricsData.operationalMetrics || {}
            })
                .eq('id', existing.id)
                .select()
                .single();
        }
        else {
            // Insert new record
            result = await supabase_1.supabase
                .from('business_performance_metrics')
                .insert({
                report_date: metricsData.reportDate,
                store_id: metricsData.storeId,
                business_id: metricsData.businessId,
                feedback_volume_trend: metricsData.feedbackVolumeTrend,
                verification_rate: metricsData.verificationRate,
                customer_satisfaction_score: metricsData.customerSatisfactionScore,
                operational_metrics: metricsData.operationalMetrics || {}
            })
                .select()
                .single();
        }
        if (result.error) {
            console.error('Error upserting business performance metrics:', result.error);
            return null;
        }
        return result.data;
    }
    /**
     * Get performance metrics with filtering
     */
    static async getMetrics(filters, page = 1, limit = 50) {
        let query = supabase_1.supabase
            .from('business_performance_metrics')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.storeId) {
            query = query.eq('store_id', filters.storeId);
        }
        if (filters?.businessId) {
            query = query.eq('business_id', filters.businessId);
        }
        if (filters?.startDate) {
            query = query.gte('report_date', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('report_date', filters.endDate);
        }
        if (filters?.minSatisfactionScore !== undefined) {
            query = query.gte('customer_satisfaction_score', filters.minSatisfactionScore);
        }
        if (filters?.maxSatisfactionScore !== undefined) {
            query = query.lte('customer_satisfaction_score', filters.maxSatisfactionScore);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('report_date', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching business performance metrics:', error);
            return { metrics: [], total: 0 };
        }
        return {
            metrics: data || [],
            total: count || 0
        };
    }
    /**
     * Get metrics by store and date
     */
    static async getByStoreAndDate(storeId, reportDate) {
        const { data, error } = await supabase_1.supabase
            .from('business_performance_metrics')
            .select('*')
            .eq('store_id', storeId)
            .eq('report_date', reportDate)
            .single();
        if (error) {
            console.error('Error fetching metrics by store and date:', error);
            return null;
        }
        return data;
    }
    /**
     * Get performance trends for a store
     */
    static async getStorePerformanceTrends(storeId, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('business_performance_metrics')
            .select('*')
            .eq('store_id', storeId)
            .gte('report_date', startDateStr)
            .lte('report_date', endDate)
            .order('report_date', { ascending: true });
        if (error) {
            console.error('Error fetching store performance trends:', error);
            return {
                trends: [],
                summary: {
                    avgFeedbackTrend: 0,
                    avgVerificationRate: 0,
                    avgSatisfactionScore: 0,
                    avgOperationalScore: 0,
                    overallTrend: 'stable'
                }
            };
        }
        const trends = (data || []).map(record => {
            // Calculate operational score from multiple metrics
            const operationalMetrics = record.operational_metrics || {};
            const operationalScore = this.calculateOperationalScore(operationalMetrics);
            return {
                date: record.report_date,
                feedbackVolumeTrend: record.feedback_volume_trend || 0,
                verificationRate: record.verification_rate || 0,
                customerSatisfactionScore: record.customer_satisfaction_score || 0,
                operationalScore
            };
        });
        // Calculate summary statistics
        const avgFeedbackTrend = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.feedbackVolumeTrend, 0) / trends.length
            : 0;
        const avgVerificationRate = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.verificationRate, 0) / trends.length
            : 0;
        const avgSatisfactionScore = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.customerSatisfactionScore, 0) / trends.length
            : 0;
        const avgOperationalScore = trends.length > 0
            ? trends.reduce((sum, t) => sum + t.operationalScore, 0) / trends.length
            : 0;
        // Determine overall trend
        let overallTrend = 'stable';
        if (trends.length >= 4) {
            const halfPoint = Math.floor(trends.length / 2);
            const firstHalfScore = trends.slice(0, halfPoint)
                .reduce((sum, t) => sum + (t.customerSatisfactionScore + t.operationalScore) / 2, 0) / halfPoint;
            const secondHalfScore = trends.slice(halfPoint)
                .reduce((sum, t) => sum + (t.customerSatisfactionScore + t.operationalScore) / 2, 0) / (trends.length - halfPoint);
            if (secondHalfScore > firstHalfScore + 5) {
                overallTrend = 'improving';
            }
            else if (secondHalfScore < firstHalfScore - 5) {
                overallTrend = 'declining';
            }
        }
        return {
            trends,
            summary: {
                avgFeedbackTrend: Math.round(avgFeedbackTrend * 100) / 100,
                avgVerificationRate: Math.round(avgVerificationRate * 100) / 100,
                avgSatisfactionScore: Math.round(avgSatisfactionScore * 100) / 100,
                avgOperationalScore: Math.round(avgOperationalScore * 100) / 100,
                overallTrend
            }
        };
    }
    /**
     * Get comparative performance analysis across stores
     */
    static async getComparativeAnalysis(businessId, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        let query = supabase_1.supabase
            .from('business_performance_metrics')
            .select('store_id, customer_satisfaction_score, verification_rate, operational_metrics')
            .gte('report_date', startDateStr)
            .lte('report_date', endDate);
        if (businessId) {
            query = query.eq('business_id', businessId);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching comparative analysis:', error);
            return {
                stores: [],
                benchmarks: {
                    topPerformerSatisfaction: 0,
                    avgSatisfaction: 0,
                    topPerformerVerification: 0,
                    avgVerification: 0
                }
            };
        }
        // Group by store and calculate averages
        const storeMetrics = {};
        data?.forEach(record => {
            if (!storeMetrics[record.store_id]) {
                storeMetrics[record.store_id] = {
                    satisfactionScores: [],
                    verificationRates: [],
                    operationalMetrics: []
                };
            }
            if (record.customer_satisfaction_score) {
                storeMetrics[record.store_id].satisfactionScores.push(record.customer_satisfaction_score);
            }
            if (record.verification_rate) {
                storeMetrics[record.store_id].verificationRates.push(record.verification_rate);
            }
            if (record.operational_metrics) {
                storeMetrics[record.store_id].operationalMetrics.push(record.operational_metrics);
            }
        });
        // Calculate store performance metrics
        const stores = Object.keys(storeMetrics).map(storeId => {
            const metrics = storeMetrics[storeId];
            const avgSatisfactionScore = metrics.satisfactionScores.length > 0
                ? metrics.satisfactionScores.reduce((sum, score) => sum + score, 0) / metrics.satisfactionScores.length
                : 0;
            const avgVerificationRate = metrics.verificationRates.length > 0
                ? metrics.verificationRates.reduce((sum, rate) => sum + rate, 0) / metrics.verificationRates.length
                : 0;
            // Calculate average operational score
            const operationalScore = metrics.operationalMetrics.length > 0
                ? metrics.operationalMetrics.reduce((sum, ops) => sum + this.calculateOperationalScore(ops), 0) / metrics.operationalMetrics.length
                : 0;
            // Calculate overall performance score for ranking
            const overallScore = (avgSatisfactionScore + avgVerificationRate + operationalScore) / 3;
            return {
                storeId,
                avgSatisfactionScore: Math.round(avgSatisfactionScore * 100) / 100,
                avgVerificationRate: Math.round(avgVerificationRate * 100) / 100,
                operationalScore: Math.round(operationalScore * 100) / 100,
                overallScore
            };
        });
        // Sort by overall score and assign ranks
        stores.sort((a, b) => b.overallScore - a.overallScore);
        const storesWithRanks = stores.map((store, index) => {
            let performanceGrade = 'D';
            if (store.overallScore >= 90)
                performanceGrade = 'A';
            else if (store.overallScore >= 80)
                performanceGrade = 'B';
            else if (store.overallScore >= 70)
                performanceGrade = 'C';
            return {
                ...store,
                performanceRank: index + 1,
                performanceGrade
            };
        });
        // Calculate benchmarks
        const satisfactionScores = stores.map(s => s.avgSatisfactionScore).filter(s => s > 0);
        const verificationRates = stores.map(s => s.avgVerificationRate).filter(r => r > 0);
        const benchmarks = {
            topPerformerSatisfaction: satisfactionScores.length > 0 ? Math.max(...satisfactionScores) : 0,
            avgSatisfaction: satisfactionScores.length > 0
                ? satisfactionScores.reduce((sum, s) => sum + s, 0) / satisfactionScores.length
                : 0,
            topPerformerVerification: verificationRates.length > 0 ? Math.max(...verificationRates) : 0,
            avgVerification: verificationRates.length > 0
                ? verificationRates.reduce((sum, r) => sum + r, 0) / verificationRates.length
                : 0
        };
        return {
            stores: storesWithRanks.map(({ overallScore, ...store }) => store),
            benchmarks: {
                topPerformerSatisfaction: Math.round(benchmarks.topPerformerSatisfaction * 100) / 100,
                avgSatisfaction: Math.round(benchmarks.avgSatisfaction * 100) / 100,
                topPerformerVerification: Math.round(benchmarks.topPerformerVerification * 100) / 100,
                avgVerification: Math.round(benchmarks.avgVerification * 100) / 100
            }
        };
    }
    /**
     * Get performance alerts for stores that need attention
     */
    static async getPerformanceAlerts(businessId, thresholds = {
        minSatisfactionScore: 70,
        minVerificationRate: 80,
        minOperationalScore: 75
    }) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        // Get recent performance data (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        let query = supabase_1.supabase
            .from('business_performance_metrics')
            .select('store_id, customer_satisfaction_score, verification_rate, operational_metrics, report_date')
            .gte('report_date', weekAgoStr)
            .lte('report_date', yesterdayStr)
            .order('report_date', { ascending: false });
        if (businessId) {
            query = query.eq('business_id', businessId);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching performance alerts:', error);
            return { criticalAlerts: [], totalAlertsCount: 0 };
        }
        // Group by store and get latest metrics
        const storeLatestMetrics = {};
        data?.forEach(record => {
            if (!storeLatestMetrics[record.store_id] || record.report_date > storeLatestMetrics[record.store_id].lastReportDate) {
                const operationalScore = this.calculateOperationalScore(record.operational_metrics || {});
                storeLatestMetrics[record.store_id] = {
                    satisfactionScore: record.customer_satisfaction_score || 0,
                    verificationRate: record.verification_rate || 0,
                    operationalScore,
                    lastReportDate: record.report_date
                };
            }
        });
        // Identify stores with performance issues
        const criticalAlerts = Object.keys(storeLatestMetrics)
            .map(storeId => {
            const metrics = storeLatestMetrics[storeId];
            const issues = [];
            if (metrics.satisfactionScore < thresholds.minSatisfactionScore) {
                issues.push(`Low customer satisfaction: ${metrics.satisfactionScore}%`);
            }
            if (metrics.verificationRate < thresholds.minVerificationRate) {
                issues.push(`Low verification rate: ${metrics.verificationRate}%`);
            }
            if (metrics.operationalScore < thresholds.minOperationalScore) {
                issues.push(`Poor operational performance: ${metrics.operationalScore}%`);
            }
            return {
                storeId,
                issues,
                satisfactionScore: metrics.satisfactionScore,
                verificationRate: metrics.verificationRate,
                operationalScore: metrics.operationalScore,
                lastReportDate: metrics.lastReportDate
            };
        })
            .filter(alert => alert.issues.length > 0)
            .sort((a, b) => b.issues.length - a.issues.length); // Sort by number of issues
        return {
            criticalAlerts,
            totalAlertsCount: criticalAlerts.length
        };
    }
    /**
     * Calculate operational score from multiple metrics
     */
    static calculateOperationalScore(metrics) {
        if (!metrics || Object.keys(metrics).length === 0)
            return 0;
        let score = 0;
        let weightedSum = 0;
        // Define weights for different metrics (higher weight = more important)
        const metricWeights = {
            uptime: 0.3,
            responseTime: 0.2, // Lower response time = higher score
            errorRate: 0.2, // Lower error rate = higher score
            throughput: 0.1,
            customerRetention: 0.1,
            conversionRate: 0.1
        };
        Object.keys(metrics).forEach(metricName => {
            const value = metrics[metricName];
            const weight = metricWeights[metricName] || 0.05; // Default weight for unknown metrics
            let normalizedValue = value;
            // Normalize different types of metrics to 0-100 scale
            switch (metricName) {
                case 'responseTime':
                    // Convert response time to score (lower is better)
                    // Assume good response time is under 1000ms
                    normalizedValue = Math.max(0, 100 - (value / 10));
                    break;
                case 'errorRate':
                    // Convert error rate to score (lower is better)
                    normalizedValue = Math.max(0, 100 - (value * 10));
                    break;
                case 'uptime':
                case 'customerRetention':
                case 'conversionRate':
                    // These are already percentages, use as-is
                    normalizedValue = Math.min(100, Math.max(0, value));
                    break;
                case 'throughput':
                    // Normalize throughput (assume 1000 req/hr is good performance)
                    normalizedValue = Math.min(100, (value / 1000) * 100);
                    break;
                default:
                    // For unknown metrics, assume they're already normalized to 0-100
                    normalizedValue = Math.min(100, Math.max(0, value));
            }
            score += normalizedValue * weight;
            weightedSum += weight;
        });
        return weightedSum > 0 ? Math.round((score / weightedSum) * 100) / 100 : 0;
    }
    /**
     * Generate performance insights for a business
     */
    static async generatePerformanceInsights(businessId, days = 30) {
        const analysis = await this.getComparativeAnalysis(businessId, days);
        const alerts = await this.getPerformanceAlerts(businessId);
        const summary = {
            totalStores: analysis.stores.length,
            avgSatisfactionScore: analysis.benchmarks.avgSatisfaction,
            avgVerificationRate: analysis.benchmarks.avgVerification,
            topPerformingStore: analysis.stores.length > 0 ? analysis.stores[0].storeId : null,
            underperformingStores: alerts.totalAlertsCount
        };
        const insights = [];
        const recommendations = [];
        // Generate insights based on performance data
        if (analysis.benchmarks.avgSatisfaction > 85) {
            insights.push('Overall customer satisfaction is excellent across stores');
        }
        else if (analysis.benchmarks.avgSatisfaction < 70) {
            insights.push('Customer satisfaction is below acceptable levels');
            recommendations.push('Implement customer experience improvement initiatives');
        }
        if (analysis.benchmarks.avgVerification > 90) {
            insights.push('Verification processes are performing well');
        }
        else if (analysis.benchmarks.avgVerification < 80) {
            insights.push('Verification rates need improvement');
            recommendations.push('Review and optimize verification processes');
        }
        const gradeDistribution = analysis.stores.reduce((acc, store) => {
            acc[store.performanceGrade] = (acc[store.performanceGrade] || 0) + 1;
            return acc;
        }, {});
        if ((gradeDistribution['A'] || 0) / analysis.stores.length > 0.5) {
            insights.push('Majority of stores are performing at excellent levels');
        }
        else if ((gradeDistribution['D'] || 0) / analysis.stores.length > 0.3) {
            insights.push('Significant number of stores need performance improvement');
            recommendations.push('Develop targeted improvement plans for underperforming stores');
        }
        if (alerts.totalAlertsCount > 0) {
            recommendations.push(`Address performance issues in ${alerts.totalAlertsCount} stores requiring immediate attention`);
        }
        return {
            summary,
            insights,
            recommendations
        };
    }
    /**
     * Clean up old performance metrics (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('business_performance_metrics')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old performance metrics:', error);
            return 0;
        }
        return data?.length || 0;
    }
}
exports.BusinessPerformanceMetricsModel = BusinessPerformanceMetricsModel;
//# sourceMappingURL=business-performance-metrics.js.map