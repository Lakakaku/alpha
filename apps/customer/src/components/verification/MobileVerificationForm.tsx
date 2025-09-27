'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useVerificationSubmission } from '../../hooks/useVerificationSubmission';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';

const verificationSchema = z.object({
  transaction_time: z.string()
    .min(1, 'Tid krävs')
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ange tid i HH:MM format'),
  transaction_amount: z.string()
    .min(1, 'Belopp krävs')
    .refine((val) => {
      const num = parseFloat(val.replace(',', '.'));
      return !isNaN(num) && num > 0;
    }, 'Ange ett giltigt belopp'),
  phone_number: z.string()
    .min(1, 'Telefonnummer krävs')
    .min(10, 'Telefonnummer måste vara minst 10 siffror')
    .max(15, 'Telefonnummer får vara max 15 siffror')
});

type VerificationFormData = z.infer<typeof verificationSchema>;

interface MobileVerificationFormProps {
  sessionToken: string;
  onSuccess: (verificationId: string) => void;
  onError: (error: string) => void;
  className?: string;
}

export function MobileVerificationForm({ 
  sessionToken, 
  onSuccess, 
  onError,
  className = '' 
}: MobileVerificationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const { submitVerification } = useVerificationSubmission();
  const { 
    isMobile, 
    touchOptimized, 
    hapticFeedback,
    preventZoom 
  } = useMobileOptimization();

  const formRef = useRef<HTMLFormElement>(null);
  const recognitionRef = useRef<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    setValue,
    watch,
    trigger
  } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    mode: 'onChange'
  });

  const watchedFields = watch();
  const steps = ['time', 'amount', 'phone'];
  const stepTitles = [
    'Transaktionstidens',
    'Transaktionsbelopp',
    'Telefonnummer'
  ];

  // Voice input setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'sv-SE';
    }
  }, []);

  // Handle voice input
  const startVoiceInput = (field: keyof VerificationFormData) => {
    if (!recognitionRef.current) return;

    setIsListening(true);
    hapticFeedback?.();

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      
      // Process transcript based on field
      if (field === 'transaction_time') {
        // Parse time from speech (e.g., "fjorton trettio" -> "14:30")
        const timeValue = parseTimeFromSpeech(transcript);
        if (timeValue) setValue('transaction_time', timeValue);
      } else if (field === 'transaction_amount') {
        // Parse amount from speech (e.g., "etthundra tjugofem kronor" -> "125")
        const amountValue = parseAmountFromSpeech(transcript);
        if (amountValue) setValue('transaction_amount', amountValue);
      } else if (field === 'phone_number') {
        // Parse phone number from speech
        const phoneValue = parsePhoneFromSpeech(transcript);
        if (phoneValue) setValue('phone_number', phoneValue);
      }
      
      setIsListening(false);
      trigger(field);
    };

    recognitionRef.current.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
  };

  // Helper functions for voice parsing
  const parseTimeFromSpeech = (text: string): string | null => {
    // Basic Swedish time parsing - could be enhanced
    const timePatterns = [
      /(\d{1,2})\s*(?:och|:|\s)\s*(\d{1,2})/,
      /(?:klockan\s*)?(\d{1,2}):(\d{1,2})/i
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
      }
    }
    return null;
  };

  const parseAmountFromSpeech = (text: string): string | null => {
    // Basic Swedish amount parsing
    const numberMatch = text.match(/(\d+(?:[,.]?\d{1,2})?)/);
    if (numberMatch) {
      return numberMatch[1].replace(',', '.');
    }
    return null;
  };

  const parsePhoneFromSpeech = (text: string): string | null => {
    // Extract digits from speech
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return formatPhoneNumber(digits);
    }
    return null;
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.startsWith('46')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return digits.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2 $3 $4');
    }
    
    return digits;
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      hapticFeedback?.();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      hapticFeedback?.();
    }
  };

  const onSubmit = async (data: VerificationFormData) => {
    try {
      setIsSubmitting(true);
      hapticFeedback?.();

      const result = await submitVerification({
        sessionToken,
        submission: {
          transaction_time: data.transaction_time,
          transaction_amount: parseFloat(data.transaction_amount.replace(',', '.')),
          phone_number: data.phone_number
        }
      });

      if (result.success) {
        hapticFeedback?.('success');
        onSuccess(result.verification_id);
      } else {
        hapticFeedback?.('error');
        
        if (result.validation_results) {
          const { validation_results } = result;

          if (validation_results.time_validation?.status === 'out_of_tolerance') {
            setError('transaction_time', {
              message: `Tiden är utanför tillåten marginal (${validation_results.time_validation.tolerance_range})`
            });
            setCurrentStep(0);
          }

          if (validation_results.amount_validation?.status === 'out_of_tolerance') {
            setError('transaction_amount', {
              message: `Beloppet är utanför tillåten marginal (${validation_results.amount_validation.tolerance_range})`
            });
            setCurrentStep(1);
          }

          if (validation_results.phone_validation?.status !== 'valid') {
            let phoneError = 'Ogiltigt telefonnummer';
            if (validation_results.phone_validation?.status === 'not_swedish') {
              phoneError = 'Vänligen ange ett svenskt telefonnummer';
            } else if (validation_results.phone_validation?.status === 'invalid_format') {
              phoneError = 'Vänligen ange ett giltigt telefonnummer';
            }
            setError('phone_number', { message: phoneError });
            setCurrentStep(2);
          }
        } else {
          onError(result.error || 'Verifiering misslyckades');
        }
      }
    } catch (error) {
      console.error('Verification submission error:', error);
      hapticFeedback?.('error');
      onError('Kunde inte skicka verifiering. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Swipe gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    formRef.current?.setAttribute('data-start-x', touch.clientX.toString());
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const startX = parseFloat(formRef.current?.getAttribute('data-start-x') || '0');
    const endX = touch.clientX;
    const diffX = startX - endX;

    if (Math.abs(diffX) > 50) { // Minimum swipe distance
      if (diffX > 0 && currentStep < steps.length - 1) {
        nextStep();
      } else if (diffX < 0 && currentStep > 0) {
        prevStep();
      }
    }
  };

  return (
    <div className={`mobile-verification-form ${className}`}>
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Steg {currentStep + 1} av {steps.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(((currentStep + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <form 
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)} 
        className="space-y-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        {...(preventZoom && { onFocus: (e) => e.target.addEventListener('touchstart', () => {}) })}
      >
        {/* Step Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {stepTitles[currentStep]}
          </h2>
          <p className="text-sm text-gray-600">
            Fyll i från din Swish-bekräftelse
          </p>
        </div>

        {/* Transaction Time Step */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="transaction_time" className="block text-lg font-medium text-gray-700 mb-3 text-center">
                Transaktionstidens *
              </label>
              <div className="relative">
                <Input
                  id="transaction_time"
                  type="time"
                  {...register('transaction_time')}
                  error={errors.transaction_time?.message}
                  className={`text-center text-2xl py-4 ${touchOptimized ? 'min-h-[60px]' : ''}`}
                  style={{ fontSize: isMobile ? '24px' : '18px' }}
                />
                {showVoiceInput && recognitionRef.current && (
                  <button
                    type="button"
                    onClick={() => startVoiceInput('transaction_time')}
                    disabled={isListening}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  >
                    {isListening ? '🎤' : '🎙️'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Exempel: 14:30
              </p>
            </div>
          </div>
        )}

        {/* Transaction Amount Step */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="transaction_amount" className="block text-lg font-medium text-gray-700 mb-3 text-center">
                Transaktionsbelopp (SEK) *
              </label>
              <div className="relative">
                <Input
                  id="transaction_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="125.50"
                  {...register('transaction_amount')}
                  error={errors.transaction_amount?.message}
                  className={`text-center text-2xl py-4 pr-16 ${touchOptimized ? 'min-h-[60px]' : ''}`}
                  style={{ fontSize: isMobile ? '24px' : '18px' }}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-lg">kr</span>
                </div>
                {showVoiceInput && recognitionRef.current && (
                  <button
                    type="button"
                    onClick={() => startVoiceInput('transaction_amount')}
                    disabled={isListening}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  >
                    {isListening ? '🎤' : '🎙️'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Exakt belopp från Swish
              </p>
            </div>
          </div>
        )}

        {/* Phone Number Step */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone_number" className="block text-lg font-medium text-gray-700 mb-3 text-center">
                Telefonnummer *
              </label>
              <div className="relative">
                <Input
                  id="phone_number"
                  type="tel"
                  inputMode="tel"
                  placeholder="070-123 45 67"
                  {...register('phone_number')}
                  error={errors.phone_number?.message}
                  className={`text-center text-2xl py-4 ${touchOptimized ? 'min-h-[60px]' : ''}`}
                  style={{ fontSize: isMobile ? '24px' : '18px' }}
                />
                {showVoiceInput && recognitionRef.current && (
                  <button
                    type="button"
                    onClick={() => startVoiceInput('phone_number')}
                    disabled={isListening}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  >
                    {isListening ? '🎤' : '🎙️'}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Nummer som användes för betalning
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex space-x-4 pt-6">
          {currentStep > 0 && (
            <Button
              type="button"
              onClick={prevStep}
              variant="secondary"
              className={`flex-1 ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            >
              ← Tillbaka
            </Button>
          )}
          
          {currentStep < steps.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={
                (currentStep === 0 && (!watchedFields.transaction_time || !!errors.transaction_time)) ||
                (currentStep === 1 && (!watchedFields.transaction_amount || !!errors.transaction_amount)) ||
                (currentStep === 2 && (!watchedFields.phone_number || !!errors.phone_number))
              }
              className={`flex-1 ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            >
              Nästa →
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={`flex-1 ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Verifierar...
                </div>
              ) : (
                'Verifiera Transaktion'
              )}
            </Button>
          )}
        </div>

        {/* Voice Input Toggle */}
        {recognitionRef.current && (
          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setShowVoiceInput(!showVoiceInput)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showVoiceInput ? 'Dölj röstinmatning' : 'Visa röstinmatning'}
            </button>
          </div>
        )}

        {/* Swipe Hint */}
        {isMobile && (
          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">
              Svep åt vänster/höger för att navigera
            </p>
          </div>
        )}

        {/* Help Section */}
        {currentStep === steps.length - 1 && (
          <div className="bg-gray-50 rounded-lg p-4 mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Verifieringskrav:
            </h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Tid måste vara inom ±2 minuter</li>
              <li>• Belopp måste vara inom ±2 SEK</li>
              <li>• Telefonnummer måste vara svenskt format</li>
              <li>• Alla uppgifter måste stämma exakt med din Swish-betalning</li>
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}