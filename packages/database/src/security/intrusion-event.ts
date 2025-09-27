/**
 * IntrusionEvent Database Model
 * Task: T036 - IntrusionEvent model
 * 
 * Database operations for intrusion_events table
 * Handles security intrusion detection and response:
 * - Brute force attacks
 * - SQL injection attempts
 * - XSS attacks
 * - DDoS detection
 * - Malware detection
 * - Automated response and mitigation
 */

import { supabase } from '../client/supabase';
import type { 
  IntrusionEvent,
  IntrusionType,
  SeverityLevel,
  IntrusionEventData,
  GeolocationData,
  ResolutionAction,
  IntrusionEventRequest,
  IntrusionEventUpdate,
  IntrusionEventQuery,
  IntrusionEventResponse
} from '@vocilia/types';

export class IntrusionEventModel {
  private static readonly TABLE_NAME = 'intrusion_events';
  
  /**
   * Create a new intrusion event
   */
  static async create(data: IntrusionEventRequest): Promise<IntrusionEvent> {
    const intrusionEvent = {
      event_type: data.event_type,
      severity_level: data.severity_level,
      source_ip: data.source_ip,
      target_resource: data.target_resource,
      attack_vector: data.attack_vector,
      detection_rule: data.detection_rule,
      event_data: data.event_data,
      geolocation: data.geolocation || null,
      user_agent: data.user_agent || null,
      is_resolved: false,
      correlation_id: data.correlation_id,
      false_positive: false
    };

    const { data: result, error } = await supabase
      .from(this.TABLE_NAME)
      .insert(intrusionEvent)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create intrusion event: ${error.message}`);
    }

    return result;
  }

  /**
   * Update intrusion event (resolution, false positive marking)
   */
  static async update(id: string, updates: IntrusionEventUpdate): Promise<IntrusionEvent> {
    const updateData: any = {};

    if (updates.is_resolved !== undefined) {
      updateData.is_resolved = updates.is_resolved;
      if (updates.is_resolved) {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (updates.resolution_action) {
      updateData.resolution_action = updates.resolution_action;
    }

    if (updates.resolution_notes) {
      updateData.resolution_notes = updates.resolution_notes;
    }

    if (updates.false_positive !== undefined) {
      updateData.false_positive = updates.false_positive;
    }

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update intrusion event: ${error.message}`);
    }

    return data;
  }

  /**
   * Query intrusion events with filtering
   */
  static async query(queryParams: IntrusionEventQuery): Promise<IntrusionEventResponse> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' });

    // Apply filters
    if (queryParams.event_type) {
      if (Array.isArray(queryParams.event_type)) {
        query = query.in('event_type', queryParams.event_type);
      } else {
        query = query.eq('event_type', queryParams.event_type);
      }
    }

    if (queryParams.severity_level) {
      if (Array.isArray(queryParams.severity_level)) {
        query = query.in('severity_level', queryParams.severity_level);
      } else {
        query = query.eq('severity_level', queryParams.severity_level);
      }
    }

    if (queryParams.source_ip) {
      query = query.eq('source_ip', queryParams.source_ip);
    }

    if (queryParams.is_resolved !== undefined) {
      query = query.eq('is_resolved', queryParams.is_resolved);
    }

    if (queryParams.start_date) {
      query = query.gte('created_at', queryParams.start_date);
    }

    if (queryParams.end_date) {
      query = query.lte('created_at', queryParams.end_date);
    }

    // Apply pagination
    const limit = Math.min(queryParams.limit || 50, 500);
    const offset = queryParams.offset || 0;

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to query intrusion events: ${error.message}`);
    }

    // Generate summary statistics
    const summary = await this.generateSummary(data || []);

    return {
      events: data || [],
      pagination: {
        total_count: count || 0,
        has_next: offset + limit < (count || 0),
        has_previous: offset > 0
      },
      summary
    };
  }

  /**
   * Get intrusion events by source IP
   */
  static async getBySourceIp(sourceIp: string, options: {
    hours?: number;
    includeResolved?: boolean;
    limit?: number;
  } = {}): Promise<IntrusionEvent[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('source_ip', sourceIp);

    if (options.hours) {
      const since = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }

    if (!options.includeResolved) {
      query = query.eq('is_resolved', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get intrusion events by source IP: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get critical unresolved events
   */
  static async getCriticalUnresolved(limit?: number): Promise<IntrusionEvent[]> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('severity_level', 'critical')
      .eq('is_resolved', false)
      .eq('false_positive', false);

    if (limit) {
      query = query.limit(limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get critical unresolved events: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get events by correlation ID
   */
  static async getByCorrelationId(correlationId: string): Promise<IntrusionEvent[]> {
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('correlation_id', correlationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get intrusion events by correlation ID: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent events for monitoring dashboard
   */
  static async getRecent(options: {
    hours?: number;
    severityLevels?: SeverityLevel[];
    eventTypes?: IntrusionType[];
    limit?: number;
  } = {}): Promise<IntrusionEvent[]> {
    const hours = options.hours || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('created_at', since);

    if (options.severityLevels && options.severityLevels.length > 0) {
      query = query.in('severity_level', options.severityLevels);
    }

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent intrusion events: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get attack patterns (grouped by source IP and attack type)
   */
  static async getAttackPatterns(options: {
    hours?: number;
    minOccurrences?: number;
  } = {}): Promise<Array<{
    source_ip: string;
    event_type: IntrusionType;
    count: number;
    severity_levels: SeverityLevel[];
    countries: string[];
    latest_attack: string;
    is_ongoing: boolean;
  }>> {
    const hours = options.hours || 24;
    const minOccurrences = options.minOccurrences || 3;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('source_ip, event_type, severity_level, geolocation, created_at, is_resolved')
      .gte('created_at', since);

    if (error) {
      throw new Error(`Failed to get attack patterns: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by source IP and event type
    const patterns: Record<string, {
      count: number;
      severity_levels: Set<SeverityLevel>;
      countries: Set<string>;
      latest_attack: string;
      unresolved_count: number;
    }> = {};

    data.forEach(event => {
      const key = `${event.source_ip}:${event.event_type}`;
      
      if (!patterns[key]) {
        patterns[key] = {
          count: 0,
          severity_levels: new Set(),
          countries: new Set(),
          latest_attack: event.created_at,
          unresolved_count: 0
        };
      }

      patterns[key].count++;
      patterns[key].severity_levels.add(event.severity_level);
      
      if (event.geolocation?.country) {
        patterns[key].countries.add(event.geolocation.country);
      }

      if (event.created_at > patterns[key].latest_attack) {
        patterns[key].latest_attack = event.created_at;
      }

      if (!event.is_resolved) {
        patterns[key].unresolved_count++;
      }
    });

    // Filter by minimum occurrences and format response
    return Object.entries(patterns)
      .filter(([, stats]) => stats.count >= minOccurrences)
      .map(([key, stats]) => {
        const [source_ip, event_type] = key.split(':');
        return {
          source_ip,
          event_type: event_type as IntrusionType,
          count: stats.count,
          severity_levels: Array.from(stats.severity_levels),
          countries: Array.from(stats.countries),
          latest_attack: stats.latest_attack,
          is_ongoing: stats.unresolved_count > 0
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Mark event as false positive
   */
  static async markFalsePositive(id: string, notes?: string): Promise<IntrusionEvent> {
    return this.update(id, {
      is_resolved: true,
      false_positive: true,
      resolution_action: 'alert_only',
      resolution_notes: notes || 'Marked as false positive'
    });
  }

  /**
   * Resolve event with action
   */
  static async resolveEvent(id: string, action: ResolutionAction, notes: string): Promise<IntrusionEvent> {
    return this.update(id, {
      is_resolved: true,
      resolution_action: action,
      resolution_notes: notes
    });
  }

  /**
   * Get intrusion statistics
   */
  static async getStatistics(options: {
    startDate?: string;
    endDate?: string;
    eventType?: IntrusionType;
  } = {}): Promise<{
    totalEvents: number;
    unresolvedEvents: number;
    criticalEvents: number;
    eventTypeDistribution: Record<IntrusionType, number>;
    severityDistribution: Record<SeverityLevel, number>;
    resolutionActionDistribution: Record<ResolutionAction, number>;
    topSourceIps: Array<{ ip: string; count: number; country?: string }>;
    topTargetResources: Array<{ resource: string; count: number }>;
    averageResolutionTime: number; // minutes
    falsePositiveRate: number; // percentage
    geographicDistribution: Array<{ country: string; count: number }>;
    dailyTrends: Array<{
      date: string;
      total_events: number;
      critical_events: number;
      resolution_rate: number;
    }>;
  }> {
    let query = supabase
      .from(this.TABLE_NAME)
      .select('*');

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get intrusion statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalEvents: 0,
        unresolvedEvents: 0,
        criticalEvents: 0,
        eventTypeDistribution: { brute_force: 0, sql_injection: 0, xss_attempt: 0, ddos_attack: 0, unauthorized_access: 0, malware_detection: 0, privilege_escalation: 0, data_exfiltration: 0, suspicious_activity: 0 },
        severityDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
        resolutionActionDistribution: { ip_blocked: 0, rate_limited: 0, user_suspended: 0, session_terminated: 0, alert_only: 0, manual_review: 0, automated_mitigation: 0 },
        topSourceIps: [],
        topTargetResources: [],
        averageResolutionTime: 0,
        falsePositiveRate: 0,
        geographicDistribution: [],
        dailyTrends: []
      };
    }

    const totalEvents = data.length;
    const unresolvedEvents = data.filter(e => !e.is_resolved).length;
    const criticalEvents = data.filter(e => e.severity_level === 'critical').length;

    // Event type distribution
    const eventTypeDistribution: Record<IntrusionType, number> = {
      brute_force: 0, sql_injection: 0, xss_attempt: 0, ddos_attack: 0,
      unauthorized_access: 0, malware_detection: 0, privilege_escalation: 0,
      data_exfiltration: 0, suspicious_activity: 0
    };
    data.forEach(event => {
      eventTypeDistribution[event.event_type as IntrusionType]++;
    });

    // Severity distribution
    const severityDistribution: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    data.forEach(event => {
      severityDistribution[event.severity_level as SeverityLevel]++;
    });

    // Resolution action distribution
    const resolutionActionDistribution: Record<ResolutionAction, number> = {
      ip_blocked: 0, rate_limited: 0, user_suspended: 0, session_terminated: 0,
      alert_only: 0, manual_review: 0, automated_mitigation: 0
    };
    data.forEach(event => {
      if (event.resolution_action) {
        resolutionActionDistribution[event.resolution_action as ResolutionAction]++;
      }
    });

    // Top source IPs
    const ipCounts: Record<string, { count: number; country?: string }> = {};
    data.forEach(event => {
      if (!ipCounts[event.source_ip]) {
        ipCounts[event.source_ip] = { 
          count: 0, 
          country: event.geolocation?.country 
        };
      }
      ipCounts[event.source_ip].count++;
    });
    const topSourceIps = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([ip, data]) => ({ ip, count: data.count, country: data.country }));

    // Top target resources
    const resourceCounts: Record<string, number> = {};
    data.forEach(event => {
      resourceCounts[event.target_resource] = (resourceCounts[event.target_resource] || 0) + 1;
    });
    const topTargetResources = Object.entries(resourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));

    // Average resolution time
    const resolvedEvents = data.filter(e => e.is_resolved && e.resolved_at);
    const averageResolutionTime = resolvedEvents.length > 0
      ? resolvedEvents.reduce((sum, event) => {
          const created = new Date(event.created_at).getTime();
          const resolved = new Date(event.resolved_at).getTime();
          return sum + (resolved - created) / (1000 * 60); // minutes
        }, 0) / resolvedEvents.length
      : 0;

    // False positive rate
    const falsePositives = data.filter(e => e.false_positive).length;
    const falsePositiveRate = totalEvents > 0 ? (falsePositives / totalEvents) * 100 : 0;

    // Geographic distribution
    const countryCounts: Record<string, number> = {};
    data.forEach(event => {
      if (event.geolocation?.country) {
        countryCounts[event.geolocation.country] = (countryCounts[event.geolocation.country] || 0) + 1;
      }
    });
    const geographicDistribution = Object.entries(countryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([country, count]) => ({ country, count }));

    // Daily trends
    const dailyData: Record<string, { total: number; critical: number; resolved: number }> = {};
    data.forEach(event => {
      const date = event.created_at.substring(0, 10); // YYYY-MM-DD
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, critical: 0, resolved: 0 };
      }
      dailyData[date].total++;
      if (event.severity_level === 'critical') {
        dailyData[date].critical++;
      }
      if (event.is_resolved) {
        dailyData[date].resolved++;
      }
    });

    const dailyTrends = Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // Last 30 days
      .map(([date, stats]) => ({
        date,
        total_events: stats.total,
        critical_events: stats.critical,
        resolution_rate: stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0
      }));

    return {
      totalEvents,
      unresolvedEvents,
      criticalEvents,
      eventTypeDistribution,
      severityDistribution,
      resolutionActionDistribution,
      topSourceIps,
      topTargetResources,
      averageResolutionTime,
      falsePositiveRate,
      geographicDistribution,
      dailyTrends
    };
  }

  /**
   * Delete old resolved events
   */
  static async deleteOldResolved(days: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('is_resolved', true)
      .lt('resolved_at', cutoffDate)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old resolved intrusion events: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Bulk update events (for batch resolution)
   */
  static async bulkUpdate(eventIds: string[], updates: IntrusionEventUpdate): Promise<number> {
    if (eventIds.length === 0) {
      return 0;
    }

    const updateData: any = {};

    if (updates.is_resolved !== undefined) {
      updateData.is_resolved = updates.is_resolved;
      if (updates.is_resolved) {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (updates.resolution_action) {
      updateData.resolution_action = updates.resolution_action;
    }

    if (updates.resolution_notes) {
      updateData.resolution_notes = updates.resolution_notes;
    }

    if (updates.false_positive !== undefined) {
      updateData.false_positive = updates.false_positive;
    }

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .update(updateData)
      .in('id', eventIds)
      .select('id');

    if (error) {
      throw new Error(`Failed to bulk update intrusion events: ${error.message}`);
    }

    return data?.length || 0;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private static async generateSummary(events: IntrusionEvent[]): Promise<{
    total_events: number;
    unresolved_events: number;
    critical_events: number;
    severity_distribution: Record<SeverityLevel, number>;
    event_type_distribution: Record<IntrusionType, number>;
    top_source_ips: Array<{ ip: string; event_count: number; country?: string }>;
    resolution_rate: number;
  }> {
    const totalEvents = events.length;
    const unresolvedEvents = events.filter(e => !e.is_resolved).length;
    const criticalEvents = events.filter(e => e.severity_level === 'critical').length;

    // Severity distribution
    const severityDistribution: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    events.forEach(event => {
      severityDistribution[event.severity_level as SeverityLevel]++;
    });

    // Event type distribution
    const eventTypeDistribution: Record<IntrusionType, number> = {
      brute_force: 0, sql_injection: 0, xss_attempt: 0, ddos_attack: 0,
      unauthorized_access: 0, malware_detection: 0, privilege_escalation: 0,
      data_exfiltration: 0, suspicious_activity: 0
    };
    events.forEach(event => {
      eventTypeDistribution[event.event_type as IntrusionType]++;
    });

    // Top source IPs
    const ipCounts: Record<string, { count: number; country?: string }> = {};
    events.forEach(event => {
      if (!ipCounts[event.source_ip]) {
        ipCounts[event.source_ip] = { 
          count: 0, 
          country: event.geolocation?.country 
        };
      }
      ipCounts[event.source_ip].count++;
    });

    const topSourceIps = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([ip, data]) => ({ 
        ip, 
        event_count: data.count, 
        country: data.country 
      }));

    // Resolution rate
    const resolvedEvents = events.filter(e => e.is_resolved).length;
    const resolutionRate = totalEvents > 0 ? (resolvedEvents / totalEvents) * 100 : 0;

    return {
      total_events: totalEvents,
      unresolved_events: unresolvedEvents,
      critical_events: criticalEvents,
      severity_distribution: severityDistribution,
      event_type_distribution: eventTypeDistribution,
      top_source_ips: topSourceIps,
      resolution_rate: resolutionRate
    };
  }
}