/**
 * FraudScore Database Model
 * Task: T031 - FraudScore model
 *
 * Database operations for fraud_scores table
 * Handles composite fraud scoring with weighted components:
 * - Context analysis (40% weight)
 * - Keyword detection (20% weight)
 * - Behavioral patterns (30% weight)
 * - Transaction verification (10% weight)
 */
import type { FraudScore, FraudScoreResponse, RiskLevel } from '@vocilia/types';
export declare class FraudScoreModel {
    private static readonly TABLE_NAME;
    /**
     * Create a new fraud score record
     */
    static create(data: {
        phone_hash: string;
        context_score: number;
        keyword_score: number;
        behavioral_score: number;
        transaction_score: number;
        analysis_version: string;
        expires_at?: string;
    }): Promise<FraudScore>;
    /**
     * Get fraud score by phone hash
     */
    static getByPhoneHash(phoneHash: string): Promise<FraudScore | null>;
    /**
     * Get recent fraud scores (not expired)
     */
    static getActiveByPhoneHash(phoneHash: string): Promise<FraudScore | null>;
    /**
     * Update fraud score (creates new version, keeps history)
     */
    static update(id: string, updates: {
        context_score?: number;
        keyword_score?: number;
        behavioral_score?: number;
        transaction_score?: number;
        analysis_version?: string;
    }): Promise<FraudScore>;
    /**
     * Get fraud scores within date range
     */
    static getByDateRange(options: {
        startDate: string;
        endDate: string;
        riskLevel?: RiskLevel;
        limit?: number;
        offset?: number;
    }): Promise<{
        scores: FraudScore[];
        totalCount: number;
    }>;
    /**
     * Get fraud statistics
     */
    static getStatistics(options?: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        totalScores: number;
        fraudulentCount: number;
        riskLevelDistribution: Record<RiskLevel, number>;
        averageScore: number;
        scoreDistribution: {
            contextAverage: number;
            keywordAverage: number;
            behavioralAverage: number;
            transactionAverage: number;
        };
    }>;
    /**
     * Delete expired fraud scores
     */
    static deleteExpired(): Promise<number>;
    /**
     * Get fraud scores for bulk analysis
     */
    static getBulkScores(phoneHashes: string[]): Promise<Map<string, FraudScore>>;
    /**
     * Generate fraud score response with contributing factors
     */
    static generateResponse(fraudScore: FraudScore): FraudScoreResponse;
    private static calculateRiskLevel;
    private static calculateConfidenceLevel;
    private static getContextRiskIndicators;
    private static getKeywordRiskIndicators;
    private static getBehavioralRiskIndicators;
    private static getTransactionRiskIndicators;
    private static generateRecommendations;
}
//# sourceMappingURL=fraud-score.d.ts.map