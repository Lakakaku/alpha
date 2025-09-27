import { CallSession } from '../../models/CallSession';
import { CallEvent } from '../../models/CallEvent';
import { supabase } from '../../config/supabase';

export interface CostBreakdown {
  telephonyCost: number;
  aiCost: number;
  totalCost: number;
  currency: 'SEK' | 'USD';
}

export interface UsageMetrics {
  callDuration: number;
  aiTokensUsed: number;
  telephonyMinutes: number;
  providerId: string;
}

export interface CostReport {
  sessionId: string;
  businessId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  breakdown: CostBreakdown;
  metrics: UsageMetrics;
  estimatedVsActual: {
    estimatedCost: number;
    actualCost: number;
    variance: number;
    variancePercent: number;
  };
}

export interface BusinessCostSummary {
  businessId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalCalls: number;
  totalCost: number;
  averageCostPerCall: number;
  costByProvider: {
    fortyelks: number;
    twilio: number;
  };
  costByComponent: {
    telephony: number;
    ai: number;
  };
  budget?: {
    allocated: number;
    remaining: number;
    utilizationPercent: number;
  };
}

export class CostTracker {
  private static instance: CostTracker;

  // Pricing constants (in USD)
  private readonly PRICING = {
    fortyelks: {
      perMinute: 0.09, // $0.09 per minute
      setup: 0.01 // $0.01 setup fee
    },
    twilio: {
      perMinute: 0.12, // $0.12 per minute
      setup: 0.015 // $0.015 setup fee
    },
    openai: {
      inputTokens: 0.000005, // $0.000005 per input token (gpt-4o-mini)
      outputTokens: 0.000015, // $0.000015 per output token
      audioPerMinute: 0.01 // $0.01 per minute for real-time audio
    }
  };

  private readonly EXCHANGE_RATE_USD_TO_SEK = 10.5; // Approximate rate

  constructor() {}

  static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  /**
   * Calculate estimated cost before call initiation
   */
  estimateCallCost(
    providerId: 'fortyelks' | 'twilio',
    estimatedDurationMinutes: number,
    expectedQuestions: number
  ): CostBreakdown {
    // Telephony cost
    const providerPricing = this.PRICING[providerId];
    const telephonyCost = providerPricing.setup + (providerPricing.perMinute * estimatedDurationMinutes);

    // AI cost estimation
    // Rough estimate: 100 tokens per question (input) + 50 tokens per response (output)
    const estimatedInputTokens = expectedQuestions * 100;
    const estimatedOutputTokens = expectedQuestions * 50;
    const tokenCost = (estimatedInputTokens * this.PRICING.openai.inputTokens) + 
                     (estimatedOutputTokens * this.PRICING.openai.outputTokens);
    const audioCost = this.PRICING.openai.audioPerMinute * estimatedDurationMinutes;
    const aiCost = tokenCost + audioCost;

    const totalCost = telephonyCost + aiCost;

    return {
      telephonyCost,
      aiCost,
      totalCost,
      currency: 'USD'
    };
  }

