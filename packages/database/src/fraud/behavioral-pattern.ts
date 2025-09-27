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

import { supabase } from '../client/supabase';
import type { 
  BehavioralPattern,
  PatternType,
  PatternData,
  DetectionRule,
  BehavioralPatternRequest,
  BehavioralPatternResponse,
  RiskLevel
} from '@vocilia/types';

export class BehavioralPatternModel {
  private static readonly TABLE_NAME = 'behavioral_patterns';
  
  /**
   * Create a new behavioral pattern record
   */
  static async create(data: {
    phone_hash: string;
    pattern_type: PatternType;
    risk_score: number; // 0-100
    violation_count: number;
    pattern_data: PatternData;
    detection_rules: DetectionRule[];
    is_resolved?: boolean;
    resolution_notes?: string;
  }): Promise<BehavioralPattern> {
    const behavioralPattern = {
      phone_hash: data.phone_hash,
      pattern_type: data.pattern_type,
      risk_score: data.risk_score,
      violation_count: data.violation_count,
      pattern_data: data.pattern_data,
      detection_rules: data.detection_rules,
      first_detected: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      is_resolved: data.is_resolved || false,
      resolution_notes: data.resolution_notes || null
    };

    const { data: result, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(behavioralPattern)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create behavioral pattern: ${error.message}`);
    }

    return result;
  }

  /**
   * Get behavioral patterns by phone hash
   */
  static async getByPhoneHash(phoneHash: string, options?: {
    patternTypes?: PatternType[];
    timeWindow?: string; // '30m', '24h', '7d', '30d'
    includeResolved?: boolean;
  }): Promise<BehavioralPattern[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash);

    if (options?.patternTypes && options.patternTypes.length > 0) {
      query = query.in('pattern_type', options.patternTypes);
    }

    if (!options?.includeResolved) {
      query = query.eq('is_resolved', false);
    }

    if (options?.timeWindow) {
      const timeWindowMs = this.parseTimeWindow(options.timeWindow);
      const since = new Date(Date.now() - timeWindowMs).toISOString();
      query = query.gte('last_updated', since);
    }

    query = query.order('last_updated', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get behavioral patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update existing pattern (increment violation count, update data)
   */
  static async updatePattern(id: string, updates: {
    risk_score?: number;
    violation_count?: number;
    pattern_data?: Partial<PatternData>;
    detection_rules?: DetectionRule[];
    is_resolved?: boolean;
    resolution_notes?: string;
  }): Promise<BehavioralPattern> {
    const updateData: any = {
      last_updated: new Date().toISOString()
    };

    if (updates.risk_score !== undefined) {
      updateData.risk_score = updates.risk_score;
    }

    if (updates.violation_count !== undefined) {
      updateData.violation_count = updates.violation_count;
    }

    if (updates.pattern_data) {
      // Merge with existing pattern data
      const { data: current } = await supabase
        .from(this.TABLE_NAME)
        .select('pattern_data')
        .eq('id', id)
        .single();

      if (current?.pattern_data) {
        updateData.pattern_data = { ...current.pattern_data, ...updates.pattern_data };
      } else {
        updateData.pattern_data = updates.pattern_data;
      }
    }

    if (updates.detection_rules) {
      updateData.detection_rules = updates.detection_rules;
    }

    if (updates.is_resolved !== undefined) {
      updateData.is_resolved = updates.is_resolved;
    }

    if (updates.resolution_notes) {
      updateData.resolution_notes = updates.resolution_notes;
    }

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update behavioral pattern: ${error.message}`);
    }

