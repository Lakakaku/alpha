'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import type { 
  CallSessionStatus, 
  CallStatusResponse, 
  CallTimelineEvent,
  CallCompletionConfirmRequest,
  CallCompletionConfirmResponse
} from '@vocilia/types/src/calls';

interface CallStatusTrackerProps {
  sessionId: string;
  onStatusChange?: (status: CallSessionStatus) => void;
  onCallCompleted?: (result: CallCompletionConfirmResponse) => void;
  className?: string;
  autoRefreshInterval?: number; // milliseconds, defaults to 5000 (5 seconds)
}

interface CallProgress {
  current_step: 'connecting' | 'questions' | 'completion' | 'finished';
  total_steps: number;
  completed_steps: number;
  estimated_remaining_seconds: number | null;
}

const DEFAULT_REFRESH_INTERVAL = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function CallStatusTracker({
  sessionId,
  onStatusChange,
  onCallCompleted,
  className,
  autoRefreshInterval = DEFAULT_REFRESH_INTERVAL
}: CallStatusTrackerProps) {
  const [callStatus, setCallStatus] = useState<CallSessionStatus>('initiated');
  const [progress, setProgress] = useState<CallProgress>({
    current_step: 'connecting',
    total_steps: 4,
    completed_steps: 0,
    estimated_remaining_seconds: null
  });
  const [timeline, setTimeline] = useState<CallTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [canConfirmCompletion, setCanConfirmCompletion] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [rewardInfo, setRewardInfo] = useState<any>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Swedish language support
  const statusMessages = {
    initiated: {
      title: 'Samtalet initieras',
      description: 'Förbereder ditt samtal...',
      icon: '🔄'
    },
    connecting: {
      title: 'Ansluter',
      description: 'Ringer upp dig nu...',
      icon: '📞'
    },
    in_progress: {
      title: 'Samtal pågår',
      description: 'Svarar på frågor med vår AI-assistent',
      icon: '🗣️'
    },
    completed: {
      title: 'Samtal slutfört',
      description: 'Tack för din medverkan! Bekräfta för att få din belöning.',
      icon: '✅'
    },
    failed: {
      title: 'Samtal misslyckades',
      description: 'Ett tekniskt fel uppstod. Försök igen.',
      icon: '❌'
    },
    timeout: {
      title: 'Samtal avbröts',
      description: 'Samtalet tog för lång tid och avbröts automatiskt.',
      icon: '⏰'
    }
  };

  const stepMessages = {
    connecting: 'Ansluter till ditt telefonnummer',
    questions: 'Ställer frågor och spelar in svar',
    completion: 'Avslutar samtalet',
    finished: 'Samtalet är slutfört'
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Fetch call status with retry mechanism
  const fetchCallStatus = useCallback(async (isRetry = false) => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/v1/calls/${sessionId}/status?includeTimeline=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CallStatusResponse = await response.json();

      // Update state
      setCallStatus(data.status);
      setProgress(data.progress);
      setTimeline(data.timeline || []);
      setCanConfirmCompletion(data.can_confirm_completion);
      setRewardInfo(data.reward_info);
      setError(null);
      setRetryCount(0);

      // Notify parent component
      onStatusChange?.(data.status);

      // Stop polling if call is finished (completed, failed, or timeout)
      if (['completed', 'failed', 'timeout'].includes(data.status)) {
        cleanup();
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Nätverksfel uppstod';
      
      if (retryCount < MAX_RETRY_ATTEMPTS && !isRetry) {
        // Retry after delay
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchCallStatus(true);
        }, RETRY_DELAY);
      } else {
        setError(errorMessage);
        cleanup();
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, retryCount, onStatusChange, cleanup]);

  // Start polling when component mounts
  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    fetchCallStatus();

    // Set up polling for active calls
    if (!['completed', 'failed', 'timeout'].includes(callStatus)) {
      intervalRef.current = setInterval(() => {
        fetchCallStatus();
      }, autoRefreshInterval);
    }

    return cleanup;
  }, [sessionId, fetchCallStatus, autoRefreshInterval, callStatus, cleanup]);

  // Handle call completion confirmation
  const handleConfirmCompletion = async (satisfactionRating?: number, qualityRating?: number) => {
    if (!canConfirmCompletion) return;

    setIsConfirming(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const request: CallCompletionConfirmRequest = {
        sessionId,
        customer_confirmed: true,
        satisfaction_rating: satisfactionRating,
        quality_rating: qualityRating
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/calls/${sessionId}/confirm-completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: CallCompletionConfirmResponse = await response.json();
      onCallCompleted?.(result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Misslyckades med att bekräfta samtalet';
      setError(errorMessage);
    } finally {
      setIsConfirming(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = Math.round((progress.completed_steps / progress.total_steps) * 100);

  // Format estimated remaining time
  const formatRemainingTime = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return null;
    
    if (seconds < 60) {
      return `${seconds} sekunder kvar`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minut${minutes !== 1 ? 'er' : ''} kvar`;
    }
  };

  const currentStatusMessage = statusMessages[callStatus];

  if (error && retryCount >= MAX_RETRY_ATTEMPTS) {
    return (
      <div className={cn("bg-red-50 border border-red-200 rounded-lg p-4", className)}>
        <div className="flex items-center">
          <span className="text-lg mr-3">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Kunde inte hämta samtalsstatus
            </h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setRetryCount(0);
                fetchCallStatus();
              }}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Försök igen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border border-gray-200 rounded-lg p-4 space-y-4", className)}>
      {/* Current Status */}
      <div className="flex items-center">
        <span className="text-2xl mr-3" role="img" aria-label={currentStatusMessage.title}>
          {currentStatusMessage.icon}
        </span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentStatusMessage.title}
          </h3>
          <p className="text-sm text-gray-600">
            {currentStatusMessage.description}
          </p>
        </div>
        {isLoading && (
          <LoadingSpinner size="sm" className="ml-2" />
        )}
      </div>

      {/* Progress Bar */}
      {callStatus !== 'failed' && callStatus !== 'timeout' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {stepMessages[progress.current_step]}
            </span>
            <span className="text-gray-500">
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Samtalsprogress: ${progressPercentage}%`}
            />
          </div>
          {progress.estimated_remaining_seconds && (
            <p className="text-sm text-gray-500 text-center">
              {formatRemainingTime(progress.estimated_remaining_seconds)}
            </p>
          )}
        </div>
      )}

      {/* Reward Information */}
      {rewardInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center">
            <span className="text-lg mr-2">🎁</span>
            <div>
              <p className="text-sm font-medium text-green-800">
                Belöning: {rewardInfo.estimated_reward_sek} kr
              </p>
              <p className="text-xs text-green-700">
                Tillgänglig: {new Date(rewardInfo.reward_timeline).toLocaleString('sv-SE')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Call Completion Confirmation */}
      {canConfirmCompletion && callStatus === 'completed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Bekräfta ditt samtal
          </h4>
          <p className="text-sm text-blue-700 mb-3">
            Bekräfta att samtalet är slutfört för att få din belöning.
          </p>
          <button
            onClick={() => handleConfirmCompletion(5, 8)} // Default ratings
            disabled={isConfirming}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConfirming ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Bekräftar...
              </div>
            ) : (
              'Bekräfta samtal'
            )}
          </button>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Samtalstidslinje</h4>
          <div className="space-y-2">
            {timeline.map((event, index) => (
              <div key={index} className="flex items-center text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full mr-3 flex-shrink-0",
                  event.status === 'completed' && "bg-green-500",
                  event.status === 'in_progress' && "bg-blue-500",
                  event.status === 'pending' && "bg-gray-300",
                  event.status === 'failed' && "bg-red-500"
                )} />
                <span className="text-gray-600">
                  {new Date(event.timestamp).toLocaleTimeString('sv-SE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span className="mx-2">-</span>
                <span className="text-gray-900">{event.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retry indicator for network issues */}
      {retryCount > 0 && retryCount < MAX_RETRY_ATTEMPTS && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center">
            <LoadingSpinner size="sm" className="mr-2" />
            <span className="text-sm text-yellow-800">
              Försöker återansluta... ({retryCount}/{MAX_RETRY_ATTEMPTS})
            </span>
          </div>
        </div>
      )}

      {/* Accessibility announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`Samtalsstatus: ${currentStatusMessage.title}. ${currentStatusMessage.description}. Progress: ${progressPercentage}%.`}
      </div>
    </div>
  );
}