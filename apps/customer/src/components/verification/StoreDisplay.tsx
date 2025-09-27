'use client';

import { useState } from 'react';
import Image from 'next/image';

interface StoreInfo {
  store_id: string;
  store_name: string;
  business_name: string;
  logo_url?: string;
}

interface StoreDisplayProps {
  storeInfo: StoreInfo;
  isLoading?: boolean;
  error?: string;
}

export function StoreDisplay({ storeInfo, isLoading, error }: StoreDisplayProps) {
  const [logoError, setLogoError] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center space-x-4 animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-b border-red-200 p-6">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Store Information Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
      <div className="p-6">
        <div className="flex items-center space-x-4">
          {/* Store Logo */}
          <div className="flex-shrink-0">
            {storeInfo.logo_url && !logoError ? (
              <div className="w-16 h-16 bg-white rounded-lg p-2 shadow-lg">
                <Image
                  src={storeInfo.logo_url}
                  alt={`${storeInfo.store_name} logo`}
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>

          {/* Store Information */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {storeInfo.store_name}
            </h1>
            {storeInfo.business_name && storeInfo.business_name !== storeInfo.store_name && (
              <p className="text-blue-100 text-sm truncate">
                {storeInfo.business_name}
              </p>
            )}
            <div className="mt-2 flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-blue-100 text-xs">Verified Business</span>
            </div>
          </div>

          {/* QR Code Indicator */}
          <div className="flex-shrink-0">
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Additional Store Info */}
        <div className="mt-4 pt-4 border-t border-blue-500 border-opacity-30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-blue-100">Secure verification process</span>
            </div>
            <div className="text-blue-200 text-xs">
              ID: {storeInfo.store_id.slice(-8)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}