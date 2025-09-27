'use client';

import { useEffect, useState } from 'react';
import { CallStatusResponse } from '@vocilia/types/src/calls';

export type RewardStatus = 'pending' | 'processing' | 'available' | 'paid';
export type MilestoneStatus = 'completed' | 'in_progress' | 'pending' | 'failed';

export interface RewardMilestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  completedAt?: string;
  estimatedAt?: string;
  isPaymentMilestone?: boolean;
}

export interface RewardTimelineProps {
  sessionId: string;
  rewardAmount: number; // Amount in SEK
  rewardStatus: RewardStatus;
  payoutDate?: string; // ISO timestamp when reward will be available
  milestones: RewardMilestone[];
  showAnimation?: boolean;
  onMilestoneClick?: (milestone: RewardMilestone) => void;
  className?: string;
}

const MILESTONE_ICONS = {
  verification: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  call: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  processing: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  payment: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
  ),
};

const DEFAULT_MILESTONES: RewardMilestone[] = [
  {
    id: 'verification',
    title: 'Köp verifierat',
    description: 'Ditt köp har verifierats',
    status: 'completed',
  },
  {
    id: 'call_scheduled',
    title: 'Samtal inbokat',
    description: 'Feedback-samtal är schemalagt',
    status: 'completed',
  },
  {
    id: 'call_completed',
    title: 'Samtal genomfört',
    description: 'Du har delat din feedback',
    status: 'in_progress',
  },
  {
    id: 'processing',
    title: 'Bearbetning',
    description: 'Din feedback bearbetas',
    status: 'pending',
  },
  {
    id: 'payment',
    title: 'Utbetalning',
    description: 'Belöning skickas via Swish',
    status: 'pending',
    isPaymentMilestone: true,
  },
];

