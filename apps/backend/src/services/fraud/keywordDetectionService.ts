/**
 * Keyword Detection Service
 * Task: T040 - Keyword detection service in apps/backend/src/services/fraud/keywordDetectionService.ts
 * 
 * Provides real-time detection of red flag keywords in Swedish customer feedback.
 * Supports regex patterns, contextual analysis, and severity-based scoring.
 */

import { RedFlagKeywordModel } from '../../../../../packages/database/src/fraud/red-flag-keyword';
import {
  KeywordDetectionRequest,
  KeywordDetectionResult,
  RedFlagKeyword,
  KeywordMatch,
  KeywordCategory
} from '../../../../../packages/types/src/fraud';

export class KeywordDetectionService {
  private keywordCache: Map<string, RedFlagKeyword[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;

  /**
   * Detect red flag keywords in text
   */
  async detectKeywords(request: KeywordDetectionRequest): Promise<KeywordDetectionResult> {
    try {
      const startTime = Date.now();
      
      // Get active keywords for the language
      const keywords = await this.getActiveKeywords(request.language_code || 'sv');
      
      // Perform keyword detection
      const matches = await this.findKeywordMatches(request.text_content, keywords);
      
      // Calculate scores
      const categoryScores = this.calculateCategoryScores(matches);
      const overallScore = this.calculateOverallScore(matches);
      
      const processingTime = Date.now() - startTime;

      const result: KeywordDetectionResult = {
        phone_hash: request.phone_hash,
        text_analyzed: request.text_content,
        language_code: request.language_code || 'sv',
        matches_found: matches,
        category_scores: categoryScores,
        overall_keyword_score: overallScore,
        risk_level: this.determineRiskLevel(overallScore),
        total_matches: matches.length,
        highest_severity: matches.length > 0 ? Math.max(...matches.map(m => m.severity_level)) : 0,
        processing_time_ms: processingTime,
        detected_at: new Date().toISOString()
      };

      // Store detection result if matches found
      if (matches.length > 0) {
        await this.storeDetectionResult(result);
      }

      return result;
    } catch (error) {
      throw new Error(`Keyword detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active keywords with caching
   */
  private async getActiveKeywords(languageCode: string): Promise<RedFlagKeyword[]> {
    const cacheKey = `keywords_${languageCode}`;
    const now = Date.now();

    // Check cache
    if (this.keywordCache.has(cacheKey) && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.keywordCache.get(cacheKey) || [];
    }

    // Fetch from database
    const keywords = await RedFlagKeywordModel.getActiveKeywords({ 
      language_code: languageCode 
    });

    // Update cache
    this.keywordCache.set(cacheKey, keywords);
    this.lastCacheUpdate = now;

    return keywords;
  }

  /**
   * Find keyword matches in text
   */
  private async findKeywordMatches(text: string, keywords: RedFlagKeyword[]): Promise<KeywordMatch[]> {
    const matches: KeywordMatch[] = [];
    const textLower = text.toLowerCase();
    const words = text.split(/\s+/);

    for (const keyword of keywords) {
      try {
        const keywordMatches = await this.detectKeywordInText(
          text,
          textLower,
          words,
          keyword
        );
        matches.push(...keywordMatches);
      } catch (error) {
        console.warn(`Error detecting keyword "${keyword.keyword}": ${error}`);
      }
    }

    // Sort by severity (highest first)
    return matches.sort((a, b) => b.severity_level - a.severity_level);
  }

  /**
   * Detect a specific keyword in text
   */
  private async detectKeywordInText(
    originalText: string,
    textLower: string,
    words: string[],
    keyword: RedFlagKeyword
  ): Promise<KeywordMatch[]> {
    const matches: KeywordMatch[] = [];

    // Use detection pattern if available, otherwise simple keyword matching
    if (keyword.detection_pattern) {
      const regex = new RegExp(keyword.detection_pattern, 'gi');
      let match;
      
      while ((match = regex.exec(originalText)) !== null) {
        matches.push({
          keyword_id: keyword.id,
          keyword: keyword.keyword,
          matched_text: match[0],
          category: keyword.category,
          severity_level: keyword.severity_level,
          position_start: match.index,
          position_end: match.index + match[0].length,
          context_before: this.getContext(originalText, match.index, -50),
          context_after: this.getContext(originalText, match.index + match[0].length, 50),
          confidence_score: this.calculateMatchConfidence(match[0], keyword),
          detection_method: 'regex_pattern'
        });
      }
    } else {
      // Simple keyword matching
      const keywordLower = keyword.keyword.toLowerCase();
      const keywordWords = keywordLower.split(/\s+/);

      // Exact phrase matching
      if (textLower.includes(keywordLower)) {
        const index = textLower.indexOf(keywordLower);
        matches.push({
          keyword_id: keyword.id,
          keyword: keyword.keyword,
          matched_text: originalText.substring(index, index + keyword.keyword.length),
          category: keyword.category,
          severity_level: keyword.severity_level,
          position_start: index,
          position_end: index + keyword.keyword.length,
          context_before: this.getContext(originalText, index, -50),
          context_after: this.getContext(originalText, index + keyword.keyword.length, 50),
          confidence_score: 1.0, // Exact match
          detection_method: 'exact_match'
        });
      }

      // Fuzzy matching for single words
      if (keywordWords.length === 1) {
        for (let i = 0; i < words.length; i++) {
          const word = words[i].toLowerCase().replace(/[^\w]/g, '');
          const similarity = this.calculateStringSimilarity(word, keywordLower);
          
          if (similarity >= 0.8) { // 80% similarity threshold
            const wordStart = originalText.toLowerCase().indexOf(word);
            matches.push({
              keyword_id: keyword.id,
              keyword: keyword.keyword,
              matched_text: words[i],
              category: keyword.category,
              severity_level: Math.floor(keyword.severity_level * similarity), // Reduce severity for fuzzy matches
              position_start: wordStart,
              position_end: wordStart + words[i].length,
              context_before: this.getContext(originalText, wordStart, -50),
              context_after: this.getContext(originalText, wordStart + words[i].length, 50),
              confidence_score: similarity,
              detection_method: 'fuzzy_match'
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Get text context around position
   */
  private getContext(text: string, position: number, length: number): string {
    if (length < 0) {
      const start = Math.max(0, position + length);
      return text.substring(start, position);
    } else {
      const end = Math.min(text.length, position + length);
      return text.substring(position, end);
    }
  }

  /**
   * Calculate match confidence score
   */
  private calculateMatchConfidence(matchedText: string, keyword: RedFlagKeyword): number {
    const similarity = this.calculateStringSimilarity(
      matchedText.toLowerCase(),
      keyword.keyword.toLowerCase()
    );
    
    // Boost confidence for exact matches
    if (matchedText.toLowerCase() === keyword.keyword.toLowerCase()) {
      return 1.0;
    }
    
    return Math.max(0.5, similarity); // Minimum 0.5 confidence for regex matches
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  /**
   * Calculate category scores
   */
  private calculateCategoryScores(matches: KeywordMatch[]): Record<KeywordCategory, number> {
    const categoryScores: Record<KeywordCategory, number> = {
      profanity: 0,
      threats: 0,
      nonsensical: 0,
      impossible: 0
    };

    const categoryMaxScores: Record<KeywordCategory, number> = {
      profanity: 0,
      threats: 0,
      nonsensical: 0,
      impossible: 0
    };

    // Group matches by category
    for (const match of matches) {
      const weightedScore = match.severity_level * match.confidence_score;
      categoryScores[match.category] += weightedScore;
      categoryMaxScores[match.category] = Math.max(
        categoryMaxScores[match.category],
        weightedScore
      );
    }

    // Apply diminishing returns for multiple matches in same category
    for (const category in categoryScores) {
      const cat = category as KeywordCategory;
      if (categoryScores[cat] > 0) {
        // Use logarithmic scaling to prevent single category domination
        categoryScores[cat] = Math.min(
          20, // Max score per category (20% of total)
          categoryMaxScores[cat] + Math.log(categoryScores[cat] / categoryMaxScores[cat] + 1) * 5
        );
      }
    }

    return categoryScores;
  }

  /**
   * Calculate overall keyword score
   */
  private calculateOverallScore(matches: KeywordMatch[]): number {
    if (matches.length === 0) return 0;

    const categoryScores = this.calculateCategoryScores(matches);
    const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);

    // Apply penalties for high-severity matches
    const highSeverityMatches = matches.filter(m => m.severity_level >= 8);
    const severityBonus = highSeverityMatches.length * 2;

    // Apply bonus for multiple categories
    const categoriesUsed = Object.values(categoryScores).filter(score => score > 0).length;
    const diversityBonus = categoriesUsed > 1 ? (categoriesUsed - 1) * 2 : 0;

    const finalScore = Math.min(20, totalScore + severityBonus + diversityBonus);
    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  /**
   * Store detection result in database
   */
  private async storeDetectionResult(result: KeywordDetectionResult): Promise<void> {
    try {
      // This would typically store the result in a keyword_detections table
      // For now, we'll just log high-severity detections
      if (result.risk_level === 'high' || result.risk_level === 'critical') {
        console.warn(`High-severity keyword detection: ${result.phone_hash} - Score: ${result.overall_keyword_score}`);
      }
    } catch (error) {
      console.error(`Failed to store keyword detection result: ${error}`);
    }
  }

  /**
   * Batch detect keywords in multiple texts
   */
  async batchDetectKeywords(requests: KeywordDetectionRequest[]): Promise<KeywordDetectionResult[]> {
    try {
      const results: KeywordDetectionResult[] = [];
      const batchSize = 10; // Process 10 at a time

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchPromises = batch.map(request => this.detectKeywords(request));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch keyword detection failed for request ${i + index}: ${result.reason}`);
          }
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Batch keyword detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update keyword cache manually
   */
  async refreshKeywordCache(languageCode?: string): Promise<void> {
    try {
      if (languageCode) {
        const keywords = await RedFlagKeywordModel.getActiveKeywords({ 
          language_code: languageCode 
        });
        this.keywordCache.set(`keywords_${languageCode}`, keywords);
      } else {
        // Refresh all languages
        this.keywordCache.clear();
        const languages = ['sv', 'en', 'no', 'da'];
        
        for (const lang of languages) {
          const keywords = await RedFlagKeywordModel.getActiveKeywords({ 
            language_code: lang 
          });
          this.keywordCache.set(`keywords_${lang}`, keywords);
        }
      }
      
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      throw new Error(`Cache refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detection statistics
   */
  async getDetectionStatistics(timeWindow: string = '24h'): Promise<{
    total_detections: number;
    unique_phone_numbers: number;
    category_breakdown: Record<KeywordCategory, number>;
    average_score: number;
    high_risk_detections: number;
  }> {
    try {
      // This would query actual detection results from the database
      // For now, return mock statistics
      return {
        total_detections: 0,
        unique_phone_numbers: 0,
        category_breakdown: {
          profanity: 0,
          threats: 0,
          nonsensical: 0,
          impossible: 0
        },
        average_score: 0,
        high_risk_detections: 0
      };
    } catch (error) {
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear keyword cache
   */
  clearCache(): void {
    this.keywordCache.clear();
    this.lastCacheUpdate = 0;
  }
}