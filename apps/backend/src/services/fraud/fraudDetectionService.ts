/**
 * Fraud Detection Orchestrator Service
 * Task: T043 - Fraud detection orchestrator service in apps/backend/src/services/fraud/fraudDetectionService.ts
 * 
 * Main orchestrator service that coordinates all fraud detection components.
 * Provides unified interface for fraud analysis and real-time decision making.
 */

import { FraudScoringService } from './fraudScoringService';
import { ContextAnalysisService } from './contextAnalysisService';
import { KeywordDetectionService } from './keywordDetectionService';
import { BehavioralPatternService } from './behavioralPatternService';
import { FraudScoreModel } from '../../../../../packages/database/src/fraud/fraud-score';
import {
  FraudDetectionRequest,
  FraudDetectionResponse,
  CompositeFraudRequest,
  RiskLevel,
  FraudAlertLevel,
  FraudDetectionMode,
  QuickScanRequest,
  QuickScanResponse
} from '../../../../../packages/types/src/fraud';

export class FraudDetectionService {
  private fraudScoringService: FraudScoringService;
  private contextAnalysisService: ContextAnalysisService;
  private keywordDetectionService: KeywordDetectionService;
  private behavioralPatternService: BehavioralPatternService;

  constructor() {
    this.fraudScoringService = new FraudScoringService();
    this.contextAnalysisService = new ContextAnalysisService();
    this.keywordDetectionService = new KeywordDetectionService();
    this.behavioralPatternService = new BehavioralPatternService();
  }

