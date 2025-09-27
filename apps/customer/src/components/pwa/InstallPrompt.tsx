'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

// Swedish language strings
const strings = {
  sv: {
    title: 'Installera Vocilia-appen',
    subtitle: 'Få en bättre upplevelse med snabbare åtkomst',
    benefits: {
      title: 'Fördelar med appen:',
      items: [
        'Snabbare åtkomst till verifiering',
        'Fungerar offline',
        'Push-notiser för belöningar',
        'Ingen webbläsare behövs'
      ]
    },
    instructions: {
      ios: {
        title: 'För att installera på iPhone/iPad:',
        steps: [
          'Tryck på delningsknappen',
          'Välj "Lägg till på hemskärmen"',
          'Tryck på "Lägg till"'
        ]
      },
      android: {
        title: 'För att installera på Android:',
        steps: [
          'Tryck på "Installera app"',
          'Bekräfta installationen'
        ]
      },
      desktop: {
        title: 'För att installera på dator:',
        steps: [
          'Klicka på installationsikonen i adressfältet',
          'Eller tryck på "Installera app" nedan'
        ]
      }
    },
    buttons: {
      install: 'Installera app',
      showInstructions: 'Visa instruktioner',
      hideInstructions: 'Dölj instruktioner',
      dismiss: 'Inte nu',
      postpone: 'Påminn senare',
      success: 'Tack!',
      close: 'Stäng'
    },
    success: {
      title: 'App installerad!',
      message: 'Du kan nu använda Vocilia direkt från din hemskärm.',
      nextSteps: 'Nästa gång kan du öppna appen direkt utan att gå via webbläsaren.'
    },
    contexts: {
      postVerification: 'Bra jobbat! Vill du installera appen för snabbare verifiering nästa gång?',
      postCall: 'Nu när ditt samtal är klart, vill du installera appen för framtida belöningar?',
      general: 'Installera Vocilia-appen för en bättre upplevelse'
    }
  },
  en: {
    title: 'Install Vocilia App',
    subtitle: 'Get a better experience with faster access',
    benefits: {
      title: 'App benefits:',
      items: [
        'Faster access to verification',
        'Works offline',
        'Push notifications for rewards',
        'No browser needed'
      ]
    },
    instructions: {
      ios: {
        title: 'To install on iPhone/iPad:',
        steps: [
          'Tap the share button',
          'Select "Add to Home Screen"',
          'Tap "Add"'
        ]
      },
      android: {
        title: 'To install on Android:',
        steps: [
          'Tap "Install app"',
          'Confirm installation'
        ]
      },
      desktop: {
        title: 'To install on computer:',
        steps: [
          'Click the install icon in the address bar',
          'Or tap "Install app" below'
        ]
      }
    },
    buttons: {
      install: 'Install app',
      showInstructions: 'Show instructions',
      hideInstructions: 'Hide instructions',
      dismiss: 'Not now',
      postpone: 'Remind later',
      success: 'Thanks!',
      close: 'Close'
    },
    success: {
      title: 'App installed!',
      message: 'You can now use Vocilia directly from your home screen.',
      nextSteps: 'Next time you can open the app directly without going through the browser.'
    },
    contexts: {
      postVerification: 'Great job! Want to install the app for faster verification next time?',
      postCall: 'Now that your call is complete, want to install the app for future rewards?',
      general: 'Install the Vocilia app for a better experience'
    }
  }
};

export type InstallContext = 'post-verification' | 'post-call' | 'general';
export type DeviceType = 'ios' | 'android' | 'desktop';

