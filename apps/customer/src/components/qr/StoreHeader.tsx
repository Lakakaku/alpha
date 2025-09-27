'use client';

interface StoreInfo {
  store_id: string;
  store_name: string;
  business_name: string;
  logo_url?: string;
}

interface StoreHeaderProps {
  storeInfo: StoreInfo;
  fraudWarning?: boolean;
}

export function StoreHeader({ storeInfo, fraudWarning }: StoreHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8">
      <div className="text-center">
        {/* Logo */}
        {storeInfo.logo_url ? (
          <div className="mx-auto h-16 w-16 mb-4">
            <img
              src={storeInfo.logo_url}
              alt={`${storeInfo.business_name} logo`}
              className="h-full w-full rounded-full object-cover bg-white shadow-lg"
            />
          </div>
        ) : (
          <div className="mx-auto h-16 w-16 mb-4 bg-white rounded-full flex items-center justify-center shadow-lg">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}

        {/* Store Info */}
        <h2 className="text-xl font-bold text-white mb-1">
          {storeInfo.store_name}
        </h2>
        <p className="text-blue-100 text-sm mb-4">
          {storeInfo.business_name}
        </p>

        {/* Fraud Warning */}
        {fraudWarning && (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mt-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Security Notice
                </h3>
                <div className="mt-1 text-sm text-yellow-700">
                  <p>
                    Please verify this is the correct store before proceeding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Indicator */}
        <div className="mt-4 flex items-center justify-center text-green-100">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">QR Code Verified</span>
        </div>
      </div>
    </div>
  );
}