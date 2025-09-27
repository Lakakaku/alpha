'use client';

import { useState } from 'react';
import { VerificationAPI } from '../services/api/verification-api';
import type { QRVerificationRequest, QRVerificationResponse } from '@vocilia/types';

interface UseQRVerificationReturn {
  verifyQR: (params: {
    storeId: string;
    qrParams: { v: string; t: string };
    clientInfo: QRVerificationRequest;
  }) => Promise<QRVerificationResponse>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useQRVerification(): UseQRVerificationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyQR = async (params: {
    storeId: string;
    qrParams: { v: string; t: string };
    clientInfo: QRVerificationRequest;
  }): Promise<QRVerificationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await VerificationAPI.initializeQRVerification(
        params.storeId,
        params.qrParams,
        params.clientInfo
      );
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR verification failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    verifyQR,
    isLoading,
    error,
    clearError
  };
}