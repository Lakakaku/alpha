'use client';

import { useState } from 'react';
import type { SessionDetailsResponse } from '@vocilia/types';

interface UseSessionDetailsResult {
  getSessionDetails: (sessionToken: string) => Promise<SessionDetailsResponse & { error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function useSessionDetails(): UseSessionDetailsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSessionDetails = async (sessionToken: string): Promise<SessionDetailsResponse & { error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

      const response = await fetch(`${apiBaseUrl}/api/v1/verification/session/${sessionToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          session_id: '',
          store_info: {
            store_id: '',
            store_name: '',
            business_name: ''
          },
          status: 'failed',
          qr_version: 0,
          created_at: '',
          expires_at: ''
        } as SessionDetailsResponse & { error: string };
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        session_id: '',
        store_info: {
          store_id: '',
          store_name: '',
          business_name: ''
        },
        status: 'failed',
        qr_version: 0,
        created_at: '',
        expires_at: ''
      } as SessionDetailsResponse & { error: string };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getSessionDetails,
    isLoading,
    error
  };
}