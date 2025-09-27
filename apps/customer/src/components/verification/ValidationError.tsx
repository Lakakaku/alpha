'use client';

interface ValidationErrorProps {
  field: 'time' | 'amount' | 'phone' | 'general';
  message: string;
  details?: {
    tolerance_range?: string;
    current_value?: string;
    expected_format?: string;
  };
  onFix?: () => void;
}

export function ValidationError({ field, message, details, onFix }: ValidationErrorProps) {
  const getFieldIcon = () => {
    switch (field) {
      case 'time':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'amount':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
      case 'phone':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
    }
  };

  const getFieldName = () => {
    switch (field) {
      case 'time':
        return 'Transaction Time';
      case 'amount':
        return 'Transaction Amount';
      case 'phone':
        return 'Phone Number';
      default:
        return 'Validation';
    }
  };

  const getHelpText = () => {
    switch (field) {
      case 'time':
        return 'Check your Swish notification for the exact transaction time. It should be within 2 minutes of now.';
      case 'amount':
        return 'Enter the exact amount from your Swish payment. Small differences (±2 SEK) are acceptable.';
      case 'phone':
        return 'Use the Swedish mobile number you paid with. Format: 070-123 45 67 or +46 70 123 45 67';
      default:
        return 'Please check your input and try again.';
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600">
            {getFieldIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-800">
            {getFieldName()} Error
          </h4>
          
          <p className="mt-1 text-sm text-red-700">
            {message}
          </p>

          {details && (
            <div className="mt-2 text-xs text-red-600 space-y-1">
              {details.tolerance_range && (
                <p>
                  <span className="font-medium">Expected range:</span> {details.tolerance_range}
                </p>
              )}
              {details.current_value && (
                <p>
                  <span className="font-medium">Your input:</span> {details.current_value}
                </p>
              )}
              {details.expected_format && (
                <p>
                  <span className="font-medium">Expected format:</span> {details.expected_format}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-800">
                {getHelpText()}
              </p>
            </div>
          </div>

          {onFix && (
            <div className="mt-3">
              <button
                onClick={onFix}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Fix this field
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}