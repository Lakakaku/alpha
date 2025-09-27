import { database } from '@vocilia/database';
import { CustomQuestionModel } from '@vocilia/database/src/questions/models/CustomQuestion';
import { QuestionResponseModel } from '@vocilia/database/src/questions/models/QuestionResponse';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import type { CustomQuestion } from '@vocilia/types/src/questions';

export interface FrequencyConfig {
  target: number; // Number of times to present
  window: 'hourly' | 'daily' | 'weekly' | 'monthly'; // Time window
  reset_behavior: 'automatic' | 'manual'; // How to reset counter
  cooldown_minutes?: number; // Minimum time between presentations
  adaptive_behavior?: boolean; // Adjust based on response patterns
}

export interface FrequencyStatus {
  question_id: string;
  current_count: number;
  target_count: number;
  window_type: string;
  window_start: Date;
  window_end: Date;
  next_reset: Date;
  presentations_remaining: number;
  cooldown_remaining_minutes: number;
  can_present: boolean;
  adaptive_adjustment?: number; // Multiplier based on response patterns
}

export interface FrequencyAnalytics {
  question_id: string;
  period_type: 'hourly' | 'daily' | 'weekly' | 'monthly';
  presentations: number;
  responses: number;
  response_rate: number;
  average_rating?: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  effectiveness_score: number; // 0-100
}

export interface AdaptiveBehaviorConfig {
  min_multiplier: number; // Minimum frequency multiplier (e.g., 0.5 = reduce by 50%)
  max_multiplier: number; // Maximum frequency multiplier (e.g., 2.0 = double frequency)
  response_rate_threshold: number; // Below this rate, reduce frequency
  rating_threshold: number; // Below this rating, reduce frequency
  adjustment_sensitivity: number; // How quickly to adjust (0-1)
}

export class FrequencyService {
  private supabase = database.createClient();
  private questionModel: CustomQuestionModel;
  private responseModel: QuestionResponseModel;

