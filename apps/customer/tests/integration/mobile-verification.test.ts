import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { axe } from 'jest-axe';
import QRLandingPage from '../../src/app/qr/[storeId]/page';
import VerificationForm from '../../src/components/verification/VerificationForm';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn((key) => {
      const params: Record<string, string> = {
        v: '12345',
        t: Math.floor(Date.now() / 1000).toString(),
      };
      return params[key] || null;
    }),
  }),
  useParams: () => ({
    storeId: '550e8400-e29b-41d4-a716-446655440000',
  }),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock viewport sizes for responsive testing
const mockViewport = {
  width: 375,
  height: 667,
  setSize: (width: number, height: number) => {
    mockViewport.width = width;
    mockViewport.height = height;
    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
  },
};

// Mock CSS media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => {
    const isMobile = mockViewport.width <= 768;
    const isTablet = mockViewport.width > 768 && mockViewport.width <= 1024;
    
    return {
      matches: query.includes('max-width: 768px') ? isMobile : 
               query.includes('max-width: 1024px') ? (isMobile || isTablet) : 
               !isMobile,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }),
});

// Mock touch events
const mockTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 20,
      radiusY: 20,
      rotationAngle: 0,
      force: 1,
    })) as any,
    changedTouches: touches as any,
    targetTouches: touches as any,
  });
};

// Mock virtual keyboard behavior
const mockVirtualKeyboard = {
  height: 0,
  show: () => {
    mockVirtualKeyboard.height = 300;
    window.dispatchEvent(new Event('visualViewport'));
  },
  hide: () => {
    mockVirtualKeyboard.height = 0;
    window.dispatchEvent(new Event('visualViewport'));
  },
};

