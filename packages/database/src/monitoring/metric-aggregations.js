"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricAggregationModel = void 0;
const supabase_1 = require("../client/supabase");
class MetricAggregationModel {
    /**
     * Create a new metric aggregation
     */
    static async create(aggregationData) {
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .insert(aggregationData)
            .select()
            .single();
        if (error) {
            console.error('Error creating metric aggregation:', error);
            return null;
        }
        return data;
    }
    /**
     * Get metric aggregations with filtering and pagination
     */
    static async getAggregations(filters, page = 1, limit = 100) {
        let query = supabase_1.supabase
            .from('metric_aggregations')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.periodType) {
            query = query.eq('period_type', filters.periodType);
        }
        if (filters?.serviceName) {
            query = query.eq('service_name', filters.serviceName);
        }
        if (filters?.metricType) {
            query = query.eq('metric_type', filters.metricType);
        }
        if (filters?.startDate) {
            query = query.gte('period_start', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('period_end', filters.endDate);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('period_start', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching metric aggregations:', error);
            return { aggregations: [], total: 0 };
        }
        return {
            aggregations: data || [],
            total: count || 0
        };
    }
    /**
     * Get aggregation by ID
     */
    static async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            console.error('Error fetching metric aggregation by ID:', error);
            return null;
        }
        return data;
    }
    /**
     * Get aggregations for a specific period range
     */
    static async getByPeriodRange(periodType, startDate, endDate, serviceName, metricType) {
        let query = supabase_1.supabase
            .from('metric_aggregations')
            .select('*')
            .eq('period_type', periodType)
            .gte('period_start', startDate)
            .lte('period_start', endDate);
        if (serviceName) {
            query = query.eq('service_name', serviceName);
        }
        if (metricType) {
            query = query.eq('metric_type', metricType);
        }
        query = query.order('period_start', { ascending: true });
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching aggregations by period range:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Get latest aggregations for each service/metric combination
     */
    static async getLatestAggregations(periodType) {
        // This is a simplified approach - in a real implementation, you might want
        // to use a more sophisticated query to get the latest for each combination
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .select('*')
            .eq('period_type', periodType)
            .order('period_start', { ascending: false })
            .limit(50);
        if (error) {
            console.error('Error fetching latest aggregations:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Delete old aggregations (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old aggregations:', error);
            return 0;
        }
        return data?.length || 0;
    }
    /**
     * Get aggregation statistics for dashboard
     */
    static async getStatistics() {
        // Get total count
        const { count } = await supabase_1.supabase
            .from('metric_aggregations')
            .select('*', { count: 'exact', head: true });
        // Get aggregations for statistics
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .select('period_type, service_name, metric_type, created_at')
            .order('created_at', { ascending: false })
            .limit(1000); // Limit for performance
        if (error) {
            console.error('Error fetching aggregation statistics:', error);
            return {
                totalAggregations: 0,
                aggregationsByPeriod: {},
                aggregationsByService: {},
                aggregationsByMetric: {},
                oldestAggregation: null,
                newestAggregation: null,
            };
        }
        const aggregationsByPeriod = {};
        const aggregationsByService = {};
        const aggregationsByMetric = {};
        let oldestDate = '';
        let newestDate = '';
        data?.forEach((agg, index) => {
            // Count by period type
            aggregationsByPeriod[agg.period_type] = (aggregationsByPeriod[agg.period_type] || 0) + 1;
            // Count by service
            aggregationsByService[agg.service_name] = (aggregationsByService[agg.service_name] || 0) + 1;
            // Count by metric type
            aggregationsByMetric[agg.metric_type] = (aggregationsByMetric[agg.metric_type] || 0) + 1;
            // Track date range
            if (index === 0) {
                newestDate = agg.created_at;
            }
            if (index === data.length - 1) {
                oldestDate = agg.created_at;
            }
        });
        return {
            totalAggregations: count || 0,
            aggregationsByPeriod,
            aggregationsByService,
            aggregationsByMetric,
            oldestAggregation: oldestDate || null,
            newestAggregation: newestDate || null,
        };
    }
    /**
     * Check if aggregation exists for specific period
     */
    static async existsForPeriod(periodType, periodStart, serviceName, metricType) {
        let query = supabase_1.supabase
            .from('metric_aggregations')
            .select('id')
            .eq('period_type', periodType)
            .eq('period_start', periodStart);
        if (serviceName) {
            query = query.eq('service_name', serviceName);
        }
        if (metricType) {
            query = query.eq('metric_type', metricType);
        }
        const { data, error } = await query.limit(1);
        if (error) {
            console.error('Error checking aggregation existence:', error);
            return false;
        }
        return (data?.length || 0) > 0;
    }
    /**
     * Bulk create aggregations
     */
    static async createMany(aggregations) {
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .insert(aggregations)
            .select();
        if (error) {
            console.error('Error bulk creating metric aggregations:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Update aggregation
     */
    static async update(id, updates) {
        const updateData = {
            ...updates,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase_1.supabase
            .from('metric_aggregations')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating metric aggregation:', error);
            return null;
        }
        return data;
    }
    /**
     * Delete aggregation
     */
    static async delete(id) {
        const { error } = await supabase_1.supabase
            .from('metric_aggregations')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('Error deleting metric aggregation:', error);
            return false;
        }
        return true;
    }
}
exports.MetricAggregationModel = MetricAggregationModel;
//# sourceMappingURL=metric-aggregations.js.map