    return data;
  }

  /**
   * Get patterns by risk level
   */
  static async getByRiskLevel(options: {
    minRiskScore: number;
    maxRiskScore?: number;
    patternTypes?: PatternType[];
    limit?: number;
    offset?: number;
    includeResolved?: boolean;
  }): Promise<{ patterns: BehavioralPattern[]; totalCount: number }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .gte('risk_score', options.minRiskScore);

    if (options.maxRiskScore !== undefined) {
      query = query.lte('risk_score', options.maxRiskScore);
    }

    if (options.patternTypes && options.patternTypes.length > 0) {
      query = query.in('pattern_type', options.patternTypes);
    }

    if (!options.includeResolved) {
      query = query.eq('is_resolved', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    query = query.order('risk_score', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get behavioral patterns by risk level: ${error.message}`);
    }

    return {
      patterns: data || [],
      totalCount: count || 0
    };
  }

  /**
   * Get call frequency patterns for phone hash
   */
  static async getCallFrequencyPatterns(phoneHash: string, timeWindowMinutes: number = 30): Promise<BehavioralPattern[]> {
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('pattern_type', 'call_frequency')
      .gte('last_updated', since)
      .order('last_updated', { ascending: false });

    if (error) {
      throw new Error(`Failed to get call frequency patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get similarity patterns (detecting bot-like behavior)
   */
  static async getSimilarityPatterns(phoneHash: string): Promise<BehavioralPattern[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('pattern_type', 'similarity_pattern')
      .eq('is_resolved', false)
      .order('risk_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get similarity patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get location patterns (impossible travel detection)
   */
  static async getLocationPatterns(phoneHash: string): Promise<BehavioralPattern[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('pattern_type', 'location_pattern')
      .eq('is_resolved', false)
      .order('last_updated', { ascending: false });

    if (error) {
      throw new Error(`Failed to get location patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get time patterns (unusual calling hours)
   */
  static async getTimePatterns(phoneHash: string): Promise<BehavioralPattern[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('phone_hash', phoneHash)
      .eq('pattern_type', 'time_pattern')
      .eq('is_resolved', false)
      .order('risk_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get time patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get patterns requiring immediate attention (high risk, unresolved)
   */
  static async getCriticalPatterns(options?: {
    riskThreshold?: number;
    limit?: number;
  }): Promise<BehavioralPattern[]> {
    const riskThreshold = options?.riskThreshold || 80;

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('risk_score', riskThreshold)
      .eq('is_resolved', false);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('risk_score', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get critical patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get pattern statistics
   */
  static async getStatistics(options: {
    startDate?: string;
    endDate?: string;
    patternType?: PatternType;
  } = {}): Promise<{
    totalPatterns: number;
    unresolvedPatterns: number;
    patternTypeDistribution: Record<PatternType, number>;
    riskLevelDistribution: {
      low: number; // 0-30
      medium: number; // 31-60
      high: number; // 61-80
      critical: number; // 81-100
    };
    averageRiskScore: number;
    averageViolationCount: number;
    resolutionRate: number;
    topRiskFactors: Array<{
      factor: string;
      count: number;
    }>;
  }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('pattern_type, risk_score, violation_count, is_resolved, detection_rules');

    if (options.startDate) {
      query = query.gte('first_detected', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('first_detected', options.endDate);
    }

    if (options.patternType) {
      query = query.eq('pattern_type', options.patternType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get behavioral pattern statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalPatterns: 0,
        unresolvedPatterns: 0,
        patternTypeDistribution: { call_frequency: 0, time_pattern: 0, location_pattern: 0, similarity_pattern: 0 },
        riskLevelDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
        averageRiskScore: 0,
        averageViolationCount: 0,
        resolutionRate: 0,
        topRiskFactors: []
      };
    }

    const totalPatterns = data.length;
    const unresolvedPatterns = data.filter(p => !p.is_resolved).length;

    // Pattern type distribution
    const patternTypeDistribution: Record<PatternType, number> = { 
      call_frequency: 0, 
      time_pattern: 0, 
      location_pattern: 0, 
      similarity_pattern: 0 
    };
    data.forEach(pattern => {
      patternTypeDistribution[pattern.pattern_type as PatternType]++;
    });

    // Risk level distribution
    const riskLevelDistribution = {
      low: data.filter(p => p.risk_score <= 30).length,
      medium: data.filter(p => p.risk_score > 30 && p.risk_score <= 60).length,
      high: data.filter(p => p.risk_score > 60 && p.risk_score <= 80).length,
      critical: data.filter(p => p.risk_score > 80).length
    };

    const averageRiskScore = data.reduce((sum, p) => sum + p.risk_score, 0) / totalPatterns;
    const averageViolationCount = data.reduce((sum, p) => sum + p.violation_count, 0) / totalPatterns;
    const resolutionRate = (totalPatterns - unresolvedPatterns) / totalPatterns * 100;

    // Top risk factors from detection rules
    const riskFactorCounts: Record<string, number> = {};
    data.forEach(pattern => {
      if (pattern.detection_rules && Array.isArray(pattern.detection_rules)) {
        pattern.detection_rules.forEach((rule: DetectionRule) => {
          if (rule.triggered) {
            riskFactorCounts[rule.rule_name] = (riskFactorCounts[rule.rule_name] || 0) + 1;
          }
        });
      }
    });

    const topRiskFactors = Object.entries(riskFactorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([factor, count]) => ({ factor, count }));

    return {
      totalPatterns,
      unresolvedPatterns,
      patternTypeDistribution,
      riskLevelDistribution,
      averageRiskScore,
      averageViolationCount,
      resolutionRate,
      topRiskFactors
    };
  }

  /**
   * Generate behavioral pattern response
   */
  static generateResponse(phoneHash: string, patterns: BehavioralPattern[], timeWindow: string = '24h'): BehavioralPatternResponse {
    const overallRiskLevel = this.calculateOverallRiskLevel(patterns);
    const totalViolations = patterns.reduce((sum, p) => sum + p.violation_count, 0);
    const highestRiskScore = Math.max(...patterns.map(p => p.risk_score), 0);
    const patternTypesDetected = [...new Set(patterns.map(p => p.pattern_type))];
    const recommendation = this.generateRecommendation(overallRiskLevel, highestRiskScore, totalViolations);

    return {
      phone_hash: phoneHash,
      patterns,
      overall_risk_level: overallRiskLevel,
      time_window_analyzed: timeWindow,
      analysis_summary: {
        total_violations: totalViolations,
        highest_risk_score: highestRiskScore,
        pattern_types_detected: patternTypesDetected,
        recommendation
      }
    };
  }

  /**
   * Resolve pattern (mark as resolved with notes)
   */
  static async resolvePattern(id: string, resolutionNotes: string): Promise<BehavioralPattern> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update({
        is_resolved: true,
        resolution_notes: resolutionNotes,
        last_updated: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resolve behavioral pattern: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete old resolved patterns
   */
  static async deleteOldResolved(daysOld: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('is_resolved', true)
      .lt('last_updated', cutoffDate)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old resolved patterns: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get bulk behavioral patterns for multiple phone hashes
   */
  static async getBulkPatterns(phoneHashes: string[], options?: {
    includeResolved?: boolean;
    timeWindow?: string;
  }): Promise<Map<string, BehavioralPattern[]>> {
    if (phoneHashes.length === 0) {
      return new Map();
    }

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .in('phone_hash', phoneHashes);

    if (!options?.includeResolved) {
      query = query.eq('is_resolved', false);
    }

    if (options?.timeWindow) {
      const timeWindowMs = this.parseTimeWindow(options.timeWindow);
      const since = new Date(Date.now() - timeWindowMs).toISOString();
      query = query.gte('last_updated', since);
    }

    query = query.order('phone_hash, risk_score', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get bulk behavioral patterns: ${error.message}`);
    }

    // Group patterns by phone hash
    const patternsMap = new Map<string, BehavioralPattern[]>();
    data?.forEach(pattern => {
      const existing = patternsMap.get(pattern.phone_hash) || [];
      existing.push(pattern);
      patternsMap.set(pattern.phone_hash, existing);
    });

    return patternsMap;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private static parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([mhd])$/);
    if (!match) {
      throw new Error(`Invalid time window format: ${timeWindow}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes to milliseconds
      case 'h': return value * 60 * 60 * 1000; // hours to milliseconds
      case 'd': return value * 24 * 60 * 60 * 1000; // days to milliseconds
      default: throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  private static calculateOverallRiskLevel(patterns: BehavioralPattern[]): RiskLevel {
    if (patterns.length === 0) return 'low';

    const maxRiskScore = Math.max(...patterns.map(p => p.risk_score));
    const avgRiskScore = patterns.reduce((sum, p) => sum + p.risk_score, 0) / patterns.length;
    const totalViolations = patterns.reduce((sum, p) => sum + p.violation_count, 0);

    // Consider both maximum risk and overall pattern severity
    if (maxRiskScore >= 85 || (avgRiskScore >= 70 && totalViolations >= 5)) return 'critical';
    if (maxRiskScore >= 70 || (avgRiskScore >= 50 && totalViolations >= 3)) return 'high';
    if (maxRiskScore >= 40 || avgRiskScore >= 30) return 'medium';
    return 'low';
  }

  private static generateRecommendation(riskLevel: RiskLevel, highestRiskScore: number, totalViolations: number): string {
    switch (riskLevel) {
      case 'critical':
        return 'Immediate action required - block phone number and investigate related activity';
      case 'high':
        return 'High risk detected - implement additional verification and monitoring';
      case 'medium':
        return 'Monitor closely for additional suspicious patterns';
      case 'low':
        return 'Continue normal monitoring';
      default:
        return 'Review patterns and adjust thresholds if necessary';
    }
  }
}