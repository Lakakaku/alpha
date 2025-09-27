/**
 * AI sentiment analysis service with GPT-4o-mini
 * Feature: 008-step-2-6
 * Task: T025
 */

import { openaiService } from '../../config/openai';
import { supabase } from '@vocilia/database/client';
import type { SentimentType, FeedbackRecord, SentimentBreakdown } from '@vocilia/types/feedback-analysis';

export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  department_tags: string[];
  priority_score: number; // 1-10
  ai_summary: string;
  confidence_score?: number; // 0-1
  processing_time_ms: number;
}

export interface BatchSentimentAnalysisResult {
  results: Array<SentimentAnalysisResult & { feedback_id: string }>;
  total_processed: number;
  successful: number;
  failed: number;
  total_processing_time_ms: number;
  aggregated_sentiment: SentimentBreakdown;
  top_departments: Array<{ department: string; count: number }>;
}

export interface FeedbackAnalysisOptions {
  include_department_detection?: boolean;
  include_priority_scoring?: boolean;
  include_summary?: boolean;
  confidence_threshold?: number;
  max_retries?: number;
  batch_size?: number;
}

/**
 * Department mapping for Swedish retail context
 */
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  'kött': ['kött', 'chark', 'slakt', 'korv', 'bacon', 'fläsk', 'nöt', 'kyckling', 'meat', 'butik'],
  'kassa': ['kassa', 'checkout', 'betala', 'betalning', 'kvitto', 'cashier', 'köa', 'kö', 'vänta'],
  'bageri': ['bageri', 'bröd', 'bakning', 'bakery', 'bulle', 'tårta', 'kaka', 'deg'],
  'kundservice': ['service', 'personal', 'hjälp', 'support', 'anställd', 'medarbetare', 'kund'],
  'parkering': ['parkering', 'bil', 'parking', 'parkeringsplats', 'p-plats'],
  'frukt': ['frukt', 'grönt', 'fruit', 'vegetables', 'grönsaker', 'äpple', 'banan'],
  'mejeri': ['mjölk', 'ost', 'yoghurt', 'dairy', 'smör', 'grädde', 'fil'],
  'frys': ['fryst', 'frys', 'frozen', 'glass', 'frysvaror'],
  'dryck': ['dryck', 'dricka', 'läsk', 'juice', 'vatten', 'öl', 'vin'],
  'hushåll': ['städ', 'tvätt', 'disk', 'rengöring', 'household', 'kemisk'],
  'elektronik': ['elektronik', 'mobil', 'dator', 'tv', 'hörlurar', 'laddare'],
  'apotek': ['apotek', 'medicin', 'vitamin', 'pharmacy', 'hälsa', 'tandkräm']
};

/**
 * Priority scoring keywords (Swedish context)
 */
const PRIORITY_KEYWORDS = {
  critical: ['farlig', 'hälsofara', 'allergi', 'gift', 'mögel', 'bakterie', 'smuts'],
  high: ['dålig', 'äcklig', 'klagomål', 'problem', 'fel', 'trasig', 'smutsig'],
  medium: ['ok', 'bra', 'vanlig', 'standard', 'normal'],
  low: ['excellent', 'fantastisk', 'perfekt', 'underbar', 'bäst']
};

/**
 * Validation functions
 */
export function validateFeedbackContent(content: string): string[] {
  const errors: string[] = [];

  if (!content || typeof content !== 'string') {
    errors.push('Content is required and must be a string');
  } else if (content.length < 10) {
    errors.push('Content must be at least 10 characters long');
  } else if (content.length > 5000) {
    errors.push('Content must not exceed 5000 characters');
  }

  return errors;
}

/**
 * Fallback analysis when AI is unavailable
 */
