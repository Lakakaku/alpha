/**
 * Database types generated for Supabase
 * Updated: 2025-09-21 for Feedback Analysis Dashboard
 */
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export interface Database {
    public: {
        Tables: {
            businesses: {
                Row: {
                    id: string;
                    name: string;
                    email: string;
                    verification_status: 'pending' | 'approved' | 'rejected';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    email: string;
                    verification_status?: 'pending' | 'approved' | 'rejected';
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    email?: string;
                    verification_status?: 'pending' | 'approved' | 'rejected';
                    created_at?: string;
                    updated_at?: string;
                };
            };
            stores: {
                Row: {
                    id: string;
                    business_id: string;
                    name: string;
                    address: string;
                    qr_code_url: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    business_id: string;
                    name: string;
                    address: string;
                    qr_code_url?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    business_id?: string;
                    name?: string;
                    address?: string;
                    qr_code_url?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            feedback: {
                Row: {
                    id: string;
                    store_id: string;
                    business_id: string;
                    content: string;
                    transaction_time: string;
                    transaction_value: number;
                    phone_hash: string;
                    created_at: string;
                    week_number: number | null;
                    year: number | null;
                    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
                    department_tags: string[] | null;
                    ai_summary: string | null;
                    priority_score: number | null;
                    analysis_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
                    processed_at: string | null;
                };
                Insert: {
                    id?: string;
                    store_id: string;
                    business_id: string;
                    content: string;
                    transaction_time: string;
                    transaction_value: number;
                    phone_hash: string;
                    created_at?: string;
                    week_number?: number | null;
                    year?: number | null;
                    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
                    department_tags?: string[] | null;
                    ai_summary?: string | null;
                    priority_score?: number | null;
                    analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
                    processed_at?: string | null;
                };
                Update: {
                    id?: string;
                    store_id?: string;
                    business_id?: string;
                    content?: string;
                    transaction_time?: string;
                    transaction_value?: number;
                    phone_hash?: string;
                    created_at?: string;
                    week_number?: number | null;
                    year?: number | null;
                    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
                    department_tags?: string[] | null;
                    ai_summary?: string | null;
                    priority_score?: number | null;
                    analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
                    processed_at?: string | null;
                };
            };
            analysis_reports: {
                Row: {
                    id: string;
                    store_id: string;
                    business_id: string;
                    week_number: number;
                    year: number;
                    positive_summary: string | null;
                    negative_summary: string | null;
                    general_opinions: string | null;
                    new_critiques: string[];
                    actionable_insights: Json;
                    total_feedback_count: number;
                    sentiment_breakdown: Json;
                    department_breakdown: Json;
                    trend_comparison: Json;
                    generated_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    store_id: string;
                    business_id: string;
                    week_number: number;
                    year: number;
                    positive_summary?: string | null;
                    negative_summary?: string | null;
                    general_opinions?: string | null;
                    new_critiques?: string[];
                    actionable_insights?: Json;
                    total_feedback_count?: number;
                    sentiment_breakdown?: Json;
                    department_breakdown?: Json;
                    trend_comparison?: Json;
                    generated_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    store_id?: string;
                    business_id?: string;
                    week_number?: number;
                    year?: number;
                    positive_summary?: string | null;
                    negative_summary?: string | null;
                    general_opinions?: string | null;
                    new_critiques?: string[];
                    actionable_insights?: Json;
                    total_feedback_count?: number;
                    sentiment_breakdown?: Json;
                    department_breakdown?: Json;
                    trend_comparison?: Json;
                    generated_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            search_queries: {
                Row: {
                    id: string;
                    user_id: string;
                    store_id: string;
                    business_id: string;
                    query_text: string;
                    processed_query: Json;
                    results_count: number;
                    execution_time_ms: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    store_id: string;
                    business_id: string;
                    query_text: string;
                    processed_query?: Json;
                    results_count?: number;
                    execution_time_ms?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    store_id?: string;
                    business_id?: string;
                    query_text?: string;
                    processed_query?: Json;
                    results_count?: number;
                    execution_time_ms?: number;
                    created_at?: string;
                };
            };
            feedback_insights: {
                Row: {
                    id: string;
                    store_id: string;
                    business_id: string;
                    feedback_id: string | null;
                    insight_type: 'improvement' | 'issue' | 'opportunity' | 'trend';
                    title: string;
                    description: string;
                    priority_level: 'low' | 'medium' | 'high' | 'critical';
                    department: string | null;
                    suggested_actions: string[];
                    confidence_score: number | null;
                    status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    store_id: string;
                    business_id: string;
                    feedback_id?: string | null;
                    insight_type: 'improvement' | 'issue' | 'opportunity' | 'trend';
                    title: string;
                    description: string;
                    priority_level: 'low' | 'medium' | 'high' | 'critical';
                    department?: string | null;
                    suggested_actions?: string[];
                    confidence_score?: number | null;
                    status?: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    store_id?: string;
                    business_id?: string;
                    feedback_id?: string | null;
                    insight_type?: 'improvement' | 'issue' | 'opportunity' | 'trend';
                    title?: string;
                    description?: string;
                    priority_level?: 'low' | 'medium' | 'high' | 'critical';
                    department?: string | null;
                    suggested_actions?: string[];
                    confidence_score?: number | null;
                    status?: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
                    created_at?: string;
                    updated_at?: string;
                };
            };
        };
        Views: {
            temporal_comparisons: {
                Row: {
                    store_id: string;
                    business_id: string;
                    current_week: number;
                    current_year: number;
                    previous_week: number | null;
                    previous_year: number | null;
                    current_sentiment: Json | null;
                    previous_sentiment: Json | null;
                    computed_at: string;
                };
            };
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            sentiment_enum: 'positive' | 'negative' | 'neutral' | 'mixed';
            analysis_status_enum: 'pending' | 'processing' | 'completed' | 'failed';
            insight_type_enum: 'improvement' | 'issue' | 'opportunity' | 'trend';
            priority_level_enum: 'low' | 'medium' | 'high' | 'critical';
            insight_status_enum: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}
//# sourceMappingURL=database.d.ts.map