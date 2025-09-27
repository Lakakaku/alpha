export type SystemMetric = {
    id: string;
    timestamp: string;
    metric_type: string;
    metric_value: number;
    service_name: string;
    additional_data: Record<string, any>;
    created_at: string;
};
export type SystemMetricInsert = Omit<SystemMetric, 'id' | 'created_at'> & {
    id?: string;
    created_at?: string;
};
export type SystemMetricUpdate = Partial<Omit<SystemMetric, 'id' | 'created_at'>>;
export type MetricType = 'api_response_time' | 'cpu_usage' | 'memory_usage' | 'error_rate';
export type ServiceName = 'backend' | 'customer_app' | 'business_app' | 'admin_app';
export interface MetricData {
    metricType: MetricType;
    metricValue: number;
    serviceName: ServiceName;
    additionalData?: Record<string, any>;
    timestamp?: string;
}
export interface MetricFilters {
    metricType?: MetricType;
    serviceName?: ServiceName;
    startTime?: string;
    endTime?: string;
}
export declare class SystemMetricModel {
    /**
     * Record a new system metric
     */
    static record(metricData: MetricData): Promise<SystemMetric | null>;
    /**
     * Get metrics with filtering and pagination
     */
    static getMetrics(filters?: MetricFilters, page?: number, limit?: number): Promise<{
        metrics: SystemMetric[];
        total: number;
    }>;
    /**
     * Get average metric values over time period
     */
    static getAverageMetrics(metricType: MetricType, serviceName: ServiceName, hours?: number): Promise<number>;
    /**
     * Get latest metric value for a service
     */
    static getLatestMetric(metricType: MetricType, serviceName: ServiceName): Promise<SystemMetric | null>;
    /**
     * Get metrics grouped by service for dashboard
     */
    static getServiceMetrics(hours?: number): Promise<{
        [serviceName: string]: {
            [metricType: string]: number;
        };
    }>;
    /**
     * Record API response time metric
     */
    static recordApiResponseTime(serviceName: ServiceName, responseTime: number, endpoint?: string, statusCode?: number): Promise<SystemMetric | null>;
    /**
     * Record resource usage metric
     */
    static recordResourceUsage(serviceName: ServiceName, metricType: 'cpu_usage' | 'memory_usage', value: number, additionalInfo?: Record<string, any>): Promise<SystemMetric | null>;
    /**
     * Record error rate metric
     */
    static recordErrorRate(serviceName: ServiceName, errorRate: number, totalRequests?: number, errorCount?: number): Promise<SystemMetric | null>;
    /**
     * Clean up old metrics (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
    /**
     * Get system health summary
     */
    static getHealthSummary(): Promise<{
        services: {
            [serviceName: string]: {
                status: 'healthy' | 'warning' | 'critical';
                avgResponseTime: number;
                errorRate: number;
                lastSeen: string;
            };
        };
    }>;
}
//# sourceMappingURL=system-metrics.d.ts.map