export class FallbackSentimentAnalyzer {
  /**
   * Basic sentiment analysis using keyword matching
   */
  static analyzeSentiment(content: string): SentimentAnalysisResult {
    const startTime = Date.now();
    const lowercaseContent = content.toLowerCase();

    // Sentiment detection
    const positiveWords = [
      'bra', 'bäst', 'fantastisk', 'excellent', 'good', 'great', 'perfekt',
      'underbar', 'trevlig', 'snabb', 'fräsch', 'ren', 'hjälpsam'
    ];

    const negativeWords = [
      'dålig', 'värst', 'problem', 'fel', 'bad', 'terrible', 'issue',
      'trasig', 'långsam', 'smutsig', 'otrevlig', 'dyr', 'dyrt'
    ];

    const neutralWords = ['ok', 'okej', 'vanlig', 'normal', 'standard'];

    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;

    positiveWords.forEach(word => {
      if (lowercaseContent.includes(word)) positiveScore++;
    });

    negativeWords.forEach(word => {
      if (lowercaseContent.includes(word)) negativeScore++;
    });

    neutralWords.forEach(word => {
      if (lowercaseContent.includes(word)) neutralScore++;
    });

    // Determine sentiment
    let sentiment: SentimentType = 'neutral';
    if (positiveScore > negativeScore && positiveScore > 0) {
      sentiment = negativeScore > 0 ? 'mixed' : 'positive';
    } else if (negativeScore > positiveScore && negativeScore > 0) {
      sentiment = positiveScore > 0 ? 'mixed' : 'negative';
    }

    // Department detection
    const departments = this.detectDepartments(lowercaseContent);

    // Priority scoring
    const priorityScore = this.calculatePriorityScore(lowercaseContent, sentiment);

    // Generate basic summary
    const summary = this.generateBasicSummary(content, sentiment, departments);

    return {
      sentiment,
      department_tags: departments,
      priority_score: priorityScore,
      ai_summary: summary,
      confidence_score: 0.6, // Lower confidence for fallback
      processing_time_ms: Date.now() - startTime
    };
  }

  /**
   * Detect departments using keyword matching
   */
  private static detectDepartments(content: string): string[] {
    const detectedDepartments: string[] = [];

    Object.entries(DEPARTMENT_KEYWORDS).forEach(([department, keywords]) => {
      if (keywords.some(keyword => content.includes(keyword))) {
        detectedDepartments.push(department);
      }
    });

    return detectedDepartments.slice(0, 3); // Limit to top 3 departments
  }

  /**
   * Calculate priority score based on keywords
   */
  private static calculatePriorityScore(content: string, sentiment: SentimentType): number {
    let score = 5; // Default medium priority

    // Adjust based on sentiment
    switch (sentiment) {
      case 'positive':
        score = 3;
        break;
      case 'negative':
        score = 7;
        break;
      case 'mixed':
        score = 6;
        break;
      default:
        score = 5;
    }

    // Check for priority keywords
    if (PRIORITY_KEYWORDS.critical.some(word => content.includes(word))) {
      score = 10;
    } else if (PRIORITY_KEYWORDS.high.some(word => content.includes(word))) {
      score = Math.max(score, 8);
    } else if (PRIORITY_KEYWORDS.low.some(word => content.includes(word))) {
      score = Math.min(score, 3);
    }

    return Math.max(1, Math.min(10, score));
  }

  /**
   * Generate basic summary
   */
  private static generateBasicSummary(content: string, sentiment: SentimentType, departments: string[]): string {
    const maxLength = 150;
    let summary = content.substring(0, maxLength);
    
    if (content.length > maxLength) {
      summary += '...';
    }

    const sentimentLabels = {
      positive: 'Positiv',
      negative: 'Negativ',
      neutral: 'Neutral',
      mixed: 'Blandad'
    };

    const prefix = `${sentimentLabels[sentiment]} feedback`;
    const departmentSuffix = departments.length > 0 ? ` (${departments.join(', ')})` : '';

    return `${prefix}${departmentSuffix}: ${summary}`;
  }
}

/**
 * Main sentiment analysis service
 */
