/**
 * Real-time updates integration with Supabase subscriptions
 * Feature: 008-step-2-6 (T035)
 * Created: 2025-09-22
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import type { 
  AnalysisReport, 
  FeedbackInsight, 
  SearchQuery,
  TemporalComparison 
} from '@vocilia/types/feedback-analysis';

// Real-time event types
export interface RealtimeEvents {
  analysisReportUpdated: AnalysisReport;
  newInsightGenerated: FeedbackInsight;
  insightStatusChanged: { insight_id: string; status: string; updated_by: string };
  searchQueryCompleted: SearchQuery;
  temporalAnalysisUpdated: TemporalComparison;
  weeklyReportGenerated: { store_id: string; week_number: number; year: number };
  feedbackProcessed: { store_id: string; feedback_count: number };
}

export type RealtimeEventName = keyof RealtimeEvents;

// Hook configuration
interface UseRealtimeFeedbackAnalysisConfig {
  storeId: string;
  userId: string;
  enabledEvents?: RealtimeEventName[];
  onError?: (error: Error) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// Subscription status
export interface SubscriptionStatus {
  connected: boolean;
  subscribedChannels: string[];
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  error?: string;
}

// Real-time data state
export interface RealtimeData {
  currentReport?: AnalysisReport;
  insights: FeedbackInsight[];
  recentSearches: SearchQuery[];
  temporalComparisons: TemporalComparison[];
  pendingUpdates: number;
  lastUpdated?: Date;
}

export function useRealtimeFeedbackAnalysis(config: UseRealtimeFeedbackAnalysisConfig) {
  const [data, setData] = useState<RealtimeData>({
    insights: [],
    recentSearches: [],
    temporalComparisons: [],
    pendingUpdates: 0,
  });

  const [status, setStatus] = useState<SubscriptionStatus>({
    connected: false,
    subscribedChannels: [],
    reconnectAttempts: 0,
  });

  const supabaseRef = useRef<ReturnType<typeof createClient<Database>> | null>(null);
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    storeId,
    userId,
    enabledEvents = [
      'analysisReportUpdated',
      'newInsightGenerated',
      'insightStatusChanged',
      'searchQueryCompleted',
      'temporalAnalysisUpdated',
      'weeklyReportGenerated',
      'feedbackProcessed'
    ],
    onError,
    reconnectAttempts = 5,
    reconnectDelay = 2000,
  } = config;

  // Initialize Supabase client
  useEffect(() => {
    supabaseRef.current = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      }
    );

    return () => {
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Unsubscribe from all channels
    subscriptionsRef.current.forEach((subscription) => {
      subscription.unsubscribe();
    });
    subscriptionsRef.current.clear();

    setStatus(prev => ({
      ...prev,
      connected: false,
      subscribedChannels: [],
    }));
  }, []);

  // Connect to real-time subscriptions
  const connect = useCallback(async () => {
    if (!supabaseRef.current) return;

    try {
      cleanup();

      const channels = [
        `feedback-analysis:store:${storeId}`,
        `insights:store:${storeId}`,
        `reports:store:${storeId}`,
        `jobs:weekly-reports`
      ];

      // Subscribe to store-specific feedback analysis updates
      if (enabledEvents.some(event => 
        ['analysisReportUpdated', 'temporalAnalysisUpdated', 'feedbackProcessed'].includes(event)
      )) {
        const feedbackAnalysisChannel = supabaseRef.current
          .channel(`feedback-analysis:store:${storeId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'analysis_reports',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              handleAnalysisReportChange(payload);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'temporal_comparisons',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              handleTemporalComparisonChange(payload);
            }
          )
          .on(
            'broadcast',
            { event: 'feedback_processed' },
            (payload) => {
              if (enabledEvents.includes('feedbackProcessed')) {
                handleFeedbackProcessed(payload);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              updateSubscriptionStatus('feedback-analysis', true);
            }
          });

        subscriptionsRef.current.set('feedback-analysis', feedbackAnalysisChannel);
      }

      // Subscribe to insights updates
      if (enabledEvents.some(event => 
        ['newInsightGenerated', 'insightStatusChanged'].includes(event)
      )) {
        const insightsChannel = supabaseRef.current
          .channel(`insights:store:${storeId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'feedback_insights',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              if (enabledEvents.includes('newInsightGenerated')) {
                handleNewInsight(payload);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'feedback_insights',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              if (enabledEvents.includes('insightStatusChanged')) {
                handleInsightStatusChange(payload);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              updateSubscriptionStatus('insights', true);
            }
          });

        subscriptionsRef.current.set('insights', insightsChannel);
      }

      // Subscribe to search query completions
      if (enabledEvents.includes('searchQueryCompleted')) {
        const searchChannel = supabaseRef.current
          .channel(`search:store:${storeId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'search_queries',
              filter: `store_id=eq.${storeId}`,
            },
            (payload) => {
              handleSearchQueryCompletion(payload);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              updateSubscriptionStatus('search', true);
            }
          });

        subscriptionsRef.current.set('search', searchChannel);
      }

      // Subscribe to weekly report generation events
      if (enabledEvents.includes('weeklyReportGenerated')) {
        const reportsChannel = supabaseRef.current
          .channel('weekly-reports')
          .on(
            'broadcast',
            { event: 'report_generated' },
            (payload) => {
              handleWeeklyReportGenerated(payload);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              updateSubscriptionStatus('reports', true);
            }
          });

        subscriptionsRef.current.set('reports', reportsChannel);
      }

      // Start heartbeat
      startHeartbeat();

      setStatus(prev => ({
        ...prev,
        connected: true,
        error: undefined,
        reconnectAttempts: 0,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setStatus(prev => ({
        ...prev,
        connected: false,
        error: errorMessage,
      }));

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      
      // Attempt reconnection
      attemptReconnect();
    }
  }, [storeId, userId, enabledEvents, onError]);

  // Handle connection errors and reconnection
  const attemptReconnect = useCallback(() => {
    setStatus(prev => {
      if (prev.reconnectAttempts >= reconnectAttempts) {
        return {
          ...prev,
          error: 'Max reconnection attempts reached',
        };
      }

      const newAttempts = prev.reconnectAttempts + 1;
      const delay = reconnectDelay * newAttempts;

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Attempting reconnection ${newAttempts}/${reconnectAttempts}`);
        connect();
      }, delay);

      return {
        ...prev,
        reconnectAttempts: newAttempts,
      };
    });
  }, [connect, reconnectAttempts, reconnectDelay]);

  // Start heartbeat to monitor connection
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        lastHeartbeat: new Date(),
      }));
    }, 30000); // 30 seconds
  }, []);

  // Update subscription status for a specific channel
  const updateSubscriptionStatus = useCallback((channelName: string, subscribed: boolean) => {
    setStatus(prev => ({
      ...prev,
      subscribedChannels: subscribed
        ? [...prev.subscribedChannels.filter(c => c !== channelName), channelName]
        : prev.subscribedChannels.filter(c => c !== channelName),
    }));
  }, []);

  // Event handlers
  const handleAnalysisReportChange = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
      const report = payload.new as AnalysisReport;
      setData(prev => ({
        ...prev,
        currentReport: report,
        lastUpdated: new Date(),
        pendingUpdates: prev.pendingUpdates + 1,
      }));
    }
  }, []);

  const handleTemporalComparisonChange = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
      const comparison = payload.new as TemporalComparison;
      setData(prev => ({
        ...prev,
        temporalComparisons: [
          comparison,
          ...prev.temporalComparisons.filter(c => c.id !== comparison.id).slice(0, 9)
        ],
        lastUpdated: new Date(),
        pendingUpdates: prev.pendingUpdates + 1,
      }));
    }
  }, []);

  const handleNewInsight = useCallback((payload: any) => {
    const insight = payload.new as FeedbackInsight;
    setData(prev => ({
      ...prev,
      insights: [insight, ...prev.insights.slice(0, 49)], // Keep last 50 insights
      lastUpdated: new Date(),
      pendingUpdates: prev.pendingUpdates + 1,
    }));
  }, []);

  const handleInsightStatusChange = useCallback((payload: any) => {
    const updatedInsight = payload.new as FeedbackInsight;
    setData(prev => ({
      ...prev,
      insights: prev.insights.map(insight =>
        insight.id === updatedInsight.id ? updatedInsight : insight
      ),
      lastUpdated: new Date(),
      pendingUpdates: prev.pendingUpdates + 1,
    }));
  }, []);

  const handleSearchQueryCompletion = useCallback((payload: any) => {
    if (payload.new.status === 'completed') {
      const query = payload.new as SearchQuery;
      setData(prev => ({
        ...prev,
        recentSearches: [query, ...prev.recentSearches.slice(0, 19)], // Keep last 20 searches
        lastUpdated: new Date(),
        pendingUpdates: prev.pendingUpdates + 1,
      }));
    }
  }, []);

  const handleWeeklyReportGenerated = useCallback((payload: any) => {
    if (payload.payload.store_id === storeId) {
      setData(prev => ({
        ...prev,
        lastUpdated: new Date(),
        pendingUpdates: prev.pendingUpdates + 1,
      }));
    }
  }, [storeId]);

  const handleFeedbackProcessed = useCallback((payload: any) => {
    if (payload.payload.store_id === storeId) {
      setData(prev => ({
        ...prev,
        lastUpdated: new Date(),
        pendingUpdates: prev.pendingUpdates + 1,
      }));
    }
  }, [storeId]);

  // Clear pending updates count
  const clearPendingUpdates = useCallback(() => {
    setData(prev => ({
      ...prev,
      pendingUpdates: 0,
    }));
  }, []);

  // Manual refresh
  const refreshData = useCallback(async () => {
    if (!supabaseRef.current) return;

    try {
      // Fetch latest data
      const [reportsResponse, insightsResponse, searchResponse] = await Promise.all([
        supabaseRef.current
          .from('analysis_reports')
          .select('*')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(1),
        
        supabaseRef.current
          .from('feedback_insights')
          .select('*')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(50),
        
        supabaseRef.current
          .from('search_queries')
          .select('*')
          .eq('store_id', storeId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      setData(prev => ({
        ...prev,
        currentReport: reportsResponse.data?.[0] as AnalysisReport,
        insights: (insightsResponse.data as FeedbackInsight[]) || [],
        recentSearches: (searchResponse.data as SearchQuery[]) || [],
        lastUpdated: new Date(),
      }));

    } catch (error) {
      console.error('Failed to refresh data:', error);
      onError?.(error instanceof Error ? error : new Error('Refresh failed'));
    }
  }, [storeId, onError]);

  // Initial connection
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  // Disconnect when component unmounts
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    data,
    status,
    clearPendingUpdates,
    refreshData,
    reconnect: connect,
    disconnect: cleanup,
  };
}

// Additional utility hooks for specific use cases

/**
 * Hook for real-time insights updates only
 */
