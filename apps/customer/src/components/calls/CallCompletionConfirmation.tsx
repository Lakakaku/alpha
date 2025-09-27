'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';
import type { 
  CallCompletionConfirmRequest,
  CallCompletionConfirmResponse 
} from '@vocilia/types/src/calls';

interface CallCompletionConfirmationProps {
  sessionId: string;
  estimatedReward?: number;
  rewardTimeline?: string;
  onConfirmed: (result: CallCompletionConfirmResponse) => void;
  onError: (error: string) => void;
  className?: string;
}

interface Rating {
  value: number;
  label: string;
  emoji: string;
}

const satisfactionRatings: Rating[] = [
  { value: 1, label: 'Mycket missnöjd', emoji: '😞' },
  { value: 2, label: 'Missnöjd', emoji: '😔' },
  { value: 3, label: 'Neutral', emoji: '😐' },
  { value: 4, label: 'Nöjd', emoji: '🙂' },
  { value: 5, label: 'Mycket nöjd', emoji: '😊' }
];

const qualityRatings: Rating[] = [
  { value: 1, label: 'Mycket dålig', emoji: '📞💔' },
  { value: 2, label: 'Dålig', emoji: '📞😟' },
  { value: 3, label: 'Okej', emoji: '📞😐' },
  { value: 4, label: 'Bra', emoji: '📞🙂' },
  { value: 5, label: 'Utmärkt', emoji: '📞😊' }
];