export class SentimentAnalysisService {
  /**
   * Analyze sentiment for a single feedback item
   */
  static async analyzeFeedback(
    content: string,
    options: FeedbackAnalysisOptions = {}
  ): Promise<SentimentAnalysisResult> {
    const {
      include_department_detection = true,
      include_priority_scoring = true,
      include_summary = true,
      confidence_threshold = 0.7,
      max_retries = 2
    } = options;

    // Validate input
    const validationErrors = validateFeedbackContent(content);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    // Try AI analysis with retries
    while (attempt <= max_retries) {
      try {
        const aiResult = await openaiService.analyzeSentiment(content);
        
        const result: SentimentAnalysisResult = {
          sentiment: aiResult.sentiment,
          department_tags: include_department_detection ? aiResult.department_tags : [],
          priority_score: include_priority_scoring ? aiResult.priority_score : 5,
          ai_summary: include_summary ? aiResult.ai_summary : '',
          confidence_score: 0.85, // High confidence for AI analysis
          processing_time_ms: Date.now() - startTime
        };

        // Validate AI result
        if (this.isValidSentimentResult(result, confidence_threshold)) {
          return result;
        } else {
          throw new Error('AI result did not meet confidence threshold');
        }

      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt <= max_retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Fallback to keyword-based analysis
    console.warn(`AI sentiment analysis failed after ${max_retries + 1} attempts, using fallback:`, lastError?.message);
    return FallbackSentimentAnalyzer.analyzeSentiment(content);
  }

  /**
   * Batch analyze multiple feedback items
   */
  static async analyzeBatch(
    feedbackItems: Array<{ id: string; content: string }>,
    options: FeedbackAnalysisOptions = {}
  ): Promise<BatchSentimentAnalysisResult> {
    const { batch_size = 10 } = options;
    const startTime = Date.now();

    const results: Array<SentimentAnalysisResult & { feedback_id: string }> = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < feedbackItems.length; i += batch_size) {
      const batch = feedbackItems.slice(i, i + batch_size);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const analysis = await this.analyzeFeedback(item.content, options);
          successful++;
          return { ...analysis, feedback_id: item.id };
        } catch (error) {
          failed++;
          console.error(`Failed to analyze feedback ${item.id}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null) as Array<SentimentAnalysisResult & { feedback_id: string }>);

      // Add delay between batches to respect rate limits
      if (i + batch_size < feedbackItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate aggregated metrics
    const aggregatedSentiment = this.calculateAggregatedSentiment(results);
    const topDepartments = this.calculateTopDepartments(results);

    return {
      results,
      total_processed: feedbackItems.length,
      successful,
      failed,
      total_processing_time_ms: Date.now() - startTime,
      aggregated_sentiment,
      top_departments
    };
  }

  /**
   * Update feedback records with sentiment analysis
   */
  static async updateFeedbackWithAnalysis(
    feedbackIds: string[],
    options: FeedbackAnalysisOptions = {}
  ): Promise<{
    updated: number;
    failed: number;
    results: BatchSentimentAnalysisResult;
  }> {
    // Fetch feedback records
    const { data: feedbackRecords, error: fetchError } = await supabase
      .from('feedback_records')
      .select('id, content')
      .in('id', feedbackIds)
      .is('analysis_status', null); // Only process unanalyzed feedback

    if (fetchError) {
      throw new Error(`Failed to fetch feedback records: ${fetchError.message}`);
    }

    if (!feedbackRecords || feedbackRecords.length === 0) {
      return {
        updated: 0,
        failed: 0,
        results: {
          results: [],
          total_processed: 0,
          successful: 0,
          failed: 0,
          total_processing_time_ms: 0,
          aggregated_sentiment: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
          top_departments: []
        }
      };
    }

    // Analyze feedback
    const analysisResults = await this.analyzeBatch(feedbackRecords, options);

    // Update database records
    let updated = 0;
    let failed = 0;

    for (const result of analysisResults.results) {
      try {
        const { error: updateError } = await supabase
          .from('feedback_records')
          .update({
            sentiment: result.sentiment,
            department_tags: result.department_tags,
            ai_summary: result.ai_summary,
            priority_score: result.priority_score,
            analysis_status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', result.feedback_id);

        if (updateError) {
          throw updateError;
        }

        updated++;
      } catch (error) {
        console.error(`Failed to update feedback ${result.feedback_id}:`, error);
        failed++;
      }
    }

    return {
      updated,
      failed,
      results: analysisResults
    };
  }

  /**
   * Validate sentiment analysis result
   */
  private static isValidSentimentResult(
    result: SentimentAnalysisResult,
    confidenceThreshold: number
  ): boolean {
    // Check basic structure
    if (!result.sentiment || !['positive', 'negative', 'neutral', 'mixed'].includes(result.sentiment)) {
      return false;
    }

    if (!Array.isArray(result.department_tags)) {
      return false;
    }

    if (typeof result.priority_score !== 'number' || result.priority_score < 1 || result.priority_score > 10) {
      return false;
    }

    if (typeof result.ai_summary !== 'string') {
      return false;
    }

    // Check confidence threshold
    if (result.confidence_score && result.confidence_score < confidenceThreshold) {
      return false;
    }

    return true;
  }

  /**
   * Calculate aggregated sentiment breakdown
   */
  private static calculateAggregatedSentiment(
    results: Array<SentimentAnalysisResult & { feedback_id: string }>
  ): SentimentBreakdown {
    const breakdown = { positive: 0, negative: 0, neutral: 0, mixed: 0 };

    results.forEach(result => {
      switch (result.sentiment) {
        case 'positive':
          breakdown.positive++;
          break;
        case 'negative':
          breakdown.negative++;
          break;
        case 'neutral':
          breakdown.neutral++;
          break;
        case 'mixed':
          breakdown.mixed++;
          break;
      }
    });

    return breakdown;
  }

  /**
   * Calculate top departments from analysis results
   */
  private static calculateTopDepartments(
    results: Array<SentimentAnalysisResult & { feedback_id: string }>
  ): Array<{ department: string; count: number }> {
    const departmentCounts: Record<string, number> = {};

    results.forEach(result => {
      result.department_tags.forEach(department => {
        departmentCounts[department] = (departmentCounts[department] || 0) + 1;
      });
    });

    return Object.entries(departmentCounts)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get sentiment analysis statistics for a store
   */
  static async getStoreAnalysisStats(
    storeId: string,
    dateRange?: { start_date: string; end_date: string }
  ): Promise<{
    total_analyzed: number;
    sentiment_breakdown: SentimentBreakdown;
    avg_priority_score: number;
    top_departments: Array<{ department: string; count: number; avg_sentiment_score: number }>;
    analysis_coverage: number; // Percentage of feedback that has been analyzed
    processing_performance: {
      avg_processing_time_ms: number;
      ai_success_rate: number;
    };
  }> {
    let query = supabase
      .from('feedback_records')
      .select('sentiment, priority_score, department_tags, analysis_status, processing_time_ms')
      .eq('store_id', storeId);

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start_date)
        .lte('created_at', dateRange.end_date);
    }

    const { data: records, error } = await query;

    if (error) {
      throw new Error(`Failed to get analysis stats: ${error.message}`);
    }

    if (!records || records.length === 0) {
      return {
        total_analyzed: 0,
        sentiment_breakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
        avg_priority_score: 0,
        top_departments: [],
        analysis_coverage: 0,
        processing_performance: {
          avg_processing_time_ms: 0,
          ai_success_rate: 0
        }
      };
    }

    const analyzedRecords = records.filter(r => r.analysis_status === 'completed');
    const totalRecords = records.length;

    // Calculate sentiment breakdown
    const sentimentBreakdown = this.calculateAggregatedSentiment(
      analyzedRecords.map((r, i) => ({ ...r, feedback_id: i.toString() }))
    );

    // Calculate average priority score
    const avgPriorityScore = analyzedRecords.length > 0
      ? analyzedRecords.reduce((sum, r) => sum + (r.priority_score || 0), 0) / analyzedRecords.length
      : 0;

    // Calculate top departments with sentiment scores
    const departmentStats = this.calculateDepartmentStats(analyzedRecords);

    // Calculate analysis coverage
    const analysisCoverage = totalRecords > 0 ? (analyzedRecords.length / totalRecords) * 100 : 0;

    // Calculate processing performance
    const processingTimes = analyzedRecords
      .map(r => r.processing_time_ms)
      .filter(t => t && t > 0);
    
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    const aiSuccessRate = analyzedRecords.length / totalRecords * 100;

    return {
      total_analyzed: analyzedRecords.length,
      sentiment_breakdown: sentimentBreakdown,
      avg_priority_score: Math.round(avgPriorityScore * 10) / 10,
      top_departments: departmentStats,
      analysis_coverage: Math.round(analysisCoverage * 10) / 10,
      processing_performance: {
        avg_processing_time_ms: Math.round(avgProcessingTime),
        ai_success_rate: Math.round(aiSuccessRate * 10) / 10
      }
    };
  }

  /**
   * Calculate department statistics with sentiment scores
   */
  private static calculateDepartmentStats(
    records: Array<{ sentiment?: string; department_tags?: string[]; priority_score?: number }>
  ): Array<{ department: string; count: number; avg_sentiment_score: number }> {
    const departmentData: Record<string, { count: number; sentimentSum: number }> = {};

    records.forEach(record => {
      if (record.department_tags) {
        const sentimentScore = this.sentimentToScore(record.sentiment || 'neutral');
        
        record.department_tags.forEach(department => {
          if (!departmentData[department]) {
            departmentData[department] = { count: 0, sentimentSum: 0 };
          }
          departmentData[department].count++;
          departmentData[department].sentimentSum += sentimentScore;
        });
      }
    });

    return Object.entries(departmentData)
      .map(([department, data]) => ({
        department,
        count: data.count,
        avg_sentiment_score: Math.round((data.sentimentSum / data.count) * 10) / 10
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Convert sentiment to numeric score for calculations
   */
  private static sentimentToScore(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 100;
      case 'mixed': return 60;
      case 'neutral': return 50;
      case 'negative': return 10;
      default: return 50;
    }
  }
}

export default SentimentAnalysisService;