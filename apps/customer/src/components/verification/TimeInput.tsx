'use client';

import { forwardRef } from 'react';
import { Input } from '../ui/Input';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  ({ value, onChange, error, placeholder = "14:30", disabled, className }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // Allow only time format HH:MM
      if (inputValue === '' || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(inputValue)) {
        onChange(inputValue);
      }
    };

    const getCurrentTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    return (
      <div className="space-y-2">
        <Input
          ref={ref}
          type="time"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          error={error}
        />
        {!value && (
          <button
            type="button"
            onClick={() => onChange(getCurrentTime())}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Use current time ({getCurrentTime()})
          </button>
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

TimeInput.displayName = 'TimeInput';