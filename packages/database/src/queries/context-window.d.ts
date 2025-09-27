import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ContextWindow, ContextWindowInsert, ContextWindowUpdate, CustomQuestion, QuestionCategory, StoreProfile, AIConfiguration, AuthContext } from '../types/index.js';
export declare class ContextWindowQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: ContextWindowInsert, authContext?: AuthContext): Promise<ContextWindow>;
    findByStoreId(storeId: string, authContext?: AuthContext): Promise<ContextWindow | null>;
    update(storeId: string, data: ContextWindowUpdate, authContext?: AuthContext): Promise<ContextWindow>;
    delete(storeId: string, authContext?: AuthContext): Promise<void>;
    updateStoreProfile(storeId: string, profileUpdates: Partial<StoreProfile>, authContext?: AuthContext): Promise<ContextWindow>;
    addCustomQuestion(storeId: string, question: Omit<CustomQuestion, 'id'>, authContext?: AuthContext): Promise<ContextWindow>;
    updateCustomQuestion(storeId: string, questionId: string, updates: Partial<Omit<CustomQuestion, 'id'>>, authContext?: AuthContext): Promise<ContextWindow>;
    removeCustomQuestion(storeId: string, questionId: string, authContext?: AuthContext): Promise<ContextWindow>;
    getCustomQuestionsByCategory(storeId: string, category: QuestionCategory, authContext?: AuthContext): Promise<CustomQuestion[]>;
    getActiveCustomQuestions(storeId: string, currentDate?: string, authContext?: AuthContext): Promise<CustomQuestion[]>;
    updateAIConfiguration(storeId: string, configUpdates: Partial<AIConfiguration>, authContext?: AuthContext): Promise<ContextWindow>;
    updateFraudDetectionSettings(storeId: string, settingsUpdates: Record<string, any>, authContext?: AuthContext): Promise<ContextWindow>;
    getContextCompleteness(storeId: string, authContext?: AuthContext): Promise<{
        score: number;
        completeness: {
            store_profile: number;
            custom_questions: number;
            ai_configuration: number;
            fraud_detection: number;
        };
        missing_fields: string[];
    }>;
    exists(storeId: string, authContext?: AuthContext): Promise<boolean>;
    private validateStoreAccess;
    private calculateContextScore;
    private calculateFallbackScore;
    private calculateStoreProfileCompleteness;
    private calculateCustomQuestionsCompleteness;
    private calculateAIConfigCompleteness;
    private calculateFraudDetectionCompleteness;
}
export declare function createContextWindowQueries(client: SupabaseClient<Database>): ContextWindowQueries;
//# sourceMappingURL=context-window.d.ts.map