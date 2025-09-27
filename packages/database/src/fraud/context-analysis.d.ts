/**
 * ContextAnalysis Database Model
 * Task: T032 - ContextAnalysis model
 *
 * Database operations for context_analyses table
 * Handles GPT-4o-mini analysis results for Swedish feedback legitimacy
 * Contributing 40% to overall fraud score
 */
import type { ContextAnalysis, GPTAnalysis, BusinessContext, ContextAnalysisMetadata } from '@vocilia/types';
export declare class ContextAnalysisModel {
    private static readonly TABLE_NAME;
    /**
     * Create a new context analysis record
     */
    static create(data: {
        phone_hash: string;
        feedback_content: string;
        language_detected: string;
        business_context: BusinessContext;
        gpt_analysis: GPTAnalysis;
        legitimacy_score: number;
        confidence_score: number;
        analysis_metadata: ContextAnalysisMetadata;
    }): Promise<ContextAnalysis>;
    /**
     * Get context analysis by phone hash
     */
    static getByPhoneHash(phoneHash: string): Promise<ContextAnalysis[]>;
    /**
     * Get latest context analysis for phone hash
     */
    static getLatestByPhoneHash(phoneHash: string): Promise<ContextAnalysis | null>;
    /**
     * Get context analyses by legitimacy score range
     */
    static getByLegitimacyRange(options: {
        minScore: number;
        maxScore: number;
        limit?: number;
        offset?: number;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        analyses: ContextAnalysis[];
        totalCount: number;
    }>;
    /**
     * Get context analyses by language
     */
    static getByLanguage(language: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<ContextAnalysis[]>;
    /**
     * Search context analyses by feedback content
     */
    static searchByContent(searchQuery: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<ContextAnalysis[]>;
    /**
     * Get context analyses with impossible claims
     */
    static getWithImpossibleClaims(options?: {
        limit?: number;
        offset?: number;
    }): Promise<ContextAnalysis[]>;
    /**
     * Get context analyses with suspicious patterns
     */
    static getWithSuspiciousPatterns(options?: {
        limit?: number;
        offset?: number;
    }): Promise<ContextAnalysis[]>;
    /**
     * Get analysis statistics
     */
    static getStatistics(options?: {
        startDate?: string;
        endDate?: string;
        language?: string;
    }): Promise<{
        totalAnalyses: number;
        languageDistribution: Record<string, number>;
        averageLegitimacyScore: number;
        averageConfidenceScore: number;
        impossibleClaimsCount: number;
        suspiciousPatternsCount: number;
        averageProcessingTime: number;
        scoreDistribution: {
            veryLow: number;
            low: number;
            medium: number;
            high: number;
            veryHigh: number;
        };
        contentAnalysis: {
            averageTextLength: number;
            averageWordCount: number;
            averageSentenceCount: number;
            averageLanguageComplexity: number;
        };
    }>;
    /**
     * Get recent analyses for performance monitoring
     */
    static getRecentAnalyses(options: {
        minutes: number;
        limit?: number;
    }): Promise<ContextAnalysis[]>;
    /**
     * Delete old context analyses
     */
    static deleteOlderThan(days: number): Promise<number>;
    /**
     * Get bulk context analyses for multiple phone hashes
     */
    static getBulkLatest(phoneHashes: string[]): Promise<Map<string, ContextAnalysis>>;
    /**
     * Update analysis (for reprocessing or corrections)
     */
    static update(id: string, updates: {
        legitimacy_score?: number;
        confidence_score?: number;
        gpt_analysis?: Partial<GPTAnalysis>;
        analysis_metadata?: Partial<ContextAnalysisMetadata>;
    }): Promise<ContextAnalysis>;
    /**
     * Get analyses requiring review (low confidence or unusual patterns)
     */
    static getRequiringReview(options?: {
        minConfidenceThreshold?: number;
        limit?: number;
        offset?: number;
    }): Promise<ContextAnalysis[]>;
}
//# sourceMappingURL=context-analysis.d.ts.map