'use client';

import { useRouter } from 'next/navigation';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  type?: 'qr_error' | 'validation_error' | 'network_error' | 'system_error';
  canRetry?: boolean;
  onRetry?: () => void;
  showGoBack?: boolean;
}

export function ErrorDisplay({ 
  title, 
  message, 
  type = 'system_error', 
  canRetry = false, 
  onRetry,
  showGoBack = true 
}: ErrorDisplayProps) {
  const router = useRouter();

  const getErrorIcon = () => {
    switch (type) {
      case 'qr_error':
        return (
          <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        );
      case 'network_error':
        return (
          <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'validation_error':
        return (
          <svg className="w-12 h-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
    }
  };

  const getErrorColors = () => {
    switch (type) {
      case 'validation_error':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          iconBg: 'bg-amber-100',
          text: 'text-amber-800',
          subtext: 'text-amber-700'
        };
      default:
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          iconBg: 'bg-red-100',
          text: 'text-red-800',
          subtext: 'text-red-700'
        };
    }
  };

  const colors = getErrorColors();

  const getDefaultTitle = () => {
    switch (type) {
      case 'qr_error':
        return 'Invalid QR Code';
      case 'validation_error':
        return 'Validation Error';
      case 'network_error':
        return 'Connection Error';
      default:
        return 'Something went wrong';
    }
  };

  const getSuggestions = () => {
    switch (type) {
      case 'qr_error':
        return [
          'Make sure you scanned the QR code correctly',
          'Check that the QR code is from a recent receipt',
          'Ask the store staff for a new QR code if needed'
        ];
      case 'validation_error':
        return [
          'Double-check your transaction details',
          'Ensure the time is within 2 minutes of your payment',
          'Verify the amount matches your receipt exactly'
        ];
      case 'network_error':
        return [
          'Check your internet connection',
          'Try again in a few moments',
          'Make sure you have a stable connection'
        ];
      default:
        return [
          'Try refreshing the page',
          'Check your internet connection',
          'Contact support if the problem persists'
        ];
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className={`${colors.bg} ${colors.border} border rounded-lg p-6`}>
          <div className="text-center">
            {/* Error Icon */}
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${colors.iconBg}`}>
              {getErrorIcon()}
            </div>

            {/* Error Title */}
            <h3 className={`mt-4 text-lg font-medium ${colors.text}`}>
              {title || getDefaultTitle()}
            </h3>

            {/* Error Message */}
            <p className={`mt-2 text-sm ${colors.subtext}`}>
              {message}
            </p>

            {/* Suggestions */}
            <div className="mt-6 text-left">
              <h4 className={`text-sm font-medium ${colors.text} mb-2`}>
                What you can try:
              </h4>
              <ul className={`text-xs ${colors.subtext} space-y-1`}>
                {getSuggestions().map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {canRetry && onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
              )}
              
              {showGoBack && (
                <button
                  onClick={() => router.back()}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go Back
                </button>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Need help? Contact the store directly or visit our support page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}