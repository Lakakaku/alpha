/**
 * Composite Fraud Scoring Service
 * Task: T042 - Composite fraud scoring service in apps/backend/src/services/fraud/fraudScoringService.ts
 * 
 * Combines all fraud detection components to generate final fraud scores.
 * Uses weighted scoring: Context (40%), Behavioral (30%), Keywords (20%), Transaction (10%)
 */

import { FraudScoreModel } from '../../../../../packages/database/src/fraud/fraud-score';
import { ContextAnalysisService } from './contextAnalysisService';
import { KeywordDetectionService } from './keywordDetectionService';
import { BehavioralPatternService } from './behavioralPatternService';
import {
  CompositeFraudRequest,
  CompositeFraudResult,
  RiskLevel,
  FraudScore,
  ScoreComponents,
  FraudDecision
} from '../../../../../packages/types/src/fraud';

export class FraudScoringService {
  private contextAnalysisService: ContextAnalysisService;
  private keywordDetectionService: KeywordDetectionService;
  private behavioralPatternService: BehavioralPatternService;

  // Scoring weights (must sum to 100%)
  private readonly WEIGHTS = {
    CONTEXT: 0.40,      // 40% - GPT-4o-mini context analysis
    BEHAVIORAL: 0.30,   // 30% - Behavioral pattern analysis
    KEYWORD: 0.20,      // 20% - Red flag keyword detection
    TRANSACTION: 0.10   // 10% - Transaction verification
  };

  // Score thresholds
  private readonly FRAUD_THRESHOLD = 70;  // 70% composite score = fraud
  private readonly HIGH_RISK_THRESHOLD = 55;
  private readonly MEDIUM_RISK_THRESHOLD = 30;

  constructor() {
    this.contextAnalysisService = new ContextAnalysisService();
    this.keywordDetectionService = new KeywordDetectionService();
    this.behavioralPatternService = new BehavioralPatternService();
  }

