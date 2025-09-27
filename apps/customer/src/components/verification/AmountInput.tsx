'use client';

import { forwardRef } from 'react';
import { Input } from '../ui/Input';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  toleranceRange?: string;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, error, placeholder = "125.50", disabled, className, toleranceRange }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow only decimal numbers with up to 2 decimal places
      if (inputValue === '' || /^\d*\.?\d{0,2}$/.test(inputValue)) {
        onChange(inputValue);
      }
    };

    const formatValue = (val: string) => {
      // Ensure proper decimal formatting
      if (val && !val.includes('.') && val.length > 0) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          return num.toFixed(2);
        }
      }
      return val;
    };

    const handleBlur = () => {
      if (value) {
        onChange(formatValue(value));
      }
    };

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`pl-8 ${className}`}
            error={error}
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
            SEK
          </span>
        </div>
        
        {toleranceRange && !error && (
          <p className="text-xs text-gray-500">
            Expected range: {toleranceRange}
          </p>
        )}
        
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

AmountInput.displayName = 'AmountInput';