export function CallCompletionConfirmation({
  sessionId,
  estimatedReward,
  rewardTimeline,
  onConfirmed,
  onError,
  className = ''
}: CallCompletionConfirmationProps) {
  const [step, setStep] = useState<'intro' | 'ratings' | 'confirmation'>('intro');
  const [satisfactionRating, setSatisfactionRating] = useState<number | null>(null);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { hapticFeedback, touchOptimized, isMobile } = useMobileOptimization();

  const handleRatingSelect = (type: 'satisfaction' | 'quality', value: number) => {
    hapticFeedback?.('light');
    
    if (type === 'satisfaction') {
      setSatisfactionRating(value);
    } else {
      setQualityRating(value);
    }
  };

  const handleSubmitConfirmation = async () => {
    try {
      setIsSubmitting(true);
      hapticFeedback?.('medium');

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const request: CallCompletionConfirmRequest = {
        sessionId,
        customer_confirmed: true,
        satisfaction_rating: satisfactionRating || 5,
        quality_rating: qualityRating || 8,
        feedback_text: feedback.trim() || undefined
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/calls/${sessionId}/confirm-completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: CallCompletionConfirmResponse = await response.json();
      
      hapticFeedback?.('success');
      onConfirmed(result);

    } catch (error) {
      console.error('Call confirmation error:', error);
      hapticFeedback?.('error');
      const errorMessage = error instanceof Error ? error.message : 'Misslyckades med att bekräfta samtalet';
      onError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRewardDate = (dateString?: string) => {
    if (!dateString) return 'inom 24-48 timmar';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('sv-SE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'inom 24-48 timmar';
    }
  };

  if (step === 'intro') {
    return (
      <div className={`call-completion-intro bg-white rounded-lg shadow-lg p-6 ${className}`}>
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <span className="text-3xl" role="img" aria-label="Samtalet slutfört">
              ✅
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Grattis! Samtalet är slutfört
          </h2>
          <p className="text-lg text-gray-600">
            Tack för din medverkan i vår kundundersökning
          </p>
        </div>

        {/* Reward Information */}
        {estimatedReward && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-3">
              <span className="text-2xl mr-2" role="img" aria-label="Belöning">🎁</span>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-800">
                  {estimatedReward} kr
                </div>
                <div className="text-sm text-green-700">
                  Uppskattad belöning
                </div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-green-700">
                <strong>Tillgänglig:</strong> {formatRewardDate(rewardTimeline)}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Belöningen kommer att skickas via Swish till ditt telefonnummer
              </p>
            </div>
          </div>
        )}

        {/* What's Next */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            Vad händer nu?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Vi bekräftar att samtalet är genomfört</li>
            <li>• Din belöning bearbetas automatiskt</li>
            <li>• Du får en Swish-överföring inom 24-48 timmar</li>
            <li>• Du kan lämna feedback (valfritt)</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={() => setStep('ratings')}
            className={`w-full ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            variant="primary"
          >
            Bekräfta samtal och lämna feedback
          </Button>
          
          <Button
            onClick={handleSubmitConfirmation}
            disabled={isSubmitting}
            className={`w-full ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            variant="secondary"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Bekräftar...
              </div>
            ) : (
              'Snabbbekräfta utan feedback'
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Genom att bekräfta accepterar du att samtalet är genomfört enligt våra villkor
        </p>
      </div>
    );
  }

  if (step === 'ratings') {
    return (
      <div className={`call-completion-ratings bg-white rounded-lg shadow-lg p-6 ${className}`}>
        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setStep('intro')}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Tillbaka
          </button>
          <span className="text-sm text-gray-500">Steg 1 av 2</span>
        </div>

        <div className="space-y-8">
          {/* Satisfaction Rating */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
              Hur nöjd var du med samtalet?
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {satisfactionRatings.map((rating) => (
                <button
                  key={rating.value}
                  onClick={() => handleRatingSelect('satisfaction', rating.value)}
                  className={`
                    p-3 rounded-lg text-center transition-all
                    ${satisfactionRating === rating.value
                      ? 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                      : 'bg-gray-50 border-2 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }
                    ${touchOptimized ? 'min-h-[80px]' : 'min-h-[60px]'}
                  `}
                >
                  <div className="text-2xl mb-1">{rating.emoji}</div>
                  <div className={`text-xs ${isMobile ? 'text-[10px]' : ''}`}>
                    {rating.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality Rating */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
              Hur var ljudkvaliteten?
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {qualityRatings.map((rating) => (
                <button
                  key={rating.value}
                  onClick={() => handleRatingSelect('quality', rating.value)}
                  className={`
                    p-3 rounded-lg text-center transition-all
                    ${qualityRating === rating.value
                      ? 'bg-green-100 border-2 border-green-500 text-green-900'
                      : 'bg-gray-50 border-2 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }
                    ${touchOptimized ? 'min-h-[80px]' : 'min-h-[60px]'}
                  `}
                >
                  <div className="text-lg mb-1">{rating.emoji}</div>
                  <div className={`text-xs ${isMobile ? 'text-[10px]' : ''}`}>
                    {rating.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Ytterligare kommentarer (valfritt)
            </h3>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Berätta gärna mer om din upplevelse..."
              className={`
                w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${touchOptimized ? 'min-h-[120px] text-lg' : 'h-24'}
              `}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {feedback.length}/500 tecken
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={() => setStep('confirmation')}
            disabled={!satisfactionRating || !qualityRating}
            className={`w-full ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
          >
            Fortsätt till bekräftelse
          </Button>
        </div>
      </div>
    );
  }

  // Confirmation step
  return (
    <div className={`call-completion-confirmation bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setStep('ratings')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
          disabled={isSubmitting}
        >
          ← Tillbaka
        </button>
        <span className="text-sm text-gray-500">Steg 2 av 2</span>
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Sammanfattning av din feedback
          </h3>
        </div>

        {/* Ratings Summary */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Allmän tillfredsställelse:
              </span>
              <div className="flex items-center">
                <span className="mr-2">
                  {satisfactionRatings.find(r => r.value === satisfactionRating)?.emoji}
                </span>
                <span className="text-sm text-gray-600">
                  {satisfactionRatings.find(r => r.value === satisfactionRating)?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Ljudkvalitet:
              </span>
              <div className="flex items-center">
                <span className="mr-2">
                  {qualityRatings.find(r => r.value === qualityRating)?.emoji}
                </span>
                <span className="text-sm text-gray-600">
                  {qualityRatings.find(r => r.value === qualityRating)?.label}
                </span>
              </div>
            </div>
          </div>

          {feedback && (
            <div className="bg-gray-50 rounded-lg p-4">
              <span className="text-sm font-medium text-gray-700 block mb-2">
                Din kommentar:
              </span>
              <p className="text-sm text-gray-600 italic">
                "{feedback}"
              </p>
            </div>
          )}
        </div>

        {/* Reward Reminder */}
        {estimatedReward && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-lg font-semibold text-green-800 mb-1">
              🎁 {estimatedReward} kr belöning
            </div>
            <div className="text-sm text-green-700">
              Tillgänglig: {formatRewardDate(rewardTimeline)}
            </div>
          </div>
        )}

        {/* Final Confirmation */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmitConfirmation}
            disabled={isSubmitting}
            className={`w-full ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            variant="primary"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Skickar bekräftelse...
              </div>
            ) : (
              'Bekräfta samtal och skicka feedback'
            )}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Tack för din tid och dina värdefulla synpunkter!
        </p>
      </div>
    </div>
  );
}