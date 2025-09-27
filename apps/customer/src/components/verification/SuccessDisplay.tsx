'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SuccessDisplayProps {
  verificationId: string;
  message?: string;
  showAnimation?: boolean;
  nextSteps?: string;
  autoRedirect?: boolean;
  redirectDelay?: number;
}

export function SuccessDisplay({ 
  verificationId, 
  message = "Your verification is complete!", 
  showAnimation = true,
  nextSteps = "You'll receive a feedback call within 24 hours.",
  autoRedirect = false,
  redirectDelay = 5000
}: SuccessDisplayProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(redirectDelay / 1000);
  const [isAnimating, setIsAnimating] = useState(showAnimation);

  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    return undefined; // Explicit return for when showAnimation is false
  }, [showAnimation]);

  useEffect(() => {
    if (autoRedirect) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            router.push('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
    
    return undefined; // Explicit return for when autoRedirect is false
  }, [autoRedirect, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-8">
            <div className="text-center">
              {/* Animated Success Icon */}
              <div className={`mx-auto w-20 h-20 ${isAnimating ? 'animate-bounce' : ''}`}>
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <h1 className="mt-4 text-2xl font-bold text-white">
                Verification Complete!
              </h1>
              
              <p className="mt-2 text-green-100">
                {message}
              </p>
            </div>
          </div>

          {/* Success Details */}
          <div className="px-6 py-6">
            {/* Verification ID */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Verification ID</p>
                <p className="text-lg font-mono text-gray-900 break-all">
                  {verificationId}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Save this ID for your records
                </p>
              </div>
            </div>

            {/* Next Steps */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens next?
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-3 text-left">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-blue-600">1</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {nextSteps}
                  </p>
                </div>
                
                <div className="flex items-start space-x-3 text-left">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-blue-600">2</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Share your honest feedback to help improve the service
                  </p>
                </div>
                
                <div className="flex items-start space-x-3 text-left">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-blue-600">3</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Your feedback will be processed and shared with the business
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  // Copy verification ID to clipboard
                  navigator.clipboard.writeText(verificationId);
                  // You could add a toast notification here
                }}
                className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Verification ID
              </button>

              <button
                onClick={() => router.push('/')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Done
                {autoRedirect && (
                  <span className="ml-2 text-blue-200">
                    ({countdown}s)
                  </span>
                )}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500">
                Thank you for using Vocilia's verification system
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Your privacy and security are our priority
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}