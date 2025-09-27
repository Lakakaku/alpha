'use client';

import type { 
  QRVerificationRequest,
  QRVerificationResponse,
  VerificationSubmissionRequest,
  VerificationSubmissionResponse,
  SessionDetailsResponse
} from '@vocilia/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * API client for verification endpoints
 */
export class VerificationAPI {
  private static getHeaders(sessionToken?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }

    return headers;
  }

  /**
   * Initialize QR verification session
   */
  static async initializeQRVerification(
    storeId: string,
    qrParams: { v: string; t: string },
    request: QRVerificationRequest
  ): Promise<QRVerificationResponse> {
    try {
      const url = `${API_BASE_URL}/api/v1/qr/verify/${storeId}?v=${qrParams.v}&t=${qrParams.t}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('QR verification initialization failed:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Failed to initialize verification session'
      );
    }
  }

  /**
   * Submit customer verification
   */
  static async submitVerification(
    sessionToken: string,
    verification: VerificationSubmissionRequest
  ): Promise<VerificationSubmissionResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/verification/submit`, {
        method: 'POST',
        headers: this.getHeaders(sessionToken),
        body: JSON.stringify(verification),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Verification submission failed:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Failed to submit verification'
      );
    }
  }

  /**
   * Get session details
   */
  static async getSessionDetails(sessionToken: string): Promise<SessionDetailsResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/verification/session/${sessionToken}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Session details retrieval failed:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Failed to retrieve session details'
      );
    }
  }

  /**
   * Health check for QR verification
   */
  static async healthCheck(storeId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/qr/verify/${storeId}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Health check failed'
      );
    }
  }
}

/**
 * React hook for QR verification
 */
export function useQRVerification() {
  const verifyQR = async (params: {
    storeId: string;
    qrParams: { v: string; t: string };
    clientInfo: QRVerificationRequest;
  }) => {
    return await VerificationAPI.initializeQRVerification(
      params.storeId,
      params.qrParams,
      params.clientInfo
    );
  };

  return { verifyQR };
}

/**
 * React hook for verification submission
 */
export function useVerificationSubmission() {
  const submitVerification = async (
    sessionToken: string,
    verification: VerificationSubmissionRequest
  ) => {
    return await VerificationAPI.submitVerification(sessionToken, verification);
  };

  return { submitVerification };
}

/**
 * React hook for session management
 */
export function useSessionDetails() {
  const getSession = async (sessionToken: string) => {
    return await VerificationAPI.getSessionDetails(sessionToken);
  };

  return { getSession };
}

/**
 * Error handling utilities
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Retry utility for failed requests
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry on client errors (4xx)
      if (error instanceof APIError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}