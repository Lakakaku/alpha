'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAutoSaveOptions<T> {
  data: T;
  interval?: number; // Debounce interval in milliseconds
  enabled?: boolean;
  onSave: (data: T) => Promise<void> | void;
  onSuccess?: (data: T) => void;
  onError?: (error: Error, data: T) => void;
  compareFn?: (prev: T, next: T) => boolean; // Custom comparison function
}

interface UseAutoSaveReturn {
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  saveNow: () => Promise<void>;
  clearAutoSave: () => void;
  manualSave: () => Promise<void>;
  errorMessage: string | null;
}

export function useAutoSave<T>({
  data,
  interval = 500,
  enabled = true,
  onSave,
  onSuccess,
  onError,
  compareFn
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout>();
  const previousDataRef = useRef<T>(data);
  const isSavingRef = useRef(false);
  const saveRequestIdRef = useRef(0);

  // Default comparison function - deep equality check
  const defaultCompareFn = useCallback((prev: T, next: T): boolean => {
    return JSON.stringify(prev) === JSON.stringify(next);
  }, []);

  const compare = compareFn || defaultCompareFn;

  const performSave = useCallback(async (dataToSave: T, requestId: number) => {
    if (isSavingRef.current || saveRequestIdRef.current !== requestId) {
      return; // Another save is in progress or this request is outdated
    }

    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setErrorMessage(null);

      await onSave(dataToSave);

      // Check if this is still the latest request
      if (saveRequestIdRef.current === requestId) {
        setSaveStatus('saved');
        setLastSaved(new Date());
        previousDataRef.current = dataToSave;
        onSuccess?.(dataToSave);

        // Reset status after a short delay
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      }
    } catch (error) {
      if (saveRequestIdRef.current === requestId) {
        const errorObj = error as Error;
        setSaveStatus('error');
        setErrorMessage(errorObj.message || 'Save failed');
        onError?.(errorObj, dataToSave);

        // Reset error status after a delay
        setTimeout(() => {
          setSaveStatus('idle');
          setErrorMessage(null);
        }, 5000);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, onSuccess, onError]);

  const scheduleAutoSave = useCallback((dataToSave: T) => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new save request
    const requestId = ++saveRequestIdRef.current;

    // Schedule the save
    timeoutRef.current = setTimeout(() => {
      performSave(dataToSave, requestId);
    }, interval);
  }, [enabled, interval, performSave]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const requestId = ++saveRequestIdRef.current;
    await performSave(data, requestId);
  }, [data, performSave]);

  const manualSave = useCallback(async () => {
    // Force save regardless of data changes
    const requestId = ++saveRequestIdRef.current;
    await performSave(data, requestId);
  }, [data, performSave]);

  const clearAutoSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    saveRequestIdRef.current++;
    setSaveStatus('idle');
    setErrorMessage(null);
  }, []);

  // Watch for data changes and schedule auto-save
  useEffect(() => {
    if (!enabled) return;

    // Check if data has actually changed
    const hasChanged = !compare(previousDataRef.current, data);
    
    if (hasChanged) {
      scheduleAutoSave(data);
    }
  }, [data, enabled, compare, scheduleAutoSave]);

  // Handle component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle page visibility changes - save when page becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && enabled) {
        // Check if there are pending changes
        const hasChanges = !compare(previousDataRef.current, data);
        if (hasChanges && !isSavingRef.current) {
          // Fire and forget save
          performSave(data, ++saveRequestIdRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, data, compare, performSave]);

  // Handle page unload - attempt to save
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasChanges = !compare(previousDataRef.current, data);
      if (hasChanges && enabled) {
        // Try to save synchronously (limited browser support)
        try {
          if (navigator.sendBeacon) {
            // Use sendBeacon for better reliability
            navigator.sendBeacon('/api/auto-save', JSON.stringify(data));
          } else {
            // Fallback to synchronous save
            performSave(data, ++saveRequestIdRef.current);
          }
        } catch (error) {
          console.error('Failed to save on page unload:', error);
        }

        // Show confirmation dialog
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data, enabled, compare, performSave]);

  // Periodic heartbeat save for long sessions
  useEffect(() => {
    if (!enabled) return;

    const heartbeatInterval = setInterval(() => {
      // Save every 5 minutes if there are changes
      const hasChanges = !compare(previousDataRef.current, data);
      if (hasChanges && !isSavingRef.current) {
        performSave(data, ++saveRequestIdRef.current);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(heartbeatInterval);
  }, [enabled, data, compare, performSave]);

  return {
    saveStatus,
    lastSaved,
    saveNow,
    clearAutoSave,
    manualSave,
    errorMessage
  };
}