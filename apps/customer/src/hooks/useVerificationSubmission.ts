'use client';

import { useState } from 'react';
import type { VerificationSubmissionRequest, VerificationSubmissionResponse } from '@vocilia/types';

interface SubmissionRequest {
  sessionToken: string;
  submission: VerificationSubmissionRequest;
}

interface UseVerificationSubmissionResult {
  submitVerification: (request: SubmissionRequest) => Promise<VerificationSubmissionResponse & { error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function useVerificationSubmission(): UseVerificationSubmissionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitVerification = async (request: SubmissionRequest): Promise<VerificationSubmissionResponse & { error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

      const response = await fetch(`${apiBaseUrl}/api/v1/verification/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': request.sessionToken,
        },
        body: JSON.stringify(request.submission),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors (400) vs other errors
        if (response.status === 400 && data.validation_results) {
          // Return validation results for form handling
          return {
            success: false,
            verification_id: '',
            validation_results: data.validation_results,
            next_steps: ''
          };
        }

        const errorMessage = data.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          verification_id: '',
          validation_results: {
            time_validation: { status: 'invalid' },
            amount_validation: { status: 'invalid' },
            phone_validation: { status: 'invalid_format' },
            overall_valid: false
          },
          next_steps: ''
        };
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        verification_id: '',
        validation_results: {
          time_validation: { status: 'invalid' },
          amount_validation: { status: 'invalid' },
          phone_validation: { status: 'invalid_format' },
          overall_valid: false
        },
        next_steps: ''
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitVerification,
    isLoading,
    error
  };
}