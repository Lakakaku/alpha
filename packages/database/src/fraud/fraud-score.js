"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FraudScoreModel = void 0;
const supabase_1 = require("../client/supabase");
class FraudScoreModel {
    static TABLE_NAME = 'fraud_scores';
    /**
     * Create a new fraud score record
     */
    static async create(data) {
        const composite_score = data.context_score + data.keyword_score + data.behavioral_score + data.transaction_score;
        const fraud_probability = Math.min(composite_score / 100, 1.0);
        const risk_level = this.calculateRiskLevel(composite_score);
        // Confidence level based on score distribution
        const confidence_level = this.calculateConfidenceLevel({
            context_score: data.context_score,
            keyword_score: data.keyword_score,
            behavioral_score: data.behavioral_score,
            transaction_score: data.transaction_score
        });
        const fraudScore = {
            phone_hash: data.phone_hash,
            context_score: data.context_score,
            keyword_score: data.keyword_score,
            behavioral_score: data.behavioral_score,
            transaction_score: data.transaction_score,
            composite_score,
            risk_level,
            fraud_probability,
            confidence_level,
            analysis_version: data.analysis_version,
            expires_at: data.expires_at || null
        };
        const { data: result, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .insert(fraudScore)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create fraud score: ${error.message}`);
        }
        return result;
    }
    /**
     * Get fraud score by phone hash
     */
    static async getByPhoneHash(phoneHash) {
        const { data, error } = await supabase_1.supabase
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
            throw new Error(`Failed to get fraud score: ${error.message}`);
        }
        return data;
    }
    /**
     * Get recent fraud scores (not expired)
     */
    static async getActiveByPhoneHash(phoneHash) {
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('phone_hash', phoneHash)
            .or('expires_at.is.null,expires_at.gt.now()')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                return null;
            }
            throw new Error(`Failed to get active fraud score: ${error.message}`);
        }
        return data;
    }
    /**
     * Update fraud score (creates new version, keeps history)
     */
    static async update(id, updates) {
        // Get current score
        const { data: current, error: fetchError } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) {
            throw new Error(`Failed to fetch fraud score: ${fetchError.message}`);
        }
        // Calculate new composite score
        const context_score = updates.context_score ?? current.context_score;
        const keyword_score = updates.keyword_score ?? current.keyword_score;
        const behavioral_score = updates.behavioral_score ?? current.behavioral_score;
        const transaction_score = updates.transaction_score ?? current.transaction_score;
        const composite_score = context_score + keyword_score + behavioral_score + transaction_score;
        const fraud_probability = Math.min(composite_score / 100, 1.0);
        const risk_level = this.calculateRiskLevel(composite_score);
        const confidence_level = this.calculateConfidenceLevel({
            context_score,
            keyword_score,
            behavioral_score,
            transaction_score
        });
        const updateData = {
            ...updates,
            context_score,
            keyword_score,
            behavioral_score,
            transaction_score,
            composite_score,
            risk_level,
            fraud_probability,
            confidence_level,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update fraud score: ${error.message}`);
        }
        return data;
    }
    /**
     * Get fraud scores within date range
     */
    static async getByDateRange(options) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*', { count: 'exact' })
            .gte('created_at', options.startDate)
            .lte('created_at', options.endDate);
        if (options.riskLevel) {
            query = query.eq('risk_level', options.riskLevel);
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
            throw new Error(`Failed to get fraud scores by date range: ${error.message}`);
        }
        return {
            scores: data || [],
            totalCount: count || 0
        };
    }
    /**
     * Get fraud statistics
     */
    static async getStatistics(options = {}) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('composite_score, context_score, keyword_score, behavioral_score, transaction_score, risk_level');
        if (options.startDate) {
            query = query.gte('created_at', options.startDate);
        }
        if (options.endDate) {
            query = query.lte('created_at', options.endDate);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to get fraud statistics: ${error.message}`);
        }
        if (!data || data.length === 0) {
            return {
                totalScores: 0,
                fraudulentCount: 0,
                riskLevelDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
                averageScore: 0,
                scoreDistribution: {
                    contextAverage: 0,
                    keywordAverage: 0,
                    behavioralAverage: 0,
                    transactionAverage: 0
                }
            };
        }
        const totalScores = data.length;
        const fraudulentCount = data.filter(score => score.composite_score >= 70).length;
        const riskLevelDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
        data.forEach(score => {
            riskLevelDistribution[score.risk_level]++;
        });
        const averageScore = data.reduce((sum, score) => sum + score.composite_score, 0) / totalScores;
        const scoreDistribution = {
            contextAverage: data.reduce((sum, score) => sum + score.context_score, 0) / totalScores,
            keywordAverage: data.reduce((sum, score) => sum + score.keyword_score, 0) / totalScores,
            behavioralAverage: data.reduce((sum, score) => sum + score.behavioral_score, 0) / totalScores,
            transactionAverage: data.reduce((sum, score) => sum + score.transaction_score, 0) / totalScores
        };
        return {
            totalScores,
            fraudulentCount,
            riskLevelDistribution,
            averageScore,
            scoreDistribution
        };
    }
    /**
     * Delete expired fraud scores
     */
    static async deleteExpired() {
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select('id');
        if (error) {
            throw new Error(`Failed to delete expired fraud scores: ${error.message}`);
        }
        return data?.length || 0;
    }
    /**
     * Get fraud scores for bulk analysis
     */
    static async getBulkScores(phoneHashes) {
        if (phoneHashes.length === 0) {
            return new Map();
        }
        // Get most recent score for each phone hash
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .in('phone_hash', phoneHashes)
            .order('phone_hash, created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to get bulk fraud scores: ${error.message}`);
        }
        // Keep only the most recent score for each phone hash
        const scoreMap = new Map();
        data?.forEach(score => {
            if (!scoreMap.has(score.phone_hash)) {
                scoreMap.set(score.phone_hash, score);
            }
        });
        return scoreMap;
    }
    /**
     * Generate fraud score response with contributing factors
     */
    static generateResponse(fraudScore) {
        const contributingFactors = [
            {
                component: 'context',
                score: fraudScore.context_score,
                weight_percent: 40,
                risk_indicators: this.getContextRiskIndicators(fraudScore.context_score),
                confidence: Math.min((fraudScore.context_score / 40) * 100, 100)
            },
            {
                component: 'keywords',
                score: fraudScore.keyword_score,
                weight_percent: 20,
                risk_indicators: this.getKeywordRiskIndicators(fraudScore.keyword_score),
                confidence: Math.min((fraudScore.keyword_score / 20) * 100, 100)
            },
            {
                component: 'behavioral',
                score: fraudScore.behavioral_score,
                weight_percent: 30,
                risk_indicators: this.getBehavioralRiskIndicators(fraudScore.behavioral_score),
                confidence: Math.min((fraudScore.behavioral_score / 30) * 100, 100)
            },
            {
                component: 'transaction',
                score: fraudScore.transaction_score,
                weight_percent: 10,
                risk_indicators: this.getTransactionRiskIndicators(fraudScore.transaction_score),
                confidence: Math.min((fraudScore.transaction_score / 10) * 100, 100)
            }
        ];
        const recommendations = this.generateRecommendations(fraudScore);
        return {
            phone_hash: fraudScore.phone_hash,
            is_fraudulent: fraudScore.composite_score >= 70,
            fraud_score: fraudScore,
            contributing_factors: contributingFactors,
            recommendations
        };
    }
    // ==================== PRIVATE HELPER METHODS ====================
    static calculateRiskLevel(compositeScore) {
        if (compositeScore >= 85)
            return 'critical';
        if (compositeScore >= 70)
            return 'high';
        if (compositeScore >= 40)
            return 'medium';
        return 'low';
    }
    static calculateConfidenceLevel(scores) {
        // Higher confidence when multiple components contribute significantly
        const nonZeroComponents = [
            scores.context_score > 0 ? 1 : 0,
            scores.keyword_score > 0 ? 1 : 0,
            scores.behavioral_score > 0 ? 1 : 0,
            scores.transaction_score > 0 ? 1 : 0
        ].reduce((sum, val) => sum + val, 0);
        // Base confidence from number of contributing components
        let confidence = (nonZeroComponents / 4) * 50;
        // Add confidence based on score strength
        const totalScore = scores.context_score + scores.keyword_score + scores.behavioral_score + scores.transaction_score;
        confidence += (totalScore / 100) * 50;
        return Math.min(Math.round(confidence), 100);
    }
    static getContextRiskIndicators(score) {
        const indicators = [];
        if (score >= 30)
            indicators.push('Highly suspicious content detected');
        else if (score >= 20)
            indicators.push('Suspicious content patterns');
        else if (score >= 10)
            indicators.push('Minor content irregularities');
        if (score >= 25)
            indicators.push('Language authenticity concerns');
        if (score >= 20)
            indicators.push('Cultural context mismatch');
        if (score >= 15)
            indicators.push('Impossible claims detected');
        return indicators;
    }
    static getKeywordRiskIndicators(score) {
        const indicators = [];
        if (score >= 15)
            indicators.push('High-severity red flag keywords');
        else if (score >= 10)
            indicators.push('Multiple red flag keywords');
        else if (score >= 5)
            indicators.push('Red flag keywords detected');
        if (score >= 12)
            indicators.push('Threat-related content');
        if (score >= 8)
            indicators.push('Profanity or nonsensical content');
        return indicators;
    }
    static getBehavioralRiskIndicators(score) {
        const indicators = [];
        if (score >= 25)
            indicators.push('Severe behavioral anomalies');
        else if (score >= 15)
            indicators.push('Multiple behavioral red flags');
        else if (score >= 8)
            indicators.push('Suspicious behavioral patterns');
        if (score >= 20)
            indicators.push('Call frequency abuse detected');
        if (score >= 15)
            indicators.push('Unusual timing patterns');
        if (score >= 10)
            indicators.push('Content similarity concerns');
        return indicators;
    }
    static getTransactionRiskIndicators(score) {
        const indicators = [];
        if (score >= 8)
            indicators.push('Transaction verification failed');
        else if (score >= 5)
            indicators.push('Transaction anomalies detected');
        else if (score >= 3)
            indicators.push('Minor transaction inconsistencies');
        return indicators;
    }
    static generateRecommendations(fraudScore) {
        const recommendations = [];
        if (fraudScore.composite_score >= 70) {
            recommendations.push('Block or flag this phone number for manual review');
            recommendations.push('Investigate related phone numbers from same source');
        }
        else if (fraudScore.composite_score >= 40) {
            recommendations.push('Monitor this phone number for additional activity');
            recommendations.push('Consider additional verification steps');
        }
        if (fraudScore.context_score >= 20) {
            recommendations.push('Review feedback content for impossible claims');
        }
        if (fraudScore.keyword_score >= 10) {
            recommendations.push('Content contains problematic keywords - verify legitimacy');
        }
        if (fraudScore.behavioral_score >= 15) {
            recommendations.push('Behavioral patterns suggest automated or abusive activity');
        }
        if (fraudScore.confidence_level < 60) {
            recommendations.push('Low confidence score - consider manual review');
        }
        return recommendations;
    }
}
exports.FraudScoreModel = FraudScoreModel;
//# sourceMappingURL=fraud-score.js.map