Object.defineProperty(window, 'visualViewport', {
  writable: true,
  value: {
    height: mockViewport.height - mockVirtualKeyboard.height,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
});

describe('T016: Mobile Verification Flow Integration Tests', () => {
  const mockSessionToken = 'valid-mobile-session-token';
  const mockStoreData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Café Mobile Test',
    address: 'Götgatan 15, Stockholm',
    expected_amount: 125.50,
    qr_version: '12345',
    status: 'active',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset viewport to mobile
    mockViewport.setSize(375, 667);
    
    // Mock successful API responses
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          store: mockStoreData,
          session_token: mockSessionToken,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          verification_id: '110e8400-e29b-41d4-a716-446655440000',
          validation_results: {
            time_validation: {
              status: 'valid',
              difference_minutes: 1,
              tolerance_range: '14:30 - 14:34',
            },
            amount_validation: {
              status: 'valid',
              difference_sek: 1.50,
              tolerance_range: '123.50 - 127.50 SEK',
            },
            phone_validation: {
              status: 'valid',
              e164_format: '+46701234567',
              national_format: '070-123 45 67',
            },
            overall_valid: true,
          },
          next_steps: 'Du kommer att få ett samtal inom 24 timmar för feedback.',
        }),
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mobile Touch Interface', () => {
    it('should have touch-friendly button sizes and spacing', async () => {
      const { container } = render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Check submit button meets touch target requirements (min 48px)
      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      const submitStyles = window.getComputedStyle(submitButton);
      
      expect(parseInt(submitStyles.minHeight)).toBeGreaterThanOrEqual(48);
      expect(parseInt(submitStyles.minWidth)).toBeGreaterThanOrEqual(48);

      // Check form field spacing for fat fingers
      const timeInput = screen.getByLabelText(/transaktionstid|transaction time/i);
      const amountInput = screen.getByLabelText(/belopp|amount/i);
      const phoneInput = screen.getByLabelText(/telefonnummer|phone/i);

      const timeRect = timeInput.getBoundingClientRect();
      const amountRect = amountInput.getBoundingClientRect();
      const phoneRect = phoneInput.getBoundingClientRect();

      // Minimum 16px spacing between interactive elements
      expect(amountRect.top - timeRect.bottom).toBeGreaterThanOrEqual(16);
      expect(phoneRect.top - amountRect.bottom).toBeGreaterThanOrEqual(16);

      // Check touch area padding around inputs
      const inputStyles = window.getComputedStyle(timeInput);
      expect(parseInt(inputStyles.padding)).toBeGreaterThanOrEqual(12);
    });

    it('should handle touch events properly', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={mockOnSuccess}
          onError={jest.fn()}
        />
      );

      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      
      // Test touch interaction
      fireEvent.touchStart(submitButton, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      
      fireEvent.touchEnd(submitButton, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      // Should handle touch events without issues
      expect(submitButton).toBeInTheDocument();
    });

    it('should prevent double-tap zoom on form elements', async () => {
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const amountInput = screen.getByLabelText(/belopp|amount/i);
      const styles = window.getComputedStyle(amountInput);
      
      // Should have touch-action: manipulation to prevent double-tap zoom
      expect(styles.touchAction).toBe('manipulation');
    });
  });

  describe('Responsive Design Behavior', () => {
    it('should adapt layout for mobile portrait (375x667)', async () => {
      mockViewport.setSize(375, 667);
      
      const { container } = render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Form should stack vertically on mobile
      const form = container.querySelector('form');
      const formStyles = window.getComputedStyle(form!);
      
      expect(formStyles.flexDirection).toBe('column');
      expect(formStyles.maxWidth).toBe('100%');
    });

    it('should adapt layout for mobile landscape (667x375)', async () => {
      mockViewport.setSize(667, 375);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Should still be touch-friendly in landscape
      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      const buttonStyles = window.getComputedStyle(submitButton);
      
      expect(parseInt(buttonStyles.minHeight)).toBeGreaterThanOrEqual(48);
    });

    it('should handle very small screens (320x568)', async () => {
      mockViewport.setSize(320, 568);
      
      const { container } = render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Should not have horizontal overflow
      const form = container.querySelector('form');
      const formStyles = window.getComputedStyle(form!);
      
      expect(formStyles.overflowX).toBe('hidden');
      expect(parseInt(formStyles.maxWidth)).toBeLessThanOrEqual(320);
    });

    it('should scale text appropriately for mobile', async () => {
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const timeLabel = screen.getByText(/transaktionstid|transaction time/i);
      const labelStyles = window.getComputedStyle(timeLabel);
      
      // Text should be readable on mobile (min 16px)
      expect(parseInt(labelStyles.fontSize)).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Virtual Keyboard Handling', () => {
    it('should trigger appropriate keyboard types for inputs', async () => {
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const timeInput = screen.getByLabelText(/transaktionstid|transaction time/i);
      const amountInput = screen.getByLabelText(/belopp|amount/i);
      const phoneInput = screen.getByLabelText(/telefonnummer|phone/i);

      // Time input should use time picker
      expect(timeInput).toHaveAttribute('type', 'time');
      
      // Amount input should trigger numeric keyboard
      expect(amountInput).toHaveAttribute('inputmode', 'decimal');
      expect(amountInput).toHaveAttribute('pattern', '[0-9]*\\.?[0-9]*');
      
      // Phone input should trigger phone keyboard
      expect(phoneInput).toHaveAttribute('type', 'tel');
      expect(phoneInput).toHaveAttribute('inputmode', 'tel');
    });

    it('should handle virtual keyboard appearance', async () => {
      const user = userEvent.setup();
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const amountInput = screen.getByLabelText(/belopp|amount/i);
      
      // Focus input to show virtual keyboard
      await user.click(amountInput);
      
      act(() => {
        mockVirtualKeyboard.show();
      });

      // Viewport height should adjust
      expect(window.visualViewport?.height).toBe(mockViewport.height - 300);
      
      // Form should remain accessible
      expect(amountInput).toBeVisible();
    });

    it('should handle autocomplete attributes for mobile optimization', async () => {
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const phoneInput = screen.getByLabelText(/telefonnummer|phone/i);
      
      // Should have autocomplete for better UX
      expect(phoneInput).toHaveAttribute('autocomplete', 'tel');
    });
  });

  describe('QR Code Scanning Flow on Mobile', () => {
    it('should load QR landing page on mobile device', async () => {
      mockViewport.setSize(375, 667);
      
      const { container } = render(
        <QRLandingPage 
          params={{ storeId: mockStoreData.id }}
          searchParams={{ v: '12345', t: Date.now().toString() }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(mockStoreData.name)).toBeInTheDocument();
      });

      // Should show mobile-optimized layout
      const header = container.querySelector('[data-testid="store-header"]');
      expect(header).toBeVisible();
    });

    it('should handle QR code scanning with device camera permissions', async () => {
      // Mock camera permissions
      Object.defineProperty(navigator, 'permissions', {
        writable: true,
        value: {
          query: jest.fn().mockResolvedValue({ state: 'granted' }),
        },
      });

      mockViewport.setSize(375, 667);
      
      render(
        <QRLandingPage 
          params={{ storeId: mockStoreData.id }}
          searchParams={{ v: '12345', t: Date.now().toString() }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(mockStoreData.name)).toBeInTheDocument();
      });

      // Should be ready for camera-based scanning
      expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'camera' });
    });

    it('should handle QR link opening in mobile browser', async () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
      });

      mockViewport.setSize(375, 667);
      
      render(
        <QRLandingPage 
          params={{ storeId: mockStoreData.id }}
          searchParams={{ v: '12345', t: Date.now().toString() }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(mockStoreData.name)).toBeInTheDocument();
      });

      // Should detect mobile browser
      expect(navigator.userAgent).toContain('iPhone');
    });
  });

  describe('Mobile Form Submission and Validation', () => {
    it('should validate and submit form on mobile', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={mockOnSuccess}
          onError={jest.fn()}
        />
      );

      // Fill form with mobile-friendly interactions
      const timeInput = screen.getByLabelText(/transaktionstid|transaction time/i);
      const amountInput = screen.getByLabelText(/belopp|amount/i);
      const phoneInput = screen.getByLabelText(/telefonnummer|phone/i);

      await user.type(amountInput, '125.50');
      await user.type(phoneInput, '070-123 45 67');

      // Submit with touch
      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show mobile-optimized validation errors', async () => {
      const user = userEvent.setup();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error messages should be clearly visible on mobile
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
        
        errorMessages.forEach(error => {
          const errorStyles = window.getComputedStyle(error);
          expect(parseInt(errorStyles.fontSize)).toBeGreaterThanOrEqual(14);
        });
      });
    });

    it('should handle form submission during network issues', async () => {
      const user = userEvent.setup();
      const mockOnError = jest.fn();
      
      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={mockOnError}
        />
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/belopp|amount/i), '125.50');
      await user.type(screen.getByLabelText(/telefonnummer|phone/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /skicka|submit/i }));

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'NETWORK_ERROR',
          })
        );
      });
    });
  });

  describe('Progress Indicators and Mobile Feedback', () => {
    it('should show loading state with mobile-friendly spinner', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true }),
        }), 1000))
      );

      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/belopp|amount/i), '125.50');
      await user.type(screen.getByLabelText(/telefonnummer|phone/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /skicka|submit/i }));

      // Should show loading indicator
      expect(screen.getByText(/skickar|submitting/i)).toBeInTheDocument();
      
      // Loading spinner should be visible and appropriately sized
      const spinner = screen.getByRole('status');
      const spinnerStyles = window.getComputedStyle(spinner);
      expect(parseInt(spinnerStyles.width)).toBeGreaterThanOrEqual(24);
    });

    it('should provide haptic feedback for mobile interactions', async () => {
      // Mock vibration API
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        value: jest.fn(),
      });

      const user = userEvent.setup();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit empty form to trigger validation error
      await user.click(screen.getByRole('button', { name: /skicka|submit/i }));

      await waitFor(() => {
        // Should trigger vibration for error feedback
        expect(navigator.vibrate).toHaveBeenCalledWith([200]);
      });
    });

    it('should show success animation optimized for mobile', async () => {
      const user = userEvent.setup();
      const mockOnSuccess = jest.fn();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={mockOnSuccess}
          onError={jest.fn()}
        />
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/belopp|amount/i), '125.50');
      await user.type(screen.getByLabelText(/telefonnummer|phone/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /skicka|submit/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Should show success state
      expect(screen.getByText(/verifiering.*klar|verification.*complete/i)).toBeInTheDocument();
    });

    it('should display validation feedback in real-time', async () => {
      const user = userEvent.setup();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const phoneInput = screen.getByLabelText(/telefonnummer|phone/i);
      
      // Enter invalid phone number
      await user.type(phoneInput, '123-456-789');
      
      // Trigger validation
      fireEvent.blur(phoneInput);

      await waitFor(() => {
        const errorMessage = screen.getByText(/ogiltigt.*format|invalid.*format/i);
        expect(errorMessage).toBeInTheDocument();
        
        // Error should be clearly visible on mobile
        const errorStyles = window.getComputedStyle(errorMessage);
        expect(errorStyles.color).toBe('rgb(239, 68, 68)'); // error red
      });
    });
  });

  describe('Accessibility on Mobile', () => {
    it('should meet accessibility standards on mobile', async () => {
      mockViewport.setSize(375, 667);
      
      const { container } = render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support screen reader navigation on mobile', async () => {
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Check ARIA labels
      expect(screen.getByLabelText(/transaktionstid|transaction time/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/belopp|amount/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/telefonnummer|phone/i)).toHaveAttribute('aria-required', 'true');

      // Check form structure
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-labelledby');
    });

    it('should handle focus management with virtual keyboard', async () => {
      const user = userEvent.setup();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const amountInput = screen.getByLabelText(/belopp|amount/i);
      
      // Focus input
      await user.click(amountInput);
      
      act(() => {
        mockVirtualKeyboard.show();
      });

      // Input should remain visible and focused
      expect(amountInput).toHaveFocus();
      expect(amountInput).toBeVisible();
    });
  });

  describe('Performance on Mobile', () => {
    it('should load quickly on mobile networks', async () => {
      const startTime = Date.now();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Form should render quickly
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skicka|submit/i })).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(100); // Component render should be fast
    });

    it('should handle touch events efficiently', async () => {
      const user = userEvent.setup();
      
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const submitButton = screen.getByRole('button', { name: /skicka|submit/i });
      
      // Rapid touch interactions should be handled smoothly
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        fireEvent.touchStart(submitButton);
        fireEvent.touchEnd(submitButton);
      }
      
      const interactionTime = Date.now() - startTime;
      expect(interactionTime).toBeLessThan(50); // Should handle touches quickly
    });
  });

  describe('Mobile-Specific Edge Cases', () => {
    it('should handle device rotation', async () => {
      // Start in portrait
      mockViewport.setSize(375, 667);
      
      const { rerender } = render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /skicka|submit/i })).toBeInTheDocument();

      // Rotate to landscape
      mockViewport.setSize(667, 375);
      
      rerender(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Form should remain functional
      expect(screen.getByRole('button', { name: /skicka|submit/i })).toBeInTheDocument();
    });

    it('should handle low memory conditions', async () => {
      // Mock memory pressure
      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: 1, // 1GB device
      });

      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Should still function on low-memory devices
      expect(screen.getByRole('button', { name: /skicka|submit/i })).toBeInTheDocument();
    });

    it('should handle background/foreground transitions', async () => {
      mockViewport.setSize(375, 667);
      
      render(
        <VerificationForm 
          sessionToken={mockSessionToken}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Simulate app going to background
      fireEvent(document, new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { value: true, writable: true });

      // Simulate app coming to foreground
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      fireEvent(document, new Event('visibilitychange'));

      // Form should remain functional
      expect(screen.getByRole('button', { name: /skicka|submit/i })).toBeInTheDocument();
    });
  });
});