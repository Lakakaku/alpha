'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAccessibility } from '../../hooks/useAccessibility';
import { useMobileOptimization } from '../../hooks/useMobileOptimization';

interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  voiceControl: boolean;
  language: 'sv' | 'en';
  hapticFeedback: boolean;
  autoReadAlerts: boolean;
  skipLinks: boolean;
  focusIndicators: 'standard' | 'enhanced';
  colorBlindSupport: boolean;
}

interface AccessibilitySettingsProps {
  onPreferencesChange?: (preferences: AccessibilityPreferences) => void;
  className?: string;
}

const defaultPreferences: AccessibilityPreferences = {
  fontSize: 'medium',
  highContrast: false,
  reducedMotion: false,
  screenReaderOptimized: false,
  voiceControl: false,
  language: 'sv',
  hapticFeedback: true,
  autoReadAlerts: false,
  skipLinks: true,
  focusIndicators: 'standard',
  colorBlindSupport: false
};

export function AccessibilitySettings({ 
  onPreferencesChange,
  className = '' 
}: AccessibilitySettingsProps) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const { 
    announceToScreenReader,
    applyAccessibilityPreferences,
    detectAccessibilityFeatures 
  } = useAccessibility();
  
  const { hapticFeedback, touchOptimized, isMobile } = useMobileOptimization();

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  // Apply preferences when they change
  useEffect(() => {
    if (!isLoading) {
      applyPreferencesToDocument(preferences);
      onPreferencesChange?.(preferences);
    }
  }, [preferences, isLoading, onPreferencesChange]);

  const loadPreferences = async () => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem('vocilia-accessibility-preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      } else {
        // Auto-detect from browser/system settings
        const detected = await detectAccessibilityFeatures();
        setPreferences({ 
          ...defaultPreferences, 
          ...detected,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          highContrast: window.matchMedia('(prefers-contrast: high)').matches
        });
      }
    } catch (error) {
      console.error('Failed to load accessibility preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setIsSaving(true);
      
      // Save to localStorage
      localStorage.setItem('vocilia-accessibility-preferences', JSON.stringify(preferences));
      
      // Apply to document
      applyPreferencesToDocument(preferences);
      
      // Send to server if user is logged in
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
        await fetch(`${apiBaseUrl}/api/v1/accessibility/preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences)
        });
      } catch (apiError) {
        // Gracefully handle API errors - preferences still saved locally
        console.warn('Failed to sync preferences to server:', apiError);
      }

      hapticFeedback?.('success');
      announceToScreenReader('Tillgänglighetsinställningar sparade');
      
    } catch (error) {
      console.error('Failed to save accessibility preferences:', error);
      hapticFeedback?.('error');
      announceToScreenReader('Fel vid sparande av inställningar');
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreferencesToDocument = useCallback((prefs: AccessibilityPreferences) => {
    const root = document.documentElement;
    
    // Font size
    root.style.setProperty('--base-font-size', {
      small: '14px',
      medium: '16px',
      large: '18px',
      xl: '20px'
    }[prefs.fontSize]);

    // High contrast
    if (prefs.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced motion
    if (prefs.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Screen reader optimization
    if (prefs.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized');
    } else {
      root.classList.remove('screen-reader-optimized');
    }

    // Enhanced focus indicators
    if (prefs.focusIndicators === 'enhanced') {
      root.classList.add('enhanced-focus');
    } else {
      root.classList.remove('enhanced-focus');
    }

    // Color blind support
    if (prefs.colorBlindSupport) {
      root.classList.add('colorblind-support');
    } else {
      root.classList.remove('colorblind-support');
    }

    // Language
    root.setAttribute('lang', prefs.language);
  }, []);

  const updatePreference = <K extends keyof AccessibilityPreferences>(
    key: K, 
    value: AccessibilityPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    hapticFeedback?.('light');
  };

  const resetToDefaults = () => {
    setPreferences(defaultPreferences);
    hapticFeedback?.('medium');
    announceToScreenReader('Inställningar återställda till standard');
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (isLoading) {
    return (
      <div className={`accessibility-settings-loading flex justify-center items-center p-8 ${className}`}>
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-lg">Laddar tillgänglighetsinställningar...</span>
      </div>
    );
  }

  return (
    <div className={`accessibility-settings bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Tillgänglighetsinställningar
        </h2>
        <p className="text-gray-600">
          Anpassa din upplevelse för bättre tillgänglighet
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Actions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-3">
            Snabbinställningar
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => {
                updatePreference('fontSize', preferences.fontSize === 'xl' ? 'medium' : 'xl');
                updatePreference('highContrast', !preferences.highContrast);
              }}
              variant={preferences.fontSize === 'xl' ? 'primary' : 'secondary'}
              className={touchOptimized ? 'py-3 text-sm' : 'py-2 text-sm'}
            >
              🔍 Stor text & kontrast
            </Button>
            <Button
              onClick={() => {
                updatePreference('screenReaderOptimized', !preferences.screenReaderOptimized);
                updatePreference('skipLinks', true);
                updatePreference('autoReadAlerts', true);
              }}
              variant={preferences.screenReaderOptimized ? 'primary' : 'secondary'}
              className={touchOptimized ? 'py-3 text-sm' : 'py-2 text-sm'}
            >
              🗣️ Skärmläsaroptimering
            </Button>
          </div>
        </div>

        {/* Visual Settings */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('visual')}
            className="w-full p-4 text-left font-medium text-gray-900 hover:bg-gray-50 flex justify-between items-center"
            aria-expanded={activeSection === 'visual'}
          >
            <span>👁️ Visuella inställningar</span>
            <span className={`transform transition-transform ${activeSection === 'visual' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {activeSection === 'visual' && (
            <div className="border-t border-gray-200 p-4 space-y-4">
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Textstorlek
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['small', 'medium', 'large', 'xl'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updatePreference('fontSize', size)}
                      className={`
                        p-2 rounded border text-center transition-colors
                        ${preferences.fontSize === size
                          ? 'bg-blue-100 border-blue-500 text-blue-900'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      style={{ fontSize: { small: '12px', medium: '14px', large: '16px', xl: '18px' }[size] }}
                    >
                      Aa
                    </button>
                  ))}
                </div>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Hög kontrast
                  </label>
                  <p className="text-xs text-gray-500">
                    Förbättrar läsbarheten för synsvaga
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('highContrast', !preferences.highContrast)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.highContrast ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.highContrast}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.highContrast ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Color Blind Support */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Färgblindhetsstöd
                  </label>
                  <p className="text-xs text-gray-500">
                    Använder mönster istället för bara färger
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('colorBlindSupport', !preferences.colorBlindSupport)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.colorBlindSupport ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.colorBlindSupport}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.colorBlindSupport ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Enhanced Focus */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fokusindikatorer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['standard', 'enhanced'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => updatePreference('focusIndicators', level)}
                      className={`
                        p-2 rounded border text-sm transition-colors
                        ${preferences.focusIndicators === level
                          ? 'bg-blue-100 border-blue-500 text-blue-900'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }
                      `}
                    >
                      {level === 'standard' ? 'Standard' : 'Förstärkt'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Motion & Audio Settings */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('motion')}
            className="w-full p-4 text-left font-medium text-gray-900 hover:bg-gray-50 flex justify-between items-center"
            aria-expanded={activeSection === 'motion'}
          >
            <span>🎬 Rörelse och ljud</span>
            <span className={`transform transition-transform ${activeSection === 'motion' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {activeSection === 'motion' && (
            <div className="border-t border-gray-200 p-4 space-y-4">
              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Reducerad rörelse
                  </label>
                  <p className="text-xs text-gray-500">
                    Minskar animationer och övergångar
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.reducedMotion ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.reducedMotion}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.reducedMotion ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Haptic Feedback */}
              {touchOptimized && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Haptisk feedback
                    </label>
                    <p className="text-xs text-gray-500">
                      Vibrationer vid interaktioner
                    </p>
                  </div>
                  <button
                    onClick={() => updatePreference('hapticFeedback', !preferences.hapticFeedback)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${preferences.hapticFeedback ? 'bg-blue-600' : 'bg-gray-200'}
                    `}
                    role="switch"
                    aria-checked={preferences.hapticFeedback}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${preferences.hapticFeedback ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              )}

              {/* Auto Read Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Automatisk uppläsning
                  </label>
                  <p className="text-xs text-gray-500">
                    Läser automatiskt viktiga meddelanden
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('autoReadAlerts', !preferences.autoReadAlerts)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.autoReadAlerts ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.autoReadAlerts}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.autoReadAlerts ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation & Interaction */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('navigation')}
            className="w-full p-4 text-left font-medium text-gray-900 hover:bg-gray-50 flex justify-between items-center"
            aria-expanded={activeSection === 'navigation'}
          >
            <span>⌨️ Navigering och interaktion</span>
            <span className={`transform transition-transform ${activeSection === 'navigation' ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {activeSection === 'navigation' && (
            <div className="border-t border-gray-200 p-4 space-y-4">
              {/* Screen Reader Optimization */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Skärmläsaroptimering
                  </label>
                  <p className="text-xs text-gray-500">
                    Förbättrar kompatibiliteten med skärmläsare
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('screenReaderOptimized', !preferences.screenReaderOptimized)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.screenReaderOptimized ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.screenReaderOptimized}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.screenReaderOptimized ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Skip Links */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Hoppa över-länkar
                  </label>
                  <p className="text-xs text-gray-500">
                    Gör det enklare att navigera med tangentbord
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('skipLinks', !preferences.skipLinks)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.skipLinks ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.skipLinks}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.skipLinks ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Voice Control */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Röststyrning
                  </label>
                  <p className="text-xs text-gray-500">
                    Aktiverar stöd för röstkommandon
                  </p>
                </div>
                <button
                  onClick={() => updatePreference('voiceControl', !preferences.voiceControl)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${preferences.voiceControl ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                  role="switch"
                  aria-checked={preferences.voiceControl}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${preferences.voiceControl ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Language Setting */}
        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            🌍 Språk
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updatePreference('language', 'sv')}
              className={`
                p-3 rounded border text-center transition-colors
                ${preferences.language === 'sv'
                  ? 'bg-blue-100 border-blue-500 text-blue-900'
                  : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              🇸🇪 Svenska
            </button>
            <button
              onClick={() => updatePreference('language', 'en')}
              className={`
                p-3 rounded border text-center transition-colors
                ${preferences.language === 'en'
                  ? 'bg-blue-100 border-blue-500 text-blue-900'
                  : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              🇺🇸 English
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-6 border-t border-gray-200">
          <Button
            onClick={savePreferences}
            disabled={isSaving}
            className={`flex-1 ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            variant="primary"
          >
            {isSaving ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Sparar...
              </div>
            ) : (
              'Spara inställningar'
            )}
          </Button>
          
          <Button
            onClick={resetToDefaults}
            className={`flex-1 ${touchOptimized ? 'py-4 text-lg' : 'py-3'}`}
            variant="secondary"
          >
            Återställ
          </Button>
        </div>

        {/* Help Text */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <p className="mb-2">
            <strong>Hjälp med tillgänglighet:</strong>
          </p>
          <ul className="space-y-1 text-xs">
            <li>• Tryck Tab för att navigera med tangentbord</li>
            <li>• Använd mellanslagstangenten eller Enter för att aktivera knappar</li>
            <li>• Alla inställningar sparas automatiskt i din webbläsare</li>
            <li>• Kontakta support om du behöver ytterligare hjälp</li>
          </ul>
        </div>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isSaving && 'Sparar tillgänglighetsinställningar...'}
      </div>
    </div>
  );
}