export function RewardTimeline({
  sessionId,
  rewardAmount = 25,
  rewardStatus,
  payoutDate,
  milestones = DEFAULT_MILESTONES,
  showAnimation = true,
  onMilestoneClick,
  className = '',
}: RewardTimelineProps) {
  const [animatedMilestones, setAnimatedMilestones] = useState<string[]>([]);
  const [showRewardPulse, setShowRewardPulse] = useState(false);

  // Format payout date
  const formatPayoutDate = (dateString?: string): string => {
    if (!dateString) return 'Inom 48 timmar';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours <= 24) {
      return `Inom ${diffHours} timmar`;
    } else if (diffHours <= 48) {
      return 'Inom 48 timmar';
    } else {
      return date.toLocaleDateString('sv-SE', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Animate milestones on mount
  useEffect(() => {
    if (showAnimation) {
      const completedMilestones = milestones
        .filter(m => m.status === 'completed')
        .map(m => m.id);
      
      completedMilestones.forEach((id, index) => {
        setTimeout(() => {
          setAnimatedMilestones(prev => [...prev, id]);
        }, index * 300);
      });

      // Show reward pulse for available rewards
      if (rewardStatus === 'available') {
        setTimeout(() => {
          setShowRewardPulse(true);
        }, completedMilestones.length * 300 + 500);
      }
    }
  }, [milestones, rewardStatus, showAnimation]);

  // Get milestone icon
  const getMilestoneIcon = (milestone: RewardMilestone) => {
    if (milestone.isPaymentMilestone) return MILESTONE_ICONS.payment;
    if (milestone.id.includes('verification')) return MILESTONE_ICONS.verification;
    if (milestone.id.includes('call')) return MILESTONE_ICONS.call;
    if (milestone.id.includes('processing')) return MILESTONE_ICONS.processing;
    return MILESTONE_ICONS.verification;
  };

  // Get status styles
  const getStatusStyles = (status: MilestoneStatus, isAnimated: boolean) => {
    const baseStyles = 'transition-all duration-300 ease-in-out';
    
    switch (status) {
      case 'completed':
        return {
          circle: `${baseStyles} bg-green-500 text-white shadow-lg ${isAnimated ? 'scale-110' : 'scale-100'}`,
          text: 'text-gray-900',
          line: 'bg-green-500',
        };
      case 'in_progress':
        return {
          circle: `${baseStyles} bg-blue-500 text-white animate-pulse`,
          text: 'text-gray-900 font-medium',
          line: 'bg-gray-300',
        };
      case 'pending':
        return {
          circle: `${baseStyles} bg-gray-300 text-gray-500`,
          text: 'text-gray-500',
          line: 'bg-gray-300',
        };
      case 'failed':
        return {
          circle: `${baseStyles} bg-red-500 text-white`,
          text: 'text-red-600',
          line: 'bg-gray-300',
        };
      default:
        return {
          circle: `${baseStyles} bg-gray-300 text-gray-500`,
          text: 'text-gray-500',
          line: 'bg-gray-300',
        };
    }
  };

  // Get reward status color
  const getRewardStatusColor = () => {
    switch (rewardStatus) {
      case 'available':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'paid':
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
  };

  // Get reward status text
  const getRewardStatusText = () => {
    switch (rewardStatus) {
      case 'available':
        return 'Redo för utbetalning';
      case 'processing':
        return 'Bearbetas';
      case 'paid':
        return 'Utbetald';
      default:
        return 'Väntar';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Header with reward amount */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-6">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg ${showRewardPulse ? 'animate-pulse' : ''}`}>
            <span className="text-2xl font-bold text-blue-600">{rewardAmount}</span>
            <span className="text-sm font-medium text-blue-600 ml-1">kr</span>
          </div>
          
          <h2 className="mt-4 text-xl font-bold text-white">
            Din belöning
          </h2>
          
          <p className={`mt-1 text-sm ${getRewardStatusColor()}`}>
            <span className="bg-white/20 px-2 py-1 rounded-full">
              {getRewardStatusText()}
            </span>
          </p>
          
          {payoutDate && rewardStatus !== 'paid' && (
            <p className="mt-2 text-blue-100 text-sm">
              Utbetalning: {formatPayoutDate(payoutDate)}
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-6">
        <div className="relative">
          {milestones.map((milestone, index) => {
            const isLast = index === milestones.length - 1;
            const isAnimated = animatedMilestones.includes(milestone.id);
            const styles = getStatusStyles(milestone.status, isAnimated);
            
            return (
              <div
                key={milestone.id}
                className={`relative flex items-start ${!isLast ? 'pb-8' : ''} ${onMilestoneClick ? 'cursor-pointer' : ''}`}
                onClick={() => onMilestoneClick?.(milestone)}
                role={onMilestoneClick ? 'button' : undefined}
                tabIndex={onMilestoneClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onMilestoneClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onMilestoneClick(milestone);
                  }
                }}
                aria-label={`${milestone.title}: ${milestone.description}`}
              >
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={`absolute left-6 top-12 w-0.5 h-8 ${styles.line}`}
                    aria-hidden="true"
                  />
                )}
                
                {/* Milestone circle */}
                <div className={`relative flex-shrink-0 w-12 h-12 ${styles.circle} rounded-full flex items-center justify-center`}>
                  {getMilestoneIcon(milestone)}
                  
                  {/* Success animation */}
                  {milestone.status === 'completed' && isAnimated && (
                    <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                  )}
                </div>
                
                {/* Milestone content */}
                <div className="ml-4 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-base font-medium ${styles.text}`}>
                      {milestone.title}
                    </h3>
                    
                    {milestone.completedAt && (
                      <time className="text-xs text-gray-500">
                        {new Date(milestone.completedAt).toLocaleTimeString('sv-SE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    )}
                  </div>
                  
                  <p className={`mt-1 text-sm ${styles.text}`}>
                    {milestone.description}
                  </p>
                  
                  {milestone.estimatedAt && milestone.status === 'pending' && (
                    <p className="mt-1 text-xs text-gray-400">
                      Uppskattat: {formatPayoutDate(milestone.estimatedAt)}
                    </p>
                  )}
                  
                  {/* Payment milestone special styling */}
                  {milestone.isPaymentMilestone && milestone.status === 'pending' && (
                    <div className="mt-2 inline-flex items-center text-xs text-blue-600">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Swish-utbetalning
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Additional info */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Session: {sessionId.slice(0, 8)}...</span>
            <span>Vocilia Belöningar</span>
          </div>
          
          {rewardStatus === 'available' && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-800 font-medium">
                  Din belöning är redo! Du kommer att få en Swish-betalning inom kort.
                </p>
              </div>
            </div>
          )}
          
          {rewardStatus === 'paid' && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  Belöning utbetald. Tack för din feedback!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Default export for easier importing
export default RewardTimeline;