  // Performance optimization: cache frequency status
  private frequencyCache = new Map<string, FrequencyStatus>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter for frequency data)

  constructor() {
    this.questionModel = new CustomQuestionModel(this.supabase);
    this.responseModel = new QuestionResponseModel(this.supabase);
  }

  /**
   * Check if a question can be presented based on frequency limits
   */
  async canPresentQuestion(questionId: string): Promise<boolean> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const status = await this.getFrequencyStatus(questionId);
    return status.can_present;
  }

  /**
   * Get current frequency status for a question
   */
  async getFrequencyStatus(questionId: string): Promise<FrequencyStatus> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    // Check cache first
    const cached = this.getFromCache(questionId);
    if (cached) {
      return cached;
    }

    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const status = await this.calculateFrequencyStatus(question);
    
    // Cache the result
    this.setCache(questionId, status);
    
    return status;
  }

  /**
   * Record a question presentation and update frequency counters
   */
  async recordPresentation(questionId: string): Promise<void> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    // Check if we can present before recording
    const canPresent = await this.canPresentQuestion(questionId);
    if (!canPresent) {
      throw new ValidationError('Question cannot be presented due to frequency limits');
    }

    // Increment the frequency counter atomically
    await this.questionModel.incrementFrequency(questionId);
    
    // Clear cache to force refresh
    this.clearCache(questionId);

    // Record analytics
    await this.recordFrequencyEvent(questionId, 'presentation');
  }

  /**
   * Reset frequency counter for a question
   */
  async resetFrequency(questionId: string, manual: boolean = false): Promise<void> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    await this.questionModel.resetFrequency(questionId);
    
    // Clear cache
    this.clearCache(questionId);

    // Record the reset event
    await this.recordFrequencyEvent(questionId, manual ? 'manual_reset' : 'automatic_reset');
  }

  /**
   * Update frequency configuration for a question
   */
  async updateFrequencyConfig(
    questionId: string,
    config: Partial<FrequencyConfig>
  ): Promise<CustomQuestion> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const updateData: any = {};
    
    if (config.target !== undefined) {
      updateData.frequency_target = config.target;
    }
    
    if (config.window !== undefined) {
      updateData.frequency_window = config.window;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No frequency configuration provided');
    }

    const updatedQuestion = await this.questionModel.update(questionId, updateData);
    
    // Clear cache
    this.clearCache(questionId);
    
    return updatedQuestion;
  }

  /**
   * Get frequency analytics for a question
   */
  async getFrequencyAnalytics(
    questionId: string,
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
    periods: number = 30
  ): Promise<FrequencyAnalytics[]> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const analytics = await this.responseModel.getAnalyticsSummary(questionId, periodType, periods);
    
    return analytics.map((period, index) => {
      const presentations = period.presentation_count || 0;
      const responses = period.response_count || 0;
      const response_rate = presentations > 0 ? (responses / presentations) * 100 : 0;
      const average_rating = period.average_rating;

      // Calculate trend (simplified)
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (index < analytics.length - 1) {
        const nextPeriod = analytics[index + 1];
        const currentScore = presentations * response_rate;
        const nextScore = (nextPeriod.presentation_count || 0) * 
                         ((nextPeriod.response_count || 0) / Math.max(1, nextPeriod.presentation_count || 1)) * 100;
        
        if (currentScore > nextScore * 1.1) {
          trend = 'increasing';
        } else if (currentScore < nextScore * 0.9) {
          trend = 'decreasing';
        }
      }

      // Calculate effectiveness score (0-100)
      let effectiveness_score = 0;
      if (presentations > 0) {
        const response_component = Math.min(100, response_rate);
        const rating_component = average_rating ? (average_rating / 5) * 100 : 50;
        const frequency_component = presentations > 0 ? Math.min(100, (presentations / 10) * 100) : 0;
        
        effectiveness_score = (response_component * 0.4) + (rating_component * 0.4) + (frequency_component * 0.2);
      }

      return {
        question_id: questionId,
        period_type: periodType,
        presentations,
        responses,
        response_rate,
        average_rating,
        trend,
        effectiveness_score: Math.round(effectiveness_score),
      };
    });
  }

  /**
   * Apply adaptive behavior adjustments based on response patterns
   */
  async applyAdaptiveBehavior(
    questionId: string,
    config: AdaptiveBehaviorConfig = {
      min_multiplier: 0.5,
      max_multiplier: 2.0,
      response_rate_threshold: 30, // 30%
      rating_threshold: 3.0, // 3.0/5.0
      adjustment_sensitivity: 0.1,
    }
  ): Promise<{
    applied: boolean;
    multiplier: number;
    reason: string;
  }> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    // Get recent analytics (last 7 days)
    const analytics = await this.getFrequencyAnalytics(questionId, 'daily', 7);
    
    if (analytics.length === 0) {
      return {
        applied: false,
        multiplier: 1.0,
        reason: 'No analytics data available',
      };
    }

    // Calculate average metrics
    const avgResponseRate = analytics.reduce((sum, a) => sum + a.response_rate, 0) / analytics.length;
    const avgRating = analytics.reduce((sum, a) => sum + (a.average_rating || 0), 0) / analytics.length;
    const totalPresentations = analytics.reduce((sum, a) => sum + a.presentations, 0);

    // Determine adjustment needed
    let multiplier = 1.0;
    let reason = 'No adjustment needed';

    if (totalPresentations < 5) {
      return {
        applied: false,
        multiplier: 1.0,
        reason: 'Insufficient data for adaptive adjustment',
      };
    }

    // Adjust based on response rate
    if (avgResponseRate < config.response_rate_threshold) {
      const adjustment = (config.response_rate_threshold - avgResponseRate) / 100 * config.adjustment_sensitivity;
      multiplier -= adjustment;
      reason = `Low response rate (${avgResponseRate.toFixed(1)}%)`;
    } else if (avgResponseRate > config.response_rate_threshold * 1.5) {
      const adjustment = (avgResponseRate - config.response_rate_threshold) / 100 * config.adjustment_sensitivity;
      multiplier += adjustment;
      reason = `High response rate (${avgResponseRate.toFixed(1)}%)`;
    }

    // Adjust based on rating
    if (avgRating > 0 && avgRating < config.rating_threshold) {
      const adjustment = (config.rating_threshold - avgRating) / 5 * config.adjustment_sensitivity;
      multiplier -= adjustment;
      reason += reason === 'No adjustment needed' ? 
        `Low average rating (${avgRating.toFixed(1)})` : 
        ` and low rating (${avgRating.toFixed(1)})`;
    }

    // Clamp multiplier to bounds
    multiplier = Math.max(config.min_multiplier, Math.min(config.max_multiplier, multiplier));

    if (Math.abs(multiplier - 1.0) < 0.05) {
      return {
        applied: false,
        multiplier: 1.0,
        reason: 'Adjustment too small to apply',
      };
    }

    // Apply the adjustment by updating the frequency target
    const question = await this.questionModel.findById(questionId);
    if (question) {
      const newTarget = Math.round((question.frequency_target || 100) * multiplier);
      await this.questionModel.update(questionId, {
        frequency_target: newTarget,
      });

      // Record the adaptive adjustment
      await this.recordFrequencyEvent(questionId, 'adaptive_adjustment', {
        old_target: question.frequency_target,
        new_target: newTarget,
        multiplier,
        reason,
      });
    }

    return {
      applied: true,
      multiplier,
      reason,
    };
  }

  /**
   * Get frequency recommendations for optimal question performance
   */
  async getFrequencyRecommendations(questionId: string): Promise<{
    current_config: FrequencyConfig;
    recommendations: Array<{
      type: 'frequency' | 'window' | 'cooldown';
      current_value: any;
      recommended_value: any;
      reason: string;
      impact: 'low' | 'medium' | 'high';
    }>;
    overall_score: number; // 0-100
  }> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    const analytics = await this.getFrequencyAnalytics(questionId, 'daily', 14);
    const stats = await this.responseModel.getQuestionStats(questionId);

    const current_config: FrequencyConfig = {
      target: question.frequency_target || 100,
      window: question.frequency_window || 'daily',
      reset_behavior: 'automatic',
    };

    const recommendations: Array<{
      type: 'frequency' | 'window' | 'cooldown';
      current_value: any;
      recommended_value: any;
      reason: string;
      impact: 'low' | 'medium' | 'high';
    }> = [];

    // Analyze response rate
    if (stats.response_rate < 20) {
      recommendations.push({
        type: 'frequency',
        current_value: current_config.target,
        recommended_value: Math.round(current_config.target * 0.7),
        reason: 'Low response rate suggests over-presentation',
        impact: 'high',
      });
    } else if (stats.response_rate > 80) {
      recommendations.push({
        type: 'frequency',
        current_value: current_config.target,
        recommended_value: Math.round(current_config.target * 1.3),
        reason: 'High response rate suggests room for more presentations',
        impact: 'medium',
      });
    }

    // Analyze average rating
    if (stats.average_rating && stats.average_rating < 2.5) {
      recommendations.push({
        type: 'cooldown',
        current_value: 'none',
        recommended_value: '30 minutes',
        reason: 'Low ratings suggest need for cooldown between presentations',
        impact: 'high',
      });
    }

    // Analyze time window effectiveness
    const hourlyEffectiveness = analytics.filter(a => a.period_type === 'daily')
      .reduce((sum, a) => sum + a.effectiveness_score, 0) / Math.max(1, analytics.length);

    if (hourlyEffectiveness < 40 && current_config.window === 'hourly') {
      recommendations.push({
        type: 'window',
        current_value: 'hourly',
        recommended_value: 'daily',
        reason: 'Low effectiveness suggests longer time window needed',
        impact: 'medium',
      });
    }

    // Calculate overall score
    let overall_score = 50; // Start with baseline
    overall_score += Math.min(30, stats.response_rate * 0.6); // Response rate component
    overall_score += Math.min(20, (stats.average_rating || 2.5) * 4); // Rating component

    return {
      current_config,
      recommendations,
      overall_score: Math.round(overall_score),
    };
  }

  // Private helper methods
  private async calculateFrequencyStatus(question: CustomQuestion): Promise<FrequencyStatus> {
    const current_count = question.frequency_current || 0;
    const target_count = question.frequency_target || 100;
    const window_type = question.frequency_window || 'daily';
    
    const { window_start, window_end, next_reset } = this.calculateWindowBounds(
      question.frequency_reset_at || question.created_at,
      window_type
    );

    // Check if we need to reset the counter
    const now = new Date();
    if (now >= next_reset) {
      await this.resetFrequency(question.id);
      return this.calculateFrequencyStatus(question); // Recalculate after reset
    }

    const presentations_remaining = Math.max(0, target_count - current_count);
    const can_present = presentations_remaining > 0;

    // TODO: Implement cooldown logic
    const cooldown_remaining_minutes = 0;

    return {
      question_id: question.id,
      current_count,
      target_count,
      window_type,
      window_start,
      window_end,
      next_reset,
      presentations_remaining,
      cooldown_remaining_minutes,
      can_present,
    };
  }

  private calculateWindowBounds(resetAt: string, windowType: string): {
    window_start: Date;
    window_end: Date;
    next_reset: Date;
  } {
    const reset = new Date(resetAt);
    const now = new Date();

    switch (windowType) {
      case 'hourly': {
        const window_start = new Date(reset);
        window_start.setMinutes(0, 0, 0);
        const window_end = new Date(window_start);
        window_end.setHours(window_end.getHours() + 1);
        const next_reset = new Date(window_end);
        
        return { window_start, window_end, next_reset };
      }
      
      case 'daily': {
        const window_start = new Date(reset);
        window_start.setHours(0, 0, 0, 0);
        const window_end = new Date(window_start);
        window_end.setDate(window_end.getDate() + 1);
        const next_reset = new Date(window_end);
        
        return { window_start, window_end, next_reset };
      }
      
      case 'weekly': {
        const window_start = new Date(reset);
        const dayOfWeek = window_start.getDay();
        window_start.setDate(window_start.getDate() - dayOfWeek);
        window_start.setHours(0, 0, 0, 0);
        const window_end = new Date(window_start);
        window_end.setDate(window_end.getDate() + 7);
        const next_reset = new Date(window_end);
        
        return { window_start, window_end, next_reset };
      }
      
      case 'monthly': {
        const window_start = new Date(reset);
        window_start.setDate(1);
        window_start.setHours(0, 0, 0, 0);
        const window_end = new Date(window_start);
        window_end.setMonth(window_end.getMonth() + 1);
        const next_reset = new Date(window_end);
        
        return { window_start, window_end, next_reset };
      }
      
      default:
        throw new Error(`Unsupported window type: ${windowType}`);
    }
  }

  private async recordFrequencyEvent(
    questionId: string,
    eventType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // This would typically go to an analytics/events table
      // For now, we'll just log it
      console.log(`Frequency event: ${eventType} for question ${questionId}`, metadata);
    } catch (error) {
      console.error('Failed to record frequency event:', error);
      // Non-critical, don't throw
    }
  }

  // Cache management
  private getFromCache(questionId: string): FrequencyStatus | null {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(questionId);
    
    if (expiry && now < expiry && this.frequencyCache.has(questionId)) {
      return this.frequencyCache.get(questionId)!;
    }
    
    return null;
  }

  private setCache(questionId: string, status: FrequencyStatus): void {
    this.frequencyCache.set(questionId, status);
    this.cacheExpiry.set(questionId, Date.now() + this.CACHE_TTL);
  }

  private clearCache(questionId: string): void {
    this.frequencyCache.delete(questionId);
    this.cacheExpiry.delete(questionId);
  }

  /**
   * Clear all frequency caches
   */
  clearAllCaches(): void {
    this.frequencyCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    total_entries: number;
    cache_hits: number;
    cache_misses: number;
    memory_usage_mb: number;
  } {
    return {
      total_entries: this.frequencyCache.size,
      cache_hits: 0, // Would need to track this
      cache_misses: 0, // Would need to track this
      memory_usage_mb: Math.round((JSON.stringify([...this.frequencyCache]).length) / 1024 / 1024 * 100) / 100,
    };
  }
}

export default FrequencyService;