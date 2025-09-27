import { useState, useEffect, useCallback } from 'react';

interface MobileOptimizationHooks {
  isMobile: boolean;
  isTablet: boolean;
  touchOptimized: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'small' | 'medium' | 'large';
  hapticFeedback: ((type?: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void) | null;
  preventZoom: boolean;
  isOnline: boolean;
  connectionType: string | null;
}

export function useMobileOptimization(): MobileOptimizationHooks {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [screenSize, setScreenSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  // Detect device type and screen size
  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent;

      // Device detection
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const tabletRegex = /iPad|Android(?=.*\\bMobile\\b)(?!.*\\bPhone\\b)|KFAPWI|LG-V900|MSTouch|Nexus 7|Nexus 10|SHW-M180S|SM-T|Transformer|TF101|playbook|TouchPad/i;
      
      setIsMobile(mobileRegex.test(userAgent) && !tabletRegex.test(userAgent));
      setIsTablet(tabletRegex.test(userAgent));

      // Orientation detection
      setOrientation(width > height ? 'landscape' : 'portrait');

      // Screen size categorization
      if (width < 640) {
        setScreenSize('small');
      } else if (width < 1024) {
        setScreenSize('medium');
      } else {
        setScreenSize('large');
      }
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  // Network status monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(navigator.onLine);
      
      // Get connection information if available
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (connection) {
        setConnectionType(connection.effectiveType || connection.type || null);
      }
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen for connection changes if supported
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus);
    }

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      if (connection) {
        connection.removeEventListener('change', updateNetworkStatus);
      }
    };
  }, []);

  // Haptic feedback
  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    if ('vibrate' in navigator) {
      // Map feedback types to vibration patterns
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [40],
        success: [10, 50, 10],
        error: [50, 50, 50]
      };

      navigator.vibrate(patterns[type]);
    }

    // iOS haptic feedback (if available)
    if ('hapticFeedback' in window) {
      const impactFeedback = (window as any).hapticFeedback?.impactOccurred;
      const notificationFeedback = (window as any).hapticFeedback?.notificationOccurred;

      if (type === 'success' && notificationFeedback) {
        notificationFeedback('success');
      } else if (type === 'error' && notificationFeedback) {
        notificationFeedback('error');
      } else if (impactFeedback) {
        const intensity = type === 'heavy' ? 'heavy' : type === 'medium' ? 'medium' : 'light';
        impactFeedback(intensity);
      }
    }
  }, []);

  // Touch optimization settings
  const touchOptimized = isMobile || isTablet;
  
  // Prevent zoom on input focus (mobile)
  const preventZoom = isMobile && screenSize === 'small';

  return {
    isMobile,
    isTablet,
    touchOptimized,
    orientation,
    screenSize,
    hapticFeedback: touchOptimized ? hapticFeedback : null,
    preventZoom,
    isOnline,
    connectionType
  };
}

// Additional mobile utility hooks

export function useSwipeGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold: number = 50
) {
  const [startTouch, setStartTouch] = useState<Touch | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    setStartTouch(e.touches[0]);
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!startTouch) return;

    const endTouch = e.changedTouches[0];
    const deltaX = startTouch.clientX - endTouch.clientX;
    const deltaY = startTouch.clientY - endTouch.clientY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }
    }

    setStartTouch(null);
  }, [startTouch, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);
}

export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);

    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
}

export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      // Use visualViewport if available (better for mobile keyboards)
      const height = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(height);
      
      // Set CSS custom property for use in styles
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
    };

    updateHeight();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateHeight);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateHeight);
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, []);

  return viewportHeight;
}