interface InstallPromptProps {
  context?: InstallContext;
  language?: 'sv' | 'en';
  className?: string;
  onDismiss?: () => void;
  onPostpone?: () => void;
  onInstallSuccess?: () => void;
  autoShow?: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPrompt({
  context = 'general',
  language = 'sv',
  className,
  onDismiss,
  onPostpone,
  onInstallSuccess,
  autoShow = false
}: InstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const t = strings[language];

  // Detect device type
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceType('ios');
    } else if (/android/.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }
  }, []);

  // Handle PWA installation prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowSuccess(true);
      setIsVisible(false);
      onInstallSuccess?.();
    };

    // Check if app is already installed
    if ('standalone' in navigator && (navigator as any).standalone) {
      setIsInstalled(true);
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstallSuccess]);

  // Auto-show logic
  useEffect(() => {
    if (autoShow && !isInstalled && !isVisible) {
      // Check local storage for previous dismissals
      const dismissedKey = `vocilia-install-dismissed-${context}`;
      const postponedKey = `vocilia-install-postponed-${context}`;

      const isDismissed = localStorage.getItem(dismissedKey) === 'true';
      const postponedUntil = localStorage.getItem(postponedKey);

      if (isDismissed) return;

      if (postponedUntil) {
        const postponedDate = new Date(postponedUntil);
        if (new Date() < postponedDate) return;
      }

      // Show prompt after a short delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
    
    return undefined; // Explicit return for when condition is false
  }, [autoShow, context, isInstalled, isVisible]);

  const handleInstall = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
          setIsVisible(false);
          // Success will be handled by appinstalled event
        } else {
          // User dismissed the native prompt
          handleDismiss();
        }
      } catch (error) {
        console.error('Error during installation:', error);
        // Fallback to showing manual instructions
        setShowInstructions(true);
      }
    } else {
      // No native prompt available, show instructions
      setShowInstructions(true);
    }
  }, [installPrompt]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem(`vocilia-install-dismissed-${context}`, 'true');
    onDismiss?.();
  }, [context, onDismiss]);

  const handlePostpone = useCallback(() => {
    setIsVisible(false);
    // Postpone for 7 days
    const postponeUntil = new Date();
    postponeUntil.setDate(postponeUntil.getDate() + 7);
    localStorage.setItem(`vocilia-install-postponed-${context}`, postponeUntil.toISOString());
    onPostpone?.();
  }, [context, onPostpone]);

  const getContextMessage = () => {
    switch (context) {
      case 'post-verification':
        return t.contexts.postVerification;
      case 'post-call':
        return t.contexts.postCall;
      default:
        return t.contexts.general;
    }
  };

  // Don't show if already installed
  if (isInstalled && !showSuccess) {
    return null;
  }

  // Success message
  if (showSuccess) {
    return (
      <div
        className={cn(
          'fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-lg bg-green-50 border border-green-200 p-4 shadow-lg',
          className
        )}
        role="alert"
        aria-live="polite"
        aria-labelledby="install-success-title"
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.53a.75.75 0 00-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 id="install-success-title" className="text-sm font-medium text-green-800">
              {t.success.title}
            </h3>
            <p className="mt-1 text-sm text-green-700">{t.success.message}</p>
            <p className="mt-2 text-xs text-green-600">{t.success.nextSteps}</p>
          </div>
          <button
            onClick={() => setShowSuccess(false)}
            className="ml-4 inline-flex text-green-400 hover:text-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-green-50"
            aria-label={t.buttons.close}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Main install prompt
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-lg bg-white border border-gray-200 shadow-lg',
        className
      )}
      role="dialog"
      aria-labelledby="install-prompt-title"
      aria-describedby="install-prompt-description"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 id="install-prompt-title" className="text-lg font-medium text-gray-900">
                {t.title}
              </h3>
              <p id="install-prompt-description" className="mt-1 text-sm text-gray-600">
                {getContextMessage()}
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900">{t.benefits.title}</h4>
          <ul className="mt-2 space-y-1">
            {t.benefits.items.map((benefit, index) => (
              <li key={index} className="flex items-center text-sm text-gray-600">
                <svg
                  className="h-4 w-4 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions (expandable) */}
        {showInstructions && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-900">
              {t.instructions[deviceType].title}
            </h4>
            <ol className="mt-2 space-y-1 text-sm text-blue-800 list-decimal list-inside">
              {t.instructions[deviceType].steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-col space-y-2">
          {/* Primary install button */}
          {(isInstallable || deviceType === 'android') && (
            <Button
              onClick={handleInstall}
              variant="primary"
              size="md"
              className="w-full"
              aria-describedby="install-prompt-description"
            >
              {t.buttons.install}
            </Button>
          )}

          {/* Instructions toggle */}
          <Button
            onClick={() => setShowInstructions(!showInstructions)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {showInstructions ? t.buttons.hideInstructions : t.buttons.showInstructions}
          </Button>

          {/* Secondary actions */}
          <div className="flex space-x-2">
            <Button
              onClick={handlePostpone}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              {t.buttons.postpone}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              {t.buttons.dismiss}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for programmatic control
export function useInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    // Check if app is already installed
    if ('standalone' in navigator && (navigator as any).standalone) {
      setIsInstalled(true);
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        return outcome === 'accepted';
      } catch (error) {
        console.error('Error during installation:', error);
        return false;
      }
    }
    return false;
  }, [installPrompt]);

  return {
    isInstallable,
    isInstalled,
    triggerInstall,
    canInstall: isInstallable && !isInstalled
  };
}