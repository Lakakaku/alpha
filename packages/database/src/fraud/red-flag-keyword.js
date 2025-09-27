"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedFlagKeywordModel = void 0;
const supabase_1 = require("../client/supabase");
class RedFlagKeywordModel {
    static TABLE_NAME = 'red_flag_keywords';
    // Default Swedish keywords with severity levels
    static DEFAULT_KEYWORDS = [
        // Nonsensical (impossible things in Swedish)
        { keyword: 'flygande elefanter', category: 'nonsensical', severity_level: 8, language_code: 'sv', detection_pattern: '\\b(flygande\\s+elefanter|flying\\s+elephants)\\b' },
        { keyword: 'teleportering', category: 'nonsensical', severity_level: 7, language_code: 'sv', detection_pattern: '\\bteleporter(ing|ade)\\b' },
        { keyword: 'tidsresor', category: 'nonsensical', severity_level: 9, language_code: 'sv', detection_pattern: '\\btidsresa(r|de|t)?\\b' },
        { keyword: 'magiska krafter', category: 'nonsensical', severity_level: 6, language_code: 'sv', detection_pattern: '\\bmagiska?\\s+krafter\\b' },
        { keyword: 'levitating', category: 'nonsensical', severity_level: 7, language_code: 'en', detection_pattern: '\\blevitat(ing|ed)\\b' },
        // Threats
        { keyword: 'bomb', category: 'threats', severity_level: 10, language_code: 'sv', detection_pattern: '\\bbomb(er|en|ade)?\\b' },
        { keyword: 'hot', category: 'threats', severity_level: 8, language_code: 'sv', detection_pattern: '\\bhot(ar|ade|else)?\\b' },
        { keyword: 'våld', category: 'threats', severity_level: 9, language_code: 'sv', detection_pattern: '\\bvåld(sam|samma|t)?\\b' },
        { keyword: 'skada', category: 'threats', severity_level: 7, language_code: 'sv', detection_pattern: '\\bskada(r|de|des)?\\b' },
        { keyword: 'döda', category: 'threats', severity_level: 10, language_code: 'sv', detection_pattern: '\\bdöd(a|ar|ade)\\b' },
        // Profanity (common Swedish)
        { keyword: 'helvete', category: 'profanity', severity_level: 5, language_code: 'sv', detection_pattern: '\\bhelvet(e|es)\\b' },
        { keyword: 'fan', category: 'profanity', severity_level: 4, language_code: 'sv', detection_pattern: '\\bfan(en)?\\b' },
        { keyword: 'skit', category: 'profanity', severity_level: 3, language_code: 'sv', detection_pattern: '\\bskit(en|ig|igt)?\\b' },
        // Impossible claims
        { keyword: 'gratis allt', category: 'impossible', severity_level: 8, language_code: 'sv', detection_pattern: '\\bgratis\\s+allt\\b' },
        { keyword: 'miljoner kronor', category: 'impossible', severity_level: 9, language_code: 'sv', detection_pattern: '\\bmiljoner?\\s+kronor\\b' },
        { keyword: 'omedelbar betalning', category: 'impossible', severity_level: 7, language_code: 'sv', detection_pattern: '\\bomedelbar(t)?\\s+betalnin(g|gar)\\b' }
    ];
    /**
     * Initialize default keywords (run once on system setup)
     */
    static async initializeDefaultKeywords() {
        for (const keyword of this.DEFAULT_KEYWORDS) {
            try {
                await this.create({
                    ...keyword,
                    created_by: 'system'
                });
            }
            catch (error) {
                // Skip if keyword already exists
                if (!error.message.includes('duplicate key')) {
                    console.warn(`Failed to create default keyword "${keyword.keyword}":`, error);
                }
            }
        }
    }
    /**
     * Create a new red flag keyword
     */
    static async create(data) {
        // Validate severity level
        if (data.severity_level < 1 || data.severity_level > 10) {
            throw new Error('Severity level must be between 1 and 10');
        }
        // Validate category
        const validCategories = ['profanity', 'threats', 'nonsensical', 'impossible'];
        if (!validCategories.includes(data.category)) {
            throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
        }
        // Validate detection pattern if provided
        if (data.detection_pattern) {
            try {
                new RegExp(data.detection_pattern);
            }
            catch (error) {
                throw new Error('Invalid regex pattern');
            }
        }
        const keywordData = {
            keyword: data.keyword.trim(),
            category: data.category,
            severity_level: data.severity_level,
            language_code: data.language_code || 'sv', // Default to Swedish
            detection_pattern: data.detection_pattern || `\\b${data.keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            created_by: data.created_by,
            is_active: true
        };
        const { data: result, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .insert(keywordData)
            .select()
            .single();
        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('Keyword already exists');
            }
            throw new Error(`Failed to create red flag keyword: ${error.message}`);
        }
        return result;
    }
    /**
     * Get all active keywords
     */
    static async getActive(options) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('is_active', true);
        if (options?.language) {
            query = query.eq('language_code', options.language);
        }
        if (options?.category) {
            query = query.eq('category', options.category);
        }
        // Set ordering
        const sortBy = options?.sortBy || 'severity';
        switch (sortBy) {
            case 'severity':
                query = query.order('severity_level', { ascending: false });
                break;
            case 'keyword':
                query = query.order('keyword', { ascending: true });
                break;
            case 'created_at':
                query = query.order('created_at', { ascending: false });
                break;
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to get active keywords: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Get keywords by category
     */
    static async getByCategory(category, language) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('category', category)
            .eq('is_active', true);
        if (language) {
            query = query.eq('language_code', language);
        }
        query = query.order('severity_level', { ascending: false });
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to get keywords by category: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Search content for red flag keywords
     */
    static async detectKeywords(content, language = 'sv') {
        const keywords = await this.getActive({ language });
        const keywordsFound = [];
        let totalSeverityScore = 0;
        const categoryDistribution = {
            profanity: 0,
            threats: 0,
            nonsensical: 0,
            impossible: 0
        };
        const contentLower = content.toLowerCase();
        for (const keyword of keywords) {
            try {
                const regex = new RegExp(keyword.detection_pattern, 'gi');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const contextStart = Math.max(0, match.index - 50);
                    const contextEnd = Math.min(content.length, match.index + match[0].length + 50);
                    const contextSnippet = content.substring(contextStart, contextEnd);
                    keywordsFound.push({
                        keyword: keyword.keyword,
                        category: keyword.category,
                        severity_level: keyword.severity_level,
                        match_position: match.index,
                        match_text: match[0],
                        detection_pattern: keyword.detection_pattern,
                        context_snippet: contextSnippet
                    });
                    totalSeverityScore += keyword.severity_level;
                    categoryDistribution[keyword.category]++;
                }
            }
            catch (regexError) {
                console.warn(`Invalid regex pattern for keyword "${keyword.keyword}":`, regexError);
            }
        }
        // Create detection result
        const detectionResult = {
            id: crypto.randomUUID(),
            phone_hash: 'temp_hash', // Will be set by caller
            feedback_content: content,
            keywords_found: keywordsFound,
            total_severity_score: totalSeverityScore,
            category_distribution: categoryDistribution,
            language_analyzed: language,
            created_at: new Date().toISOString()
        };
        return detectionResult;
    }
    /**
     * Update keyword (activate/deactivate, modify severity)
     */
    static async update(id, updates) {
        if (updates.severity_level !== undefined && (updates.severity_level < 1 || updates.severity_level > 10)) {
            throw new Error('Severity level must be between 1 and 10');
        }
        if (updates.detection_pattern) {
            try {
                new RegExp(updates.detection_pattern);
            }
            catch (error) {
                throw new Error('Invalid regex pattern');
            }
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        if (updates.severity_level !== undefined) {
            updateData.severity_level = updates.severity_level;
        }
        if (updates.detection_pattern) {
            updateData.detection_pattern = updates.detection_pattern;
        }
        if (updates.is_active !== undefined) {
            updateData.is_active = updates.is_active;
        }
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update keyword: ${error.message}`);
        }
        return data;
    }
    /**
     * Deactivate keyword (soft delete)
     */
    static async deactivate(id) {
        return this.update(id, { is_active: false });
    }
    /**
     * Get keyword statistics
     */
    static async getStatistics(options = {}) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('keyword, category, severity_level, language_code, is_active, created_at');
        if (options.startDate) {
            query = query.gte('created_at', options.startDate);
        }
        if (options.endDate) {
            query = query.lte('created_at', options.endDate);
        }
        if (options.language) {
            query = query.eq('language_code', options.language);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to get keyword statistics: ${error.message}`);
        }
        if (!data || data.length === 0) {
            return {
                totalKeywords: 0,
                activeKeywords: 0,
                categoryDistribution: { profanity: 0, threats: 0, nonsensical: 0, impossible: 0 },
                severityDistribution: {},
                languageDistribution: {},
                averageSeverity: 0,
                mostUsedKeywords: []
            };
        }
        const totalKeywords = data.length;
        const activeKeywords = data.filter(k => k.is_active).length;
        // Category distribution
        const categoryDistribution = { profanity: 0, threats: 0, nonsensical: 0, impossible: 0 };
        data.forEach(keyword => {
            categoryDistribution[keyword.category]++;
        });
        // Severity distribution
        const severityDistribution = {};
        data.forEach(keyword => {
            const severity = `Level ${keyword.severity_level}`;
            severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;
        });
        // Language distribution
        const languageDistribution = {};
        data.forEach(keyword => {
            languageDistribution[keyword.language_code] = (languageDistribution[keyword.language_code] || 0) + 1;
        });
        // Average severity
        const averageSeverity = data.reduce((sum, keyword) => sum + keyword.severity_level, 0) / totalKeywords;
        // Most used keywords (placeholder - would need actual usage tracking)
        const mostUsedKeywords = data
            .filter(k => k.is_active)
            .sort((a, b) => b.severity_level - a.severity_level)
            .slice(0, 10)
            .map(keyword => ({
            keyword: keyword.keyword,
            category: keyword.category,
            severity_level: keyword.severity_level,
            usage_count: 0 // Placeholder - would need actual usage tracking
        }));
        return {
            totalKeywords,
            activeKeywords,
            categoryDistribution,
            severityDistribution,
            languageDistribution,
            averageSeverity,
            mostUsedKeywords
        };
    }
    /**
     * Bulk create keywords
     */
    static async bulkCreate(keywords, createdBy) {
        let created = 0;
        const errors = [];
        for (const keywordData of keywords) {
            try {
                await this.create({
                    ...keywordData,
                    created_by: createdBy
                });
                created++;
            }
            catch (error) {
                errors.push({
                    keyword: keywordData.keyword,
                    error: error.message
                });
            }
        }
        return { created, errors };
    }
    /**
     * Search keywords by text
     */
    static async searchKeywords(searchQuery, options) {
        let query = supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .ilike('keyword', `%${searchQuery}%`);
        if (options?.category) {
            query = query.eq('category', options.category);
        }
        if (options?.language) {
            query = query.eq('language_code', options.language);
        }
        if (options?.activeOnly !== false) { // Default to true
            query = query.eq('is_active', true);
        }
        query = query.order('severity_level', { ascending: false });
        const { data, error } = await query;
        if (error) {
            throw new Error(`Failed to search keywords: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Get keyword by ID
     */
    static async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from(this.TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                return null;
            }
            throw new Error(`Failed to get keyword: ${error.message}`);
        }
        return data;
    }
    /**
     * Validate keyword request data
     */
    static validateKeywordRequest(data) {
        const errors = [];
        if (!data.keyword || data.keyword.trim().length === 0) {
            errors.push('Keyword is required');
        }
        else if (data.keyword.length > 100) {
            errors.push('Keyword must be 100 characters or less');
        }
        const validCategories = ['profanity', 'threats', 'nonsensical', 'impossible'];
        if (!data.category || !validCategories.includes(data.category)) {
            errors.push(`Category must be one of: ${validCategories.join(', ')}`);
        }
        if (data.severity_level === undefined || data.severity_level < 1 || data.severity_level > 10) {
            errors.push('Severity level must be between 1 and 10');
        }
        if (data.detection_pattern) {
            try {
                new RegExp(data.detection_pattern);
            }
            catch {
                errors.push('Detection pattern must be a valid regex');
            }
        }
        const validLanguages = ['sv', 'en', 'no', 'da'];
        if (data.language_code && !validLanguages.includes(data.language_code)) {
            errors.push(`Language code must be one of: ${validLanguages.join(', ')}`);
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Calculate fraud score contribution from keywords
     * Returns score 0-20 (20% weight in overall fraud score)
     */
    static calculateFraudScoreContribution(detectionResult) {
        if (detectionResult.keywords_found.length === 0) {
            return 0;
        }
        // Base score from severity levels
        const baseScore = Math.min(detectionResult.total_severity_score, 50); // Cap at 50
        // Bonus for multiple categories (indicates more sophisticated attack)
        const categoriesFound = Object.values(detectionResult.category_distribution).filter(count => count > 0).length;
        const categoryBonus = Math.max(0, (categoriesFound - 1) * 2); // 2 points per additional category
        // Bonus for high-severity keywords
        const highSeverityKeywords = detectionResult.keywords_found.filter(k => k.severity_level >= 8).length;
        const severityBonus = highSeverityKeywords * 3; // 3 points per high-severity keyword
        // Calculate final score (0-20 scale)
        const totalScore = baseScore + categoryBonus + severityBonus;
        return Math.min(Math.round((totalScore / 50) * 20), 20); // Scale to 0-20
    }
}
exports.RedFlagKeywordModel = RedFlagKeywordModel;
//# sourceMappingURL=red-flag-keyword.js.map