'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  ContextVersion,
  ContextCompleteness
} from '@vocilia/types/src/context';

export type ContextChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ContextChange<T = unknown> {
  type: ContextChangeType;
  table: string;
  old_record?: T;
  new_record?: T;
  timestamp: string;
  userId?: string;
}

export interface ContextRealtimeState {
  isConnected: boolean;
  isSubscribed: boolean;
  lastActivity: Date | null;
  error: string | null;
  connectionAttempts: number;
}

export interface ContextRealtimeCallbacks {
  onProfileChange?: (change: ContextChange<StoreContextProfile>) => void;
  onPersonnelChange?: (change: ContextChange<StoreContextPersonnel>) => void;
  onLayoutChange?: (change: ContextChange<StoreContextLayout>) => void;
  onInventoryChange?: (change: ContextChange<StoreContextInventory>) => void;
  onVersionChange?: (change: ContextChange<ContextVersion>) => void;
  onCompletenessChange?: (change: ContextChange<ContextCompleteness>) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseContextRealtimeOptions {
  storeId: string;
  enabled?: boolean;
  tables?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useContextRealtime(
  options: UseContextRealtimeOptions,
  callbacks: ContextRealtimeCallbacks = {}
) {
  const {
    storeId,
    enabled = true,
    tables = [
      'store_context_profiles',
      'store_context_personnel', 
      'store_context_layouts',
      'store_context_inventory',
      'store_context_versions'
    ],
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    debug = false,
  } = options;

  const [state, setState] = useState<ContextRealtimeState>({
    isConnected: false,
    isSubscribed: false,
    lastActivity: null,
    error: null,
    connectionAttempts: 0,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  const log = useCallback((message: string, data?: unknown) => {
    if (debug) {
      console.log(`[ContextRealtime] ${message}`, data);
    }
  }, [debug]);

  const updateState = useCallback((updates: Partial<ContextRealtimeState>) => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleChange = useCallback((
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ) => {
    const { eventType, table, old: oldRecord, new: newRecord } = payload;
    
    log(`Change detected in ${table}`, { eventType, oldRecord, newRecord });

    const change: ContextChange = {
      type: eventType as ContextChangeType,
      table,
      old_record: oldRecord,
      new_record: newRecord,
      timestamp: new Date().toISOString(),
    };

    updateState({ lastActivity: new Date(), error: null });

    // Route change to appropriate callback
    switch (table) {
      case 'store_context_profiles':
        callbacks.onProfileChange?.(change as ContextChange<StoreContextProfile>);
        break;
      case 'store_context_personnel':
        callbacks.onPersonnelChange?.(change as ContextChange<StoreContextPersonnel>);
        break;
      case 'store_context_layouts':
        callbacks.onLayoutChange?.(change as ContextChange<StoreContextLayout>);
        break;
      case 'store_context_inventory':
        callbacks.onInventoryChange?.(change as ContextChange<StoreContextInventory>);
        break;
      case 'store_context_versions':
        callbacks.onVersionChange?.(change as ContextChange<ContextVersion>);
        break;
      default:
        log(`Unhandled table change: ${table}`);
    }
  }, [callbacks, log, updateState]);

  const handleError = useCallback((error: string) => {
    log(`Error occurred: ${error}`);
    updateState({ error, isConnected: false });
    callbacks.onError?.(error);
  }, [callbacks, log, updateState]);

  const subscribe = useCallback(async () => {
    if (!enabled || !storeId || channelRef.current) {
      return;
    }

    try {
      log(`Subscribing to realtime updates for store ${storeId}`);

      const channelName = `context_changes_${storeId}`;
      const channel = supabase.channel(channelName);

      // Subscribe to each table with store filter
      tables.forEach(table => {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `store_id=eq.${storeId}`,
          },
          handleChange
        );
      });

      // Handle channel status changes
      channel.on('broadcast', { event: 'connection' }, (payload) => {
        log('Connection status changed', payload);
        const isConnected = payload.connected;
        updateState({ isConnected });
        callbacks.onConnectionChange?.(isConnected);
      });

      // Subscribe to the channel
      const subscriptionResponse = await channel.subscribe((status, error) => {
        log(`Subscription status: ${status}`, error);

        if (status === 'SUBSCRIBED') {
          updateState({
            isSubscribed: true,
            isConnected: true,
            error: null,
            connectionAttempts: 0,
          });
          callbacks.onConnectionChange?.(true);
        } else if (status === 'CHANNEL_ERROR') {
          const errorMessage = error?.message || 'Channel subscription error';
          handleError(errorMessage);
        } else if (status === 'TIMED_OUT') {
          handleError('Subscription timed out');
        }
      });

      if (subscriptionResponse === 'error') {
        throw new Error('Failed to subscribe to channel');
      }

      channelRef.current = channel;
      log('Successfully subscribed to realtime updates');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Subscription error';
      handleError(errorMessage);
      scheduleReconnect();
    }
  }, [enabled, storeId, tables, handleChange, handleError, callbacks, log, updateState]);

  const unsubscribe = useCallback(async () => {
    if (channelRef.current) {
      log('Unsubscribing from realtime updates');
      
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      
      updateState({
        isSubscribed: false,
        isConnected: false,
        error: null,
      });
      
      callbacks.onConnectionChange?.(false);
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, [callbacks, log, updateState]);

  const scheduleReconnect = useCallback(() => {
    if (!enabled || state.connectionAttempts >= maxReconnectAttempts) {
      log(`Max reconnection attempts reached (${maxReconnectAttempts})`);
      return;
    }

    updateState(prev => ({ 
      ...prev, 
      connectionAttempts: prev.connectionAttempts + 1 
    }));

    log(`Scheduling reconnection attempt ${state.connectionAttempts + 1} in ${reconnectInterval}ms`);

    reconnectTimeoutRef.current = setTimeout(async () => {
      if (mountedRef.current && enabled) {
        await unsubscribe();
        await subscribe();
      }
    }, reconnectInterval);
  }, [
    enabled, 
    state.connectionAttempts, 
    maxReconnectAttempts, 
    reconnectInterval, 
    log, 
    updateState, 
    unsubscribe, 
    subscribe
  ]);

  const reconnect = useCallback(async () => {
    log('Manual reconnection requested');
    updateState({ connectionAttempts: 0 });
    await unsubscribe();
    await subscribe();
  }, [log, updateState, unsubscribe, subscribe]);

  const getConnectionStatus = useCallback(() => {
    return {
      ...state,
      channelState: channelRef.current?.state,
      supabaseConnected: supabase.realtime.isConnected(),
    };
  }, [state]);

  // Subscribe on mount and when dependencies change
  useEffect(() => {
    if (enabled && storeId) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [enabled, storeId, subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [unsubscribe]);

  // Monitor connection health
  useEffect(() => {
    if (!enabled) return;

    const healthCheckInterval = setInterval(() => {
      if (channelRef.current && state.isSubscribed) {
        const now = Date.now();
        const lastActivityTime = state.lastActivity?.getTime() || 0;
        const timeSinceActivity = now - lastActivityTime;

        // If no activity for 30 seconds, check connection
        if (timeSinceActivity > 30000 && state.isConnected) {
          log('No activity detected, checking connection health');
          
          // Send a ping to check if connection is alive
          channelRef.current.send({
            type: 'broadcast',
            event: 'ping',
            payload: { timestamp: now },
          });
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(healthCheckInterval);
  }, [enabled, state.isSubscribed, state.isConnected, state.lastActivity, log]);

  return {
    state,
    actions: {
      reconnect,
      unsubscribe,
      getConnectionStatus,
    },
    isConnected: state.isConnected,
    isSubscribed: state.isSubscribed,
    error: state.error,
    lastActivity: state.lastActivity,
  };
}

// Convenience hooks for specific context sections
export function useContextProfileRealtime(
  storeId: string, 
  onProfileChange: (change: ContextChange<StoreContextProfile>) => void,
  options: Omit<UseContextRealtimeOptions, 'storeId' | 'tables'> = {}
) {
  return useContextRealtime(
    { 
      ...options, 
      storeId, 
      tables: ['store_context_profiles'] 
    },
    { onProfileChange }
  );
}

export function useContextPersonnelRealtime(
  storeId: string,
  onPersonnelChange: (change: ContextChange<StoreContextPersonnel>) => void,
  options: Omit<UseContextRealtimeOptions, 'storeId' | 'tables'> = {}
) {
  return useContextRealtime(
    { 
      ...options, 
      storeId, 
      tables: ['store_context_personnel'] 
    },
    { onPersonnelChange }
  );
}

export function useContextLayoutRealtime(
  storeId: string,
  onLayoutChange: (change: ContextChange<StoreContextLayout>) => void,
  options: Omit<UseContextRealtimeOptions, 'storeId' | 'tables'> = {}
) {
  return useContextRealtime(
    { 
      ...options, 
      storeId, 
      tables: ['store_context_layouts'] 
    },
    { onLayoutChange }
  );
}

export function useContextInventoryRealtime(
  storeId: string,
  onInventoryChange: (change: ContextChange<StoreContextInventory>) => void,
  options: Omit<UseContextRealtimeOptions, 'storeId' | 'tables'> = {}
) {
  return useContextRealtime(
    { 
      ...options, 
      storeId, 
      tables: ['store_context_inventory'] 
    },
    { onInventoryChange }
  );
}

export function useContextVersionRealtime(
  storeId: string,
  onVersionChange: (change: ContextChange<ContextVersion>) => void,
  options: Omit<UseContextRealtimeOptions, 'storeId' | 'tables'> = {}
) {
  return useContextRealtime(
    { 
      ...options, 
      storeId, 
      tables: ['store_context_versions'] 
    },
    { onVersionChange }
  );
}

export default useContextRealtime;