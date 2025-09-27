'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { Button } from '../../../components/ui/Button';

function VerificationSuccessContent() {
  const searchParams = useSearchParams();
  const verificationId = searchParams.get('id');

  const [isLoading, setIsLoading] = useState(true);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (verificationId) {
      loadVerificationDetails();
    } else {
      setError('No verification ID provided');
      setIsLoading(false);
    }
  }, [verificationId]);

  const loadVerificationDetails = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/v1/verification/status/${verificationId}`);

      if (response.ok) {
        const data = await response.json();
        setVerificationDetails(data);
      } else {
        setError('Failed to load verification details');
      }
    } catch (err) {
      setError('Failed to connect to verification service');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading verification details...</p>
        </div>
      </div>
    );
  }

  if (error || !verificationDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Unable to Load Details</h3>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-8">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 mb-4 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Verification Complete!
              </h1>
              <p className="text-green-100">
                Your transaction has been successfully verified
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Verification Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-green-800 mb-3">
                Verification Summary
              </h3>
              <div className="space-y-2 text-sm text-green-700">
                <div className="flex justify-between">
                  <span>Verification ID:</span>
                  <span className="font-mono">{verificationId?.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium">Verified ✓</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span>{new Date().toLocaleTimeString('sv-SE')}</span>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                What happens next?
              </h2>
              <p className="text-gray-600 mb-4">
                Your feedback submission has been verified and processed. You can now share your experience!
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 text-left">
                    <h3 className="text-sm font-medium text-blue-800">
                      Feedback Form Ready
                    </h3>
                    <div className="mt-1 text-sm text-blue-700">
                      <p>
                        You can now access the feedback form to share your experience with {verificationDetails.store_info?.store_name || 'this store'}.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                className="w-full text-lg py-3"
                variant="primary"
                onClick={() => {
                  // Navigate to feedback form
                  window.location.href = `/feedback?verification=${verificationId}`;
                }}
              >
                Continue to Feedback Form
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  // Close or go back
                  window.close();
                }}
              >
                Close
              </Button>
            </div>

            {/* Security Notice */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                Your verification is secure and encrypted. Transaction details are not stored permanently.
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

export default function VerificationSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading verification details...</p>
        </div>
      </div>
    }>
      <VerificationSuccessContent />
    </Suspense>
  );
}