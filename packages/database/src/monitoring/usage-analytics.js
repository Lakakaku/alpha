"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageAnalyticsModel = void 0;
const supabase_1 = require("../client/supabase");
class UsageAnalyticsModel {
    /**
     * Upsert daily usage analytics
     */
    static async upsertDailyUsage(usageData) {
        // First try to get existing record
        const { data: existing } = await supabase_1.supabase
            .from('usage_analytics')
            .select('id')
            .eq('date', usageData.date)
            .eq('service_name', usageData.serviceName)
            .single();
        let result;
        if (existing) {
            // Update existing record
            result = await supabase_1.supabase
                .from('usage_analytics')
                .update({
                daily_active_users: usageData.dailyActiveUsers,
                api_call_volume: usageData.apiCallVolume,
                feature_usage: usageData.featureUsage || {}
            })
                .eq('id', existing.id)
                .select()
                .single();
        }
        else {
            // Insert new record
            result = await supabase_1.supabase
                .from('usage_analytics')
                .insert({
                date: usageData.date,
                service_name: usageData.serviceName,
                daily_active_users: usageData.dailyActiveUsers,
                api_call_volume: usageData.apiCallVolume,
                feature_usage: usageData.featureUsage || {}
            })
                .select()
                .single();
        }
        if (result.error) {
            console.error('Error upserting usage analytics:', result.error);
            return null;
        }
        return result.data;
    }
    /**
     * Get usage analytics with filtering
     */
    static async getUsageAnalytics(filters, page = 1, limit = 30) {
        let query = supabase_1.supabase
            .from('usage_analytics')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.serviceName) {
            query = query.eq('service_name', filters.serviceName);
        }
        if (filters?.startDate) {
            query = query.gte('date', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('date', filters.endDate);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('date', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching usage analytics:', error);
            return { analytics: [], total: 0 };
        }
        return {
            analytics: data || [],
            total: count || 0
        };
    }
    /**
     * Get usage analytics for a specific date and service
     */
    static async getByDateAndService(date, serviceName) {
        const { data, error } = await supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .eq('date', date)
            .eq('service_name', serviceName)
            .single();
        if (error) {
            console.error('Error fetching usage analytics by date and service:', error);
            return null;
        }
        return data;
    }
    /**
     * Get aggregated usage statistics for a time period
     */
    static async getAggregatedStats(serviceName, days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        let query = supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .gte('date', startDateStr)
            .lte('date', endDate);
        if (serviceName) {
            query = query.eq('service_name', serviceName);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching aggregated stats:', error);
            return {
                totalDailyActiveUsers: 0,
                totalApiCalls: 0,
                avgDailyActiveUsers: 0,
                avgApiCalls: 0,
                featureUsageTotals: {}
            };
        }
        const totalDailyActiveUsers = data?.reduce((sum, record) => sum + record.daily_active_users, 0) || 0;
        const totalApiCalls = data?.reduce((sum, record) => sum + record.api_call_volume, 0) || 0;
        const recordCount = data?.length || 1;
        // Aggregate feature usage
        const featureUsageTotals = {};
        data?.forEach(record => {
            if (record.feature_usage) {
                Object.keys(record.feature_usage).forEach(feature => {
                    featureUsageTotals[feature] = (featureUsageTotals[feature] || 0) +
                        record.feature_usage[feature];
                });
            }
        });
        return {
            totalDailyActiveUsers,
            totalApiCalls,
            avgDailyActiveUsers: Math.round(totalDailyActiveUsers / recordCount),
            avgApiCalls: Math.round(totalApiCalls / recordCount),
            featureUsageTotals
        };
    }
    /**
     * Get usage trends by service
     */
    static async getUsageTrends(days = 30) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const { data, error } = await supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .gte('date', startDateStr)
            .lte('date', endDate)
            .order('date', { ascending: true });
        if (error) {
            console.error('Error fetching usage trends:', error);
            return {};
        }
        const trends = {};
        data?.forEach(record => {
            if (!trends[record.service_name]) {
                trends[record.service_name] = {
                    dates: [],
                    dailyActiveUsers: [],
                    apiCallVolume: []
                };
            }
            trends[record.service_name].dates.push(record.date);
            trends[record.service_name].dailyActiveUsers.push(record.daily_active_users);
            trends[record.service_name].apiCallVolume.push(record.api_call_volume);
        });
        return trends;
    }
    /**
     * Get top features by usage
     */
    static async getTopFeatures(serviceName, days = 30, limit = 10) {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        let query = supabase_1.supabase
            .from('usage_analytics')
            .select('feature_usage')
            .gte('date', startDateStr)
            .lte('date', endDateStr);
        if (serviceName) {
            query = query.eq('service_name', serviceName);
        }
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching top features:', error);
            return [];
        }
        const featureTotals = {};
        let recordCount = 0;
        data?.forEach(record => {
            recordCount++;
            if (record.feature_usage) {
                Object.keys(record.feature_usage).forEach(feature => {
                    featureTotals[feature] = (featureTotals[feature] || 0) +
                        record.feature_usage[feature];
                });
            }
        });
        return Object.keys(featureTotals)
            .map(featureName => ({
            featureName,
            totalUsage: featureTotals[featureName],
            avgDailyUsage: Math.round(featureTotals[featureName] / recordCount)
        }))
            .sort((a, b) => b.totalUsage - a.totalUsage)
            .slice(0, limit);
    }
    /**
     * Update feature usage for today
     */
    static async updateFeatureUsage(serviceName, featureName, incrementValue = 1) {
        const today = new Date().toISOString().split('T')[0];
        // Get current record for today
        const { data: current } = await supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .eq('date', today)
            .eq('service_name', serviceName)
            .single();
        let featureUsage = {};
        let dailyActiveUsers = 0;
        let apiCallVolume = 0;
        if (current) {
            featureUsage = current.feature_usage || {};
            dailyActiveUsers = current.daily_active_users;
            apiCallVolume = current.api_call_volume;
        }
        // Update feature usage
        featureUsage[featureName] = (featureUsage[featureName] || 0) + incrementValue;
        return this.upsertDailyUsage({
            date: today,
            serviceName,
            dailyActiveUsers,
            apiCallVolume,
            featureUsage
        });
    }
    /**
     * Record daily active user count
     */
    static async recordDailyActiveUsers(serviceName, userCount, date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        // Get current record
        const { data: current } = await supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .eq('date', targetDate)
            .eq('service_name', serviceName)
            .single();
        return this.upsertDailyUsage({
            date: targetDate,
            serviceName,
            dailyActiveUsers: userCount,
            apiCallVolume: current?.api_call_volume || 0,
            featureUsage: current?.feature_usage || {}
        });
    }
    /**
     * Record API call volume
     */
    static async recordApiCallVolume(serviceName, callCount, date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        // Get current record
        const { data: current } = await supabase_1.supabase
            .from('usage_analytics')
            .select('*')
            .eq('date', targetDate)
            .eq('service_name', serviceName)
            .single();
        return this.upsertDailyUsage({
            date: targetDate,
            serviceName,
            dailyActiveUsers: current?.daily_active_users || 0,
            apiCallVolume: callCount,
            featureUsage: current?.feature_usage || {}
        });
    }
    /**
     * Get usage comparison between periods
     */
    static async getUsageComparison(serviceName, currentPeriodDays = 7, previousPeriodDays = 7) {
        const today = new Date();
        // Current period
        const currentEnd = new Date(today);
        currentEnd.setDate(currentEnd.getDate() - 1); // Yesterday
        const currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() - currentPeriodDays + 1);
        // Previous period
        const previousEnd = new Date(currentStart);
        previousEnd.setDate(previousEnd.getDate() - 1);
        const previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - previousPeriodDays + 1);
        // Fetch current period data
        const { data: currentData } = await supabase_1.supabase
            .from('usage_analytics')
            .select('daily_active_users, api_call_volume')
            .eq('service_name', serviceName)
            .gte('date', currentStart.toISOString().split('T')[0])
            .lte('date', currentEnd.toISOString().split('T')[0]);
        // Fetch previous period data
        const { data: previousData } = await supabase_1.supabase
            .from('usage_analytics')
            .select('daily_active_users, api_call_volume')
            .eq('service_name', serviceName)
            .gte('date', previousStart.toISOString().split('T')[0])
            .lte('date', previousEnd.toISOString().split('T')[0]);
        // Calculate totals
        const currentTotalUsers = currentData?.reduce((sum, d) => sum + d.daily_active_users, 0) || 0;
        const currentTotalApiCalls = currentData?.reduce((sum, d) => sum + d.api_call_volume, 0) || 0;
        const previousTotalUsers = previousData?.reduce((sum, d) => sum + d.daily_active_users, 0) || 0;
        const previousTotalApiCalls = previousData?.reduce((sum, d) => sum + d.api_call_volume, 0) || 0;
        // Calculate growth percentages
        const userGrowth = previousTotalUsers > 0
            ? ((currentTotalUsers - previousTotalUsers) / previousTotalUsers) * 100
            : 0;
        const apiCallGrowth = previousTotalApiCalls > 0
            ? ((currentTotalApiCalls - previousTotalApiCalls) / previousTotalApiCalls) * 100
            : 0;
        return {
            currentPeriod: {
                totalUsers: currentTotalUsers,
                totalApiCalls: currentTotalApiCalls,
                avgDaily: {
                    users: Math.round(currentTotalUsers / currentPeriodDays),
                    apiCalls: Math.round(currentTotalApiCalls / currentPeriodDays)
                }
            },
            previousPeriod: {
                totalUsers: previousTotalUsers,
                totalApiCalls: previousTotalApiCalls,
                avgDaily: {
                    users: Math.round(previousTotalUsers / previousPeriodDays),
                    apiCalls: Math.round(previousTotalApiCalls / previousPeriodDays)
                }
            },
            growth: {
                users: Math.round(userGrowth * 100) / 100,
                apiCalls: Math.round(apiCallGrowth * 100) / 100
            }
        };
    }
    /**
     * Clean up old usage analytics (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('usage_analytics')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old usage analytics:', error);
            return 0;
        }
        return data?.length || 0;
    }
}
exports.UsageAnalyticsModel = UsageAnalyticsModel;
//# sourceMappingURL=usage-analytics.js.map