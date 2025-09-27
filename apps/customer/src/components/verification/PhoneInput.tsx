'use client';

import { forwardRef } from 'react';
import { Input } from '../ui/Input';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, placeholder = "070-123 45 67", disabled, className }, ref) => {
    const formatSwedishPhone = (input: string) => {
      // Remove all non-digit characters
      const digits = input.replace(/\D/g, '');
      
      // Handle international format starting with 46
      if (digits.startsWith('46')) {
        const nationalDigits = digits.slice(2);
        if (nationalDigits.length <= 10) {
          return formatNationalNumber(nationalDigits);
        }
      }
      
      // Handle national format starting with 0
      if (digits.startsWith('0')) {
        if (digits.length <= 10) {
          return formatNationalNumber(digits);
        }
      }
      
      // Handle format without leading 0
      if (!digits.startsWith('0') && !digits.startsWith('46')) {
        if (digits.length <= 9) {
          return formatNationalNumber('0' + digits);
        }
      }
      
      return input; // Return original if doesn't fit expected formats
    };

    const formatNationalNumber = (digits: string) => {
      if (digits.length >= 3) {
        let formatted = digits.slice(0, 3);
        if (digits.length > 3) {
          formatted += '-' + digits.slice(3, 6);
        }
        if (digits.length > 6) {
          formatted += ' ' + digits.slice(6, 8);
        }
        if (digits.length > 8) {
          formatted += ' ' + digits.slice(8, 10);
        }
        return formatted;
      }
      return digits;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow input during typing, but format on blur
      onChange(inputValue);
    };

    const handleBlur = () => {
      if (value) {
        const formatted = formatSwedishPhone(value);
        onChange(formatted);
      }
    };

    const isValidSwedishMobile = (phone: string) => {
      const digits = phone.replace(/\D/g, '');
      
      // Check if it's a valid Swedish mobile number
      const swedishMobilePattern = /^(0|46)7[02369]\d{7}$/;
      return swedishMobilePattern.test(digits);
    };

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type="tel"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`pl-12 ${className}`}
            error={error}
          />
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
            🇸🇪 +46
          </span>
        </div>
        
        <div className="text-xs text-gray-500">
          <p>Supported formats:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>070-123 45 67 (National)</li>
            <li>+46 70 123 45 67 (International)</li>
            <li>0701234567 (Without formatting)</li>
          </ul>
        </div>
        
        {value && !error && isValidSwedishMobile(value) && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Valid Swedish mobile number
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

PhoneInput.displayName = 'PhoneInput';