export type ErrorLog = {
    id: string;
    timestamp: string;
    severity: string;
    error_message: string;
    stack_trace?: string;
    service_name: string;
    endpoint?: string;
    user_context: Record<string, any>;
    resolution_status: string;
    created_at: string;
    updated_at: string;
};
export type ErrorLogInsert = Omit<ErrorLog, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
};
export type ErrorLogUpdate = Partial<Omit<ErrorLog, 'id' | 'created_at'>>;
export type ErrorSeverity = 'critical' | 'warning' | 'info';
export type ErrorResolutionStatus = 'open' | 'investigating' | 'resolved';
export type ServiceName = 'backend' | 'customer_app' | 'business_app' | 'admin_app';
export interface ErrorLogEntry {
    severity: ErrorSeverity;
    errorMessage: string;
    serviceName: ServiceName;
    stackTrace?: string;
    endpoint?: string;
    userContext?: Record<string, any>;
    timestamp?: string;
}
export interface ErrorLogFilters {
    severity?: ErrorSeverity;
    serviceName?: ServiceName;
    resolutionStatus?: ErrorResolutionStatus;
    startTime?: string;
    endTime?: string;
    endpoint?: string;
}
export declare class ErrorLogModel {
    /**
     * Log a new error
     */
    static logError(errorData: ErrorLogEntry): Promise<ErrorLog | null>;
    /**
     * Get error logs with filtering and pagination
     */
    static getErrorLogs(filters?: ErrorLogFilters, page?: number, limit?: number): Promise<{
        errors: ErrorLog[];
        total: number;
    }>;
    /**
     * Get error by ID
     */
    static getById(id: string): Promise<ErrorLog | null>;
    /**
     * Update error resolution status
     */
    static updateResolutionStatus(id: string, status: ErrorResolutionStatus): Promise<ErrorLog | null>;
    /**
     * Get critical errors in the last period
     */
    static getCriticalErrors(hours?: number): Promise<ErrorLog[]>;
    /**
     * Get unresolved errors count by severity
     */
    static getUnresolvedErrorStats(): Promise<{
        critical: number;
        warning: number;
        info: number;
        total: number;
    }>;
    /**
     * Get error trends by service
     */
    static getErrorTrendsByService(days?: number): Promise<{
        [serviceName: string]: {
            [severity: string]: number;
        };
    }>;
    /**
     * Get most frequent error patterns
     */
    static getFrequentErrorPatterns(limit?: number, hours?: number): Promise<{
        errorMessage: string;
        count: number;
        latestOccurrence: string;
        services: string[];
    }[]>;
    /**
     * Get errors by endpoint
     */
    static getErrorsByEndpoint(endpoint: string, hours?: number): Promise<ErrorLog[]>;
    /**
     * Log critical error (convenience method)
     */
    static logCritical(serviceName: ServiceName, errorMessage: string, stackTrace?: string, endpoint?: string, userContext?: Record<string, any>): Promise<ErrorLog | null>;
    /**
     * Log warning error (convenience method)
     */
    static logWarning(serviceName: ServiceName, errorMessage: string, endpoint?: string, userContext?: Record<string, any>): Promise<ErrorLog | null>;
    /**
     * Log info error (convenience method)
     */
    static logInfo(serviceName: ServiceName, errorMessage: string, endpoint?: string, userContext?: Record<string, any>): Promise<ErrorLog | null>;
    /**
     * Mark error as investigating
     */
    static markAsInvestigating(id: string): Promise<ErrorLog | null>;
    /**
     * Mark error as resolved
     */
    static markAsResolved(id: string): Promise<ErrorLog | null>;
    /**
     * Clean up old error logs (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
    /**
     * Get error rate over time
     */
    static getErrorRate(serviceName?: ServiceName, hours?: number): Promise<{
        timestamp: string;
        errorCount: number;
    }[]>;
}
//# sourceMappingURL=error-logs.d.ts.map