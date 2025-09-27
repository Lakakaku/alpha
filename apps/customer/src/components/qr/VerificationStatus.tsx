'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { VerificationSessionStatus } from '@vocilia/types';

interface VerificationStatusProps {
  sessionToken: string;
  onStatusChange?: (status: VerificationSessionStatus) => void;
}

export function VerificationStatus({ sessionToken, onStatusChange }: VerificationStatusProps) {
  const [status, setStatus] = useState<VerificationSessionStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToken) {
      checkStatus();
      // Poll for status updates every 3 seconds
      const interval = setInterval(checkStatus, 3000);
      return () => clearInterval(interval);
    }
    
    return undefined; // Explicit return for when sessionToken is falsy
  }, [sessionToken]);

  const checkStatus = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/v1/verification/session/${sessionToken}`);

      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
        setError(null);
        onStatusChange?.(data.status);
      } else {
        setError('Failed to check status');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'pending':
        return {
          color: 'yellow',
          icon: '⏳',
          text: 'Waiting for verification...',
          description: 'Please complete the verification form'
        };
      case 'completed':
        return {
          color: 'green',
          icon: '✅',
          text: 'Verification complete',
          description: 'Your transaction has been verified successfully'
        };
      case 'expired':
        return {
          color: 'red',
          icon: '⏰',
          text: 'Session expired',
          description: 'Please scan a new QR code to continue'
        };
      case 'failed':
        return {
          color: 'red',
          icon: '❌',
          text: 'Verification failed',
          description: 'Unable to verify your transaction details'
        };
      default:
        return {
          color: 'gray',
          icon: '❓',
          text: 'Unknown status',
          description: 'Please refresh the page'
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner size="sm" className="mr-2" />
        <span className="text-sm text-gray-600">Checking status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <div className={`bg-${statusDisplay.color}-50 border border-${statusDisplay.color}-200 rounded-lg p-4`}>
      <div className="flex items-center">
        <span className="text-lg mr-3">{statusDisplay.icon}</span>
        <div>
          <h3 className={`text-sm font-medium text-${statusDisplay.color}-800`}>
            {statusDisplay.text}
          </h3>
          <p className={`text-sm text-${statusDisplay.color}-700 mt-1`}>
            {statusDisplay.description}
          </p>
        </div>
      </div>
    </div>
  );
}