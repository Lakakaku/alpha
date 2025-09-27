/**
 * AI Assistant Interface Types
 * Feature: 007-step-2-5 - Context Builder
 *
 * TypeScript definitions for AI assistant conversations, messages,
 * context entries, suggestions, and validation results.
 */
export type ConversationStatus = 'active' | 'paused' | 'completed' | 'archived';
export type MessageType = 'text' | 'suggestion' | 'validation' | 'context_update';
export type SenderType = 'user' | 'assistant';
export type ContextCategory = 'store_profile' | 'personnel' | 'layout' | 'inventory' | 'operations' | 'customer_journey' | 'fraud_detection' | 'seasonal_variations';
export type SourceType = 'conversation' | 'ai_inference' | 'manual_input' | 'system_default';
export type SuggestionType = 'context_gap' | 'question_recommendation' | 'fraud_improvement' | 'frequency_optimization' | 'validation_enhancement';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'implemented';
export interface AIConversation {
    id: string;
    business_id: string;
    store_id?: string | null;
    title?: string | null;
    status: ConversationStatus;
    completeness_score?: number | null;
    last_message_at: string;
    created_at: string;
    updated_at: string;
}
export interface AIConversationMessage {
    id: string;
    conversation_id: string;
    message_type: MessageType;
    sender_type: SenderType;
    content: Record<string, any>;
    metadata: Record<string, any>;
    sequence_number: number;
    created_at: string;
}
export interface BusinessContextEntry {
    id: string;
    business_id: string;
    store_id?: string | null;
    conversation_id?: string | null;
    category: ContextCategory;
    subcategory?: string | null;
    key: string;
    value: Record<string, any>;
    confidence_score: number;
    source_type: SourceType;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
}
export interface AISuggestion {
    id: string;
    business_id: string;
    store_id?: string | null;
    conversation_id?: string | null;
    suggestion_type: SuggestionType;
    category?: ContextCategory | null;
    title: string;
    description: string;
    action_data?: Record<string, any> | null;
    priority: PriorityLevel;
    status: SuggestionStatus;
    accepted_at?: string | null;
    rejected_at?: string | null;
    created_at: string;
}
export interface ContextValidationResult {
    id: string;
    business_id: string;
    store_id?: string | null;
    conversation_id?: string | null;
    overall_score: number;
    category_scores: Record<string, any>;
    missing_requirements: Array<{
        category: string;
        field: string;
        importance: 'required' | 'recommended' | 'optional';
        description: string;
    }>;
    improvement_suggestions: Array<{
        action: string;
        description: string;
        impact: number;
    }>;
    fraud_readiness_score?: number | null;
    validation_version: string;
    created_at: string;
}
export interface CreateConversationRequest {
    store_id?: string;
    title?: string;
    initial_context?: Record<string, any>;
}
export interface UpdateConversationRequest {
    status?: ConversationStatus;
    title?: string;
}
export interface SendMessageRequest {
    content: string;
    message_type?: MessageType;
    metadata?: Record<string, any>;
}
export interface SendMessageResponse {
    user_message: AIConversationMessage;
    ai_response: AIConversationMessage;
    context_updates?: BusinessContextEntry[];
    suggestions?: AISuggestion[];
}
export interface CreateContextEntryRequest {
    store_id?: string;
    category: ContextCategory;
    subcategory?: string;
    key: string;
    value: Record<string, any>;
    confidence_score?: number;
    is_verified?: boolean;
}
export interface AcceptSuggestionRequest {
    implement_immediately?: boolean;
    notes?: string;
}
export interface RejectSuggestionRequest {
    reason?: string;
}
export interface ValidationScoreRequest {
    store_id?: string;
    include_fraud_analysis?: boolean;
    validation_rules?: Record<string, any>;
}
export interface StreamingMessageChunk {
    type: 'content' | 'context_update' | 'suggestion' | 'complete';
    data: any;
    metadata?: Record<string, any>;
}
export interface OpenAIConversationContext {
    conversation_id: string;
    business_context: BusinessContextEntry[];
    recent_messages: AIConversationMessage[];
    current_completeness_score?: number;
    store_info?: Record<string, any>;
}
export interface AIExtractionResult {
    extracted_info: Array<{
        category: ContextCategory;
        key: string;
        value: Record<string, any>;
        confidence_score: number;
    }>;
    suggestions: Array<{
        type: SuggestionType;
        title: string;
        description: string;
        priority: PriorityLevel;
        action_data?: Record<string, any>;
    }>;
    follow_up_questions: string[];
}
export interface ValidationRule {
    category: ContextCategory;
    required_fields: string[];
    recommended_fields: string[];
    weight: number;
    custom_validator?: (context: BusinessContextEntry[]) => number;
}
export interface CompletenessScoreBreakdown {
    overall_score: number;
    category_scores: Record<ContextCategory, number>;
    max_possible_score: number;
    missing_critical_items: number;
    improvement_potential: number;
}
export interface ChatInterfaceProps {
    conversation_id: string;
    onMessageSent?: (message: AIConversationMessage) => void;
    onContextUpdate?: (entries: BusinessContextEntry[]) => void;
    onSuggestionGenerated?: (suggestions: AISuggestion[]) => void;
}
export interface ContextSidebarProps {
    business_id: string;
    store_id?: string;
    context_entries: BusinessContextEntry[];
    completeness_score?: number;
    onEntryUpdate?: (entry: BusinessContextEntry) => void;
}
export interface SuggestionsPanelProps {
    suggestions: AISuggestion[];
    onAccept: (suggestion_id: string, request: AcceptSuggestionRequest) => void;
    onReject: (suggestion_id: string, request: RejectSuggestionRequest) => void;
}
export interface ValidationScoreProps {
    validation_result: ContextValidationResult;
    onRecalculate?: () => void;
}
export interface AIAssistantError {
    code: string;
    message: string;
    details?: Record<string, any>;
    retry_after?: number;
}
export interface ConversationSubscriptionPayload {
    conversation_id: string;
    event_type: 'message_added' | 'conversation_updated' | 'context_updated';
    data: AIConversationMessage | AIConversation | BusinessContextEntry;
}
export declare namespace AIAssistant {
    type Conversation = AIConversation;
    type Message = AIConversationMessage;
    type ContextEntry = BusinessContextEntry;
    type Suggestion = AISuggestion;
    type ValidationResult = ContextValidationResult;
    type Error = AIAssistantError;
}
//# sourceMappingURL=ai-assistant.d.ts.map