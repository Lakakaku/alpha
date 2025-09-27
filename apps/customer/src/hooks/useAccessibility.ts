import { useCallback, useEffect, useRef } from 'react';

interface AccessibilityFeatures {
  reducedMotion?: boolean;
  highContrast?: boolean;
  screenReaderDetected?: boolean;
  voiceControlSupported?: boolean;
  hapticFeedbackSupported?: boolean;
}

interface UseAccessibilityReturn {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  applyAccessibilityPreferences: (preferences: any) => void;
  detectAccessibilityFeatures: () => Promise<AccessibilityFeatures>;
  focusElement: (element: HTMLElement | string) => void;
  skipToContent: () => void;
  toggleHighContrast: () => void;
  increaseTextSize: () => void;
  decreaseTextSize: () => void;
  pauseAllAnimations: () => void;
  resumeAllAnimations: () => void;
}

export function useAccessibility(): UseAccessibilityReturn {
  const announcementRef = useRef<HTMLDivElement | null>(null);

  // Create announcement region for screen readers
  useEffect(() => {
    if (!announcementRef.current) {
      const region = document.createElement('div');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.className = 'sr-only';
      region.id = 'accessibility-announcements';
      document.body.appendChild(region);
      announcementRef.current = region;
    }

    return () => {
      if (announcementRef.current) {
        document.body.removeChild(announcementRef.current);
        announcementRef.current = null;
      }
    };
  }, []);

  // Announce message to screen readers
  const announceToScreenReader = useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (!announcementRef.current) return;

    // Clear previous message
    announcementRef.current.textContent = '';
    announcementRef.current.setAttribute('aria-live', priority);

    // Add new message after a brief delay to ensure it's announced
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = message;
      }
    }, 100);

    // Clear message after announcement
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 3000);
  }, []);

  // Detect accessibility features from browser/system
  const detectAccessibilityFeatures = useCallback(async (): Promise<AccessibilityFeatures> => {
    const features: AccessibilityFeatures = {};

    try {
      // Detect reduced motion preference
      if (window.matchMedia) {
        features.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        features.highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      }

      // Detect screen reader (basic heuristics)
      features.screenReaderDetected = await detectScreenReader();

      // Check voice control support
      features.voiceControlSupported = 'SpeechRecognition' in window || 
                                       'webkitSpeechRecognition' in window;

      // Check haptic feedback support
      features.hapticFeedbackSupported = 'vibrate' in navigator;

    } catch (error) {
      console.warn('Failed to detect accessibility features:', error);
    }

    return features;
  }, []);

  // Detect screen reader presence
  const detectScreenReader = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check for common screen reader indicators
      const indicators = [
        // NVDA, JAWS, etc. often modify these properties
        () => window.navigator.userAgent.includes('JAWS'),
        () => window.navigator.userAgent.includes('NVDA'),
        () => window.navigator.userAgent.includes('SARACON'),
        () => window.navigator.userAgent.includes('Dragon'),
        
        // Check for assistive technology APIs
        () => 'speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0,
        
        // Check for reduced motion (often correlates with screen reader use)
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        
        // Check for high contrast mode
        () => window.matchMedia('(prefers-contrast: high)').matches,
      ];

      const hasIndicators = indicators.some(check => {
        try {
          return check();
        } catch {
          return false;
        }
      });

      // Also check for focus behavior that suggests keyboard navigation
      let focusDetected = false;
      const focusHandler = () => {
        focusDetected = true;
        document.removeEventListener('focusin', focusHandler);
      };
      
      document.addEventListener('focusin', focusHandler);
      
      // Resolve after a brief delay
      setTimeout(() => {
        document.removeEventListener('focusin', focusHandler);
        resolve(hasIndicators || focusDetected);
      }, 1000);
    });
  }, []);

  // Apply accessibility preferences to document
  const applyAccessibilityPreferences = useCallback((preferences: any) => {
    const root = document.documentElement;
    
    // Apply font size
    if (preferences.fontSize) {
      const fontSizes = {
        small: '14px',
        medium: '16px',
        large: '18px',
        xl: '20px'
      };
      root.style.setProperty('--base-font-size', fontSizes[preferences.fontSize as keyof typeof fontSizes]);
    }

    // Apply high contrast
    root.classList.toggle('high-contrast', preferences.highContrast);
    
    // Apply reduced motion
    root.classList.toggle('reduce-motion', preferences.reducedMotion);
    
    // Apply screen reader optimization
    root.classList.toggle('screen-reader-optimized', preferences.screenReaderOptimized);
    
    // Apply enhanced focus indicators
    root.classList.toggle('enhanced-focus', preferences.focusIndicators === 'enhanced');
    
    // Apply color blind support
    root.classList.toggle('colorblind-support', preferences.colorBlindSupport);
    
    // Set language
    if (preferences.language) {
      root.setAttribute('lang', preferences.language);
    }

    // Configure skip links
    if (preferences.skipLinks) {
      addSkipLinks();
    } else {
      removeSkipLinks();
    }
  }, []);

  // Add skip links to page
  const addSkipLinks = useCallback(() => {
    if (document.getElementById('skip-links')) return;

    const skipLinks = document.createElement('div');
    skipLinks.id = 'skip-links';
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Hoppa till huvudinnehåll</a>
      <a href="#navigation" class="skip-link">Hoppa till navigation</a>
      <a href="#footer" class="skip-link">Hoppa till sidfot</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);
  }, []);

  // Remove skip links
  const removeSkipLinks = useCallback(() => {
    const skipLinks = document.getElementById('skip-links');
    if (skipLinks) {
      skipLinks.remove();
    }
  }, []);

  // Focus an element by reference or selector
  const focusElement = useCallback((element: HTMLElement | string) => {
    try {
      const target = typeof element === 'string' 
        ? document.querySelector(element) as HTMLElement
        : element;
        
      if (target) {
        target.focus();
        
        // Announce focus change to screen readers
        const label = target.getAttribute('aria-label') || 
                     target.getAttribute('title') || 
                     target.textContent?.trim() || 
                     'Element';
        announceToScreenReader(`Fokus på ${label}`);
      }
    } catch (error) {
      console.warn('Failed to focus element:', error);
    }
  }, [announceToScreenReader]);

  // Skip to main content
  const skipToContent = useCallback(() => {
    const mainContent = document.getElementById('main-content') || 
                       document.querySelector('main') ||
                       document.querySelector('[role="main"]');
    
    if (mainContent) {
      focusElement(mainContent as HTMLElement);
    }
  }, [focusElement]);

  // Toggle high contrast mode
  const toggleHighContrast = useCallback(() => {
    const root = document.documentElement;
    const isHighContrast = root.classList.contains('high-contrast');
    
    root.classList.toggle('high-contrast', !isHighContrast);
    
    announceToScreenReader(
      isHighContrast ? 'Hög kontrast avaktiverad' : 'Hög kontrast aktiverad'
    );
  }, [announceToScreenReader]);

  // Increase text size
  const increaseTextSize = useCallback(() => {
    const root = document.documentElement;
    const currentSize = getComputedStyle(root).getPropertyValue('--base-font-size') || '16px';
    const newSize = Math.min(parseInt(currentSize) + 2, 24) + 'px';
    
    root.style.setProperty('--base-font-size', newSize);
    announceToScreenReader(`Textstorlek ökad till ${newSize}`);
  }, [announceToScreenReader]);

  // Decrease text size
  const decreaseTextSize = useCallback(() => {
    const root = document.documentElement;
    const currentSize = getComputedStyle(root).getPropertyValue('--base-font-size') || '16px';
    const newSize = Math.max(parseInt(currentSize) - 2, 12) + 'px';
    
    root.style.setProperty('--base-font-size', newSize);
    announceToScreenReader(`Textstorlek minskad till ${newSize}`);
  }, [announceToScreenReader]);

  // Pause all animations
  const pauseAllAnimations = useCallback(() => {
    const style = document.createElement('style');
    style.id = 'pause-animations';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
    
    announceToScreenReader('Animationer pausade');
  }, [announceToScreenReader]);

  // Resume all animations
  const resumeAllAnimations = useCallback(() => {
    const style = document.getElementById('pause-animations');
    if (style) {
      style.remove();
    }
    
    announceToScreenReader('Animationer återupptagna');
  }, [announceToScreenReader]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if in input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Alt + / = Toggle high contrast
      if (event.altKey && event.key === '/') {
        event.preventDefault();
        toggleHighContrast();
      }

      // Alt + + = Increase text size
      if (event.altKey && event.key === '+') {
        event.preventDefault();
        increaseTextSize();
      }

      // Alt + - = Decrease text size
      if (event.altKey && event.key === '-') {
        event.preventDefault();
        decreaseTextSize();
      }

      // Alt + 0 = Skip to content
      if (event.altKey && event.key === '0') {
        event.preventDefault();
        skipToContent();
      }

      // Alt + p = Pause/resume animations
      if (event.altKey && event.key === 'p') {
        event.preventDefault();
        const isPaused = document.getElementById('pause-animations');
        if (isPaused) {
          resumeAllAnimations();
        } else {
          pauseAllAnimations();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleHighContrast, increaseTextSize, decreaseTextSize, skipToContent, pauseAllAnimations, resumeAllAnimations]);

  return {
    announceToScreenReader,
    applyAccessibilityPreferences,
    detectAccessibilityFeatures,
    focusElement,
    skipToContent,
    toggleHighContrast,
    increaseTextSize,
    decreaseTextSize,
    pauseAllAnimations,
    resumeAllAnimations,
  };
}