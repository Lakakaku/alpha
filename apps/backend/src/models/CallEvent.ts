import { CallEvent, CallEventType, CallEventSource } from '@vocilia/types';
import { supabase } from '../config/supabase';

export class CallEventModel {
  static async create(data: {
    call_session_id: string;
    event_type: CallEventType;
    event_data: Record<string, any>;
    source: CallEventSource;
    metadata?: Record<string, any>;
  }): Promise<CallEvent> {
    const { data: event, error } = await supabase
      .from('call_events')
      .insert({
        ...data,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call event: ${error.message}`);
    }

    return event;
  }

  static async findBySessionId(sessionId: string, options?: {
    eventType?: CallEventType;
    source?: CallEventSource;
    limit?: number;
    offset?: number;
  }): Promise<CallEvent[]> {
    let query = supabase
      .from('call_events')
      .select('*')
      .eq('call_session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options?.source) {
      query = query.eq('source', options.source);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: events, error } = await query;

    if (error) {
      throw new Error(`Failed to find call events: ${error.message}`);
    }

    return events || [];
  }

  static async findById(id: string): Promise<CallEvent | null> {
    const { data: event, error } = await supabase
      .from('call_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find call event: ${error.message}`);
    }

    return event;
  }

  static async findLatestBySessionId(sessionId: string): Promise<CallEvent | null> {
    const { data: event, error } = await supabase
      .from('call_events')
      .select('*')
      .eq('call_session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find latest call event: ${error.message}`);
    }

    return event;
  }

  static async findByTimeRange(sessionId: string, fromTime: string, toTime: string): Promise<CallEvent[]> {
    const { data: events, error } = await supabase
      .from('call_events')
      .select('*')
      .eq('call_session_id', sessionId)
      .gte('timestamp', fromTime)
      .lte('timestamp', toTime)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to find call events by time range: ${error.message}`);
    }

    return events || [];
  }

  static async getEventTimeline(sessionId: string): Promise<CallEvent[]> {
    return this.findBySessionId(sessionId);
  }

  static async findByEventType(sessionId: string, eventType: CallEventType): Promise<CallEvent[]> {
    return this.findBySessionId(sessionId, { eventType });
  }

  static async findBySource(sessionId: string, source: CallEventSource): Promise<CallEvent[]> {
    return this.findBySessionId(sessionId, { source });
  }

  static async getEventDuration(sessionId: string, startEventType: CallEventType, endEventType: CallEventType): Promise<number | null> {
    const startEvent = await supabase
      .from('call_events')
      .select('timestamp')
      .eq('call_session_id', sessionId)
      .eq('event_type', startEventType)
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    const endEvent = await supabase
      .from('call_events')
      .select('timestamp')
      .eq('call_session_id', sessionId)
      .eq('event_type', endEventType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (startEvent.error || endEvent.error || !startEvent.data || !endEvent.data) {
      return null;
    }

    const startTime = new Date(startEvent.data.timestamp).getTime();
    const endTime = new Date(endEvent.data.timestamp).getTime();

    return Math.round((endTime - startTime) / 1000); // Duration in seconds
  }

  static async getCallDuration(sessionId: string): Promise<number | null> {
    return this.getEventDuration(sessionId, 'answered', 'completed');
  }

  static async hasEventOccurred(sessionId: string, eventType: CallEventType): Promise<boolean> {
    const { data, error } = await supabase
      .from('call_events')
      .select('id')
      .eq('call_session_id', sessionId)
      .eq('event_type', eventType)
      .limit(1);

    if (error) {
      throw new Error(`Failed to check event occurrence: ${error.message}`);
    }

    return (data?.length || 0) > 0;
  }

  static async getEventCounts(sessionId: string): Promise<Record<CallEventType, number>> {
    const { data: events, error } = await supabase
      .from('call_events')
      .select('event_type')
      .eq('call_session_id', sessionId);

    if (error) {
      throw new Error(`Failed to get event counts: ${error.message}`);
    }

    const counts: Record<CallEventType, number> = {
      'initiated': 0,
      'connecting': 0,
      'answered': 0,
      'ai_connected': 0,
      'question_asked': 0,
      'response_received': 0,
      'warning_sent': 0,
      'timeout': 0,
      'completed': 0,
      'failed': 0,
    };

    (events || []).forEach((event: { event_type: CallEventType }) => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    });

    return counts;
  }

  // Helper methods for creating specific event types
  static async createInitiatedEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'initiated',
      event_data: data,
      source: 'system',
    });
  }

  static async createConnectingEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'connecting',
      event_data: data,
      source: 'telephony',
    });
  }

  static async createAnsweredEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'answered',
      event_data: data,
      source: 'telephony',
    });
  }

  static async createAiConnectedEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'ai_connected',
      event_data: data,
      source: 'ai',
    });
  }

  static async createQuestionAskedEvent(sessionId: string, questionData: Record<string, any>): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'question_asked',
      event_data: questionData,
      source: 'ai',
    });
  }

  static async createResponseReceivedEvent(sessionId: string, responseData: Record<string, any>): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'response_received',
      event_data: responseData,
      source: 'customer',
    });
  }

  static async createWarningEvent(sessionId: string, warningData: Record<string, any>): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'warning_sent',
      event_data: warningData,
      source: 'system',
    });
  }

  static async createTimeoutEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'timeout',
      event_data: data,
      source: 'system',
    });
  }

  static async createCompletedEvent(sessionId: string, data: Record<string, any> = {}): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'completed',
      event_data: data,
      source: 'system',
    });
  }

  static async createFailedEvent(sessionId: string, errorData: Record<string, any>): Promise<CallEvent> {
    return this.create({
      call_session_id: sessionId,
      event_type: 'failed',
      event_data: errorData,
      source: 'system',
    });
  }

  static async deleteBySessionId(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_events')
      .delete()
      .eq('call_session_id', sessionId);

    if (error) {
      throw new Error(`Failed to delete call events: ${error.message}`);
    }
  }

  static async getEventsByBusinessId(businessId: string, options?: {
    eventType?: CallEventType;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<CallEvent[]> {
    let query = supabase
      .from('call_events')
      .select(`
        *,
        call_sessions!inner(business_id)
      `)
      .eq('call_sessions.business_id', businessId)
      .order('timestamp', { ascending: false });

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options?.fromDate) {
      query = query.gte('timestamp', options.fromDate);
    }

    if (options?.toDate) {
      query = query.lte('timestamp', options.toDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: events, error } = await query;

    if (error) {
      throw new Error(`Failed to find events by business: ${error.message}`);
    }

    return events || [];
  }

  static async isValidEventSequence(sessionId: string, newEventType: CallEventType): Promise<boolean> {
    const latestEvent = await this.findLatestBySessionId(sessionId);
    
    if (!latestEvent) {
      return newEventType === 'initiated';
    }

    const validNextEvents: Record<CallEventType, CallEventType[]> = {
      'initiated': ['connecting', 'failed'],
      'connecting': ['answered', 'failed'],
      'answered': ['ai_connected', 'failed'],
      'ai_connected': ['question_asked', 'warning_sent', 'completed', 'timeout', 'failed'],
      'question_asked': ['response_received', 'question_asked', 'warning_sent', 'timeout', 'failed'],
      'response_received': ['question_asked', 'warning_sent', 'completed', 'timeout', 'failed'],
      'warning_sent': ['question_asked', 'completed', 'timeout', 'failed'],
      'timeout': [], // Terminal state
      'completed': [], // Terminal state
      'failed': [], // Terminal state
    };

    return validNextEvents[latestEvent.event_type]?.includes(newEventType) || false;
  }
}