export function useRealtimeInsights(storeId: string, userId: string) {
  return useRealtimeFeedbackAnalysis({
    storeId,
    userId,
    enabledEvents: ['newInsightGenerated', 'insightStatusChanged'],
  });
}

/**
 * Hook for real-time search updates only
 */
export function useRealtimeSearch(storeId: string, userId: string) {
  return useRealtimeFeedbackAnalysis({
    storeId,
    userId,
    enabledEvents: ['searchQueryCompleted'],
  });
}

/**
 * Hook for real-time report updates only
 */
export function useRealtimeReports(storeId: string, userId: string) {
  return useRealtimeFeedbackAnalysis({
    storeId,
    userId,
    enabledEvents: ['analysisReportUpdated', 'weeklyReportGenerated'],
  });
}

/**
 * Context provider for real-time feedback analysis
 */
import { createContext, useContext, ReactNode } from 'react';

interface RealtimeFeedbackAnalysisContextValue {
  data: RealtimeData;
  status: SubscriptionStatus;
  clearPendingUpdates: () => void;
  refreshData: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

const RealtimeFeedbackAnalysisContext = createContext<RealtimeFeedbackAnalysisContextValue | null>(null);

interface RealtimeFeedbackAnalysisProviderProps {
  children: ReactNode;
  storeId: string;
  userId: string;
  enabledEvents?: RealtimeEventName[];
  onError?: (error: Error) => void;
}

export function RealtimeFeedbackAnalysisProvider({
  children,
  storeId,
  userId,
  enabledEvents,
  onError,
}: RealtimeFeedbackAnalysisProviderProps) {
  const realtimeHook = useRealtimeFeedbackAnalysis({
    storeId,
    userId,
    enabledEvents,
    onError,
  });

  return (
    <RealtimeFeedbackAnalysisContext.Provider value={realtimeHook}>
      {children}
    </RealtimeFeedbackAnalysisContext.Provider>
  );
}

export function useRealtimeFeedbackAnalysisContext() {
  const context = useContext(RealtimeFeedbackAnalysisContext);
  if (!context) {
    throw new Error('useRealtimeFeedbackAnalysisContext must be used within RealtimeFeedbackAnalysisProvider');
  }
  return context;
}