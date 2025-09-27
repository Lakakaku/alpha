import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { OpenAIService, QualityAnalysisResult, FraudAnalysisResult } from '../ai/openaiService';
import { ConversationMessage } from '../../models/conversationTranscript';
import { QualityAssessment, CreateQualityAssessmentData } from '../../models/qualityAssessment';
import { BusinessContextProfile } from '../../models/businessContextProfile';
import { CreateFraudDetectionResultData, CheckType } from '../../models/fraudDetectionResult';

export class AnalysisService {
  private supabase;
  private openaiService: OpenAIService;
  private redis: any;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.openaiService = new OpenAIService();
    this.initializeRedis();
  }

  async processQualityAnalysis(request: QualityAnalysisRequest): Promise<QualityAnalysisJobResult> {
    // Validate inputs
    const session = await this.validateAnalysisRequest(request.call_session_id);
    const transcript = await this.getConversationTranscript(request.call_session_id);
    const businessContext = await this.getBusinessContext(session.store_id);

    // Create analysis job
    const analysisId = this.generateAnalysisId();
    
    // Store job status in Redis
    await this.setAnalysisStatus(analysisId, {
      status: 'queued',
      progress_percentage: 0,
      current_stage: 'legitimacy_check',
      call_session_id: request.call_session_id,
      created_at: new Date().toISOString()
    });

    // Process analysis asynchronously
    this.performQualityAnalysisAsync(analysisId, request.call_session_id, transcript, businessContext);

    return {
      analysis_id: analysisId,
      estimated_completion: new Date(Date.now() + 30000), // ~30 seconds
      status: 'queued'
    };
  }

  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatusResult> {
    const status = await this.getAnalysisStatusFromRedis(analysisId);
    
    if (!status) {
      throw new AnalysisError('ANALYSIS_NOT_FOUND', 'Analysis job not found');
    }

    return {
      analysis_id: analysisId,
      status: status.status,
      progress_percentage: status.progress_percentage || 0,
      current_stage: status.current_stage,
      error_message: status.error_message || null,
      estimated_completion: status.estimated_completion ? new Date(status.estimated_completion) : null
    };
  }

  async getAnalysisResults(analysisId: string): Promise<QualityAssessment> {
    const status = await this.getAnalysisStatusFromRedis(analysisId);
    
    if (!status) {
      throw new AnalysisError('ANALYSIS_NOT_FOUND', 'Analysis job not found');
    }

    if (status.status !== 'completed') {
      throw new AnalysisError('ANALYSIS_NOT_COMPLETE', 'Analysis not yet completed');
    }

    // Retrieve quality assessment from database
    const { data: assessment, error } = await this.supabase
      .from('quality_assessments')
      .select('*')
      .eq('call_session_id', status.call_session_id)
      .single();

    if (error || !assessment) {
      throw new AnalysisError('RESULTS_NOT_FOUND', 'Analysis results not found');
    }

    return assessment as QualityAssessment;
  }

  async performFraudCheck(request: FraudCheckRequest): Promise<FraudCheckResponse> {
    const transcript = await this.getConversationTranscript(request.call_session_id);
    const businessContext = await this.getBusinessContext(
      (await this.getCallSession(request.call_session_id)).store_id
    );

    // Perform AI fraud detection
    const fraudAnalysis = await this.openaiService.detectFraud(
      transcript,
      businessContext,
      request.check_types
    );

    // Store fraud detection results
    const fraudResults: CreateFraudDetectionResultData[] = fraudAnalysis.fraud_results.map(result => ({
      call_session_id: request.call_session_id,
      check_type: result.check_type as CheckType,
      is_suspicious: result.is_suspicious,
      confidence_level: result.confidence_level,
      fraud_indicators: result.fraud_indicators || [],
      context_violations: result.context_violations || [],
      decision_reasoning: result.reasoning
    }));

    if (fraudResults.length > 0) {
      const { error } = await this.supabase
        .from('fraud_detection_results')
        .insert(fraudResults);

      if (error) {
        console.error('Failed to store fraud detection results:', error);
      }
    }

    return {
      fraud_results: fraudResults,
      overall_is_fraudulent: fraudAnalysis.overall_is_fraudulent,
      confidence_level: fraudAnalysis.confidence_level,
      should_exclude_from_rewards: fraudAnalysis.should_exclude_from_rewards
    };
  }

  async generateFeedbackSummary(request: SummaryGenerationRequest): Promise<SummaryGenerationResult> {
    // Check quality threshold
    if (request.quality_threshold < 0.02 || request.quality_threshold > 0.15) {
      throw new AnalysisError('INVALID_THRESHOLD', 'Quality threshold must be between 0.02 and 0.15');
    }

    const qualityAssessment = await this.getQualityAssessment(request.call_session_id);
    
    if (qualityAssessment.overall_quality_score < request.quality_threshold) {
      throw new AnalysisError('QUALITY_TOO_LOW', 'Feedback quality below threshold for summarization');
    }

    const transcript = await this.getConversationTranscript(request.call_session_id);
    
    const summary = await this.openaiService.generateFeedbackSummary(
      transcript,
      qualityAssessment.overall_quality_score,
      request.preserve_details
    );

    const summaryId = this.generateSummaryId();

    // Store summary in quality assessment
    await this.supabase
      .from('quality_assessments')
      .update({
        analysis_summary: summary.summary_text
      })
      .eq('call_session_id', request.call_session_id);

    return {
      summary_id: summaryId,
      summary_text: summary.summary_text,
      key_insights: summary.key_insights,
      actionable_items: summary.actionable_items,
      summary_metadata: {
        quality_score: qualityAssessment.overall_quality_score,
        target_length: request.target_length || 'standard',
        preserve_details: request.preserve_details,
        generation_timestamp: new Date().toISOString()
      }
    };
  }

  async cleanupLowGradeFeedback(
    qualityThreshold: number,
    batchSize: number = 100,
    dryRun: boolean = false
  ): Promise<CleanupResult> {
    const startTime = Date.now();

    // Find low-grade feedback sessions
    const { data: lowGradeSessions, error } = await this.supabase
      .from('quality_assessments')
      .select('call_session_id, overall_quality_score')
      .lt('overall_quality_score', qualityThreshold)
      .limit(batchSize);

    if (error) {
      throw new AnalysisError('CLEANUP_QUERY_FAILED', 'Failed to query low-grade feedback', error);
    }

    const sessionIds = lowGradeSessions?.map(s => s.call_session_id) || [];
    let deletedCount = 0;

    if (!dryRun && sessionIds.length > 0) {
      // Delete conversation transcripts
      await this.supabase
        .from('conversation_transcripts')
        .delete()
        .in('call_session_id', sessionIds);

      // Delete quality assessments
      await this.supabase
        .from('quality_assessments')
        .delete()
        .in('call_session_id', sessionIds);

      // Delete call quality metrics
      await this.supabase
        .from('call_quality_metrics')
        .delete()
        .in('call_session_id', sessionIds);

      // Delete fraud detection results
      await this.supabase
        .from('fraud_detection_results')
        .delete()
        .in('call_session_id', sessionIds);

      // Update call sessions to mark as cleaned
      const { count } = await this.supabase
        .from('feedback_call_sessions')
        .update({ session_status: 'failed', failure_reason: 'Quality below reward threshold' })
        .in('id', sessionIds);

      deletedCount = count || 0;
    }

    // Count remaining sessions above threshold
    const { count: preservedCount } = await this.supabase
      .from('quality_assessments')
      .select('call_session_id', { count: 'exact' })
      .gte('overall_quality_score', qualityThreshold);

    return {
      deleted_count: dryRun ? sessionIds.length : deletedCount,
      preserved_count: preservedCount || 0,
      execution_time_ms: Date.now() - startTime,
      dry_run: dryRun
    };
  }

  async getAnalysisMetrics(storeId?: string, dateRange?: DateRange): Promise<AnalysisMetricsResult> {
    let query = this.supabase
      .from('quality_assessments')
      .select(`
        *,
        feedback_call_sessions!inner(store_id, created_at)
      `);

    if (storeId) {
      query = query.eq('feedback_call_sessions.store_id', storeId);
    }

    if (dateRange) {
      query = query
        .gte('feedback_call_sessions.created_at', dateRange.start_date)
        .lte('feedback_call_sessions.created_at', dateRange.end_date);
    }

    const { data: assessments, error } = await query;

    if (error) {
      throw new AnalysisError('METRICS_QUERY_FAILED', 'Failed to retrieve analysis metrics', error);
    }

    return this.calculateMetrics(assessments || []);
  }

  private async performQualityAnalysisAsync(
    analysisId: string,
    callSessionId: string,
    transcript: ConversationMessage[],
    businessContext: BusinessContextProfile
  ): Promise<void> {
    try {
      // Update status: processing
      await this.setAnalysisStatus(analysisId, {
        status: 'processing',
        progress_percentage: 10,
        current_stage: 'legitimacy_check'
      });

      // Perform AI quality analysis
      const analysisResult = await this.openaiService.analyzeConversationQuality(
        transcript,
        businessContext
      );

      // Update status: scoring
      await this.setAnalysisStatus(analysisId, {
        status: 'processing',
        progress_percentage: 70,
        current_stage: 'scoring'
      });

      // Store quality assessment
      const assessmentData: CreateQualityAssessmentData = {
        call_session_id: callSessionId,
        legitimacy_score: analysisResult.scores.legitimacy_score,
        depth_score: analysisResult.scores.depth_score,
        usefulness_score: analysisResult.scores.usefulness_score,
        overall_quality_score: analysisResult.scores.overall_quality_score,
        reward_percentage: analysisResult.reward_percentage,
        is_fraudulent: analysisResult.is_fraudulent,
        fraud_reasons: analysisResult.fraud_reasons,
        analysis_summary: JSON.stringify(analysisResult.key_insights),
        business_actionable_items: analysisResult.actionable_items,
        analysis_metadata: {
          business_value_reasoning: analysisResult.business_value_reasoning,
          analysis_duration_ms: Date.now() - Date.now(), // Will be calculated properly
          model_version: 'gpt-4o-mini-1.0'
        }
      };

      const { error } = await this.supabase
        .from('quality_assessments')
        .insert(assessmentData);

      if (error) {
        throw new Error(`Failed to store assessment: ${error.message}`);
      }

      // Update status: completed
      await this.setAnalysisStatus(analysisId, {
        status: 'completed',
        progress_percentage: 100,
        current_stage: 'completed'
      });

    } catch (error: any) {
      // Update status: failed
      await this.setAnalysisStatus(analysisId, {
        status: 'failed',
        progress_percentage: 0,
        current_stage: 'failed',
        error_message: error.message
      });
    }
  }

  private async initializeRedis(): Promise<void> {
    const Redis = require('ioredis');
    this.redis = new Redis(process.env.REDIS_URL);
  }

  private async validateAnalysisRequest(callSessionId: string): Promise<any> {
    const session = await this.getCallSession(callSessionId);
    
    if (session.session_status !== 'completed') {
      throw new AnalysisError('SESSION_NOT_COMPLETED', 'Call session must be completed for analysis');
    }

    return session;
  }

  private async getCallSession(callSessionId: string): Promise<any> {
    const { data: session, error } = await this.supabase
      .from('feedback_call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .single();

    if (error || !session) {
      throw new AnalysisError('SESSION_NOT_FOUND', 'Call session not found');
    }

    return session;
  }

  private async getConversationTranscript(callSessionId: string): Promise<ConversationMessage[]> {
    const { data: transcript, error } = await this.supabase
      .from('conversation_transcripts')
      .select('*')
      .eq('call_session_id', callSessionId)
      .order('message_order');

    if (error) {
      throw new AnalysisError('TRANSCRIPT_FETCH_FAILED', 'Failed to retrieve conversation transcript', error);
    }

    return transcript?.map(t => ({
      speaker: t.speaker as 'ai' | 'customer',
      content: t.content,
      timestamp_ms: t.timestamp_ms,
      message_order: t.message_order,
      confidence_score: t.confidence_score || undefined,
      message_type: (t.message_type as any) || 'response',
      language_detected: t.language_detected || 'sv'
    })) || [];
  }

  private async getBusinessContext(storeId: string): Promise<BusinessContextProfile> {
    const { data, error } = await this.supabase
      .from('business_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .order('context_version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new AnalysisError('BUSINESS_CONTEXT_NOT_FOUND', 'Business context not found');
    }

    return data as BusinessContextProfile;
  }

  private async getQualityAssessment(callSessionId: string): Promise<QualityAssessment> {
    const { data, error } = await this.supabase
      .from('quality_assessments')
      .select('*')
      .eq('call_session_id', callSessionId)
      .single();

    if (error || !data) {
      throw new AnalysisError('ASSESSMENT_NOT_FOUND', 'Quality assessment not found');
    }

    return data as QualityAssessment;
  }

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSummaryId(): string {
    return `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async setAnalysisStatus(analysisId: string, status: any): Promise<void> {
    await this.redis.setex(`analysis_status:${analysisId}`, 3600, JSON.stringify(status));
  }

  private async getAnalysisStatusFromRedis(analysisId: string): Promise<any | null> {
    const status = await this.redis.get(`analysis_status:${analysisId}`);
    return status ? JSON.parse(status) : null;
  }

  private calculateMetrics(assessments: any[]): AnalysisMetricsResult {
    const totalCount = assessments.length;
    const fraudCount = assessments.filter(a => a.is_fraudulent).length;
    const qualifyingCount = assessments.filter(a => a.overall_quality_score >= 0.02).length;
    
    const avgQualityScore = totalCount > 0 
      ? assessments.reduce((sum, a) => sum + a.overall_quality_score, 0) / totalCount
      : 0;

    const avgRewardPercentage = qualifyingCount > 0
      ? assessments
          .filter(a => a.overall_quality_score >= 0.02)
          .reduce((sum, a) => sum + a.reward_percentage, 0) / qualifyingCount
      : 0;

    return {
      total_assessments: totalCount,
      fraud_detected_count: fraudCount,
      fraud_rate_percentage: totalCount > 0 ? (fraudCount / totalCount) * 100 : 0,
      qualifying_feedback_count: qualifyingCount,
      qualification_rate_percentage: totalCount > 0 ? (qualifyingCount / totalCount) * 100 : 0,
      average_quality_score: avgQualityScore,
      average_reward_percentage: avgRewardPercentage,
      quality_distribution: this.calculateQualityDistribution(assessments)
    };
  }

  private calculateQualityDistribution(assessments: any[]): Record<string, number> {
    const distribution = {
      'below_threshold': 0,
      'low_quality': 0,
      'medium_quality': 0,
      'high_quality': 0
    };

    assessments.forEach(a => {
      const score = a.overall_quality_score;
      if (score < 0.02) distribution.below_threshold++;
      else if (score < 0.33) distribution.low_quality++;
      else if (score < 0.67) distribution.medium_quality++;
      else distribution.high_quality++;
    });

    return distribution;
  }
}

// Type definitions
export interface QualityAnalysisRequest {
  call_session_id: string;
  transcript_id?: string;
  priority?: 'normal' | 'high';
}

export interface QualityAnalysisJobResult {
  analysis_id: string;
  estimated_completion: Date;
  status: 'queued' | 'processing';
}

export interface AnalysisStatusResult {
  analysis_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  current_stage: string;
  error_message: string | null;
  estimated_completion: Date | null;
}

export interface FraudCheckRequest {
  call_session_id: string;
  check_types: CheckType[];
  business_context?: Record<string, any>;
  force_recheck?: boolean;
}

export interface FraudCheckResponse {
  fraud_results: CreateFraudDetectionResultData[];
  overall_is_fraudulent: boolean;
  confidence_level: number;
  should_exclude_from_rewards: boolean;
}

export interface SummaryGenerationRequest {
  call_session_id: string;
  quality_threshold: number;
  preserve_details?: boolean;
  target_length?: 'brief' | 'standard' | 'detailed';
}

export interface SummaryGenerationResult {
  summary_id: string;
  summary_text: string;
  key_insights: string[];
  actionable_items: any[];
  summary_metadata: Record<string, any>;
}

export interface CleanupResult {
  deleted_count: number;
  preserved_count: number;
  execution_time_ms: number;
  dry_run: boolean;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface AnalysisMetricsResult {
  total_assessments: number;
  fraud_detected_count: number;
  fraud_rate_percentage: number;
  qualifying_feedback_count: number;
  qualification_rate_percentage: number;
  average_quality_score: number;
  average_reward_percentage: number;
  quality_distribution: Record<string, number>;
}

export class AnalysisError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}