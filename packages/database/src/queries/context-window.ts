import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  ContextWindow,
  ContextWindowInsert,
  ContextWindowUpdate,
  CustomQuestion,
  QuestionCategory,
  QuestionPriority,
  StoreProfile,
  AIConfiguration,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class ContextWindowQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: ContextWindowInsert, authContext?: AuthContext): Promise<ContextWindow> {
    try {
      dbLogger.debug('Creating context window', { store_id: data.store_id });

      await this.validateStoreAccess(data.store_id, authContext);

      const contextScore = await this.calculateContextScore(
        data.store_profile,
        data.custom_questions,
        data.ai_configuration,
        data.fraud_detection_settings
      );

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
        dbLogger.error('Failed to create context window', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Context window created successfully', { id: contextWindow.id, store_id: contextWindow.store_id });
      return contextWindow;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create context window');
    }
  }

  async findByStoreId(storeId: string, authContext?: AuthContext): Promise<ContextWindow | null> {
    try {
      dbLogger.debug('Finding context window by store ID', { storeId });

      await this.validateStoreAccess(storeId, authContext);

      const { data: contextWindow, error } = await this.client
        .from('context_window')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();

      if (error) {
        dbLogger.error('Failed to find context window by store ID', error);
        throw formatDatabaseError(error);
      }

      return contextWindow;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find context window');
    }
  }

  async update(storeId: string, data: ContextWindowUpdate, authContext?: AuthContext): Promise<ContextWindow> {
    try {
      dbLogger.debug('Updating context window', { storeId, fields: Object.keys(data) });

      await this.validateStoreAccess(storeId, authContext);

      const updateData: any = {
        ...data,
        last_updated: new Date().toISOString()
      };

      if (data.store_profile || data.custom_questions || data.ai_configuration || data.fraud_detection_settings) {
        const existing = await this.findByStoreId(storeId, authContext);
        if (existing) {
          updateData.context_score = await this.calculateContextScore(
            data.store_profile || existing.store_profile,
            data.custom_questions || existing.custom_questions,
            data.ai_configuration || existing.ai_configuration,
            data.fraud_detection_settings || existing.fraud_detection_settings
          );
        }
      }

      const { data: contextWindow, error } = await this.client
        .from('context_window')
        .update(updateData)
        .eq('store_id', storeId)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to update context window', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Context window updated successfully', { id: contextWindow.id, store_id: contextWindow.store_id });
      return contextWindow;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update context window');
    }
  }

  async delete(storeId: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting context window', { storeId });

      await this.validateStoreAccess(storeId, authContext);

      const { error } = await this.client
        .from('context_window')
        .delete()
        .eq('store_id', storeId);

      if (error) {
        dbLogger.error('Failed to delete context window', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Context window deleted successfully', { storeId });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete context window');
    }
  }

  async updateStoreProfile(
    storeId: string,
    profileUpdates: Partial<StoreProfile>,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
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
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update store profile');
    }
  }

  async addCustomQuestion(
    storeId: string,
    question: Omit<CustomQuestion, 'id'>,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
    try {
      const existing = await this.findByStoreId(storeId, authContext);
      if (!existing) {
        throw new Error('Context window not found');
      }

      const newQuestion: CustomQuestion = {
        ...question,
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };

      const updatedQuestions = [...existing.custom_questions, newQuestion];

      return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to add custom question');
    }
  }

  async updateCustomQuestion(
    storeId: string,
    questionId: string,
    updates: Partial<Omit<CustomQuestion, 'id'>>,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
    try {
      const existing = await this.findByStoreId(storeId, authContext);
      if (!existing) {
        throw new Error('Context window not found');
      }

      const updatedQuestions = existing.custom_questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      );

      return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update custom question');
    }
  }

  async removeCustomQuestion(
    storeId: string,
    questionId: string,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
    try {
      const existing = await this.findByStoreId(storeId, authContext);
      if (!existing) {
        throw new Error('Context window not found');
      }

      const updatedQuestions = existing.custom_questions.filter(q => q.id !== questionId);

      return await this.update(storeId, { custom_questions: updatedQuestions }, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to remove custom question');
    }
  }

  async getCustomQuestionsByCategory(
    storeId: string,
    category: QuestionCategory,
    authContext?: AuthContext
  ): Promise<CustomQuestion[]> {
    try {
      const contextWindow = await this.findByStoreId(storeId, authContext);
      if (!contextWindow) {
        return [];
      }

      return contextWindow.custom_questions.filter(q => q.category === category);
    } catch (error) {
      return [];
    }
  }

  async getActiveCustomQuestions(
    storeId: string,
    currentDate: string = new Date().toISOString(),
    authContext?: AuthContext
  ): Promise<CustomQuestion[]> {
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
    } catch (error) {
      return [];
    }
  }

  async updateAIConfiguration(
    storeId: string,
    configUpdates: Partial<AIConfiguration>,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
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
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update AI configuration');
    }
  }

  async updateFraudDetectionSettings(
    storeId: string,
    settingsUpdates: Record<string, any>,
    authContext?: AuthContext
  ): Promise<ContextWindow> {
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
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update fraud detection settings');
    }
  }

  async getContextCompleteness(storeId: string, authContext?: AuthContext): Promise<{
    score: number;
    completeness: {
      store_profile: number;
      custom_questions: number;
      ai_configuration: number;
      fraud_detection: number;
    };
    missing_fields: string[];
  }> {
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

      const missingFields: string[] = [];

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
    } catch (error) {
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

  async exists(storeId: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const contextWindow = await this.findByStoreId(storeId, authContext);
      return contextWindow !== null;
    } catch {
      return false;
    }
  }

  private async validateStoreAccess(storeId: string, authContext?: AuthContext): Promise<void> {
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

  private async calculateContextScore(
    storeProfile: Record<string, any>,
    customQuestions: CustomQuestion[],
    aiConfiguration: Record<string, any>,
    fraudDetectionSettings: Record<string, any>
  ): Promise<number> {
    try {
      const { data, error } = await this.client
        .rpc('calculate_context_score', {
          store_profile_data: storeProfile,
          custom_questions_data: customQuestions,
          ai_config_data: aiConfiguration,
          fraud_settings_data: fraudDetectionSettings
        });

      if (error) {
        dbLogger.warn('Failed to calculate context score, using fallback', error);
        return this.calculateFallbackScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings);
      }

      return data || 0;
    } catch (error) {
      dbLogger.warn('Error calculating context score, using fallback', error);
      return this.calculateFallbackScore(storeProfile, customQuestions, aiConfiguration, fraudDetectionSettings);
    }
  }

  private calculateFallbackScore(
    storeProfile: Record<string, any>,
    customQuestions: CustomQuestion[],
    aiConfiguration: Record<string, any>,
    fraudDetectionSettings: Record<string, any>
  ): number {
    let score = 0;

    score += this.calculateStoreProfileCompleteness(storeProfile);
    score += this.calculateCustomQuestionsCompleteness(customQuestions);
    score += this.calculateAIConfigCompleteness(aiConfiguration);
    score += this.calculateFraudDetectionCompleteness(fraudDetectionSettings);

    return Math.round(score / 4);
  }

  private calculateStoreProfileCompleteness(storeProfile: Record<string, any>, missingFields?: string[]): number {
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
        } else if (!Array.isArray(value)) {
          completedFields++;
        } else if (missingFields) {
          missingFields.push(`store_profile.${field}`);
        }
      } else if (missingFields) {
        missingFields.push(`store_profile.${field}`);
      }
    });

    return Math.round((completedFields / requiredFields.length) * 100);
  }

  private calculateCustomQuestionsCompleteness(customQuestions: CustomQuestion[], missingFields?: string[]): number {
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

  private calculateAIConfigCompleteness(aiConfiguration: Record<string, any>, missingFields?: string[]): number {
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
      } else if (missingFields) {
        missingFields.push(`ai_configuration.${field}`);
      }
    });

    return Math.round((completedFields / requiredFields.length) * 100);
  }

  private calculateFraudDetectionCompleteness(fraudDetectionSettings: Record<string, any>, missingFields?: string[]): number {
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
      } else if (missingFields) {
        missingFields.push(`fraud_detection_settings.${field}`);
      }
    });

    return Math.round((completedFields / requiredFields.length) * 100);
  }
}

export function createContextWindowQueries(client: SupabaseClient<Database>): ContextWindowQueries {
  return new ContextWindowQueries(client);
}