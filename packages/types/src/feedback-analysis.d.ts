/**
 * TypeScript types for Feedback Analysis Dashboard
 * Feature: 008-step-2-6
 * Created: 2025-09-21
 */
export type SentimentType = 'positive' | 'negative' | 'neutral' | 'mixed';
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type InsightType = 'improvement' | 'issue' | 'opportunity' | 'trend';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
export interface FeedbackRecord {
    id: string;
    store_id: string;
    business_id: string;
    content: string;
    transaction_time: string;
    transaction_value: number;
    phone_hash: string;
    created_at: string;
    week_number: number;
    year: number;
    sentiment?: SentimentType;
    department_tags?: string[];
    ai_summary?: string;
    priority_score?: number;
    analysis_status?: AnalysisStatus;
    processed_at?: string;
}
export interface AnalysisReport {
    id: string;
    store_id: string;
    business_id: string;
    week_number: number;
    year: number;
    positive_summary?: string;
    negative_summary?: string;
    general_opinions?: string;
    new_critiques?: string[];
    actionable_insights?: ActionableInsight[];
    total_feedback_count: number;
    sentiment_breakdown?: SentimentBreakdown;
    department_breakdown?: DepartmentBreakdown;
    trend_comparison?: TrendComparison;
    generated_at?: string;
    created_at: string;
    updated_at: string;
}
export interface SearchQuery {
    id: string;
    user_id: string;
    store_id: string;
    business_id: string;
    query_text: string;
    processed_query?: ProcessedQuery;
    results_count: number;
    execution_time_ms: number;
    created_at: string;
}
export interface FeedbackInsight {
    id: string;
    store_id: string;
    business_id: string;
    feedback_id?: string;
    insight_type: InsightType;
    title: string;
    description: string;
    priority_level: PriorityLevel;
    department?: string;
    suggested_actions?: string[];
    confidence_score?: number;
    status: InsightStatus;
    created_at: string;
    updated_at: string;
}
export interface ActionableInsight {
    title: string;
    description: string;
    priority: PriorityLevel;
    department?: string;
    suggested_actions?: string[];
}
export interface SentimentBreakdown {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
}
export interface DepartmentBreakdown {
    [department: string]: number;
}
export interface TrendComparison {
    sentiment_change: {
        positive_change: number;
        negative_change: number;
        neutral_change: number;
        mixed_change: number;
    };
    new_issues: string[];
    resolved_issues: string[];
    trend_direction: 'improving' | 'declining' | 'stable';
}
export interface ProcessedQuery {
    departments?: string[];
    sentiment_filter?: SentimentType | 'all';
    date_range?: DateRange;
    keywords?: string[];
    intent?: string;
}
export interface DateRange {
    start_date: string;
    end_date: string;
}
export interface SearchRequest {
    query_text: string;
    departments?: string[];
    sentiment_filter?: SentimentType | 'all';
    date_range?: DateRange;
    limit?: number;
}
export interface SearchResponse {
    feedback: FeedbackRecord[];
    total_count: number;
    execution_time_ms: number;
    summary?: string;
}
export interface TemporalComparisonData {
    store_id: string;
    business_id: string;
    current_week: number;
    current_year: number;
    previous_week?: number;
    previous_year?: number;
    sentiment_change?: {
        positive_change: number;
        negative_change: number;
        neutral_change: number;
        mixed_change: number;
    };
    new_issues?: string[];
    resolved_issues?: string[];
    trend_direction?: 'improving' | 'declining' | 'stable';
    computed_at: string;
}
export interface ReportGenerationRequest {
    week_number?: number;
    year?: number;
    force_regenerate?: boolean;
}
export interface ReportGenerationResponse {
    job_id: string;
    estimated_completion: string;
}
export interface JobStatusResponse {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    estimated_completion?: string;
    error_message?: string;
}
export interface InsightStatusUpdate {
    status: InsightStatus;
    notes?: string;
}
export interface FeedbackCategorizationProps {
    storeId: string;
    weekNumber?: number;
    year?: number;
}
export interface SearchInterfaceProps {
    storeId: string;
    onSearch: (query: SearchRequest) => void;
    isLoading?: boolean;
}
export interface TemporalComparisonProps {
    storeId: string;
    comparisonWeeks?: number;
}
export interface InsightsPanelProps {
    storeId: string;
    priorityFilter?: PriorityLevel;
    statusFilter?: InsightStatus;
    onStatusUpdate: (insightId: string, update: InsightStatusUpdate) => void;
}
export interface FeedbackAnalysisError {
    code: string;
    message: string;
    details?: Record<string, any>;
}
export interface UseFeedbackAnalysisReturn {
    currentReport: AnalysisReport | null;
    historicalReports: AnalysisReport[];
    insights: FeedbackInsight[];
    isLoading: boolean;
    error: FeedbackAnalysisError | null;
    refetch: () => void;
}
export interface UseSearchReturn {
    search: (query: SearchRequest) => Promise<SearchResponse>;
    results: SearchResponse | null;
    isSearching: boolean;
    searchError: FeedbackAnalysisError | null;
    searchHistory: SearchQuery[];
}
export interface UseTemporalComparisonReturn {
    comparisonData: TemporalComparisonData | null;
    isLoading: boolean;
    error: FeedbackAnalysisError | null;
    refetch: (comparisonWeeks?: number) => void;
}
export interface PerformanceMetrics {
    ai_response_time_ms: number;
    categorization_time_ms: number;
    database_query_time_ms: number;
    total_request_time_ms: number;
}
export declare const VALIDATION_RULES: {
    readonly SEARCH_QUERY: {
        readonly MIN_LENGTH: 1;
        readonly MAX_LENGTH: 500;
    };
    readonly FEEDBACK_CONTENT: {
        readonly MIN_LENGTH: 10;
        readonly MAX_LENGTH: 5000;
    };
    readonly INSIGHT_TITLE: {
        readonly MIN_LENGTH: 5;
        readonly MAX_LENGTH: 200;
    };
    readonly PRIORITY_SCORE: {
        readonly MIN: 1;
        readonly MAX: 10;
    };
    readonly CONFIDENCE_SCORE: {
        readonly MIN: 0;
        readonly MAX: 1;
    };
    readonly WEEK_NUMBER: {
        readonly MIN: 1;
        readonly MAX: 53;
    };
};
//# sourceMappingURL=feedback-analysis.d.ts.map