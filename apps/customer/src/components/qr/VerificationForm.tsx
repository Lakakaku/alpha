'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useVerificationSubmission } from '../../hooks/useVerificationSubmission';

const verificationSchema = z.object({
  transaction_time: z.string()
    .min(1, 'Transaction time is required')
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter time in HH:MM format'),
  transaction_amount: z.string()
    .min(1, 'Transaction amount is required')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    }, 'Please enter a valid amount'),
  phone_number: z.string()
    .min(1, 'Phone number is required')
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be at most 15 digits')
});

type VerificationFormData = z.infer<typeof verificationSchema>;

interface VerificationFormProps {
  sessionToken: string;
  onSuccess: (verificationId: string) => void;
  onError: (error: string) => void;
}

export function VerificationForm({ sessionToken, onSuccess, onError }: VerificationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitVerification } = useVerificationSubmission();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    mode: 'onChange'
  });

  const watchedAmount = watch('transaction_amount');

  const onSubmit = async (data: VerificationFormData) => {
    try {
      setIsSubmitting(true);

      const result = await submitVerification({
        sessionToken,
        submission: {
          transaction_time: data.transaction_time,
          transaction_amount: parseFloat(data.transaction_amount.replace(',', '.')),
          phone_number: data.phone_number
        }
      });

      if (result.success) {
        onSuccess(result.verification_id);
      } else {
        // Handle validation errors
        if (result.validation_results) {
          const { validation_results } = result;

          if (validation_results.time_validation?.status === 'out_of_tolerance') {
            setError('transaction_time', {
              message: `Time is out of tolerance range (${validation_results.time_validation.tolerance_range})`
            });
          }

          if (validation_results.amount_validation?.status === 'out_of_tolerance') {
            setError('transaction_amount', {
              message: `Amount is out of tolerance range (${validation_results.amount_validation.tolerance_range})`
            });
          }

          if (validation_results.phone_validation?.status !== 'valid') {
            let phoneError = 'Invalid phone number';
            if (validation_results.phone_validation?.status === 'not_swedish') {
              phoneError = 'Please enter a Swedish phone number';
            } else if (validation_results.phone_validation?.status === 'invalid_format') {
              phoneError = 'Please enter a valid phone number format';
            }
            setError('phone_number', { message: phoneError });
          }
        } else {
          onError(result.error || 'Verification failed');
        }
      }
    } catch (error) {
      console.error('Verification submission error:', error);
      onError('Unable to submit verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format Swedish phone numbers
    if (digits.startsWith('46')) {
      // International format
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      // National format
      const formatted = digits.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2 $3 $4');
      return formatted;
    }

    return digits;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Transaction Time */}
      <div>
        <label htmlFor="transaction_time" className="block text-sm font-medium text-gray-700 mb-2">
          Transaction Time *
        </label>
        <Input
          id="transaction_time"
          type="time"
          placeholder="14:30"
          {...register('transaction_time')}
          error={errors.transaction_time?.message}
          className="text-center text-lg"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter the exact time from your Swish confirmation
        </p>
      </div>

      {/* Transaction Amount */}
      <div>
        <label htmlFor="transaction_amount" className="block text-sm font-medium text-gray-700 mb-2">
          Transaction Amount (SEK) *
        </label>
        <div className="relative">
          <Input
            id="transaction_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="125.50"
            {...register('transaction_amount')}
            error={errors.transaction_amount?.message}
            className="text-center text-lg pr-12"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-sm">SEK</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Enter the exact amount from your Swish payment
        </p>
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number *
        </label>
        <Input
          id="phone_number"
          type="tel"
          placeholder="070-123 45 67"
          {...register('phone_number')}
          error={errors.phone_number?.message}
          className="text-center text-lg"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter the phone number used for the Swish payment
        </p>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-lg py-3"
          variant="primary"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner size="sm" className="mr-2" />
              Verifying Transaction...
            </div>
          ) : (
            'Verify Transaction'
          )}
        </Button>
      </div>

      {/* Help Text */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Verification Requirements:
        </h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Transaction time must be within ±2 minutes</li>
          <li>• Transaction amount must be within ±2 SEK</li>
          <li>• Phone number must be Swedish format</li>
          <li>• All details must match your Swish payment exactly</li>
        </ul>
      </div>
    </form>
  );
}