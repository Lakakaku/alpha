/**
 * Behavioral Pattern Analysis Service
 * Task: T041 - Behavioral pattern analysis service in apps/backend/src/services/fraud/behavioralPatternService.ts
 * 
 * Analyzes customer call patterns to detect suspicious behavioral anomalies.
 * Tracks call frequency, timing, location patterns, and similarity analysis.
 */

import { BehavioralPatternModel } from '../../../../../packages/database/src/fraud/behavioral-pattern';
import {
  BehavioralAnalysisRequest,
  BehavioralAnalysisResult,
  BehavioralPattern,
  PatternType,
  CallFrequencyPattern,
  TimePattern,
  LocationPattern,
  SimilarityPattern
} from '../../../../../packages/types/src/fraud';

export class BehavioralPatternService {
  private readonly CALL_FREQUENCY_THRESHOLD = 5; // Calls per 30 minutes
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% content similarity
  private readonly TIME_WINDOW_MINUTES = 30;
  private readonly LOCATION_RADIUS_KM = 5;

  /**
   * Analyze behavioral patterns for a phone number
   */
  async analyzeBehavioralPatterns(request: BehavioralAnalysisRequest): Promise<BehavioralAnalysisResult> {
    try {
      const startTime = Date.now();

      // Run all pattern analyses in parallel
      const [
        callFrequencyPattern,
        timePattern,
        locationPattern,
        similarityPattern
      ] = await Promise.all([
        this.analyzeCallFrequency(request),
        this.analyzeTimePatterns(request),
        this.analyzeLocationPatterns(request),
        this.analyzeSimilarityPatterns(request)
      ]);

      // Store patterns in database
      const patterns: BehavioralPattern[] = [];
      
      if (callFrequencyPattern) {
        const dbPattern = await BehavioralPatternModel.create({
          phone_hash: request.phone_hash,
          pattern_type: 'call_frequency',
          risk_score: callFrequencyPattern.risk_score,
          pattern_data: callFrequencyPattern,
          detection_confidence: callFrequencyPattern.confidence,
          violation_count: callFrequencyPattern.violations.length,
          severity_level: this.calculateSeverity(callFrequencyPattern.risk_score),
          time_window_start: request.time_window_start,
          time_window_end: request.time_window_end
        });
        patterns.push(dbPattern);
      }

      if (timePattern) {
        const dbPattern = await BehavioralPatternModel.create({
          phone_hash: request.phone_hash,
          pattern_type: 'time_pattern',
          risk_score: timePattern.risk_score,
          pattern_data: timePattern,
          detection_confidence: timePattern.confidence,
          violation_count: timePattern.violations.length,
          severity_level: this.calculateSeverity(timePattern.risk_score),
          time_window_start: request.time_window_start,
          time_window_end: request.time_window_end
        });
        patterns.push(dbPattern);
      }

      if (locationPattern) {
        const dbPattern = await BehavioralPatternModel.create({
          phone_hash: request.phone_hash,
          pattern_type: 'location_pattern',
          risk_score: locationPattern.risk_score,
          pattern_data: locationPattern,
          detection_confidence: locationPattern.confidence,
          violation_count: locationPattern.violations.length,
          severity_level: this.calculateSeverity(locationPattern.risk_score),
          time_window_start: request.time_window_start,
          time_window_end: request.time_window_end
        });
        patterns.push(dbPattern);
      }

      if (similarityPattern) {
        const dbPattern = await BehavioralPatternModel.create({
          phone_hash: request.phone_hash,
          pattern_type: 'similarity_pattern',
          risk_score: similarityPattern.risk_score,
          pattern_data: similarityPattern,
          detection_confidence: similarityPattern.confidence,
          violation_count: similarityPattern.violations.length,
          severity_level: this.calculateSeverity(similarityPattern.risk_score),
          time_window_start: request.time_window_start,
          time_window_end: request.time_window_end
        });
        patterns.push(dbPattern);
      }

      // Calculate composite behavioral score
      const compositeScore = this.calculateCompositeBehavioralScore([
        callFrequencyPattern,
        timePattern, 
        locationPattern,
        similarityPattern
      ].filter(Boolean));

      const processingTime = Date.now() - startTime;

      return {
        phone_hash: request.phone_hash,
        analysis_period: {
          start: request.time_window_start,
          end: request.time_window_end
        },
        patterns_detected: patterns,
        call_frequency_pattern: callFrequencyPattern,
        time_pattern: timePattern,
        location_pattern: locationPattern,
        similarity_pattern: similarityPattern,
        composite_behavioral_score: compositeScore,
        overall_risk_level: this.determineRiskLevel(compositeScore),
        total_violations: patterns.reduce((sum, p) => sum + p.violation_count, 0),
        processing_time_ms: processingTime,
        analyzed_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Behavioral pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze call frequency patterns
   */
  private async analyzeCallFrequency(request: BehavioralAnalysisRequest): Promise<CallFrequencyPattern | null> {
    try {
      const calls = request.call_history || [];
      if (calls.length < 2) return null;

      // Group calls by time windows
      const timeWindows = this.groupCallsByTimeWindow(calls, this.TIME_WINDOW_MINUTES);
      const violations: Array<{
        window_start: string;
        window_end: string;
        call_count: number;
        threshold_exceeded: number;
      }> = [];

      let totalViolations = 0;
      let maxCallsInWindow = 0;

      for (const window of timeWindows) {
        if (window.calls.length > this.CALL_FREQUENCY_THRESHOLD) {
          const thresholdExceeded = window.calls.length - this.CALL_FREQUENCY_THRESHOLD;
          totalViolations += thresholdExceeded;
          maxCallsInWindow = Math.max(maxCallsInWindow, window.calls.length);

          violations.push({
            window_start: window.start,
            window_end: window.end,
            call_count: window.calls.length,
            threshold_exceeded: thresholdExceeded
          });
        }
      }

      if (violations.length === 0) return null;

      // Calculate risk score (0-30 points for behavioral patterns)
      const baseScore = Math.min(20, totalViolations * 2);
      const intensityBonus = Math.min(10, (maxCallsInWindow - this.CALL_FREQUENCY_THRESHOLD) * 1.5);
      const riskScore = Math.min(30, baseScore + intensityBonus);

      return {
        pattern_type: 'call_frequency',
        risk_score: Math.round(riskScore * 100) / 100,
        confidence: 0.9, // High confidence for frequency analysis
        violations,
        analysis_summary: {
          total_calls: calls.length,
          time_windows_analyzed: timeWindows.length,
          violations_found: violations.length,
          max_calls_in_window: maxCallsInWindow,
          threshold_used: this.CALL_FREQUENCY_THRESHOLD,
          window_size_minutes: this.TIME_WINDOW_MINUTES
        }
      };
    } catch (error) {
      console.error(`Call frequency analysis error: ${error}`);
      return null;
    }
  }

  /**
   * Analyze time-based patterns
   */
  private async analyzeTimePatterns(request: BehavioralAnalysisRequest): Promise<TimePattern | null> {
    try {
      const calls = request.call_history || [];
      if (calls.length < 3) return null;

      // Analyze unusual timing patterns
      const hourCounts: Record<number, number> = {};
      const dayOfWeekCounts: Record<number, number> = {};
      const violations: Array<{
        pattern_type: 'unusual_hours' | 'weekend_clustering' | 'rapid_succession';
        description: string;
        severity: number;
        call_times: string[];
      }> = [];

      // Count calls by hour and day of week
      for (const call of calls) {
        const callTime = new Date(call.timestamp);
        const hour = callTime.getHours();
        const dayOfWeek = callTime.getDay();
        
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayOfWeekCounts[dayOfWeek] = (dayOfWeekCounts[dayOfWeek] || 0) + 1;
      }

      // Detect unusual hours (late night/early morning)
      const unusualHours = [0, 1, 2, 3, 4, 5, 22, 23];
      const unusualHourCalls = unusualHours.reduce((sum, hour) => sum + (hourCounts[hour] || 0), 0);
      
      if (unusualHourCalls > 2) {
        violations.push({
          pattern_type: 'unusual_hours',
          description: `${unusualHourCalls} calls during unusual hours (22:00-06:00)`,
          severity: Math.min(10, unusualHourCalls * 2),
          call_times: calls
            .filter(call => unusualHours.includes(new Date(call.timestamp).getHours()))
            .map(call => call.timestamp)
        });
      }

      // Detect weekend clustering
      const weekendCalls = (dayOfWeekCounts[0] || 0) + (dayOfWeekCounts[6] || 0);
      const weekdayCalls = calls.length - weekendCalls;
      
      if (weekendCalls > weekdayCalls && weekendCalls > 3) {
        violations.push({
          pattern_type: 'weekend_clustering',
          description: `${weekendCalls} weekend calls vs ${weekdayCalls} weekday calls`,
          severity: Math.min(8, weekendCalls - weekdayCalls),
          call_times: calls
            .filter(call => [0, 6].includes(new Date(call.timestamp).getDay()))
            .map(call => call.timestamp)
        });
      }

      // Detect rapid succession calls
      const sortedCalls = calls.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const rapidCalls: string[] = [];
      
      for (let i = 1; i < sortedCalls.length; i++) {
        const timeDiff = new Date(sortedCalls[i].timestamp).getTime() - new Date(sortedCalls[i - 1].timestamp).getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        
        if (minutesDiff < 2) { // Less than 2 minutes apart
          rapidCalls.push(sortedCalls[i - 1].timestamp, sortedCalls[i].timestamp);
        }
      }
      
      if (rapidCalls.length > 2) {
        violations.push({
          pattern_type: 'rapid_succession',
          description: `${rapidCalls.length / 2} pairs of calls within 2 minutes`,
          severity: Math.min(10, rapidCalls.length),
          call_times: [...new Set(rapidCalls)]
        });
      }

      if (violations.length === 0) return null;

      // Calculate risk score
      const totalSeverity = violations.reduce((sum, v) => sum + v.severity, 0);
      const riskScore = Math.min(30, totalSeverity);

      return {
        pattern_type: 'time_pattern',
        risk_score: Math.round(riskScore * 100) / 100,
        confidence: 0.8,
        violations,
        analysis_summary: {
          total_calls: calls.length,
          unusual_hour_calls: unusualHourCalls,
          weekend_calls: weekendCalls,
          weekday_calls: weekdayCalls,
          rapid_succession_pairs: rapidCalls.length / 2
        }
      };
    } catch (error) {
      console.error(`Time pattern analysis error: ${error}`);
      return null;
    }
  }

  /**
   * Analyze location-based patterns
   */
  private async analyzeLocationPatterns(request: BehavioralAnalysisRequest): Promise<LocationPattern | null> {
    try {
      const calls = request.call_history || [];
      const locationsWithCalls = calls.filter(call => call.location);
      
      if (locationsWithCalls.length < 2) return null;

      const violations: Array<{
        pattern_type: 'impossible_travel' | 'location_spoofing' | 'geographic_clustering';
        description: string;
        severity: number;
        locations: Array<{ lat: number; lng: number; timestamp: string }>;
      }> = [];

      // Analyze impossible travel patterns
      const sortedLocationCalls = locationsWithCalls
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (let i = 1; i < sortedLocationCalls.length; i++) {
        const prev = sortedLocationCalls[i - 1];
        const curr = sortedLocationCalls[i];
        
        if (!prev.location || !curr.location) continue;

        const distance = this.calculateDistance(
          prev.location.latitude,
          prev.location.longitude,
          curr.location.latitude,
          curr.location.longitude
        );

        const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Check for impossible travel (>500 km/h sustained speed)
        if (distance > 0 && hoursDiff > 0) {
          const speedKmh = distance / hoursDiff;
          
          if (speedKmh > 500) {
            violations.push({
              pattern_type: 'impossible_travel',
              description: `Travel of ${distance.toFixed(1)}km in ${hoursDiff.toFixed(1)}h (${speedKmh.toFixed(0)}km/h)`,
              severity: Math.min(10, speedKmh / 100),
              locations: [
                { lat: prev.location.latitude, lng: prev.location.longitude, timestamp: prev.timestamp },
                { lat: curr.location.latitude, lng: curr.location.longitude, timestamp: curr.timestamp }
              ]
            });
          }
        }
      }

      // Analyze geographic clustering
      const uniqueLocations = this.clusterLocationsByDistance(locationsWithCalls, this.LOCATION_RADIUS_KM);
      if (uniqueLocations.length === 1 && locationsWithCalls.length > 5) {
        violations.push({
          pattern_type: 'geographic_clustering',
          description: `All ${locationsWithCalls.length} calls from same ${this.LOCATION_RADIUS_KM}km area`,
          severity: Math.min(8, locationsWithCalls.length - 5),
          locations: locationsWithCalls.map(call => ({
            lat: call.location!.latitude,
            lng: call.location!.longitude,
            timestamp: call.timestamp
          }))
        });
      }

      if (violations.length === 0) return null;

      // Calculate risk score
      const totalSeverity = violations.reduce((sum, v) => sum + v.severity, 0);
      const riskScore = Math.min(30, totalSeverity);

      return {
        pattern_type: 'location_pattern',
        risk_score: Math.round(riskScore * 100) / 100,
        confidence: 0.7, // Lower confidence due to location data accuracy issues
        violations,
        analysis_summary: {
          total_calls: calls.length,
          calls_with_location: locationsWithCalls.length,
          unique_locations: uniqueLocations.length,
          impossible_travel_violations: violations.filter(v => v.pattern_type === 'impossible_travel').length
        }
      };
    } catch (error) {
      console.error(`Location pattern analysis error: ${error}`);
      return null;
    }
  }

  /**
   * Analyze content similarity patterns
   */
  private async analyzeSimilarityPatterns(request: BehavioralAnalysisRequest): Promise<SimilarityPattern | null> {
    try {
      const calls = request.call_history?.filter(call => call.transcript) || [];
      if (calls.length < 2) return null;

      const violations: Array<{
        pattern_type: 'high_similarity' | 'scripted_responses' | 'template_abuse';
        description: string;
        severity: number;
        similar_calls: Array<{
          call_id: string;
          timestamp: string;
          similarity_score: number;
          transcript_preview: string;
        }>;
      }> = [];

      // Compare all call pairs for similarity
      for (let i = 0; i < calls.length; i++) {
        for (let j = i + 1; j < calls.length; j++) {
          const call1 = calls[i];
          const call2 = calls[j];
          
          if (!call1.transcript || !call2.transcript) continue;

          const similarity = this.calculateTextSimilarity(call1.transcript, call2.transcript);
          
          if (similarity >= this.SIMILARITY_THRESHOLD) {
            violations.push({
              pattern_type: 'high_similarity',
              description: `${(similarity * 100).toFixed(1)}% similarity between calls`,
              severity: Math.round((similarity - 0.8) * 50), // Scale 0.8-1.0 to 0-10
              similar_calls: [
                {
                  call_id: call1.call_id || `call_${i}`,
                  timestamp: call1.timestamp,
                  similarity_score: similarity,
                  transcript_preview: call1.transcript.substring(0, 100) + '...'
                },
                {
                  call_id: call2.call_id || `call_${j}`,
                  timestamp: call2.timestamp,
                  similarity_score: similarity,
                  transcript_preview: call2.transcript.substring(0, 100) + '...'
                }
              ]
            });
          }
        }
      }

      // Detect scripted/template patterns
      const wordCounts = new Map<string, number>();
      const phraseCounts = new Map<string, number>();

      for (const call of calls) {
        if (!call.transcript) continue;
        
        const words = call.transcript.toLowerCase().split(/\s+/);
        const phrases = this.extractPhrases(call.transcript, 3); // 3-word phrases

        words.forEach(word => {
          if (word.length > 3) { // Ignore short words
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
          }
        });

        phrases.forEach(phrase => {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
        });
      }

      // Find repeated phrases (potential scripted content)
      const repeatedPhrases = Array.from(phraseCounts.entries())
        .filter(([phrase, count]) => count > calls.length * 0.5) // Appears in >50% of calls
        .sort((a, b) => b[1] - a[1]);

      if (repeatedPhrases.length > 2) {
        violations.push({
          pattern_type: 'scripted_responses',
          description: `${repeatedPhrases.length} phrases repeated across ${calls.length} calls`,
          severity: Math.min(10, repeatedPhrases.length),
          similar_calls: calls.map((call, index) => ({
            call_id: call.call_id || `call_${index}`,
            timestamp: call.timestamp,
            similarity_score: 0.8, // Estimated based on repeated phrases
            transcript_preview: call.transcript?.substring(0, 100) + '...' || ''
          }))
        });
      }

      if (violations.length === 0) return null;

      // Calculate risk score
      const totalSeverity = violations.reduce((sum, v) => sum + v.severity, 0);
      const riskScore = Math.min(30, totalSeverity);

      return {
        pattern_type: 'similarity_pattern',
        risk_score: Math.round(riskScore * 100) / 100,
        confidence: 0.85,
        violations,
        analysis_summary: {
          total_calls: calls.length,
          calls_with_transcripts: calls.filter(c => c.transcript).length,
          high_similarity_pairs: violations.filter(v => v.pattern_type === 'high_similarity').length,
          repeated_phrases: repeatedPhrases.length,
          average_similarity: violations.length > 0 
            ? violations.reduce((sum, v) => sum + (v.similar_calls[0]?.similarity_score || 0), 0) / violations.length
            : 0
        }
      };
    } catch (error) {
      console.error(`Similarity pattern analysis error: ${error}`);
      return null;
    }
  }

  /**
   * Group calls by time windows
   */
  private groupCallsByTimeWindow(calls: any[], windowMinutes: number): Array<{
    start: string;
    end: string;
    calls: any[];
  }> {
    const windows: Array<{ start: string; end: string; calls: any[] }> = [];
    const sortedCalls = calls.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const call of sortedCalls) {
      const callTime = new Date(call.timestamp);
      let addedToWindow = false;

      // Try to add to existing window
      for (const window of windows) {
        const windowEnd = new Date(window.end);
        if (callTime.getTime() <= windowEnd.getTime()) {
          window.calls.push(call);
          // Extend window end if needed
          const newEnd = new Date(callTime.getTime() + windowMinutes * 60 * 1000);
          if (newEnd > windowEnd) {
            window.end = newEnd.toISOString();
          }
          addedToWindow = true;
          break;
        }
      }

      // Create new window if not added
      if (!addedToWindow) {
        windows.push({
          start: callTime.toISOString(),
          end: new Date(callTime.getTime() + windowMinutes * 60 * 1000).toISOString(),
          calls: [call]
        });
      }
    }

    return windows;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Cluster locations by distance
   */
  private clusterLocationsByDistance(calls: any[], radiusKm: number): Array<{ lat: number; lng: number }> {
    const clusters: Array<{ lat: number; lng: number; calls: any[] }> = [];
    
    for (const call of calls) {
      if (!call.location) continue;
      
      let addedToCluster = false;
      
      for (const cluster of clusters) {
        const distance = this.calculateDistance(
          call.location.latitude,
          call.location.longitude,
          cluster.lat,
          cluster.lng
        );
        
        if (distance <= radiusKm) {
          cluster.calls.push(call);
          addedToCluster = true;
          break;
        }
      }
      
      if (!addedToCluster) {
        clusters.push({
          lat: call.location.latitude,
          lng: call.location.longitude,
          calls: [call]
        });
      }
    }
    
    return clusters.map(cluster => ({ lat: cluster.lat, lng: cluster.lng }));
  }

  /**
   * Calculate text similarity using Jaccard index
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Extract phrases of specified length from text
   */
  private extractPhrases(text: string, phraseLength: number): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const phrases: string[] = [];
    
    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(' ');
      if (phrase.length > 10) { // Ignore very short phrases
        phrases.push(phrase);
      }
    }
    
    return phrases;
  }

  /**
   * Calculate severity level from risk score
   */
  private calculateSeverity(riskScore: number): number {
    if (riskScore >= 25) return 10;
    if (riskScore >= 20) return 8;
    if (riskScore >= 15) return 6;
    if (riskScore >= 10) return 4;
    if (riskScore >= 5) return 2;
    return 1;
  }

  /**
   * Calculate composite behavioral score
   */
  private calculateCompositeBehavioralScore(patterns: Array<{risk_score: number} | null>): number {
    const validPatterns = patterns.filter(Boolean) as Array<{risk_score: number}>;
    if (validPatterns.length === 0) return 0;

    // Use weighted average with diminishing returns for multiple patterns
    const totalScore = validPatterns.reduce((sum, pattern) => sum + pattern.risk_score, 0);
    const averageScore = totalScore / validPatterns.length;
    
    // Apply bonus for multiple pattern types detected
    const patternTypeBonus = Math.min(5, (validPatterns.length - 1) * 2);
    
    const compositeScore = Math.min(30, averageScore + patternTypeBonus);
    return Math.round(compositeScore * 100) / 100;
  }

  /**
   * Determine risk level based on score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 25) return 'critical';
    if (score >= 18) return 'high';
    if (score >= 10) return 'medium';
    return 'low';
  }

  /**
   * Get behavioral pattern statistics
   */
  async getPatternStatistics(phoneHash?: string, timeWindow: string = '24h'): Promise<{
    total_analyses: number;
    patterns_by_type: Record<PatternType, number>;
    average_risk_scores: Record<PatternType, number>;
    high_risk_patterns: number;
  }> {
    try {
      const hours = this.parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const stats = await BehavioralPatternModel.getStatistics({ 
        phone_hash: phoneHash,
        since 
      });

      return {
        total_analyses: stats.total_count,
        patterns_by_type: stats.patterns_by_type,
        average_risk_scores: stats.avg_risk_scores_by_type,
        high_risk_patterns: stats.high_risk_count
      };
    } catch (error) {
      throw new Error(`Pattern statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse time window string to hours
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hmd])$/);
    if (!match) return 24;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value / 60;
      case 'h': return value;
      case 'd': return value * 24;
      default: return 24;
    }
  }
}