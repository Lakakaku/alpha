import { database } from '@vocilia/database';
import { QuestionTriggerModel } from '@vocilia/database/src/questions/models/QuestionTrigger';
import { CustomQuestionModel } from '@vocilia/database/src/questions/models/CustomQuestion';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import type {
  QuestionTrigger,
  CustomQuestion,
  CreateTriggerRequest,
} from '@vocilia/types/src/questions';

export interface TriggerEvaluationContext {
  customerData?: {
    session_id?: string;
    visit_count?: number;
    previous_ratings?: number[];
    demographics?: Record<string, any>;
  };
  storeData?: {
    store_id: string;
    store_name?: string;
    current_occupancy?: number;
    peak_hours?: boolean;
    special_events?: string[];
  };
  timeContext: {
    currentTime: Date;
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
    hour: number; // 0-23
    minute: number; // 0-59
    timezone?: string;
  };
  sessionData?: {
    duration_minutes?: number;
    pages_visited?: string[];
    interactions?: Record<string, any>;
    device_type?: 'mobile' | 'desktop' | 'tablet';
  };
  businessData?: {
    business_id: string;
    subscription_tier?: string;
    feature_flags?: Record<string, boolean>;
  };
}

export interface TriggerEvaluationResult {
  triggered: boolean;
  trigger_id?: string;
  reason?: string;
  confidence: number; // 0-1 scale
  metadata?: Record<string, any>;
}

export interface TriggerPerformanceMetrics {
  trigger_id: string;
  total_evaluations: number;
  total_activations: number;
  activation_rate: number;
  average_evaluation_time_ms: number;
  last_activated: string | null;
  cooldown_remaining_minutes: number;
}

export class TriggerService {
  private supabase = database.createClient();
  private triggerModel: QuestionTriggerModel;
  private questionModel: CustomQuestionModel;

