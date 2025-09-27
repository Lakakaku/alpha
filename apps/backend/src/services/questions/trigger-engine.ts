import {
  getDynamicTriggers,
  createDynamicTrigger,
  updateDynamicTrigger,
  updateTriggerEffectiveness
} from '@vocilia/database/questions/dynamic-triggers';
import {
  getTriggerConditions,
  createTriggerCondition,
  evaluateConditionMatch
} from '@vocilia/database/questions/trigger-conditions';
import {
  createTriggerActivationLog,
  updateTriggerActivationLog,
  getTriggerEffectivenessMetrics
} from '@vocilia/database/questions/activation-logs';
import { loggingService } from '../loggingService';

export interface TriggerEvaluationContext {
  verificationId: string;
  businessId: string;
  customerData: {
    purchaseCategories?: string[];
    purchaseItems?: string[];
    transactionAmount?: number;
    transactionCurrency?: string;
    transactionTime?: string;
    customerSequence?: number;
    timeOfDay?: number;
    dayOfWeek?: number;
    isWeekend?: boolean;
  };
}

export interface TriggerResult {
  triggerId: string;
  triggerName: string;
  triggerType: 'purchase_based' | 'time_based' | 'amount_based';
  priorityLevel: number;
  questionsToTrigger: string[];
  conditionsMet: Record<string, any>;
  confidenceScore: number;
  activationReason: string;
}

export interface TriggerEvaluationResult {
  activatedTriggers: TriggerResult[];
  evaluationMetadata: {
    totalTriggersEvaluated: number;
    processingTimeMs: number;
    averageConfidenceScore: number;
    triggersWithAllConditionsMet: number;
  };
  questionsTriggered: string[];
  priorityBoosts: Record<string, number>;
}

export class DynamicTriggerEngine {
  constructor(
    private readonly loggingService: typeof loggingService
  ) {}

  async evaluateTriggers(context: TriggerEvaluationContext): Promise<TriggerEvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Get all active triggers for the business
      const triggers = await getDynamicTriggers(context.businessId, { isActive: true });
      
      const activatedTriggers: TriggerResult[] = [];
      const questionsTriggered = new Set<string>();
      const priorityBoosts: Record<string, number> = {};

      // Evaluate each trigger
      for (const trigger of triggers) {
        const triggerResult = await this.evaluateSingleTrigger(trigger, context);
        
        if (triggerResult) {
          activatedTriggers.push(triggerResult);
          
          // Add questions to triggered set
          triggerResult.questionsToTrigger.forEach(questionId => {
            questionsTriggered.add(questionId);
            // Apply priority boost if configured
            if (trigger.priority_boost > 0) {
              priorityBoosts[questionId] = Math.max(
                priorityBoosts[questionId] || 0,
                trigger.priority_boost
              );
            }
          });

          // Log trigger activation
          await this.logTriggerActivation(trigger.id, context, triggerResult);
        }
      }

      // Apply trigger priority hierarchy - higher priority triggers override lower ones
      const sortedTriggers = activatedTriggers.sort((a, b) => b.priorityLevel - a.priorityLevel);
      const finalTriggersMap = new Map<string, TriggerResult>();