  /**
   * Calculate actual cost after call completion
   */
  async calculateActualCost(sessionId: string): Promise<CostBreakdown> {
    const session = await CallSession.findById(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    // Get call events to analyze usage
    const events = await CallEvent.findBySessionId(sessionId);
    
    // Calculate telephony cost
    const durationMinutes = session.actualDuration ? Math.ceil(session.actualDuration / 60) : 0;
    const providerId = session.providerId as 'fortyelks' | 'twilio';
    const providerPricing = providerId ? this.PRICING[providerId] : this.PRICING.fortyelks;
    
    const telephonyCost = durationMinutes > 0 
      ? providerPricing.setup + (providerPricing.perMinute * durationMinutes)
      : 0;

    // Calculate AI cost from events
    let aiCost = 0;
    
    // Audio processing cost
    if (session.actualDuration) {
      const audioMinutes = session.actualDuration / 60;
      aiCost += this.PRICING.openai.audioPerMinute * audioMinutes;
    }

    // Token usage cost (would need actual token counts from OpenAI API)
    // For now, estimate based on responses
    const responses = await this.getCallResponses(sessionId);
    if (responses.length > 0) {
      const estimatedTokens = responses.length * 150; // Average tokens per interaction
      aiCost += estimatedTokens * this.PRICING.openai.outputTokens;
    }

    const totalCost = telephonyCost + aiCost;

    return {
      telephonyCost,
      aiCost,
      totalCost,
      currency: 'USD'
    };
  }

  /**
   * Track cost in real-time during call
   */
  async trackCallCost(sessionId: string, event: string, data?: any): Promise<void> {
    const costData = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    await CallEvent.create({
      sessionId,
      eventType: 'cost_tracking',
      providerId: 'system',
      eventData: costData
    });
  }

  /**
   * Generate detailed cost report for a call
   */
  async generateCostReport(sessionId: string): Promise<CostReport> {
    const session = await CallSession.findById(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    const actualCost = await this.calculateActualCost(sessionId);
    const events = await CallEvent.findBySessionId(sessionId);

    // Extract usage metrics
    const metrics: UsageMetrics = {
      callDuration: session.actualDuration || 0,
      aiTokensUsed: 0, // Would need actual token tracking
      telephonyMinutes: session.actualDuration ? Math.ceil(session.actualDuration / 60) : 0,
      providerId: session.providerId || 'unknown'
    };

    // Calculate variance from estimate
    const estimatedCost = session.estimatedCost || 0;
    const actualCostAmount = actualCost.totalCost;
    const variance = actualCostAmount - estimatedCost;
    const variancePercent = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

    return {
      sessionId,
      businessId: session.businessId,
      startTime: new Date(session.createdAt),
      endTime: session.status === 'completed' ? new Date(session.updatedAt) : undefined,
      duration: session.actualDuration || 0,
      breakdown: actualCost,
      metrics,
      estimatedVsActual: {
        estimatedCost,
        actualCost: actualCostAmount,
        variance,
        variancePercent
      }
    };
  }

  /**
   * Generate business cost summary for a period
   */
  async generateBusinessCostSummary(
    businessId: string,
    startDate: Date,
    endDate: Date,
    budgetAmount?: number
  ): Promise<BusinessCostSummary> {
    // Get all sessions for the business in the period
    const { data: sessions, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error || !sessions) {
      throw new Error('Failed to fetch call sessions');
    }

    const totalCalls = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    // Calculate total costs
    let totalCost = 0;
    let costByProvider = { fortyelks: 0, twilio: 0 };
    let costByComponent = { telephony: 0, ai: 0 };

    for (const session of completedSessions) {
      if (session.actual_cost) {
        totalCost += session.actual_cost;
        
        // Breakdown by provider
        if (session.provider_id === 'fortyelks') {
          costByProvider.fortyelks += session.actual_cost;
        } else if (session.provider_id === 'twilio') {
          costByProvider.twilio += session.actual_cost;
        }
      } else {
        // Calculate cost if not stored
        const costBreakdown = await this.calculateActualCost(session.id);
        totalCost += costBreakdown.totalCost;
        costByComponent.telephony += costBreakdown.telephonyCost;
        costByComponent.ai += costBreakdown.aiCost;
      }
    }

    const averageCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;

    // Budget analysis
    let budget;
    if (budgetAmount) {
      const remaining = budgetAmount - totalCost;
      const utilizationPercent = (totalCost / budgetAmount) * 100;
      
      budget = {
        allocated: budgetAmount,
        remaining,
        utilizationPercent
      };
    }

    return {
      businessId,
      period: { start: startDate, end: endDate },
      totalCalls,
      totalCost,
      averageCostPerCall,
      costByProvider,
      costByComponent,
      budget
    };
  }

  /**
   * Convert cost from USD to SEK
   */
  convertToSEK(usdAmount: number): number {
    return usdAmount * this.EXCHANGE_RATE_USD_TO_SEK;
  }

  /**
   * Get cost efficiency metrics
   */
  async getCostEfficiencyMetrics(businessId: string, days: number = 30): Promise<{
    costPerSuccessfulCall: number;
    costPerQuestion: number;
    costPerMinute: number;
    providerEfficiency: {
      fortyelks: { cost: number; successRate: number; efficiency: number };
      twilio: { cost: number; successRate: number; efficiency: number };
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const summary = await this.generateBusinessCostSummary(businessId, startDate, endDate);

    // Get session details for calculations
    const { data: sessions } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const completedSessions = sessions?.filter(s => s.status === 'completed') || [];
    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.actual_duration || 0), 0);
    const totalQuestions = completedSessions.reduce((sum, s) => sum + (s.expected_questions || 0), 0);

    const costPerSuccessfulCall = completedSessions.length > 0 ? summary.totalCost / completedSessions.length : 0;
    const costPerQuestion = totalQuestions > 0 ? summary.totalCost / totalQuestions : 0;
    const costPerMinute = totalDuration > 0 ? summary.totalCost / (totalDuration / 60) : 0;

    // Provider efficiency analysis
    const fortyElksSessions = sessions?.filter(s => s.provider_id === 'fortyelks') || [];
    const twilioSessions = sessions?.filter(s => s.provider_id === 'twilio') || [];

    const fortyElksSuccess = fortyElksSessions.filter(s => s.status === 'completed').length;
    const twilioSuccess = twilioSessions.filter(s => s.status === 'completed').length;

    const fortyElksEfficiency = fortyElksSessions.length > 0 
      ? (fortyElksSuccess / fortyElksSessions.length) / (summary.costByProvider.fortyelks || 1)
      : 0;
    
    const twilioEfficiency = twilioSessions.length > 0
      ? (twilioSuccess / twilioSessions.length) / (summary.costByProvider.twilio || 1)
      : 0;

    return {
      costPerSuccessfulCall,
      costPerQuestion,
      costPerMinute,
      providerEfficiency: {
        fortyelks: {
          cost: summary.costByProvider.fortyelks,
          successRate: fortyElksSessions.length > 0 ? fortyElksSuccess / fortyElksSessions.length : 0,
          efficiency: fortyElksEfficiency
        },
        twilio: {
          cost: summary.costByProvider.twilio,
          successRate: twilioSessions.length > 0 ? twilioSuccess / twilioSessions.length : 0,
          efficiency: twilioEfficiency
        }
      }
    };
  }

  /**
   * Helper to get call responses
   */
  private async getCallResponses(sessionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('call_responses')
      .select('*')
      .eq('session_id', sessionId);

    return data || [];
  }

  /**
   * Update pricing (for dynamic pricing adjustments)
   */
  updatePricing(provider: 'fortyelks' | 'twilio', pricing: { perMinute: number; setup: number }): void {
    this.PRICING[provider] = pricing;
  }
}

// Export singleton instance
export const costTracker = CostTracker.getInstance();