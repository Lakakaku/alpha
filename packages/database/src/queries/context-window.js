"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextWindowQueries = void 0;
exports.createContextWindowQueries = createContextWindowQueries;
const utils_js_1 = require("../client/utils.js");
class ContextWindowQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Creating context window', { store_id: data.store_id });
            await this.validateStoreAccess(data.store_id, authContext);
            const contextScore = await this.calculateContextScore(data.store_profile, data.custom_questions, data.ai_configuration, data.fraud_detection_settings);
            const contextWindowData = {
                ...data,
                context_score: contextScore,
                last_updated: new Date().toISOString()
            };
            const { data: contextWindow, error } = await this.client
                .from('context_window')
                .insert(contextWindowData)
                .select()
                .single();
            if (error) {
                utils_js_1.dbLogger.error('Failed to create context window', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Context window created successfully', { id: contextWindow.id, store_id: contextWindow.store_id });
            return contextWindow;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to create context window');
        }
    }
    async findByStoreId(storeId, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding context window by store ID', { storeId });
            await this.validateStoreAccess(storeId, authContext);
            const { data: contextWindow, error } = await this.client
                .from('context_window')
                .select('*')
                .eq('store_id', storeId)
                .maybeSingle();
            if (error) {
                utils_js_1.dbLogger.error('Failed to find context window by store ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return contextWindow;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find context window');
        }
    }
    async update(storeId, data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Updating context window', { storeId, fields: Object.keys(data) });
            await this.validateStoreAccess(storeId, authContext);
            const updateData = {
                ...data,
                last_updated: new Date().toISOString()
            };
            if (data.store_profile || data.custom_questions || data.ai_configuration || data.fraud_detection_settings) {
                const existing = await this.findByStoreId(storeId, authContext);
                if (existing) {
                    updateData.context_score = await this.calculateContextScore(data.store_profile || existing.store_profile, data.custom_questions || existing.custom_questions, data.ai_configuration || existing.ai_configuration, data.fraud_detection_settings || existing.fraud_detection_settings);
                }
            }
            const { data: contextWindow, error } = await this.client
                .from('context_window')
                .update(updateData)
                .eq('store_id', storeId)
                .select()
                .single();
            if (error) {
                utils_js_1.dbLogger.error('Failed to update context window', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Context window updated successfully', { id: contextWindow.id, store_id: contextWindow.store_id });
            return contextWindow;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update context window');
        }
    }
    async delete(storeId, authContext) {
        try {
            utils_js_1.dbLogger.debug('Deleting context window', { storeId });
            await this.validateStoreAccess(storeId, authContext);
            const { error } = await this.client
                .from('context_window')
                .delete()
                .eq('store_id', storeId);
            if (error) {
                utils_js_1.dbLogger.error('Failed to delete context window', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Context window deleted successfully', { storeId });
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to delete context window');
        }
    }
    async updateStoreProfile(storeId, profileUpdates, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const mergedProfile = {
                ...existing.store_profile,
                ...profileUpdates
            };
            return await this.update(storeId, { store_profile: mergedProfile }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update store profile');
        }
    }
    async addCustomQuestion(storeId, question, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const newQuestion = {
                ...question,
                id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
            };
            const updatedQuestions = [...existing.custom_questions, newQuestion];
            return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to add custom question');
        }
    }
    async updateCustomQuestion(storeId, questionId, updates, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const updatedQuestions = existing.custom_questions.map(q => q.id === questionId ? { ...q, ...updates } : q);
            return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update custom question');
        }
    }
    async removeCustomQuestion(storeId, questionId, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const updatedQuestions = existing.custom_questions.filter(q => q.id !== questionId);
            return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to remove custom question');
        }
    }
    async getCustomQuestionsByCategory(storeId, category, authContext) {
        try {
            const contextWindow = await this.findByStoreId(storeId, authContext);
            if (!contextWindow) {
                return [];
            }
            return contextWindow.custom_questions.filter(q => q.category === category);
        }
        catch (error) {
            return [];
        }
    }
    async getActiveCustomQuestions(storeId, currentDate = new Date().toISOString(), authContext) {
        try {
            const contextWindow = await this.findByStoreId(storeId, authContext);
            if (!contextWindow) {
                return [];
            }
            const current = new Date(currentDate);
            return contextWindow.custom_questions.filter(q => {
                if (!q.active_period) {
                    return true;
                }
                const startDate = new Date(q.active_period.start_date);
                const endDate = new Date(q.active_period.end_date);
                return current >= startDate && current <= endDate;
            });
        }
        catch (error) {
            return [];
        }
    }
    async updateAIConfiguration(storeId, configUpdates, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const mergedConfig = {
                ...existing.ai_configuration,
                ...configUpdates
            };
            return await this.update(storeId, { ai_configuration: mergedConfig }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update AI configuration');
        }
    }
    async updateFraudDetectionSettings(storeId, settingsUpdates, authContext) {
        try {
            const existing = await this.findByStoreId(storeId, authContext);
            if (!existing) {
                throw new Error('Context window not found');
            }
            const mergedSettings = {
                ...existing.fraud_detection_settings,
                ...settingsUpdates
            };
            return await this.update(storeId, { fraud_detection_settings: mergedSettings }, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update fraud detection settings');
        }
    }
    async getContextCompleteness(storeId, authContext) {
        try {
            const contextWindow = await this.findByStoreId(storeId, authContext);
            if (!contextWindow) {
                return {
                    score: 0,
                    completeness: {
                        store_profile: 0,
                        custom_questions: 0,
                        ai_configuration: 0,
                        fraud_detection: 0
                    },
                    missing_fields: ['context_window']
                };
            }
            const missingFields = [];
            const storeProfileScore = this.calculateStoreProfileCompleteness(contextWindow.store_profile, missingFields);
            const customQuestionsScore = this.calculateCustomQuestionsCompleteness(contextWindow.custom_questions, missingFields);
            const aiConfigScore = this.calculateAIConfigCompleteness(contextWindow.ai_configuration, missingFields);
            const fraudDetectionScore = this.calculateFraudDetectionCompleteness(contextWindow.fraud_detection_settings, missingFields);
            const overallScore = Math.round((storeProfileScore + customQuestionsScore + aiConfigScore + fraudDetectionScore) / 4);
            return {
                score: overallScore,
                completeness: {
                    store_profile: storeProfileScore,
                    custom_questions: customQuestionsScore,
                    ai_configuration: aiConfigScore,
                    fraud_detection: fraudDetectionScore
                },
                missing_fields: missingFields
            };
        }
        catch (error) {
            return {
                score: 0,
                completeness: {
                    store_profile: 0,
                    custom_questions: 0,
                    ai_configuration: 0,
                    fraud_detection: 0
                },
                missing_fields: ['error_calculating_completeness']
            };
        }
    }
    async exists(storeId, authContext) {
        try {
            const contextWindow = await this.findByStoreId(storeId, authContext);
            return contextWindow !== null;
        }
        catch {
            return false;
        }
    }
    async validateStoreAccess(storeId, authContext) {
        if (!authContext || authContext.role === 'admin') {
            return;
        }
        const { data: store, error } = await this.client
            .from('stores')
            .select('business_id')
            .eq('id', storeId)
            .single();
        if (error || !store) {
            throw new Error('Store not found');
        }
        if (authContext.business_id !== store.business_id) {
            throw new Error('Cannot access context window for store from different business');
        }
    }
    async calculateContextScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings) {
        try {
            const { data, error } = await this.client
                .rpc('calculate_context_score', {
                store_profile_data: storeProfile,
                custom_questions_data: customQuestions,
                ai_config_data: aiConfiguration,
                fraud_settings_data: fraudDetectionSettings
            });
            if (error) {
                utils_js_1.dbLogger.warn('Failed to calculate context score, using fallback', error);
                return this.calculateFallbackScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings);
            }
            return data || 0;
        }
        catch (error) {
            utils_js_1.dbLogger.warn('Error calculating context score, using fallback', error);
            return this.calculateFallbackScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings);
        }
    }
    calculateFallbackScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings) {
        let score = 0;
        score += this.calculateStoreProfileCompleteness(storeProfile);
        score += this.calculateCustomQuestionsCompleteness(customQuestions);
        score += this.calculateAIConfigCompleteness(aiConfiguration);
        score += this.calculateFraudDetectionCompleteness(fraudDetectionSettings);
        return Math.round(score / 4);
    }
    calculateStoreProfileCompleteness(storeProfile, missingFields) {
        const requiredFields = [
            'store_type.category',
            'store_type.subcategory',
            'size.square_footage',
            'operating_hours',
            'location.address',
            'personnel.staff_count',
            'inventory.product_categories'
        ];
        let completedFields = 0;
        requiredFields.forEach(field => {
            const fieldPath = field.split('.');
            let value = storeProfile;
            for (const path of fieldPath) {
                value = value?.[path];
            }
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value) && value.length > 0) {
                    completedFields++;
                }
                else if (!Array.isArray(value)) {
                    completedFields++;
                }
                else if (missingFields) {
                    missingFields.push(`store_profile.${field}`);
                }
            }
            else if (missingFields) {
                missingFields.push(`store_profile.${field}`);
            }
        });
        return Math.round((completedFields / requiredFields.length) * 100);
    }
    calculateCustomQuestionsCompleteness(customQuestions, missingFields) {
        if (!customQuestions || customQuestions.length === 0) {
            if (missingFields) {
                missingFields.push('custom_questions');
            }
            return 0;
        }
        const minRecommendedQuestions = 3;
        const maxScore = 100;
        if (customQuestions.length >= minRecommendedQuestions) {
            return maxScore;
        }
        return Math.round((customQuestions.length / minRecommendedQuestions) * maxScore);
    }
    calculateAIConfigCompleteness(aiConfiguration, missingFields) {
        const requiredFields = [
            'conversation_style',
            'language_preferences.primary',
            'call_duration_target.min_seconds',
            'call_duration_target.max_seconds',
            'question_selection.max_questions_per_call'
        ];
        let completedFields = 0;
        requiredFields.forEach(field => {
            const fieldPath = field.split('.');
            let value = aiConfiguration;
            for (const path of fieldPath) {
                value = value?.[path];
            }
            if (value !== undefined && value !== null && value !== '') {
                completedFields++;
            }
            else if (missingFields) {
                missingFields.push(`ai_configuration.${field}`);
            }
        });
        return Math.round((completedFields / requiredFields.length) * 100);
    }
    calculateFraudDetectionCompleteness(fraudDetectionSettings, missingFields) {
        const requiredFields = [
            'sensitivity_level',
            'verification_thresholds.min_response_length',
            'verification_thresholds.coherence_threshold'
        ];
        let completedFields = 0;
        requiredFields.forEach(field => {
            const fieldPath = field.split('.');
            let value = fraudDetectionSettings;
            for (const path of fieldPath) {
                value = value?.[path];
            }
            if (value !== undefined && value !== null && value !== '') {
                completedFields++;
            }
            else if (missingFields) {
                missingFields.push(`fraud_detection_settings.${field}`);
            }
        });
        return Math.round((completedFields / requiredFields.length) * 100);
    }
}
exports.ContextWindowQueries = ContextWindowQueries;
function createContextWindowQueries(client) {
    return new ContextWindowQueries(client);
}
//# sourceMappingURL=context-window.js.map