  /**
   * Comprehensive fraud detection analysis
   */
  async detectFraud(request: FraudDetectionRequest): Promise<FraudDetectionResponse> {
    try {
      const startTime = Date.now();

      // Validate request
      this.validateDetectionRequest(request);

      // Determine detection mode
      const detectionMode = request.detection_mode || this.determineOptimalMode(request);

      let fraudResult;

      switch (detectionMode) {
        case 'comprehensive':
          fraudResult = await this.runComprehensiveAnalysis(request);
          break;
        case 'quick_scan':
          fraudResult = await this.runQuickScan(request);
          break;
        case 'context_only':
          fraudResult = await this.runContextOnlyAnalysis(request);
          break;
        case 'behavioral_only':
          fraudResult = await this.runBehavioralOnlyAnalysis(request);
          break;
        default:
          fraudResult = await this.runComprehensiveAnalysis(request);
      }

      // Generate alerts if needed
      const alerts = await this.generateFraudAlerts(fraudResult);

      // Calculate processing metrics
      const totalProcessingTime = Date.now() - startTime;

      return {
        detection_id: this.generateDetectionId(),
        phone_hash: request.phone_hash,
        detection_mode: detectionMode,
        fraud_result: fraudResult,
        alerts_generated: alerts,
        processing_metrics: {
          total_time_ms: totalProcessingTime,
          components_used: this.identifyComponentsUsed(detectionMode),
          performance_grade: this.calculatePerformanceGrade(totalProcessingTime, detectionMode)
        },
        recommendations: this.generateActionRecommendations(fraudResult),
        next_steps: this.determineNextSteps(fraudResult),
        detected_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Fraud detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Quick fraud scan for real-time scenarios
   */
  async quickScan(request: QuickScanRequest): Promise<QuickScanResponse> {
    try {
      const startTime = Date.now();

      // Priority-based quick analysis
      const [keywordResult, basicBehavioral] = await Promise.allSettled([
        // Quick keyword scan (highest priority)
        this.keywordDetectionService.detectKeywords({
          phone_hash: request.phone_hash,
          text_content: request.content,
          language_code: request.language_code || 'sv'
        }),

        // Basic behavioral check (if history available)
        request.recent_call_count ? this.checkRecentCallFrequency(
          request.phone_hash,
          request.recent_call_count,
          request.time_window_minutes || 30
        ) : Promise.resolve(null)
      ]);

      // Calculate quick risk score
      const keywordScore = keywordResult.status === 'fulfilled' 
        ? keywordResult.value.overall_keyword_score 
        : 0;

      const behavioralScore = basicBehavioral.status === 'fulfilled' && basicBehavioral.value
        ? basicBehavioral.value.risk_score
        : 0;

      // Simple weighted score for quick decision
      const quickScore = (keywordScore * 0.6) + (behavioralScore * 0.4);
      const riskLevel = this.calculateQuickRiskLevel(quickScore);
      const shouldBlock = quickScore >= 50; // Lower threshold for quick blocking

      const processingTime = Date.now() - startTime;

      return {
        phone_hash: request.phone_hash,
        quick_risk_score: Math.round(quickScore * 100) / 100,
        risk_level: riskLevel,
        should_block: shouldBlock,
        block_reason: shouldBlock ? this.generateBlockReason(keywordResult, basicBehavioral) : null,
        keyword_matches: keywordResult.status === 'fulfilled' 
          ? keywordResult.value.total_matches 
          : 0,
        behavioral_flags: basicBehavioral.status === 'fulfilled' && basicBehavioral.value
          ? basicBehavioral.value.flags
          : [],
        processing_time_ms: processingTime,
        scanned_at: new Date().toISOString()
      };
    } catch (error) {
      // Fail-safe: Allow on error but log it
      console.error(`Quick scan failed: ${error}`);
      return {
        phone_hash: request.phone_hash,
        quick_risk_score: 0,
        risk_level: 'low',
        should_block: false,
        block_reason: null,
        keyword_matches: 0,
        behavioral_flags: [],
        processing_time_ms: Date.now() - Date.now(),
        scanned_at: new Date().toISOString(),
        error_occurred: true
      };
    }
  }

  /**
   * Run comprehensive fraud analysis
   */
  private async runComprehensiveAnalysis(request: FraudDetectionRequest) {
    const compositeFraudRequest: CompositeFraudRequest = {
      phone_hash: request.phone_hash,
      call_transcript: request.call_transcript,
      feedback_content: request.feedback_content,
      call_history: request.call_history,
      time_window_start: request.time_window_start || 
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      time_window_end: request.time_window_end || new Date().toISOString(),
      context_metadata: request.context_metadata,
      language_code: request.language_code || 'sv'
    };

    return await this.fraudScoringService.generateFraudScore(compositeFraudRequest);
  }

  /**
   * Run quick scan analysis
   */
  private async runQuickScan(request: FraudDetectionRequest) {
    const quickRequest: QuickScanRequest = {
      phone_hash: request.phone_hash,
      content: `${request.call_transcript || ''} ${request.feedback_content || ''}`.trim(),
      language_code: request.language_code,
      recent_call_count: request.call_history?.length,
      time_window_minutes: 30
    };

    const quickResult = await this.quickScan(quickRequest);

    // Convert quick scan result to fraud result format
    return {
      fraud_score_id: this.generateDetectionId(),
      phone_hash: request.phone_hash,
      composite_score: quickResult.quick_risk_score,
      risk_level: quickResult.risk_level,
      fraud_decision: {
        is_fraud: quickResult.should_block,
        confidence: 0.7, // Medium confidence for quick scan
        primary_reason: quickResult.block_reason || 'quick_scan_analysis',
        recommendation: quickResult.should_block ? 'block_immediately' : 'allow',
        review_required: quickResult.quick_risk_score > 40
      },
      fraud_probability: Math.min(1.0, quickResult.quick_risk_score / 100),
      score_components: {
        context_score: 0,
        keyword_score: quickResult.keyword_matches * 5, // Approximate
        behavioral_score: quickResult.behavioral_flags.length * 10,
        transaction_score: 0
      },
      component_results: {
        context_analysis: null,
        keyword_detection: null,
        behavioral_patterns: null,
        transaction_analysis: null
      },
      confidence_level: 0.7,
      processing_time_ms: quickResult.processing_time_ms,
      analyzed_at: quickResult.scanned_at
    };
  }

  /**
   * Run context-only analysis
   */
  private async runContextOnlyAnalysis(request: FraudDetectionRequest) {
    const contextResult = await this.contextAnalysisService.analyzeContext({
      phone_hash: request.phone_hash,
      call_transcript: request.call_transcript,
      feedback_content: request.feedback_content,
      context_metadata: request.context_metadata
    });

    // Convert to fraud result format
    const compositeScore = contextResult.overall_context_score;
    return {
      fraud_score_id: this.generateDetectionId(),
      phone_hash: request.phone_hash,
      composite_score: compositeScore,
      risk_level: this.calculateQuickRiskLevel(compositeScore),
      fraud_decision: {
        is_fraud: compositeScore >= 70,
        confidence: contextResult.confidence_level,
        primary_reason: 'context_analysis_only',
        recommendation: compositeScore >= 70 ? 'manual_review' : 'allow',
        review_required: compositeScore > 50
      },
      fraud_probability: Math.min(1.0, compositeScore / 100),
      score_components: {
        context_score: compositeScore,
        keyword_score: 0,
        behavioral_score: 0,
        transaction_score: 0
      },
      component_results: {
        context_analysis: contextResult,
        keyword_detection: null,
        behavioral_patterns: null,
        transaction_analysis: null
      },
      confidence_level: contextResult.confidence_level,
      processing_time_ms: contextResult.processing_time_ms,
      analyzed_at: contextResult.analyzed_at
    };
  }

  /**
   * Run behavioral-only analysis
   */
  private async runBehavioralOnlyAnalysis(request: FraudDetectionRequest) {
    if (!request.call_history || request.call_history.length === 0) {
      throw new Error('Call history required for behavioral-only analysis');
    }

    const behavioralResult = await this.behavioralPatternService.analyzeBehavioralPatterns({
      phone_hash: request.phone_hash,
      call_history: request.call_history,
      time_window_start: request.time_window_start || 
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      time_window_end: request.time_window_end || new Date().toISOString()
    });

    const compositeScore = behavioralResult.composite_behavioral_score;
    return {
      fraud_score_id: this.generateDetectionId(),
      phone_hash: request.phone_hash,
      composite_score: compositeScore,
      risk_level: behavioralResult.overall_risk_level,
      fraud_decision: {
        is_fraud: compositeScore >= 70,
        confidence: 0.8,
        primary_reason: 'behavioral_patterns_only',
        recommendation: compositeScore >= 70 ? 'manual_review' : 'monitor_closely',
        review_required: compositeScore > 40
      },
      fraud_probability: Math.min(1.0, compositeScore / 100),
      score_components: {
        context_score: 0,
        keyword_score: 0,
        behavioral_score: compositeScore,
        transaction_score: 0
      },
      component_results: {
        context_analysis: null,
        keyword_detection: null,
        behavioral_patterns: behavioralResult,
        transaction_analysis: null
      },
      confidence_level: 0.8,
      processing_time_ms: behavioralResult.processing_time_ms,
      analyzed_at: behavioralResult.analyzed_at
    };
  }

  /**
   * Validate detection request
   */
  private validateDetectionRequest(request: FraudDetectionRequest): void {
    if (!request.phone_hash) {
      throw new Error('Phone hash is required');
    }

    if (!request.call_transcript && !request.feedback_content) {
      throw new Error('Either call transcript or feedback content is required');
    }

    // Validate detection mode if specified
    if (request.detection_mode) {
      const validModes: FraudDetectionMode[] = ['comprehensive', 'quick_scan', 'context_only', 'behavioral_only'];
      if (!validModes.includes(request.detection_mode)) {
        throw new Error(`Invalid detection mode: ${request.detection_mode}`);
      }
    }
  }

  /**
   * Determine optimal detection mode based on request data
   */
  private determineOptimalMode(request: FraudDetectionRequest): FraudDetectionMode {
    const hasTranscript = Boolean(request.call_transcript);
    const hasFeedback = Boolean(request.feedback_content);
    const hasCallHistory = Boolean(request.call_history && request.call_history.length > 0);
    const hasContext = Boolean(request.context_metadata);

    // Comprehensive if we have rich data
    if (hasTranscript && hasFeedback && hasCallHistory && hasContext) {
      return 'comprehensive';
    }

    // Context-only if we have good text data but limited history
    if ((hasTranscript || hasFeedback) && !hasCallHistory) {
      return 'context_only';
    }

    // Behavioral-only if we have call history but limited text
    if (hasCallHistory && !hasTranscript && !hasFeedback) {
      return 'behavioral_only';
    }

    // Quick scan for minimal data or time-sensitive scenarios
    if (!hasCallHistory && (!hasTranscript || !hasFeedback)) {
      return 'quick_scan';
    }

    // Default to comprehensive
    return 'comprehensive';
  }

  /**
   * Generate fraud alerts based on results
   */
  private async generateFraudAlerts(fraudResult: any): Promise<Array<{
    level: FraudAlertLevel;
    message: string;
    component: string;
    recommended_action: string;
  }>> {
    const alerts: Array<{
      level: FraudAlertLevel;
      message: string;
      component: string;
      recommended_action: string;
    }> = [];

    // Critical fraud score alert
    if (fraudResult.composite_score >= 85) {
      alerts.push({
        level: 'critical',
        message: `Critical fraud score detected: ${fraudResult.composite_score}`,
        component: 'composite_score',
        recommended_action: 'immediate_block'
      });
    }

    // High keyword risk alert
    if (fraudResult.score_components?.keyword_score >= 15) {
      alerts.push({
        level: 'high',
        message: 'High-severity keywords detected in content',
        component: 'keyword_detection',
        recommended_action: 'manual_review'
      });
    }

    // Behavioral anomaly alert
    if (fraudResult.score_components?.behavioral_score >= 25) {
      alerts.push({
        level: 'high',
        message: 'Severe behavioral anomalies detected',
        component: 'behavioral_patterns',
        recommended_action: 'investigate_patterns'
      });
    }

    // Context legitimacy alert
    if (fraudResult.score_components?.context_score >= 30) {
      alerts.push({
        level: 'medium',
        message: 'Context analysis indicates potential fraud',
        component: 'context_analysis',
        recommended_action: 'detailed_review'
      });
    }

    return alerts;
  }

  /**
   * Generate action recommendations
   */
  private generateActionRecommendations(fraudResult: any): string[] {
    const recommendations: string[] = [];
    const score = fraudResult.composite_score;

    if (score >= 85) {
      recommendations.push('Block user immediately');
      recommendations.push('Escalate to security team');
      recommendations.push('Preserve evidence for investigation');
    } else if (score >= 70) {
      recommendations.push('Manual review required');
      recommendations.push('Temporary account restriction');
      recommendations.push('Request additional verification');
    } else if (score >= 40) {
      recommendations.push('Enhanced monitoring');
      recommendations.push('Flag for future review');
      recommendations.push('Document risk factors');
    } else {
      recommendations.push('Normal processing');
      recommendations.push('Continue monitoring');
    }

    return recommendations;
  }

  /**
   * Determine next steps
   */
  private determineNextSteps(fraudResult: any): string[] {
    const nextSteps: string[] = [];
    const decision = fraudResult.fraud_decision;

    if (decision.is_fraud) {
      nextSteps.push('Execute fraud prevention measures');
      nextSteps.push('Notify relevant stakeholders');
      nextSteps.push('Begin investigation process');
    } else if (decision.review_required) {
      nextSteps.push('Schedule manual review');
      nextSteps.push('Gather additional context');
      nextSteps.push('Monitor for escalating patterns');
    } else {
      nextSteps.push('Continue standard processing');
      nextSteps.push('Maintain routine monitoring');
    }

    return nextSteps;
  }

  /**
   * Check recent call frequency for quick scan
   */
  private async checkRecentCallFrequency(
    phoneHash: string, 
    callCount: number, 
    timeWindowMinutes: number
  ): Promise<{ risk_score: number; flags: string[] } | null> {
    const threshold = 5; // calls per 30 minutes
    const scaledThreshold = (threshold * timeWindowMinutes) / 30;

    if (callCount <= scaledThreshold) {
      return null;
    }

    const riskScore = Math.min(30, (callCount - scaledThreshold) * 5);
    const flags = [
      `${callCount} calls in ${timeWindowMinutes} minutes`,
      `Exceeds threshold of ${scaledThreshold} calls`
    ];

    return { risk_score: riskScore, flags };
  }

  /**
   * Calculate quick risk level
   */
  private calculateQuickRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate block reason for quick scan
   */
  private generateBlockReason(keywordResult: PromiseSettledResult<any>, behavioralResult: PromiseSettledResult<any>): string {
    const reasons: string[] = [];

    if (keywordResult.status === 'fulfilled' && keywordResult.value.total_matches > 0) {
      reasons.push(`${keywordResult.value.total_matches} red flag keywords detected`);
    }

    if (behavioralResult.status === 'fulfilled' && behavioralResult.value) {
      reasons.push('Suspicious call frequency pattern');
    }

    return reasons.join('; ') || 'Multiple risk factors detected';
  }

  /**
   * Identify components used in detection mode
   */
  private identifyComponentsUsed(mode: FraudDetectionMode): string[] {
    switch (mode) {
      case 'comprehensive':
        return ['context_analysis', 'keyword_detection', 'behavioral_patterns', 'transaction_analysis'];
      case 'quick_scan':
        return ['keyword_detection', 'basic_behavioral'];
      case 'context_only':
        return ['context_analysis'];
      case 'behavioral_only':
        return ['behavioral_patterns'];
      default:
        return [];
    }
  }

  /**
   * Calculate performance grade
   */
  private calculatePerformanceGrade(processingTime: number, mode: FraudDetectionMode): 'A' | 'B' | 'C' | 'D' | 'F' {
    const thresholds = {
      'comprehensive': { A: 5000, B: 8000, C: 12000, D: 18000 },
      'quick_scan': { A: 500, B: 1000, C: 2000, D: 3000 },
      'context_only': { A: 3000, B: 5000, C: 8000, D: 12000 },
      'behavioral_only': { A: 2000, B: 4000, C: 6000, D: 10000 }
    };

    const modeThresholds = thresholds[mode] || thresholds.comprehensive;

    if (processingTime <= modeThresholds.A) return 'A';
    if (processingTime <= modeThresholds.B) return 'B';
    if (processingTime <= modeThresholds.C) return 'C';
    if (processingTime <= modeThresholds.D) return 'D';
    return 'F';
  }

  /**
   * Generate unique detection ID
   */
  private generateDetectionId(): string {
    return `fraud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get fraud detection statistics
   */
  async getDetectionStatistics(timeWindow: string = '24h'): Promise<{
    total_detections: number;
    fraud_rate: number;
    avg_processing_time: Record<FraudDetectionMode, number>;
    component_usage: Record<string, number>;
    alert_distribution: Record<FraudAlertLevel, number>;
  }> {
    try {
      const hours = this.parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const stats = await FraudScoreModel.getStatistics({ since });

      return {
        total_detections: stats.total_count,
        fraud_rate: stats.fraud_rate,
        avg_processing_time: {
          comprehensive: stats.avg_processing_time_comprehensive || 0,
          quick_scan: stats.avg_processing_time_quick || 0,
          context_only: stats.avg_processing_time_context || 0,
          behavioral_only: stats.avg_processing_time_behavioral || 0
        },
        component_usage: {
          context_analysis: stats.context_usage_count || 0,
          keyword_detection: stats.keyword_usage_count || 0,
          behavioral_patterns: stats.behavioral_usage_count || 0,
          transaction_analysis: stats.transaction_usage_count || 0
        },
        alert_distribution: {
          critical: stats.critical_alert_count || 0,
          high: stats.high_alert_count || 0,
          medium: stats.medium_alert_count || 0,
          low: stats.low_alert_count || 0
        }
      };
    } catch (error) {
      throw new Error(`Detection statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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