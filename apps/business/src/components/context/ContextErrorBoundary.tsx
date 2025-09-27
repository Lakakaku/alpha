'use client';

import React, { Component, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ContextErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

interface ContextErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  context?: string;
}

export class ContextErrorBoundary extends Component<
  ContextErrorBoundaryProps,
  ContextErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ContextErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ContextErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Context Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // In a real application, this would send to an error tracking service
    // like Sentry, LogRocket, or similar
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context || 'Unknown',
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
    };

    console.error('Error logged:', errorData);
    
    // Example: Send to error tracking service
    // errorTrackingService.captureException(error, { extra: errorData });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });

      // Add a small delay before retry to prevent immediate re-errors
      this.retryTimeoutId = setTimeout(() => {
        // Force re-render
        this.forceUpdate();
      }, 100);
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  private getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' | 'critical' => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch')) {
      return 'medium';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'high';
    }
    
    if (message.includes('validation') || message.includes('format')) {
      return 'low';
    }
    
    if (stack.includes('react') || stack.includes('component')) {
      return 'high';
    }
    
    return 'medium';
  };

  private getErrorRecommendation = (error: Error): string => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Check your internet connection and try again.';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'You may not have permission to access this feature. Contact your administrator.';
    }
    
    if (message.includes('validation')) {
      return 'Please check your input data and try again.';
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource could not be found. It may have been moved or deleted.';
    }
    
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3, context = 'Context Management' } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback;
      }

      const severity = this.getErrorSeverity(error);
      const recommendation = this.getErrorRecommendation(error);
      const canRetry = retryCount < maxRetries;

      const severityStyles = {
        low: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        medium: 'bg-orange-50 border-orange-200 text-orange-800',
        high: 'bg-red-50 border-red-200 text-red-800',
        critical: 'bg-red-100 border-red-300 text-red-900',
      };

      const severityIcons = {
        low: '⚠️',
        medium: '🔶',
        high: '❌',
        critical: '🚨',
      };

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className={`rounded-lg border-2 p-6 ${severityStyles[severity]}`}>
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <span className="text-2xl">{severityIcons[severity]}</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium">
                    {context} Error
                  </h3>
                  <p className="text-sm mt-1 opacity-90">
                    Something went wrong while loading this section
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium text-sm mb-2">Error Details:</h4>
                <p className="text-sm bg-white bg-opacity-50 rounded p-2 font-mono">
                  {error.message}
                </p>
              </div>

              <div className="mb-6">
                <h4 className="font-medium text-sm mb-2">Recommendation:</h4>
                <p className="text-sm">
                  {recommendation}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="flex items-center justify-center px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-md text-sm font-medium text-gray-700 transition-colors"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Retry ({maxRetries - retryCount} left)
                  </button>
                )}
                
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Reset
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Reload Page
                </button>
              </div>

              {retryCount >= maxRetries && (
                <div className="mt-4 p-3 bg-gray-100 rounded-md">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Still having issues?</strong>
                  </p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p>• Try refreshing the entire page</p>
                    <p>• Check your internet connection</p>
                    <p>• Contact support if the problem persists</p>
                  </div>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                    Developer Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for easy wrapping
export function withContextErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ContextErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ContextErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ContextErrorBoundary>
  );

  WrappedComponent.displayName = `withContextErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useContextErrorHandler() {
  const reportError = React.useCallback((error: Error, context?: string) => {
    console.error(`Context Error in ${context || 'Unknown'}:`, error);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // errorTrackingService.captureException(error, { tags: { context } });
    }
  }, []);

  const handleAsyncError = React.useCallback((promise: Promise<any>, context?: string) => {
    promise.catch((error) => {
      reportError(error, context);
    });
  }, [reportError]);

  return { reportError, handleAsyncError };
}

export default ContextErrorBoundary;