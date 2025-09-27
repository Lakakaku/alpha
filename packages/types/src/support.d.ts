export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportRequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportRequestCategory = 'technical' | 'verification' | 'app_usage' | 'payment' | 'general';
export interface CustomerSupportRequest {
    id: string;
    customer_id: string | null;
    session_id: string | null;
    category: SupportRequestCategory;
    priority: SupportRequestPriority;
    subject: string;
    description: string;
    status: SupportRequestStatus;
    contact_email: string | null;
    contact_phone: string | null;
    device_info: DeviceInfo | null;
    error_logs: string[] | null;
    screenshots: string[] | null;
    resolved_at: string | null;
    resolution_notes: string | null;
    created_at: string;
    updated_at: string;
}
export interface DeviceInfo {
    user_agent: string;
    screen_resolution: string;
    viewport_size: string;
    device_type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
    browser_version: string;
    language: string;
    timezone: string;
    connection_type: string;
    app_version: string;
    pwa_installed: boolean;
}
export interface SupportRequestCreate {
    category: SupportRequestCategory;
    subject: string;
    description: string;
    contact_email?: string;
    contact_phone?: string;
    session_id?: string;
    device_info?: DeviceInfo;
    error_logs?: string[];
    screenshots?: string[];
}
export interface SupportRequestResponse {
    success: boolean;
    request_id: string;
    estimated_response_time: string;
    support_channels: {
        email: string;
        phone: string | null;
        chat_available: boolean;
    };
}
export interface SupportFAQEntry {
    id: string;
    category: SupportRequestCategory;
    question: string;
    answer: string;
    keywords: string[];
    helpful_count: number;
    not_helpful_count: number;
    priority: number;
    language: string;
    published: boolean;
    created_at: string;
    updated_at: string;
}
export interface SupportFAQRequest {
    category?: SupportRequestCategory;
    search_query?: string;
    language?: string;
    limit?: number;
}
export interface SupportFAQResponse {
    success: boolean;
    entries: SupportFAQEntry[];
    total_count: number;
    suggested_categories: SupportRequestCategory[];
}
export interface ContextualHelp {
    page_id: string;
    help_sections: HelpSection[];
    quick_actions: QuickAction[];
    related_faqs: string[];
}
export interface HelpSection {
    id: string;
    title: string;
    content: string;
    icon: string;
    priority: number;
}
export interface QuickAction {
    id: string;
    label: string;
    action_type: 'link' | 'modal' | 'support_request';
    action_data: any;
    icon: string;
}
export interface SupportWidgetConfig {
    enabled: boolean;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    theme: 'light' | 'dark' | 'auto';
    show_faq: boolean;
    show_contact_form: boolean;
    show_chat: boolean;
    auto_detect_issues: boolean;
    collect_diagnostics: boolean;
}
export interface DiagnosticReport {
    id: string;
    session_id: string | null;
    device_info: DeviceInfo;
    performance_metrics: PerformanceMetrics;
    error_logs: ErrorLog[];
    user_actions: UserAction[];
    network_info: NetworkInfo;
    storage_info: StorageInfo;
    generated_at: string;
}
export interface PerformanceMetrics {
    page_load_time: number;
    time_to_interactive: number;
    largest_contentful_paint: number;
    cumulative_layout_shift: number;
    memory_usage: number;
    cache_hit_rate: number;
}
export interface ErrorLog {
    timestamp: string;
    level: 'error' | 'warning' | 'info';
    message: string;
    stack_trace: string | null;
    user_action: string | null;
    url: string;
}
export interface UserAction {
    timestamp: string;
    action: string;
    element: string;
    page: string;
    data: any;
}
export interface NetworkInfo {
    online: boolean;
    connection_type: string;
    effective_bandwidth: number;
    latency: number;
}
export interface StorageInfo {
    local_storage_used: number;
    session_storage_used: number;
    indexeddb_used: number;
    cache_storage_used: number;
    quota_available: number;
}
//# sourceMappingURL=support.d.ts.map