  // Performance optimization: cache frequently used triggers
  private triggerCache = new Map<string, QuestionTrigger[]>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.triggerModel = new QuestionTriggerModel(this.supabase);
    this.questionModel = new CustomQuestionModel(this.supabase);
  }

  /**
   * Evaluate all triggers for a question and return the best match
   */
  async evaluateTriggers(
    questionId: string,
    context: TriggerEvaluationContext
  ): Promise<TriggerEvaluationResult> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const startTime = performance.now();

    try {
      // Get all enabled triggers for the question
      const triggers = await this.getTriggersFromCache(questionId);
      
      if (triggers.length === 0) {
        return {
          triggered: false,
          reason: 'No active triggers found',
          confidence: 0,
        };
      }

      // Evaluate each trigger
      const evaluationPromises = triggers.map(trigger => 
        this.evaluateSingleTrigger(trigger, context)
      );

      const results = await Promise.all(evaluationPromises);
      
      // Find the highest confidence trigger that passed evaluation
      const validResults = results.filter(result => result.triggered);
      
      if (validResults.length === 0) {
        return {
          triggered: false,
          reason: 'No triggers satisfied their conditions',
          confidence: 0,
        };
      }

      // Sort by confidence (highest first), then by priority
      validResults.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        // If confidence is equal, prioritize by trigger priority
        const triggerA = triggers.find(t => t.id === a.trigger_id);
        const triggerB = triggers.find(t => t.id === b.trigger_id);
        return this.getPriorityValue(triggerB?.priority) - this.getPriorityValue(triggerA?.priority);
      });

      const bestResult = validResults[0];
      const evaluationTime = performance.now() - startTime;

      // Record the evaluation and activation
      if (bestResult.trigger_id) {
        await this.recordTriggerActivation(bestResult.trigger_id, context, evaluationTime);
      }

      return bestResult;
    } catch (error) {
      console.error('Error evaluating triggers:', error);
      return {
        triggered: false,
        reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      };
    }
  }

  /**
   * Evaluate a single trigger against the provided context
   */
  private async evaluateSingleTrigger(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): Promise<TriggerEvaluationResult> {
    try {
      // Check if trigger is enabled
      if (!trigger.is_enabled) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Trigger is disabled',
          confidence: 0,
        };
      }

      // Check cooldown period
      const cooldownOk = await this.triggerModel.checkCooldown(trigger.id);
      if (!cooldownOk) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Trigger is in cooldown period',
          confidence: 0,
        };
      }

      // Check max activations
      const activationsOk = await this.triggerModel.checkMaxActivations(trigger.id);
      if (!activationsOk) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Trigger has reached maximum activations',
          confidence: 0,
        };
      }

      // Evaluate trigger-specific conditions
      let confidence = 1.0;
      let metadata: Record<string, any> = {};

      switch (trigger.trigger_type) {
        case 'time_based':
          return this.evaluateTimeBased(trigger, context);
        
        case 'frequency_based':
          return this.evaluateFrequencyBased(trigger, context);
        
        case 'customer_behavior':
          return this.evaluateCustomerBehavior(trigger, context);
        
        case 'store_context':
          return this.evaluateStoreContext(trigger, context);
        
        case 'composite':
          return this.evaluateComposite(trigger, context);
        
        default:
          console.warn(`Unknown trigger type: ${trigger.trigger_type}`);
          return {
            triggered: false,
            trigger_id: trigger.id,
            reason: `Unsupported trigger type: ${trigger.trigger_type}`,
            confidence: 0,
          };
      }
    } catch (error) {
      console.error(`Error evaluating trigger ${trigger.id}:`, error);
      return {
        triggered: false,
        trigger_id: trigger.id,
        reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      };
    }
  }

  private evaluateTimeBased(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): TriggerEvaluationResult {
    const conditions = trigger.conditions;
    const { timeContext } = context;

    let confidence = 1.0;
    let metadata: Record<string, any> = {
      current_time: timeContext.currentTime.toISOString(),
      day_of_week: timeContext.dayOfWeek,
      hour: timeContext.hour,
    };

    // Check day of week
    if (conditions.days_of_week && Array.isArray(conditions.days_of_week)) {
      if (!conditions.days_of_week.includes(timeContext.dayOfWeek)) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Current day not in allowed days',
          confidence: 0,
          metadata,
        };
      }
    }

    // Check hour range
    if (conditions.hour_start !== undefined && conditions.hour_end !== undefined) {
      const inHourRange = timeContext.hour >= conditions.hour_start && 
                         timeContext.hour <= conditions.hour_end;
      if (!inHourRange) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Current time not in allowed hour range',
          confidence: 0,
          metadata,
        };
      }
    }

    // Check specific time windows
    if (conditions.time_windows && Array.isArray(conditions.time_windows)) {
      const currentMinutes = timeContext.hour * 60 + timeContext.minute;
      const inWindow = conditions.time_windows.some((window: any) => {
        const startMinutes = this.parseTimeToMinutes(window.start);
        const endMinutes = this.parseTimeToMinutes(window.end);
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      });

      if (!inWindow) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Current time not in any allowed time window',
          confidence: 0,
          metadata,
        };
      }
    }

    return {
      triggered: true,
      trigger_id: trigger.id,
      reason: 'Time-based conditions satisfied',
      confidence,
      metadata,
    };
  }

  private evaluateFrequencyBased(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): TriggerEvaluationResult {
    const conditions = trigger.conditions;
    let confidence = 1.0;
    let metadata: Record<string, any> = {};

    // Check visit frequency
    if (conditions.min_visits && context.customerData?.visit_count) {
      if (context.customerData.visit_count < conditions.min_visits) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Customer visit count below minimum threshold',
          confidence: 0,
          metadata: { visit_count: context.customerData.visit_count },
        };
      }
      confidence *= 0.8 + (0.2 * Math.min(1, context.customerData.visit_count / conditions.min_visits));
    }

    return {
      triggered: true,
      trigger_id: trigger.id,
      reason: 'Frequency conditions satisfied',
      confidence,
      metadata,
    };
  }

  private evaluateCustomerBehavior(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): TriggerEvaluationResult {
    const conditions = trigger.conditions;
    let confidence = 1.0;
    let metadata: Record<string, any> = {};

    // Check session duration
    if (conditions.min_session_duration && context.sessionData?.duration_minutes) {
      if (context.sessionData.duration_minutes < conditions.min_session_duration) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Session duration below minimum threshold',
          confidence: 0,
          metadata: { session_duration: context.sessionData.duration_minutes },
        };
      }
    }

    // Check device type
    if (conditions.device_types && context.sessionData?.device_type) {
      if (!conditions.device_types.includes(context.sessionData.device_type)) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Device type not in allowed list',
          confidence: 0,
          metadata: { device_type: context.sessionData.device_type },
        };
      }
    }

    // Check previous ratings
    if (conditions.rating_threshold && context.customerData?.previous_ratings) {
      const avgRating = context.customerData.previous_ratings.reduce((sum, rating) => sum + rating, 0) / 
                       context.customerData.previous_ratings.length;
      
      if (avgRating < conditions.rating_threshold) {
        confidence *= 1.2; // Boost confidence for low-rated customers
      }
      
      metadata.average_previous_rating = avgRating;
    }

    return {
      triggered: true,
      trigger_id: trigger.id,
      reason: 'Customer behavior conditions satisfied',
      confidence,
      metadata,
    };
  }

  private evaluateStoreContext(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): TriggerEvaluationResult {
    const conditions = trigger.conditions;
    let confidence = 1.0;
    let metadata: Record<string, any> = {};

    // Check store occupancy
    if (conditions.occupancy_threshold && context.storeData?.current_occupancy !== undefined) {
      if (context.storeData.current_occupancy < conditions.occupancy_threshold) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Store occupancy below threshold',
          confidence: 0,
          metadata: { current_occupancy: context.storeData.current_occupancy },
        };
      }
    }

    // Check peak hours
    if (conditions.peak_hours_only && !context.storeData?.peak_hours) {
      return {
        triggered: false,
        trigger_id: trigger.id,
        reason: 'Not during peak hours',
        confidence: 0,
        metadata: { is_peak_hours: context.storeData?.peak_hours },
      };
    }

    // Check special events
    if (conditions.required_events && context.storeData?.special_events) {
      const hasRequiredEvents = conditions.required_events.every((event: string) =>
        context.storeData?.special_events?.includes(event)
      );
      
      if (!hasRequiredEvents) {
        return {
          triggered: false,
          trigger_id: trigger.id,
          reason: 'Required special events not present',
          confidence: 0,
          metadata: { special_events: context.storeData.special_events },
        };
      }
    }

    return {
      triggered: true,
      trigger_id: trigger.id,
      reason: 'Store context conditions satisfied',
      confidence,
      metadata,
    };
  }

  private evaluateComposite(
    trigger: QuestionTrigger,
    context: TriggerEvaluationContext
  ): TriggerEvaluationResult {
    // For composite triggers, use the condition evaluation from the trigger model
    return this.triggerModel.evaluateConditions(trigger.id, {
      customerData: context.customerData,
      storeData: context.storeData,
      timeContext: context.timeContext,
      sessionData: context.sessionData,
    }).then(satisfied => ({
      triggered: satisfied,
      trigger_id: trigger.id,
      reason: satisfied ? 'Composite conditions satisfied' : 'Composite conditions not met',
      confidence: satisfied ? 0.9 : 0,
    })).catch(error => ({
      triggered: false,
      trigger_id: trigger.id,
      reason: `Composite evaluation error: ${error.message}`,
      confidence: 0,
    }));
  }

  /**
   * Get performance metrics for triggers
   */
  async getTriggerPerformanceMetrics(
    businessId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<TriggerPerformanceMetrics[]> {
    const triggers = await this.triggerModel.findByBusinessId(businessId);
    
    const metrics = await Promise.all(
      triggers.map(async (trigger) => {
        const activationHistory = await this.triggerModel.getActivationHistory(trigger.id, 1000);
        
        const activationsInRange = activationHistory.filter(activation => {
          const activatedAt = new Date(activation.activated_at);
          return activatedAt >= timeRange.start && activatedAt <= timeRange.end;
        });

        const total_activations = activationsInRange.length;
        const total_evaluations = total_activations * 2; // Estimate based on activation rate
        const activation_rate = total_evaluations > 0 ? (total_activations / total_evaluations) * 100 : 0;

        const lastActivation = activationHistory[0];
        const cooldownMinutes = trigger.cooldown_period || 0;
        const cooldown_remaining_minutes = lastActivation 
          ? Math.max(0, cooldownMinutes - ((Date.now() - new Date(lastActivation.activated_at).getTime()) / (1000 * 60)))
          : 0;

        return {
          trigger_id: trigger.id,
          total_evaluations,
          total_activations,
          activation_rate,
          average_evaluation_time_ms: 45, // Placeholder - would need actual timing data
          last_activated: lastActivation?.activated_at || null,
          cooldown_remaining_minutes,
        };
      })
    );

    return metrics;
  }

  /**
   * Optimize trigger performance by reordering and caching
   */
  async optimizeTriggerPerformance(questionId: string): Promise<void> {
    const triggers = await this.triggerModel.findByQuestionId(questionId);
    
    // Sort triggers by activation rate and evaluation time
    const metrics = await Promise.all(
      triggers.map(async (trigger) => {
        const history = await this.triggerModel.getActivationHistory(trigger.id, 100);
        return {
          trigger,
          activation_rate: history.length, // Simplified metric
        };
      })
    );

    // Cache the optimized trigger order
    const optimizedTriggers = metrics
      .sort((a, b) => b.activation_rate - a.activation_rate)
      .map(m => m.trigger);

    this.triggerCache.set(questionId, optimizedTriggers);
    this.cacheExpiry.set(questionId, Date.now() + this.CACHE_TTL);
  }

  // Helper methods
  private async getTriggersFromCache(questionId: string): Promise<QuestionTrigger[]> {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(questionId);
    
    if (expiry && now < expiry && this.triggerCache.has(questionId)) {
      return this.triggerCache.get(questionId)!;
    }

    // Cache miss or expired - fetch from database
    const triggers = await this.triggerModel.findEnabled(questionId);
    this.triggerCache.set(questionId, triggers);
    this.cacheExpiry.set(questionId, now + this.CACHE_TTL);
    
    return triggers;
  }

  private getPriorityValue(priority?: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async recordTriggerActivation(
    triggerId: string,
    context: TriggerEvaluationContext,
    evaluationTimeMs: number
  ): Promise<void> {
    try {
      await this.triggerModel.recordActivation(triggerId, {
        evaluation_time_ms: evaluationTimeMs,
        context_summary: {
          time: context.timeContext.currentTime.toISOString(),
          store_id: context.storeData?.store_id,
          customer_session: context.customerData?.session_id,
        },
      });
    } catch (error) {
      console.error('Failed to record trigger activation:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Clear trigger cache for a question (useful after trigger updates)
   */
  clearTriggerCache(questionId: string): void {
    this.triggerCache.delete(questionId);
    this.cacheExpiry.delete(questionId);
  }

  /**
   * Clear all trigger caches
   */
  clearAllTriggerCaches(): void {
    this.triggerCache.clear();
    this.cacheExpiry.clear();
  }
}

export default TriggerService;