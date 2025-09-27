'use client';

import { useState, useEffect } from 'react';
import { VerificationForm } from './VerificationForm';
import { VerificationStatus } from './VerificationStatus';
import { Button } from '../ui/Button';

interface MobileOptimizedFormProps {
  sessionToken: string;
  onSuccess: (verificationId: string) => void;
  onError: (error: string) => void;
}

export function MobileOptimizedForm({ sessionToken, onSuccess, onError }: MobileOptimizedFormProps) {
  const [isFormVisible, setIsFormVisible] = useState(true);
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  useEffect(() => {
    // Detect device type
    const detectDevice = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  const handleStatusChange = (status: any) => {
    if (status === 'completed') {
      setIsFormVisible(false);
    }
  };

  return (
    <div className="w-full">
      {/* Mobile-optimized status indicator */}
      <div className="mb-4">
        <VerificationStatus
          sessionToken={sessionToken}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Form or success message */}
      {isFormVisible ? (
        <div className="space-y-4">
          {/* Mobile-specific instructions */}
          {deviceType === 'mobile' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                📱 Mobile Tips
              </h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Use your device's number pad for easier input</li>
                <li>• Double-check details against your Swish notification</li>
                <li>• Ensure stable internet connection</li>
              </ul>
            </div>
          )}

          <VerificationForm
            sessionToken={sessionToken}
            onSuccess={onSuccess}
            onError={onError}
          />

          {/* Mobile-specific help */}
          <div className="text-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Trigger vibration on mobile if supported
                if ('vibrate' in navigator) {
                  navigator.vibrate(100);
                }
                // Show help modal or expand help section
                alert('Help: Make sure all transaction details match your Swish payment exactly. Time tolerance: ±2 minutes, Amount tolerance: ±2 SEK');
              }}
            >
              Need Help? 💡
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Verification Complete!
          </h2>
          <p className="text-gray-600 mb-6">
            Your transaction has been successfully verified.
          </p>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => onSuccess('completed')}
          >
            Continue to Feedback
          </Button>
        </div>
      )}
    </div>
  );
}