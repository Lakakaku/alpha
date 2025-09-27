'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { QRLandingPage } from '../../../components/qr/QRLandingPage';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

export default function QRPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const storeId = params.storeId as string;
  const qrVersion = searchParams.get('v');
  const qrTimestamp = searchParams.get('t');

  useEffect(() => {
    // Validate QR parameters
    if (!storeId || !qrVersion || !qrTimestamp) {
      setValidationError('Invalid QR code. Missing required parameters.');
      setIsValidating(false);
      return;
    }

    // Basic format validation
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
      setValidationError('Invalid store ID format.');
      setIsValidating(false);
      return;
    }

    if (!/^\d+$/.test(qrVersion)) {
      setValidationError('Invalid QR version format.');
      setIsValidating(false);
      return;
    }

    if (!/^\d+$/.test(qrTimestamp)) {
      setValidationError('Invalid QR timestamp format.');
      setIsValidating(false);
      return;
    }

    // Validate timestamp is not too old (24 hours)
    const qrTime = parseInt(qrTimestamp) * 1000;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - qrTime > twentyFourHours) {
      setValidationError('QR code has expired. Please scan a new one.');
      setIsValidating(false);
      return;
    }

    setIsValidating(false);
  }, [storeId, qrVersion, qrTimestamp]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Validating QR code...</p>
        </div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Invalid QR Code</h3>
              <p className="mt-1 text-sm text-gray-500">{validationError}</p>
              <div className="mt-6">
                <p className="text-xs text-gray-400">Please scan a valid QR code from your receipt.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QRLandingPage
        storeId={storeId}
        qrVersion={qrVersion!}
        qrTimestamp={qrTimestamp!}
      />
    </ErrorBoundary>
  );
}