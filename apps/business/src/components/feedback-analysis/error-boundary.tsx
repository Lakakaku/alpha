/**
 * Error Boundaries and Loading States for Feedback Analysis Dashboard
 * Feature: 008-step-2-6
 * Task: T042
 */

'use client';

import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@vocilia/ui/components/alert';

interface ErrorInfo {
  componentStack: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  context?: string;
}

/**
 * Error Boundary for Feedback Analysis Components
 * Provides graceful error handling with retry functionality
 */
export class FeedbackAnalysisErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, context } = this.props;
    
    // Log error with context
    console.error(`[FeedbackAnalysis${context ? ` - ${context}` : ''}] Error caught:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
    });

    this.setState({ errorInfo });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Report to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError({
        error,
        errorInfo,
        context: `FeedbackAnalysis${context ? ` - ${context}` : ''}`,
        errorId: this.state.errorId,
        retryCount: this.state.retryCount,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`[FeedbackAnalysis] Max retries (${maxRetries}) exceeded`);
      return;
    }

    console.info(`[FeedbackAnalysis] Retrying... (attempt ${retryCount + 1}/${maxRetries})`);

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: retryCount + 1,
    });

    // Clear any existing retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Auto-retry after delay if error persists
    this.retryTimeoutId = setTimeout(() => {
      if (this.state.hasError) {
        this.handleRetry();
      }
    }, Math.min(1000 * Math.pow(2, retryCount), 10000)); // Exponential backoff, max 10s
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, enableRetry = true, maxRetries = 3, context } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={error}
          retryCount={retryCount}
          maxRetries={maxRetries}
          onRetry={enableRetry ? this.handleRetry : undefined}
          context={context}
        />
      );
    }

    return children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  retryCount: number;
  maxRetries: number;
  onRetry?: () => void;
  context?: string;
}

/**
 * Error Fallback Component
 * Displays user-friendly error messages with retry options
 */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  retryCount,
  maxRetries,
  onRetry,
  context,
}) => {
  const getErrorMessage = () => {
    if (!error) return 'Ett oväntat fel uppstod';

    // Swedish error messages for common scenarios
    if (error.message.includes('fetch')) {
      return 'Kunde inte hämta data. Kontrollera din internetanslutning.';
    }
    if (error.message.includes('timeout')) {
      return 'Begäran tog för lång tid. Försök igen senare.';
    }
    if (error.message.includes('404')) {
      return 'Den begärda informationen kunde inte hittas.';
    }
    if (error.message.includes('403')) {
      return 'Du har inte behörighet att komma åt denna information.';
    }
    if (error.message.includes('500')) {
      return 'Ett serverfel uppstod. Vårt team har blivit informerat.';
    }

    return 'Ett tekniskt fel uppstod. Försök igen eller kontakta support.';
  };

  const canRetry = onRetry && retryCount < maxRetries;

  return (
    <div className="flex items-center justify-center min-h-[200px] p-6">
      <div className="max-w-md w-full">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-red-800 mb-2">
              {context ? `${context} - Fel` : 'Fel'}
            </h3>
            <AlertDescription className="text-red-700 mb-4">
              {getErrorMessage()}
            </AlertDescription>
            
            {retryCount > 0 && (
              <p className="text-xs text-red-600 mb-3">
                Försök {retryCount} av {maxRetries}
              </p>
            )}

            <div className="flex gap-2">
              {canRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Försök igen
                </button>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Ladda om sidan
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 text-xs text-red-600">
                <summary className="cursor-pointer font-medium">Teknisk information</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </Alert>
      </div>
    </div>
  );
};

// Loading States Components

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading Spinner Component
 * Provides consistent loading indicators across the dashboard
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <RefreshCw
      className={`animate-spin text-blue-600 ${sizeClasses[size]} ${className}`}
    />
  );
};

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
  className?: string;
}

/**
 * Loading State Component
 * Displays loading message with optional spinner
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Laddar...',
  showSpinner = true,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="flex flex-col items-center gap-3">
        {showSpinner && <LoadingSpinner size="lg" />}
        <p className="text-sm text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  rows?: number;
}

/**
 * Skeleton Loading Component
 * Provides content placeholder during loading
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rows = 1,
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`bg-gray-200 rounded ${i === 0 ? '' : 'mt-2'} h-4`}
          style={{
            width: `${85 + Math.random() * 15}%`, // Random width 85-100%
          }}
        />
      ))}
    </div>
  );
};

interface DataTableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Data Table Skeleton
 * Skeleton loading for table-based data
 */
export const DataTableSkeleton: React.FC<DataTableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header skeleton */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={`header-${i}`} className="h-4" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={`row-${i}`} className="grid grid-cols-4 gap-4 p-4 border rounded-lg">
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={`cell-${i}-${j}`} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
};

interface NetworkStatusProps {
  className?: string;
}

/**
 * Network Status Indicator
 * Shows connection status with automatic detection
 */
export const NetworkStatus: React.FC<NetworkStatusProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000); // Hide after 3 seconds
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    // Initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus && isOnline) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          isOnline
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}
      >
        {isOnline ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        {isOnline ? 'Anslutning återställd' : 'Ingen internetanslutning'}
      </div>
    </div>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

/**
 * Progress Bar Component
 * Shows progress for long-running operations
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  className = '',
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm text-gray-500">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

// Higher-order component for adding error boundaries to components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  const WrappedComponent: React.FC<P> = (props) => (
    <FeedbackAnalysisErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </FeedbackAnalysisErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for handling async operations with loading states
export function useAsyncOperation<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = async (operation: () => Promise<T>) => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setData(null);
  };

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}

// Export all components
export default FeedbackAnalysisErrorBoundary;