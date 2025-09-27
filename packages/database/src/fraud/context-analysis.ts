/**
 * ContextAnalysis Database Model
 * Task: T032 - ContextAnalysis model
 * 
 * Database operations for context_analyses table
 * Handles GPT-4o-mini analysis results for Swedish feedback legitimacy
 * Contributing 40% to overall fraud score
 */

import { supabase } from '../client/supabase';
import type { 
  ContextAnalysis,
  GPTAnalysis,
  BusinessContext,
  ContextAnalysisMetadata
} from '@vocilia/types';

export class ContextAnalysisModel {
  private static readonly TABLE_NAME = 'context_analyses';
  
  /**
   * Create a new context analysis record
   */
  static async create(data: {
    phone_hash: string;
    feedback_content: string;
    language_detected: string;
    business_context: BusinessContext;
    gpt_analysis: GPTAnalysis;
    legitimacy_score: number; // 0-100
    confidence_score: number; // 0-100
    analysis_metadata: ContextAnalysisMetadata;
  }): Promise<ContextAnalysis> {
    const contextAnalysis = {
      phone_hash: data.phone_hash,
      feedback_content: data.feedback_content,
      language_detected: data.language_detected,
      business_context: data.business_context,
      gpt_analysis: data.gpt_analysis,
      legitimacy_score: data.legitimacy_score,
      confidence_score: data.confidence_score,
      analysis_metadata: data.analysis_metadata
    };

    const { data: result, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(contextAnalysis)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create context analysis: ${error.message}`);
    }

    return result;
  }

  /**
   * Get context analysis by phone hash
   */
  static async getByPhoneHash(phoneHash: string): Promise<ContextAnalysis[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get context analyses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get latest context analysis for phone hash
   */
  static async getLatestByPhoneHash(phoneHash: string): Promise<ContextAnalysis | null> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw new Error(`Failed to get latest context analysis: ${error.message}`);
    }

    return data;
  }

  /**
   * Get context analyses by legitimacy score range
   */
  static async getByLegitimacyRange(options: {
    minScore: number;
    maxScore: number;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ analyses: ContextAnalysis[]; totalCount: number }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .gte('legitimacy_score', options.minScore)
      .lte('legitimacy_score', options.maxScore);

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get context analyses by legitimacy range: ${error.message}`);
    }

