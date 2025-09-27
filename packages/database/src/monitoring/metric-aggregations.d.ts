export type MetricAggregation = {
    id: string;
    period_type: 'hourly' | 'daily' | 'weekly' | 'monthly';
    period_start: string;
    period_end: string;
    service_name: string;
    metric_type: string;
    metric_count: number;
    metric_sum: number;
    metric_average: number;
    metric_minimum: number;
    metric_maximum: number;
    standard_deviation: number;
    percentile_95: number;
    created_at: string;
    updated_at: string;
};
export type MetricAggregationInsert = Omit<MetricAggregation, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
};
export type MetricAggregationUpdate = Partial<Omit<MetricAggregation, 'id' | 'created_at'>>;
export interface AggregationFilters {
    periodType?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    serviceName?: string;
    metricType?: string;
    startDate?: string;
    endDate?: string;
}
export declare class MetricAggregationModel {
    /**
     * Create a new metric aggregation
     */
    static create(aggregationData: MetricAggregationInsert): Promise<MetricAggregation | null>;
    /**
     * Get metric aggregations with filtering and pagination
     */
    static getAggregations(filters?: AggregationFilters, page?: number, limit?: number): Promise<{
        aggregations: MetricAggregation[];
        total: number;
    }>;
    /**
     * Get aggregation by ID
     */
    static getById(id: string): Promise<MetricAggregation | null>;
    /**
     * Get aggregations for a specific period range
     */
    static getByPeriodRange(periodType: 'hourly' | 'daily' | 'weekly' | 'monthly', startDate: string, endDate: string, serviceName?: string, metricType?: string): Promise<MetricAggregation[]>;
    /**
     * Get latest aggregations for each service/metric combination
     */
    static getLatestAggregations(periodType: 'hourly' | 'daily' | 'weekly' | 'monthly'): Promise<MetricAggregation[]>;
    /**
     * Delete old aggregations (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
    /**
     * Get aggregation statistics for dashboard
     */
    static getStatistics(): Promise<{
        totalAggregations: number;
        aggregationsByPeriod: Record<string, number>;
        aggregationsByService: Record<string, number>;
        aggregationsByMetric: Record<string, number>;
        oldestAggregation: string | null;
        newestAggregation: string | null;
    }>;
    /**
     * Check if aggregation exists for specific period
     */
    static existsForPeriod(periodType: 'hourly' | 'daily' | 'weekly' | 'monthly', periodStart: string, serviceName?: string, metricType?: string): Promise<boolean>;
    /**
     * Bulk create aggregations
     */
    static createMany(aggregations: MetricAggregationInsert[]): Promise<MetricAggregation[]>;
    /**
     * Update aggregation
     */
    static update(id: string, updates: MetricAggregationUpdate): Promise<MetricAggregation | null>;
    /**
     * Delete aggregation
     */
    static delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=metric-aggregations.d.ts.map