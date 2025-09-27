/**
 * RedFlagKeyword Database Model
 * Task: T034 - RedFlagKeyword model
 *
 * Database operations for red_flag_keywords table
 * Manages Swedish fraud detection keywords:
 * - Categories: profanity, threats, nonsensical, impossible
 * - Severity levels: 1-10
 * - Detection patterns: regex for advanced matching
 * Contributing 20% to overall fraud score
 */
import type { RedFlagKeyword, KeywordCategory, KeywordDetectionResult, KeywordRequest } from '@vocilia/types';
export declare class RedFlagKeywordModel {
    private static readonly TABLE_NAME;
    private static readonly DEFAULT_KEYWORDS;
    /**
     * Initialize default keywords (run once on system setup)
     */
    static initializeDefaultKeywords(): Promise<void>;
    /**
     * Create a new red flag keyword
     */
    static create(data: {
        keyword: string;
        category: KeywordCategory;
        severity_level: number;
        language_code?: string;
        detection_pattern?: string;
        created_by: string;
    }): Promise<RedFlagKeyword>;
    /**
     * Get all active keywords
     */
    static getActive(options?: {
        language?: string;
        category?: KeywordCategory;
        sortBy?: 'severity' | 'keyword' | 'created_at';
    }): Promise<RedFlagKeyword[]>;
    /**
     * Get keywords by category
     */
    static getByCategory(category: KeywordCategory, language?: string): Promise<RedFlagKeyword[]>;
    /**
     * Search content for red flag keywords
     */
    static detectKeywords(content: string, language?: string): Promise<KeywordDetectionResult>;
    /**
     * Update keyword (activate/deactivate, modify severity)
     */
    static update(id: string, updates: {
        severity_level?: number;
        detection_pattern?: string;
        is_active?: boolean;
    }): Promise<RedFlagKeyword>;
    /**
     * Deactivate keyword (soft delete)
     */
    static deactivate(id: string): Promise<RedFlagKeyword>;
    /**
     * Get keyword statistics
     */
    static getStatistics(options?: {
        startDate?: string;
        endDate?: string;
        language?: string;
    }): Promise<{
        totalKeywords: number;
        activeKeywords: number;
        categoryDistribution: Record<KeywordCategory, number>;
        severityDistribution: Record<string, number>;
        languageDistribution: Record<string, number>;
        averageSeverity: number;
        mostUsedKeywords: Array<{
            keyword: string;
            category: KeywordCategory;
            severity_level: number;
            usage_count: number;
        }>;
    }>;
    /**
     * Bulk create keywords
     */
    static bulkCreate(keywords: Array<{
        keyword: string;
        category: KeywordCategory;
        severity_level: number;
        language_code?: string;
        detection_pattern?: string;
    }>, createdBy: string): Promise<{
        created: number;
        errors: Array<{
            keyword: string;
            error: string;
        }>;
    }>;
    /**
     * Search keywords by text
     */
    static searchKeywords(searchQuery: string, options?: {
        category?: KeywordCategory;
        language?: string;
        activeOnly?: boolean;
    }): Promise<RedFlagKeyword[]>;
    /**
     * Get keyword by ID
     */
    static getById(id: string): Promise<RedFlagKeyword | null>;
    /**
     * Validate keyword request data
     */
    static validateKeywordRequest(data: KeywordRequest): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Calculate fraud score contribution from keywords
     * Returns score 0-20 (20% weight in overall fraud score)
     */
    static calculateFraudScoreContribution(detectionResult: KeywordDetectionResult): number;
}
//# sourceMappingURL=red-flag-keyword.d.ts.map