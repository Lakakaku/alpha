'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VerificationForm } from './VerificationForm';
import { StoreHeader } from './StoreHeader';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useQRVerification } from '../../hooks/useQRVerification';
import type { QRVerificationResponse } from '@vocilia/types';

interface QRLandingPageProps {
  storeId: string;
  qrVersion: string;
  qrTimestamp: string;
}

export function QRLandingPage({ storeId, qrVersion, qrTimestamp }: QRLandingPageProps) {
  const router = useRouter();
  const [verificationData, setVerificationData] = useState<QRVerificationResponse | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const { verifyQR, isLoading: isVerifying } = useQRVerification();

  useEffect(() => {
    initializeVerification();
  }, []);

  const initializeVerification = async () => {
    try {
      setIsInitializing(true);
      setInitError(null);

      // Get user's IP and user agent
      const ipResponse = await fetch('/api/client-info');
      const clientInfo = await ipResponse.json();

      const result = await verifyQR({
        storeId,
        qrParams: { v: qrVersion, t: qrTimestamp },
        clientInfo: {
          ip_address: clientInfo.ip,
          user_agent: navigator.userAgent
        }
      });

      if (result.success) {
        setVerificationData(result);
        // Store session token for verification form
        sessionStorage.setItem('vocilia_session_token', result.session_token);
      } else {
        setInitError('Failed to initialize verification session');
      }
    } catch (error) {
      console.error('Failed to initialize verification:', error);
      setInitError('Unable to connect to verification service. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleVerificationComplete = (verificationId: string) => {
    // Navigate to success page
    router.push(`/verification/success?id=${verificationId}`);
  };

  const handleVerificationError = (error: string) => {
    // Navigate to error page with details
    router.push(`/verification/error?message=${encodeURIComponent(error)}`);
  };

  if (isInitializing || isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">
            {isInitializing ? 'Initializing verification session...' : 'Processing...'}
          </p>
        </div>
      </div>
    );
  }

  if (initError || !verificationData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Verification Failed</h3>
              <p className="mt-1 text-sm text-gray-500">{initError}</p>
              <div className="mt-6">
                <button
                  onClick={initializeVerification}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Store Header */}
          <StoreHeader
            storeInfo={verificationData.store_info}
            fraudWarning={verificationData.fraud_warning}
          />

          {/* Main Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verify Your Transaction
              </h1>
              <p className="text-gray-600">
                To complete your feedback submission, please verify your Swish payment details below.
              </p>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Your privacy is protected
                  </h3>
                  <div className="mt-1 text-sm text-blue-700">
                    <p>
                      We only use this information to verify your transaction. Your data is encrypted and will not be shared.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Form */}
            <VerificationForm
              sessionToken={verificationData.session_token}
              onSuccess={handleVerificationComplete}
              onError={handleVerificationError}
            />

            {/* Help Text */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                Having trouble? The transaction details should match your Swish payment exactly.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Time tolerance: ±2 minutes • Amount tolerance: ±2 SEK
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