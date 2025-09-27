'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '../../../components/ui/Button';

function VerificationErrorContent() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');

  useEffect(() => {
    const message = searchParams.get('message') ?? 'An unknown error occurred during verification';
    const code = searchParams.get('code') ?? 'UNKNOWN_ERROR';

    setErrorMessage(decodeURIComponent(message));
    setErrorCode(code);
  }, [searchParams]);

  const getErrorDetails = (code: string) => {
    switch (code) {
      case 'INVALID_SESSION_TOKEN':
        return {
          title: 'Session Expired',
          description: 'Your verification session has expired. Please scan the QR code again.',
          suggestion: 'Try scanning a fresh QR code from your receipt.',
          canRetry: true
        };
      case 'VALIDATION_ERROR':
        return {
          title: 'Validation Failed',
          description: 'The transaction details you provided do not match our records.',
          suggestion: 'Please check that all details match your Swish payment exactly.',
          canRetry: true
        };
      case 'RATE_LIMIT_EXCEEDED':
        return {
          title: 'Too Many Attempts',
          description: 'You have exceeded the maximum number of verification attempts.',
          suggestion: 'Please wait before trying again, or contact support if you need help.',
          canRetry: false
        };
      case 'STORE_NOT_FOUND':
        return {
          title: 'Invalid Store',
          description: 'The store associated with this QR code could not be found.',
          suggestion: 'Please ensure you scanned a valid QR code from your receipt.',
          canRetry: false
        };
      case 'FRAUD_DETECTED':
        return {
          title: 'Security Check Failed',
          description: 'This verification attempt has been flagged for security reasons.',
          suggestion: 'If you believe this is an error, please contact customer support.',
          canRetry: false
        };
      default:
        return {
          title: 'Verification Error',
          description: errorMessage ?? 'An unexpected error occurred during verification.',
          suggestion: 'Please try again or contact support if the problem persists.',
          canRetry: true
        };
    }
  };

  const errorDetails = getErrorDetails(errorCode);

  const handleRetry = () => {
    // Go back to try again
    window.history.back();
  };

  const handleNewQR = () => {
    // Navigate to QR scanner or home
    window.location.href = '/';
  };

  const handleSupport = () => {
    // Open support contact
    window.open('mailto:support@vocilia.com?subject=Verification Error&body=' + encodeURIComponent(
      `Error Code: ${errorCode}\nError Message: ${errorMessage}\nTimestamp: ${new Date().toISOString()}`
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Error Header */}
          <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 mb-4 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {errorDetails.title}
              </h1>
              <p className="text-red-100">
                Verification could not be completed
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Error Details */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                What went wrong?
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {errorDetails.description}
              </p>
              {errorCode !== 'UNKNOWN_ERROR' && (
                <div className="text-xs text-red-600">
                  <span className="font-medium">Error Code:</span> {errorCode}
                </div>
              )}
            </div>

            {/* Suggestion */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Suggested Solution
                  </h3>
                  <div className="mt-1 text-sm text-blue-700">
                    <p>{errorDetails.suggestion}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Issues */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Common Issues & Solutions:
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2 mr-3"></span>
                  <span><strong>Time mismatch:</strong> Check that the time matches your Swish payment within ±2 minutes</span>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2 mr-3"></span>
                  <span><strong>Amount mismatch:</strong> Ensure the amount matches within ±2 SEK</span>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2 mr-3"></span>
                  <span><strong>Phone number:</strong> Use the Swedish phone number from your Swish account</span>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2 mr-3"></span>
                  <span><strong>QR code:</strong> Make sure to scan a fresh QR code from your receipt</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {errorDetails.canRetry && (
                <Button
                  className="w-full text-lg py-3"
                  variant="primary"
                  onClick={handleRetry}
                >
                  Try Again
                </Button>
              )}

              <Button
                className="w-full"
                variant="outline"
                onClick={handleNewQR}
              >
                Scan New QR Code
              </Button>

              <Button
                className="w-full"
                variant="ghost"
                onClick={handleSupport}
              >
                Contact Support
              </Button>
            </div>

            {/* Help Text */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                If you continue to experience issues, please contact our support team with the error code above.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Powered by Vocilia • Secure feedback verification
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerificationErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading error details...</p>
        </div>
      </div>
    }>
      <VerificationErrorContent />
    </Suspense>
  );
}