  /**
   * Generate comprehensive fraud score
   */
  async generateFraudScore(request: CompositeFraudRequest): Promise<CompositeFraudResult> {
    try {
      const startTime = Date.now();

      // Run all analysis components in parallel for performance
      const [
        contextResult,
        keywordResult,
        behavioralResult,
        transactionResult
      ] = await Promise.allSettled([
        // Context analysis (GPT-4o-mini)
        this.contextAnalysisService.analyzeContext({
          phone_hash: request.phone_hash,
          call_transcript: request.call_transcript,
          feedback_content: request.feedback_content,
          context_metadata: request.context_metadata
        }),
        
        // Keyword detection
        this.keywordDetectionService.detectKeywords({
          phone_hash: request.phone_hash,
          text_content: `${request.call_transcript || ''} ${request.feedback_content}`.trim(),
          language_code: request.language_code || 'sv'
        }),

        // Behavioral pattern analysis
        this.behavioralPatternService.analyzeBehavioralPatterns({
          phone_hash: request.phone_hash,
          call_history: request.call_history,
          time_window_start: request.time_window_start,
          time_window_end: request.time_window_end
        }),

        // Transaction verification (mock for now)
        this.analyzeTransactionPatterns(request)
      ]);

      // Extract results and handle failures gracefully
      const contextScore = this.extractScore(contextResult, 'context', 40);
      const keywordScore = this.extractScore(keywordResult, 'keyword', 20);
      const behavioralScore = this.extractScore(behavioralResult, 'behavioral', 30);
      const transactionScore = this.extractScore(transactionResult, 'transaction', 10);

      // Calculate composite score using weighted average
      const compositeScore = this.calculateCompositeScore({
        context: contextScore,
        keyword: keywordScore,
        behavioral: behavioralScore,
        transaction: transactionScore
      });

      // Determine risk level and fraud decision
      const riskLevel = this.calculateRiskLevel(compositeScore);
      const fraudDecision = this.makeFraudDecision(compositeScore, {
        context: contextScore,
        keyword: keywordScore,
        behavioral: behavioralScore,
        transaction: transactionScore
      });

      // Calculate fraud probability (0.0 to 1.0)
      const fraudProbability = Math.min(1.0, Math.max(0.0, compositeScore / 100));

      // Store fraud score in database
      const fraudScoreRecord = await FraudScoreModel.create({
        phone_hash: request.phone_hash,
        context_score: contextScore,
        keyword_score: keywordScore,
        behavioral_score: behavioralScore,
        transaction_score: transactionScore,
        composite_score: compositeScore,
        risk_level: riskLevel,
        fraud_probability: fraudProbability,
        analysis_metadata: {
          context_result: contextResult.status === 'fulfilled' ? {
            analysis_id: contextResult.value.analysis_id,
            confidence_level: contextResult.value.confidence_level,
            reasoning: contextResult.value.reasoning
          } : null,
          keyword_result: keywordResult.status === 'fulfilled' ? {
            total_matches: keywordResult.value.total_matches,
            highest_severity: keywordResult.value.highest_severity,
            risk_level: keywordResult.value.risk_level
          } : null,
          behavioral_result: behavioralResult.status === 'fulfilled' ? {
            patterns_detected: behavioralResult.value.patterns_detected.length,
            total_violations: behavioralResult.value.total_violations,
            overall_risk_level: behavioralResult.value.overall_risk_level
          } : null,
          transaction_result: transactionResult.status === 'fulfilled' ? transactionResult.value : null
        },
        processing_metadata: {
          processing_time_ms: Date.now() - startTime,
          components_analyzed: [
            contextResult.status === 'fulfilled' ? 'context' : null,
            keywordResult.status === 'fulfilled' ? 'keyword' : null,
            behavioralResult.status === 'fulfilled' ? 'behavioral' : null,
            transactionResult.status === 'fulfilled' ? 'transaction' : null
          ].filter(Boolean),
          failed_components: [
            contextResult.status === 'rejected' ? 'context' : null,
            keywordResult.status === 'rejected' ? 'keyword' : null,
            behavioralResult.status === 'rejected' ? 'behavioral' : null,
            transactionResult.status === 'rejected' ? 'transaction' : null
          ].filter(Boolean)
        }
      });

      return {
        fraud_score_id: fraudScoreRecord.id,
        phone_hash: request.phone_hash,
        composite_score: compositeScore,
        risk_level: riskLevel,
        fraud_decision: fraudDecision,
        fraud_probability: fraudProbability,
        score_components: {
          context_score: contextScore,
          keyword_score: keywordScore,
          behavioral_score: behavioralScore,
          transaction_score: transactionScore
        },
        component_results: {
          context_analysis: contextResult.status === 'fulfilled' ? contextResult.value : null,
          keyword_detection: keywordResult.status === 'fulfilled' ? keywordResult.value : null,
          behavioral_patterns: behavioralResult.status === 'fulfilled' ? behavioralResult.value : null,
          transaction_analysis: transactionResult.status === 'fulfilled' ? transactionResult.value : null
        },
        score_breakdown: this.generateScoreBreakdown(compositeScore, {
          context: contextScore,
          keyword: keywordScore,
          behavioral: behavioralScore,
          transaction: transactionScore
        }),
        confidence_level: this.calculateOverallConfidence([
          contextResult,
          keywordResult,
          behavioralResult,
          transactionResult
        ]),
        processing_time_ms: Date.now() - startTime,
        analyzed_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Fraud scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract score from analysis result
   */
  private extractScore(result: PromiseSettledResult<any>, component: string, maxScore: number): number {
    if (result.status === 'rejected') {
      console.warn(`${component} analysis failed: ${result.reason}`);
      return 0; // Conservative scoring on failure
    }

    switch (component) {
      case 'context':
        return Math.min(maxScore, result.value.overall_context_score || 0);
      case 'keyword':
        return Math.min(maxScore, result.value.overall_keyword_score || 0);
      case 'behavioral':
        return Math.min(maxScore, result.value.composite_behavioral_score || 0);
      case 'transaction':
        return Math.min(maxScore, result.value.transaction_risk_score || 0);
      default:
        return 0;
    }
  }

  /**
   * Calculate composite score using weighted average
   */
  private calculateCompositeScore(components: ScoreComponents): number {
    const weightedScore = 
      (components.context * this.WEIGHTS.CONTEXT) +
      (components.keyword * this.WEIGHTS.KEYWORD) +
      (components.behavioral * this.WEIGHTS.BEHAVIORAL) +
      (components.transaction * this.WEIGHTS.TRANSACTION);

    return Math.round(weightedScore * 100) / 100;
  }

  /**
   * Calculate risk level based on composite score
   */
  private calculateRiskLevel(compositeScore: number): RiskLevel {
    if (compositeScore >= this.FRAUD_THRESHOLD) return 'critical';
    if (compositeScore >= this.HIGH_RISK_THRESHOLD) return 'high';
    if (compositeScore >= this.MEDIUM_RISK_THRESHOLD) return 'medium';
    return 'low';
  }

  /**
   * Make fraud decision based on score and component analysis
   */
  private makeFraudDecision(compositeScore: number, components: ScoreComponents): FraudDecision {
    // Primary decision based on composite score
    if (compositeScore >= this.FRAUD_THRESHOLD) {
      return {
        is_fraud: true,
        confidence: this.calculateDecisionConfidence(compositeScore, components),
        primary_reason: this.identifyPrimaryReason(components),
        recommendation: 'block_immediately',
        review_required: compositeScore < 85 // Manual review for edge cases
      };
    }

    // High-risk cases
    if (compositeScore >= this.HIGH_RISK_THRESHOLD) {
      return {
        is_fraud: false,
        confidence: this.calculateDecisionConfidence(compositeScore, components),
        primary_reason: this.identifyPrimaryReason(components),
        recommendation: 'manual_review',
        review_required: true
      };
    }

    // Medium-risk cases
    if (compositeScore >= this.MEDIUM_RISK_THRESHOLD) {
      return {
        is_fraud: false,
        confidence: this.calculateDecisionConfidence(compositeScore, components),
        primary_reason: this.identifyPrimaryReason(components),
        recommendation: 'monitor_closely',
        review_required: false
      };
    }

    // Low-risk cases
    return {
      is_fraud: false,
      confidence: this.calculateDecisionConfidence(compositeScore, components),
      primary_reason: 'low_risk_profile',
      recommendation: 'allow',
      review_required: false
    };
  }

  /**
   * Calculate decision confidence
   */
  private calculateDecisionConfidence(compositeScore: number, components: ScoreComponents): number {
    // Higher confidence when multiple components agree
    const activeComponents = Object.values(components).filter(score => score > 0).length;
    const scoreDistribution = Object.values(components).map(score => score > 0 ? 1 : 0).reduce((a, b) => a + b, 0);
    
    // Base confidence from composite score certainty
    let baseConfidence: number;
    if (compositeScore >= 80 || compositeScore <= 20) {
      baseConfidence = 0.95; // Very confident in extreme scores
    } else if (compositeScore >= 70 || compositeScore <= 30) {
      baseConfidence = 0.85; // High confidence
    } else if (compositeScore >= 60 || compositeScore <= 40) {
      baseConfidence = 0.75; // Medium confidence  
    } else {
      baseConfidence = 0.60; // Lower confidence near thresholds
    }

    // Boost confidence when multiple components agree
    const consensusBonus = Math.min(0.15, (activeComponents - 1) * 0.05);
    
    return Math.min(1.0, baseConfidence + consensusBonus);
  }

  /**
   * Identify primary reason for decision
   */
  private identifyPrimaryReason(components: ScoreComponents): string {
    const maxComponent = Object.entries(components)
      .reduce((max, [key, value]) => value > max.value ? { key, value } : max, { key: '', value: -1 });

    if (maxComponent.value === 0) return 'insufficient_data';

    const reasons: Record<string, string> = {
      context: 'suspicious_context_patterns',
      keyword: 'red_flag_keywords_detected',
      behavioral: 'abnormal_behavioral_patterns',
      transaction: 'transaction_anomalies'
    };

    return reasons[maxComponent.key] || 'multiple_risk_factors';
  }

  /**
   * Generate detailed score breakdown
   */
  private generateScoreBreakdown(compositeScore: number, components: ScoreComponents): {
    total_score: number;
    component_contributions: Record<string, { score: number; weight: number; contribution: number }>;
    risk_factors: string[];
    protective_factors: string[];
  } {
    const componentContributions = {
      context: {
        score: components.context,
        weight: this.WEIGHTS.CONTEXT,
        contribution: components.context * this.WEIGHTS.CONTEXT
      },
      keyword: {
        score: components.keyword,
        weight: this.WEIGHTS.KEYWORD,
        contribution: components.keyword * this.WEIGHTS.KEYWORD
      },
      behavioral: {
        score: components.behavioral,
        weight: this.WEIGHTS.BEHAVIORAL,
        contribution: components.behavioral * this.WEIGHTS.BEHAVIORAL
      },
      transaction: {
        score: components.transaction,
        weight: this.WEIGHTS.TRANSACTION,
        contribution: components.transaction * this.WEIGHTS.TRANSACTION
      }
    };

    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];

    Object.entries(componentContributions).forEach(([key, data]) => {
      if (data.score >= 15) {
        riskFactors.push(`High ${key} risk score (${data.score})`);
      } else if (data.score <= 5) {
        protectiveFactors.push(`Low ${key} risk indicators`);
      }
    });

    return {
      total_score: compositeScore,
      component_contributions: componentContributions,
      risk_factors: riskFactors,
      protective_factors: protectiveFactors
    };
  }

  /**
   * Calculate overall confidence from component results
   */
  private calculateOverallConfidence(results: PromiseSettledResult<any>[]): number {
    const successfulResults = results.filter(result => result.status === 'fulfilled');
    const totalResults = results.length;
    
    // Base confidence from successful component analysis
    const baseConfidence = successfulResults.length / totalResults;
    
    // Extract individual confidence scores where available
    const componentConfidences = successfulResults.map(result => {
      if (result.status === 'fulfilled' && result.value.confidence_level) {
        return result.value.confidence_level;
      }
      return 0.8; // Default confidence for components without explicit confidence
    });

    // Average component confidence
    const avgComponentConfidence = componentConfidences.length > 0
      ? componentConfidences.reduce((sum, conf) => sum + conf, 0) / componentConfidences.length
      : 0.5;

    // Combined confidence (weighted average)
    return Math.round((baseConfidence * 0.4 + avgComponentConfidence * 0.6) * 100) / 100;
  }

  /**
   * Mock transaction pattern analysis (placeholder)
   */
  private async analyzeTransactionPatterns(request: CompositeFraudRequest): Promise<{
    transaction_risk_score: number;
    analysis_summary: any;
  }> {
    // Mock implementation - in production this would analyze payment patterns,
    // refund requests, geographic inconsistencies, etc.
    return {
      transaction_risk_score: 0, // Default to no transaction risk for now
      analysis_summary: {
        patterns_analyzed: ['payment_timing', 'geographic_consistency', 'refund_patterns'],
        anomalies_found: 0,
        confidence: 0.7
      }
    };
  }

  /**
   * Get fraud scoring statistics
   */
  async getScoringStatistics(timeWindow: string = '24h'): Promise<{
    total_scores_generated: number;
    fraud_rate: number;
    average_composite_score: number;
    component_averages: ScoreComponents;
    risk_level_distribution: Record<RiskLevel, number>;
    decision_distribution: Record<string, number>;
  }> {
    try {
      const hours = this.parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const stats = await FraudScoreModel.getStatistics({ since });

      return {
        total_scores_generated: stats.total_count,
        fraud_rate: stats.fraud_rate,
        average_composite_score: stats.avg_composite_score,
        component_averages: {
          context: stats.avg_context_score,
          keyword: stats.avg_keyword_score,
          behavioral: stats.avg_behavioral_score,
          transaction: stats.avg_transaction_score
        },
        risk_level_distribution: stats.risk_level_distribution,
        decision_distribution: {
          fraud_detected: stats.fraud_count,
          manual_review: stats.high_risk_count,
          monitor_closely: stats.medium_risk_count,
          allow: stats.low_risk_count
        }
      };
    } catch (error) {
      throw new Error(`Scoring statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch process fraud scores
   */
  async batchGenerateFraudScores(requests: CompositeFraudRequest[]): Promise<CompositeFraudResult[]> {
    try {
      const results: CompositeFraudResult[] = [];
      const batchSize = 3; // Process 3 at a time to avoid overwhelming AI services

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchPromises = batch.map(request => this.generateFraudScore(request));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch fraud scoring failed for request ${i + index}: ${result.reason}`);
          }
        });

        // Delay between batches to respect rate limits
        if (i + batchSize < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Batch fraud scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Re-score existing fraud case with updated data
   */
  async reScore(phoneHash: string, fraudScoreId?: string): Promise<CompositeFraudResult> {
    try {
      // Get existing fraud score data if provided
      const existingScore = fraudScoreId ? await FraudScoreModel.getById(fraudScoreId) : null;
      
      if (!existingScore) {
        throw new Error('Cannot re-score without existing fraud score data');
      }

      // Reconstruct request from existing data
      const request: CompositeFraudRequest = {
        phone_hash: phoneHash,
        call_transcript: existingScore.analysis_metadata.context_result?.reasoning || '',
        feedback_content: '', // Would need to retrieve from original source
        call_history: [], // Would need to retrieve from call logs
        time_window_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        time_window_end: new Date().toISOString(),
        language_code: 'sv'
      };

      return await this.generateFraudScore(request);
    } catch (error) {
      throw new Error(`Re-scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse time window string to hours
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hmd])$/);
    if (!match) return 24;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value / 60;
      case 'h': return value;
      case 'd': return value * 24;
      default: return 24;
    }
  }
}