    return {
      analyses: data || [],
      totalCount: count || 0
    };
  }

  /**
   * Get context analyses by language
   */
  static async getByLanguage(language: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<ContextAnalysis[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('language_detected', language);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get context analyses by language: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Search context analyses by feedback content
   */
  static async searchByContent(searchQuery: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<ContextAnalysis[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .textSearch('feedback_content', searchQuery);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search context analyses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get context analyses with impossible claims
   */
  static async getWithImpossibleClaims(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ContextAnalysis[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .not('gpt_analysis->impossible_claims_detected', 'eq', '[]');

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get context analyses with impossible claims: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get context analyses with suspicious patterns
   */
  static async getWithSuspiciousPatterns(options?: {
    limit?: number;
    offset?: number;
  }): Promise<ContextAnalysis[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .not('gpt_analysis->suspicious_patterns', 'eq', '[]');

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get context analyses with suspicious patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get analysis statistics
   */
  static async getStatistics(options: {
    startDate?: string;
    endDate?: string;
    language?: string;
  } = {}): Promise<{
    totalAnalyses: number;
    languageDistribution: Record<string, number>;
    averageLegitimacyScore: number;
    averageConfidenceScore: number;
    impossibleClaimsCount: number;
    suspiciousPatternsCount: number;
    averageProcessingTime: number;
    scoreDistribution: {
      veryLow: number; // 0-20
      low: number; // 21-40
      medium: number; // 41-60
      high: number; // 61-80
      veryHigh: number; // 81-100
    };
    contentAnalysis: {
      averageTextLength: number;
      averageWordCount: number;
      averageSentenceCount: number;
      averageLanguageComplexity: number;
    };
  }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('language_detected, legitimacy_score, confidence_score, gpt_analysis, analysis_metadata');

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.language) {
      query = query.eq('language_detected', options.language);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get context analysis statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalAnalyses: 0,
        languageDistribution: {},
        averageLegitimacyScore: 0,
        averageConfidenceScore: 0,
        impossibleClaimsCount: 0,
        suspiciousPatternsCount: 0,
        averageProcessingTime: 0,
        scoreDistribution: { veryLow: 0, low: 0, medium: 0, high: 0, veryHigh: 0 },
        contentAnalysis: {
          averageTextLength: 0,
          averageWordCount: 0,
          averageSentenceCount: 0,
          averageLanguageComplexity: 0
        }
      };
    }

    const totalAnalyses = data.length;

    // Language distribution
    const languageDistribution: Record<string, number> = {};
    data.forEach(analysis => {
      languageDistribution[analysis.language_detected] = (languageDistribution[analysis.language_detected] || 0) + 1;
    });

    // Average scores
    const averageLegitimacyScore = data.reduce((sum, analysis) => sum + analysis.legitimacy_score, 0) / totalAnalyses;
    const averageConfidenceScore = data.reduce((sum, analysis) => sum + analysis.confidence_score, 0) / totalAnalyses;

    // Impossible claims and suspicious patterns count
    const impossibleClaimsCount = data.filter(analysis => 
      analysis.gpt_analysis?.impossible_claims_detected && analysis.gpt_analysis.impossible_claims_detected.length > 0
    ).length;
    
    const suspiciousPatternsCount = data.filter(analysis => 
      analysis.gpt_analysis?.suspicious_patterns && analysis.gpt_analysis.suspicious_patterns.length > 0
    ).length;

    // Average processing time
    const averageProcessingTime = data.reduce((sum, analysis) => 
      sum + (analysis.gpt_analysis?.processing_time_ms || 0), 0
    ) / totalAnalyses;

    // Score distribution
    const scoreDistribution = {
      veryLow: data.filter(a => a.legitimacy_score <= 20).length,
      low: data.filter(a => a.legitimacy_score > 20 && a.legitimacy_score <= 40).length,
      medium: data.filter(a => a.legitimacy_score > 40 && a.legitimacy_score <= 60).length,
      high: data.filter(a => a.legitimacy_score > 60 && a.legitimacy_score <= 80).length,
      veryHigh: data.filter(a => a.legitimacy_score > 80).length
    };

    // Content analysis
    const validMetadata = data.filter(a => a.analysis_metadata);
    const contentAnalysis = {
      averageTextLength: validMetadata.reduce((sum, analysis) => sum + (analysis.analysis_metadata?.text_length || 0), 0) / validMetadata.length || 0,
      averageWordCount: validMetadata.reduce((sum, analysis) => sum + (analysis.analysis_metadata?.word_count || 0), 0) / validMetadata.length || 0,
      averageSentenceCount: validMetadata.reduce((sum, analysis) => sum + (analysis.analysis_metadata?.sentence_count || 0), 0) / validMetadata.length || 0,
      averageLanguageComplexity: validMetadata.reduce((sum, analysis) => sum + (analysis.analysis_metadata?.language_complexity || 0), 0) / validMetadata.length || 0
    };

    return {
      totalAnalyses,
      languageDistribution,
      averageLegitimacyScore,
      averageConfidenceScore,
      impossibleClaimsCount,
      suspiciousPatternsCount,
      averageProcessingTime,
      scoreDistribution,
      contentAnalysis
    };
  }

  /**
   * Get recent analyses for performance monitoring
   */
  static async getRecentAnalyses(options: {
    minutes: number;
    limit?: number;
  }): Promise<ContextAnalysis[]> {
    const since = new Date(Date.now() - options.minutes * 60 * 1000).toISOString();

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('created_at', since);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent context analyses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete old context analyses
   */
  static async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .lt('created_at', cutoffDate)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old context analyses: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get bulk context analyses for multiple phone hashes
   */
  static async getBulkLatest(phoneHashes: string[]): Promise<Map<string, ContextAnalysis>> {
    if (phoneHashes.length === 0) {
      return new Map();
    }

    // Get latest analysis for each phone hash
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .in('phone_hash', phoneHashes)
      .order('phone_hash, created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get bulk context analyses: ${error.message}`);
    }

    // Keep only the most recent analysis for each phone hash
    const analysisMap = new Map<string, ContextAnalysis>();
    data?.forEach(analysis => {
      if (!analysisMap.has(analysis.phone_hash)) {
        analysisMap.set(analysis.phone_hash, analysis);
      }
    });

    return analysisMap;
  }

  /**
   * Update analysis (for reprocessing or corrections)
   */
  static async update(id: string, updates: {
    legitimacy_score?: number;
    confidence_score?: number;
    gpt_analysis?: Partial<GPTAnalysis>;
    analysis_metadata?: Partial<ContextAnalysisMetadata>;
  }): Promise<ContextAnalysis> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.legitimacy_score !== undefined) {
      updateData.legitimacy_score = updates.legitimacy_score;
    }

    if (updates.confidence_score !== undefined) {
      updateData.confidence_score = updates.confidence_score;
    }

    if (updates.gpt_analysis) {
      // Merge with existing GPT analysis
      const { data: current } = await supabase
        .from(this.TABLE_NAME)
        .select('gpt_analysis')
        .eq('id', id)
        .single();

      if (current?.gpt_analysis) {
        updateData.gpt_analysis = { ...current.gpt_analysis, ...updates.gpt_analysis };
      } else {
        updateData.gpt_analysis = updates.gpt_analysis;
      }
    }

    if (updates.analysis_metadata) {
      // Merge with existing metadata
      const { data: current } = await supabase
        .from(this.TABLE_NAME)
        .select('analysis_metadata')
        .eq('id', id)
        .single();

      if (current?.analysis_metadata) {
        updateData.analysis_metadata = { ...current.analysis_metadata, ...updates.analysis_metadata };
      } else {
        updateData.analysis_metadata = updates.analysis_metadata;
      }
    }

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context analysis: ${error.message}`);
    }

    return data;
  }

  /**
   * Get analyses requiring review (low confidence or unusual patterns)
   */
  static async getRequiringReview(options?: {
    minConfidenceThreshold?: number;
    limit?: number;
    offset?: number;
  }): Promise<ContextAnalysis[]> {
    const confidenceThreshold = options?.minConfidenceThreshold || 60;

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .or(`confidence_score.lt.${confidenceThreshold},gpt_analysis->impossible_claims_detected.not.eq.[],gpt_analysis->suspicious_patterns.not.eq.[]`);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get context analyses requiring review: ${error.message}`);
    }

    return data || [];
  }
}