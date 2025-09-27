"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMetricModel = void 0;
const supabase_1 = require("../client/supabase");
class SystemMetricModel {
    /**
     * Record a new system metric
     */
    static async record(metricData) {
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .insert({
            metric_type: metricData.metricType,
            metric_value: metricData.metricValue,
            service_name: metricData.serviceName,
            additional_data: metricData.additionalData || {},
            timestamp: metricData.timestamp || new Date().toISOString()
        })
            .select()
            .single();
        if (error) {
            console.error('Error recording system metric:', error);
            return null;
        }
        return data;
    }
    /**
     * Get metrics with filtering and pagination
     */
    static async getMetrics(filters, page = 1, limit = 100) {
        let query = supabase_1.supabase
            .from('system_metrics')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.metricType) {
            query = query.eq('metric_type', filters.metricType);
        }
        if (filters?.serviceName) {
            query = query.eq('service_name', filters.serviceName);
        }
        if (filters?.startTime) {
            query = query.gte('timestamp', filters.startTime);
        }
        if (filters?.endTime) {
            query = query.lte('timestamp', filters.endTime);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching system metrics:', error);
            return { metrics: [], total: 0 };
        }
        return {
            metrics: data || [],
            total: count || 0
        };
    }
    /**
     * Get average metric values over time period
     */
    static async getAverageMetrics(metricType, serviceName, hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .select('metric_value')
            .eq('metric_type', metricType)
            .eq('service_name', serviceName)
            .gte('timestamp', since.toISOString());
        if (error) {
            console.error('Error fetching average metrics:', error);
            return 0;
        }
        if (!data || data.length === 0) {
            return 0;
        }
        const sum = data.reduce((acc, metric) => acc + metric.metric_value, 0);
        return sum / data.length;
    }
    /**
     * Get latest metric value for a service
     */
    static async getLatestMetric(metricType, serviceName) {
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .select('*')
            .eq('metric_type', metricType)
            .eq('service_name', serviceName)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            console.error('Error fetching latest metric:', error);
            return null;
        }
        return data;
    }
    /**
     * Get metrics grouped by service for dashboard
     */
    static async getServiceMetrics(hours = 1) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .select('service_name, metric_type, metric_value')
            .gte('timestamp', since.toISOString());
        if (error) {
            console.error('Error fetching service metrics:', error);
            return {};
        }
        const groupedMetrics = {};
        // Group metrics by service and type
        data?.forEach(metric => {
            if (!groupedMetrics[metric.service_name]) {
                groupedMetrics[metric.service_name] = {};
            }
            if (!groupedMetrics[metric.service_name][metric.metric_type]) {
                groupedMetrics[metric.service_name][metric.metric_type] = [];
            }
            groupedMetrics[metric.service_name][metric.metric_type].push(metric.metric_value);
        });
        // Calculate averages
        const result = {};
        Object.keys(groupedMetrics).forEach(serviceName => {
            result[serviceName] = {};
            Object.keys(groupedMetrics[serviceName]).forEach(metricType => {
                const values = groupedMetrics[serviceName][metricType];
                result[serviceName][metricType] = values.reduce((sum, val) => sum + val, 0) / values.length;
            });
        });
        return result;
    }
    /**
     * Record API response time metric
     */
    static async recordApiResponseTime(serviceName, responseTime, endpoint, statusCode) {
        return this.record({
            metricType: 'api_response_time',
            metricValue: responseTime,
            serviceName,
            additionalData: {
                endpoint,
                status_code: statusCode
            }
        });
    }
    /**
     * Record resource usage metric
     */
    static async recordResourceUsage(serviceName, metricType, value, additionalInfo) {
        return this.record({
            metricType,
            metricValue: value,
            serviceName,
            additionalData: additionalInfo
        });
    }
    /**
     * Record error rate metric
     */
    static async recordErrorRate(serviceName, errorRate, totalRequests, errorCount) {
        return this.record({
            metricType: 'error_rate',
            metricValue: errorRate,
            serviceName,
            additionalData: {
                total_requests: totalRequests,
                error_count: errorCount
            }
        });
    }
    /**
     * Clean up old metrics (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old metrics:', error);
            return 0;
        }
        return data?.length || 0;
    }
    /**
     * Get system health summary
     */
    static async getHealthSummary() {
        const since = new Date();
        since.setMinutes(since.getMinutes() - 5); // Last 5 minutes
        const { data, error } = await supabase_1.supabase
            .from('system_metrics')
            .select('*')
            .gte('timestamp', since.toISOString());
        if (error) {
            console.error('Error fetching health summary:', error);
            return { services: {} };
        }
        const services = {};
        // Group by service
        const serviceData = {};
        data?.forEach(metric => {
            if (!serviceData[metric.service_name]) {
                serviceData[metric.service_name] = {
                    responseTimes: [],
                    errorRates: [],
                    lastTimestamp: metric.timestamp
                };
            }
            if (metric.metric_type === 'api_response_time') {
                serviceData[metric.service_name].responseTimes.push(metric.metric_value);
            }
            else if (metric.metric_type === 'error_rate') {
                serviceData[metric.service_name].errorRates.push(metric.metric_value);
            }
            // Update last seen timestamp
            if (metric.timestamp > serviceData[metric.service_name].lastTimestamp) {
                serviceData[metric.service_name].lastTimestamp = metric.timestamp;
            }
        });
        // Calculate health status for each service
        Object.keys(serviceData).forEach(serviceName => {
            const service = serviceData[serviceName];
            const avgResponseTime = service.responseTimes.length > 0
                ? service.responseTimes.reduce((sum, val) => sum + val, 0) / service.responseTimes.length
                : 0;
            const errorRate = service.errorRates.length > 0
                ? service.errorRates.reduce((sum, val) => sum + val, 0) / service.errorRates.length
                : 0;
            let status = 'healthy';
            if (errorRate > 5 || avgResponseTime > 2000) {
                status = 'critical';
            }
            else if (errorRate > 1 || avgResponseTime > 1000) {
                status = 'warning';
            }
            services[serviceName] = {
                status,
                avgResponseTime,
                errorRate,
                lastSeen: service.lastTimestamp
            };
        });
        return { services };
    }
}
exports.SystemMetricModel = SystemMetricModel;
//# sourceMappingURL=system-metrics.js.map