/**
 * BehavioralPattern Database Model
 * Task: T033 - BehavioralPattern model
 *
 * Database operations for behavioral_patterns table
 * Handles detection of suspicious calling patterns:
 * - Call frequency abuse (rapid calls)
 * - Time pattern anomalies
 * - Location impossibilities
 * - Content similarity (bot-like behavior)
 * Contributing 30% to overall fraud score
 */
import type { BehavioralPattern, PatternType, PatternData, DetectionRule, BehavioralPatternResponse } from '@vocilia/types';
export declare class BehavioralPatternModel {
    private static readonly TABLE_NAME;
    /**
     * Create a new behavioral pattern record
     */
    static create(data: {
        phone_hash: string;
        pattern_type: PatternType;
        risk_score: number;
        violation_count: number;
        pattern_data: PatternData;
        detection_rules: DetectionRule[];
        is_resolved?: boolean;
        resolution_notes?: string;
    }): Promise<BehavioralPattern>;
    /**
     * Get behavioral patterns by phone hash
     */
    static getByPhoneHash(phoneHash: string, options?: {
        patternTypes?: PatternType[];
        timeWindow?: string;
        includeResolved?: boolean;
    }): Promise<BehavioralPattern[]>;
    /**
     * Update existing pattern (increment violation count, update data)
     */
    static updatePattern(id: string, updates: {
        risk_score?: number;
        violation_count?: number;
        pattern_data?: Partial<PatternData>;
        detection_rules?: DetectionRule[];
        is_resolved?: boolean;
        resolution_notes?: string;
    }): Promise<BehavioralPattern>;
    /**
     * Get patterns by risk level
     */
    static getByRiskLevel(options: {
        minRiskScore: number;
        maxRiskScore?: number;
        patternTypes?: PatternType[];
        limit?: number;
        offset?: number;
        includeResolved?: boolean;
    }): Promise<{
        patterns: BehavioralPattern[];
        totalCount: number;
    }>;
    /**
     * Get call frequency patterns for phone hash
     */
    static getCallFrequencyPatterns(phoneHash: string, timeWindowMinutes?: number): Promise<BehavioralPattern[]>;
    /**
     * Get similarity patterns (detecting bot-like behavior)
     */
    static getSimilarityPatterns(phoneHash: string): Promise<BehavioralPattern[]>;
    /**
     * Get location patterns (impossible travel detection)
     */
    static getLocationPatterns(phoneHash: string): Promise<BehavioralPattern[]>;
    /**
     * Get time patterns (unusual calling hours)
     */
    static getTimePatterns(phoneHash: string): Promise<BehavioralPattern[]>;
    /**
     * Get patterns requiring immediate attention (high risk, unresolved)
     */
    static getCriticalPatterns(options?: {
        riskThreshold?: number;
        limit?: number;
    }): Promise<BehavioralPattern[]>;
    /**
     * Get pattern statistics
     */
    static getStatistics(options?: {
        startDate?: string;
        endDate?: string;
        patternType?: PatternType;
    }): Promise<{
        totalPatterns: number;
        unresolvedPatterns: number;
        patternTypeDistribution: Record<PatternType, number>;
        riskLevelDistribution: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        averageRiskScore: number;
        averageViolationCount: number;
        resolutionRate: number;
        topRiskFactors: Array<{
            factor: string;
            count: number;
        }>;
    }>;
    /**
     * Generate behavioral pattern response
     */
    static generateResponse(phoneHash: string, patterns: BehavioralPattern[], timeWindow?: string): BehavioralPatternResponse;
    /**
     * Resolve pattern (mark as resolved with notes)
     */
    static resolvePattern(id: string, resolutionNotes: string): Promise<BehavioralPattern>;
    /**
     * Delete old resolved patterns
     */
    static deleteOldResolved(daysOld: number): Promise<number>;
    /**
     * Get bulk behavioral patterns for multiple phone hashes
     */
    static getBulkPatterns(phoneHashes: string[], options?: {
        includeResolved?: boolean;
        timeWindow?: string;
    }): Promise<Map<string, BehavioralPattern[]>>;
    private static parseTimeWindow;
    private static calculateOverallRiskLevel;
    private static generateRecommendation;
}
//# sourceMappingURL=behavioral-pattern.d.ts.map