      // Process triggers in priority order
      for (const trigger of sortedTriggers) {
        for (const questionId of trigger.questionsToTrigger) {
          if (!finalTriggersMap.has(questionId) || 
              finalTriggersMap.get(questionId)!.priorityLevel < trigger.priorityLevel) {
            finalTriggersMap.set(questionId, trigger);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      const averageConfidence = activatedTriggers.length > 0 
        ? activatedTriggers.reduce((sum, t) => sum + t.confidenceScore, 0) / activatedTriggers.length
        : 0;

      const result: TriggerEvaluationResult = {
        activatedTriggers: Array.from(new Set(activatedTriggers.map(t => t.triggerId)))
          .map(id => activatedTriggers.find(t => t.triggerId === id)!),
        evaluationMetadata: {
          totalTriggersEvaluated: triggers.length,
          processingTimeMs: processingTime,
          averageConfidenceScore: averageConfidence,
          triggersWithAllConditionsMet: activatedTriggers.filter(t => t.confidenceScore >= 0.8).length
        },
        questionsTriggered: Array.from(questionsTriggered),
        priorityBoosts
      };

      await this.loggingService.logInfo('Trigger evaluation completed', {
        businessId: context.businessId,
        verificationId: context.verificationId,
        totalTriggers: triggers.length,
        activatedTriggers: activatedTriggers.length,
        questionsTriggered: questionsTriggered.size,
        processingTimeMs: processingTime
      });

      // Performance requirement: <500ms
      if (processingTime > 500) {
        await this.loggingService.logWarning('Trigger evaluation exceeded performance threshold', {
          businessId: context.businessId,
          processingTimeMs: processingTime,
          threshold: 500
        });
      }

      return result;

    } catch (error) {
      await this.loggingService.logError('Trigger evaluation failed', {
        businessId: context.businessId,
        verificationId: context.verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async evaluateSingleTrigger(
    trigger: any,
    context: TriggerEvaluationContext
  ): Promise<TriggerResult | null> {
    try {
      // Get trigger conditions
      const conditions = await getTriggerConditions(trigger.id);
      
      if (conditions.length === 0) {
        // No conditions means trigger always activates
        return this.createTriggerResult(trigger, context, {}, 1.0, 'No conditions - always active');
      }

      const conditionResults: Array<{ condition: any; met: boolean; confidence: number }> = [];
      
      // Evaluate each condition
      for (const condition of conditions) {
        const met = await evaluateConditionMatch(condition, context.customerData);
        const confidence = met ? 1.0 : 0.0;
        
        conditionResults.push({
          condition,
          met,
          confidence
        });
      }

      // Check if trigger should activate based on conditions
      const requiredConditions = conditionResults.filter(r => r.condition.is_required);
      const optionalConditions = conditionResults.filter(r => !r.condition.is_required);

      // All required conditions must be met
      const allRequiredMet = requiredConditions.every(r => r.met);
      if (!allRequiredMet) {
        return null; // Don't activate if required conditions not met
      }

      // Calculate weighted confidence score
      const totalWeight = conditions.reduce((sum, c) => sum + c.weight_factor, 0);
      const weightedScore = conditionResults.reduce((sum, result) => {
        return sum + (result.confidence * result.condition.weight_factor);
      }, 0) / (totalWeight || 1);

      // Apply trigger sensitivity threshold
      if (weightedScore < trigger.sensitivity_threshold / 100) {
        return null; // Confidence too low
      }

      // Create conditions met summary
      const conditionsMet = conditionResults.reduce((summary, result) => {
        summary[result.condition.condition_type] = {
          met: result.met,
          operator: result.condition.condition_operator,
          value: result.condition.condition_value,
          confidence: result.confidence
        };
        return summary;
      }, {} as Record<string, any>);

      const activationReason = this.generateActivationReason(trigger, conditionResults);

      return this.createTriggerResult(
        trigger,
        context,
        conditionsMet,
        weightedScore,
        activationReason
      );

    } catch (error) {
      await this.loggingService.logError('Single trigger evaluation failed', {
        triggerId: trigger.id,
        triggerName: trigger.trigger_name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private createTriggerResult(
    trigger: any,
    context: TriggerEvaluationContext,
    conditionsMet: Record<string, any>,
    confidenceScore: number,
    activationReason: string
  ): TriggerResult {
    // Get questions to trigger - this would typically come from a trigger-question mapping
    // For now, we'll simulate based on trigger type and config
    const questionsToTrigger = this.getQuestionsForTrigger(trigger);

    return {
      triggerId: trigger.id,
      triggerName: trigger.trigger_name,
      triggerType: trigger.trigger_type,
      priorityLevel: trigger.priority_level,
      questionsToTrigger,
      conditionsMet,
      confidenceScore,
      activationReason
    };
  }

  private getQuestionsForTrigger(trigger: any): string[] {
    // This would typically query a trigger-question mapping table
    // For now, simulate based on trigger configuration
    const questions: string[] = [];
    
    if (trigger.trigger_config?.question_ids) {
      questions.push(...trigger.trigger_config.question_ids);
    } else {
      // Fallback: generate questions based on trigger type
      switch (trigger.trigger_type) {
        case 'purchase_based':
          if (trigger.trigger_config?.categories?.includes('meat')) {
            questions.push('meat_quality_question', 'meat_freshness_question');
          }
          if (trigger.trigger_config?.categories?.includes('produce')) {
            questions.push('produce_quality_question', 'produce_freshness_question');
          }
          break;
        case 'time_based':
          questions.push('queue_time_question', 'checkout_experience_question');
          break;
        case 'amount_based':
          questions.push('value_perception_question', 'service_quality_question');
          break;
      }
    }

    return questions;
  }

  private generateActivationReason(
    trigger: any,
    conditionResults: Array<{ condition: any; met: boolean; confidence: number }>
  ): string {
    const metConditions = conditionResults.filter(r => r.met);
    const conditionSummary = metConditions.map(r => {
      const condition = r.condition;
      return `${condition.condition_type}(${condition.condition_operator}: ${condition.condition_value})`;
    }).join(', ');

    return `${trigger.trigger_type} trigger activated: ${conditionSummary}`;
  }

  private async logTriggerActivation(
    triggerId: string,
    context: TriggerEvaluationContext,
    result: TriggerResult
  ): Promise<void> {
    try {
      await createTriggerActivationLog({
        trigger_id: triggerId,
        business_id: context.businessId,
        customer_verification_id: context.verificationId,
        conditions_met: result.conditionsMet,
        questions_triggered: result.questionsToTrigger
      });
    } catch (error) {
      await this.loggingService.logError('Failed to log trigger activation', {
        triggerId,
        verificationId: context.verificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createTrigger(
    businessId: string,
    triggerData: {
      triggerName: string;
      triggerType: 'purchase_based' | 'time_based' | 'amount_based';
      priorityLevel: number;
      sensitivityThreshold: number;
      triggerConfig: Record<string, any>;
      priorityBoost?: number;
    }
  ) {
    const trigger = await createDynamicTrigger({
      business_id: businessId,
      trigger_name: triggerData.triggerName,
      trigger_type: triggerData.triggerType,
      priority_level: triggerData.priorityLevel,
      sensitivity_threshold: triggerData.sensitivityThreshold,
      trigger_config: triggerData.triggerConfig,
      priority_boost: triggerData.priorityBoost || 0
    });

    await this.loggingService.logInfo('Dynamic trigger created', {
      businessId,
      triggerId: trigger.id,
      triggerName: triggerData.triggerName,
      triggerType: triggerData.triggerType
    });

    return trigger;
  }

  async updateTrigger(
    triggerId: string,
    updates: {
      triggerName?: string;
      priorityLevel?: number;
      sensitivityThreshold?: number;
      triggerConfig?: Record<string, any>;
      priorityBoost?: number;
      isActive?: boolean;
    }
  ) {
    const updateData: any = {};
    
    if (updates.triggerName) updateData.trigger_name = updates.triggerName;
    if (updates.priorityLevel) updateData.priority_level = updates.priorityLevel;
    if (updates.sensitivityThreshold) updateData.sensitivity_threshold = updates.sensitivityThreshold;
    if (updates.triggerConfig) updateData.trigger_config = updates.triggerConfig;
    if (updates.priorityBoost !== undefined) updateData.priority_boost = updates.priorityBoost;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    return await updateDynamicTrigger(triggerId, updateData);
  }

  async addConditionToTrigger(
    triggerId: string,
    conditionData: {
      conditionType: 'purchase_category' | 'purchase_item' | 'transaction_amount' | 'time_window' | 'customer_frequency';
      conditionOperator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in_range';
      conditionValue: string;
      secondaryValue?: string;
      weightFactor?: number;
      isRequired?: boolean;
    }
  ) {
    return await createTriggerCondition({
      trigger_id: triggerId,
      condition_type: conditionData.conditionType,
      condition_operator: conditionData.conditionOperator,
      condition_value: conditionData.conditionValue,
      secondary_value: conditionData.secondaryValue,
      weight_factor: conditionData.weightFactor || 1.0,
      is_required: conditionData.isRequired || false
    });
  }

  async updateTriggerEffectiveness(
    triggerId: string,
    effectivenessScore: number,
    activationCount: number
  ): Promise<void> {
    await updateTriggerEffectiveness(triggerId, effectivenessScore, activationCount);

    await this.loggingService.logInfo('Trigger effectiveness updated', {
      triggerId,
      effectivenessScore,
      activationCount
    });
  }

  async getTriggerAnalytics(businessId: string, triggerId?: string) {
    if (triggerId) {
      return await getTriggerEffectivenessMetrics(businessId, triggerId);
    }

    // Get analytics for all triggers
    const triggers = await getDynamicTriggers(businessId, { isActive: true });
    const analytics = await Promise.all(
      triggers.map(async (trigger) => {
        const metrics = await getTriggerEffectivenessMetrics(businessId, trigger.id);
        return {
          triggerId: trigger.id,
          triggerName: trigger.trigger_name,
          triggerType: trigger.trigger_type,
          ...metrics
        };
      })
    );

    return analytics;
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample context to ensure <500ms requirement
    const sampleContext: TriggerEvaluationContext = {
      verificationId: 'performance-test',
      businessId: 'test-business',
      customerData: {
        purchaseCategories: ['meat', 'produce'],
        purchaseItems: ['ground_beef', 'apples'],
        transactionAmount: 450.0,
        transactionCurrency: 'SEK',
        transactionTime: '2025-09-24T12:30:00Z',
        customerSequence: 15,
        timeOfDay: 12.5,
        dayOfWeek: 2,
        isWeekend: false
      }
    };

    const startTime = Date.now();
    
    try {
      await this.evaluateTriggers(sampleContext);
      const duration = Date.now() - startTime;
      return duration < 500;
    } catch {
      return false;
    }
  }
}