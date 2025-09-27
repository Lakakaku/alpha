'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

interface ContextEntry {
  id: string;
  category: string;
  type: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  overallScore: number;
  categoryScores: Record<string, {
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  missingFields: Array<{
    category: string;
    field: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  recommendations: string[];
  completionLevel: 'incomplete' | 'basic' | 'good' | 'excellent';
  lastUpdated: string;
}

interface UseConversationSyncOptions {
  onMessageUpdate?: (messages: Message[]) => void;
  onContextUpdate?: (entries: ContextEntry[]) => void;
  onValidationUpdate?: (result: ValidationResult) => void;
  onConversationUpdate?: (conversation: any) => void;
  onError?: (error: Error) => void;
}

interface UseConversationSyncReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useConversationSync(
  conversationId: string | null,
  options: UseConversationSyncOptions = {}
): UseConversationSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const {
    onMessageUpdate,
    onContextUpdate,
    onValidationUpdate,
    onConversationUpdate,
    onError
  } = options;

  const handleError = useCallback((error: Error) => {
    console.error('Conversation sync error:', error);
    setConnectionStatus('error');
    onError?.(error);
  }, [onError]);

  const setupRealtimeSubscription = useCallback(async () => {
    if (!conversationId || channelRef.current) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      
      // Create channel for this conversation
      const channel = supabase.channel(`conversation:${conversationId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: conversationId }
        }
      });

      // Subscribe to message updates
      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ai_messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          console.log('Message change:', payload);
          setLastActivity(new Date());
          
          if (onMessageUpdate) {
            // Fetch updated messages
            fetchMessages();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'context_entries',
          filter: `store_id=eq.${conversationId}` // Assuming store_id is available
        }, (payload) => {
          console.log('Context change:', payload);
          setLastActivity(new Date());
          
          if (onContextUpdate) {
            fetchContextEntries();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'validation_results',
          filter: `store_id=eq.${conversationId}` // Assuming store_id is available
        }, (payload) => {
          console.log('Validation change:', payload);
          setLastActivity(new Date());
          
          if (onValidationUpdate) {
            fetchValidationResult();
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ai_conversations',
          filter: `id=eq.${conversationId}`
        }, (payload) => {
          console.log('Conversation change:', payload);
          setLastActivity(new Date());
          
          if (onConversationUpdate) {
            onConversationUpdate(payload.new);
          }
        })
        .subscribe((status) => {
          console.log('Subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            setConnectionStatus('error');
            scheduleReconnect();
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false);
            setConnectionStatus('error');
            scheduleReconnect();
          }
        });

      channelRef.current = channel;

    } catch (error) {
      handleError(error as Error);
      scheduleReconnect();
    }
  }, [conversationId, onMessageUpdate, onContextUpdate, onValidationUpdate, onConversationUpdate, handleError]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`/api/ai-assistant/conversations/${conversationId}/messages`);
      const data = await response.json();
      
      if (data.messages && onMessageUpdate) {
        onMessageUpdate(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [conversationId, onMessageUpdate]);

  const fetchContextEntries = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Note: In real implementation, you'd need the store_id
      // This is a simplified version assuming conversationId maps to store
      const response = await fetch(`/api/ai-assistant/context/entries?store_id=${conversationId}`);
      const data = await response.json();
      
      if (data.entries && onContextUpdate) {
        onContextUpdate(data.entries);
      }
    } catch (error) {
      console.error('Failed to fetch context entries:', error);
    }
  }, [conversationId, onContextUpdate]);

  const fetchValidationResult = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await fetch(`/api/ai-assistant/validation/score?store_id=${conversationId}`);
      const data = await response.json();
      
      if (data.validation && onValidationUpdate) {
        const result: ValidationResult = {
          overallScore: data.validation.overall_score,
          categoryScores: data.validation.category_scores,
          missingFields: data.validation.missing_fields,
          recommendations: data.validation.recommendations,
          completionLevel: data.validation.completion_level,
          lastUpdated: data.validation.created_at
        };
        onValidationUpdate(result);
      }
    } catch (error) {
      console.error('Failed to fetch validation result:', error);
    }
  }, [conversationId, onValidationUpdate]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      setConnectionStatus('error');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff, max 30s
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      console.log(`Reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
      disconnect();
      setupRealtimeSubscription();
    }, delay);
  }, []);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setupRealtimeSubscription();
  }, [disconnect, setupRealtimeSubscription]);

  // Setup subscription when conversationId changes
  useEffect(() => {
    if (conversationId) {
      setupRealtimeSubscription();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [conversationId, setupRealtimeSubscription, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Heartbeat to detect connection issues
  useEffect(() => {
    if (!isConnected) return;

    const heartbeatInterval = setInterval(() => {
      if (channelRef.current) {
        // Send a heartbeat
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [isConnected]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && conversationId) {
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isConnected, conversationId, reconnect]);

  return {
    isConnected,
    connectionStatus,
    lastActivity,
    reconnect,
    disconnect
  };
}