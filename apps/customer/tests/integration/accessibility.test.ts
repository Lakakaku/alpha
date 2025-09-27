import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest, beforeAll, afterEach } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import QRLanding from '../../src/app/qr/[storeId]/page';
import VerificationForm from '../../src/components/verification-form';
import { useRouter, useSearchParams } from 'next/navigation';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock IntersectionObserver for tests
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for responsive design tests
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('T019: Accessibility Compliance Tests', () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };
  
  const validStoreId = '550e8400-e29b-41d4-a716-446655440000';
  const validParams = {
    get: jest.fn((param: string) => {
      switch (param) {
        case 'v': return '12345';
        case 't': return Math.floor(Date.now() / 1000).toString();
        default: return null;
      }
    })
  };

  const mockStoreInfo = {
    success: true,
    session_token: 'valid-session-token-123',
    store_info: {
      store_id: validStoreId,
      store_name: 'ICA Supermarket Vasastan',
      business_name: 'ICA Sverige AB',
      logo_url: 'https://cdn.vocilia.com/logos/ica-vasastan.png'
    },
    fraud_warning: false
  };

  beforeAll(() => {
    // Setup axe-core configuration for Swedish accessibility standards
    jest.setTimeout(10000); // Accessibility tests can take longer
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(validParams);
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockStoreInfo
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should pass axe-core accessibility audit for QR landing page', async () => {
      const { container } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      });

      const results = await axe(container, {
        rules: {
          // Enable WCAG 2.1 AA rules
          'color-contrast': { enabled: true },
          'wcag21aa': { enabled: true },
          'wcag2aa': { enabled: true },
          // Swedish accessibility requirements
          'bypass': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'keyboard-navigation': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });

    it('should pass axe-core audit for error states', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Store is no longer available for feedback'
        })
      });

      const { container } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe-core audit for form states', async () => {
      const { container } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      });

      const results = await axe(container, {
        rules: {
          'label': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'required-attr': { enabled: true },
          'aria-required-attr': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });

    it('should have valid HTML structure', async () => {
      const { container } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      });

      const results = await axe(container, {
        rules: {
          'valid-lang': { enabled: true },
          'html-has-lang': { enabled: true },
          'landmark-one-main': { enabled: true },
          'page-has-heading-one': { enabled: true },
          'heading-order': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation Functionality', () => {
    it('should allow full keyboard navigation through form fields', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      });

      const transactionTimeField = screen.getByLabelText(/transaction time/i);
      const amountField = screen.getByLabelText(/amount/i);
      const phoneField = screen.getByLabelText(/phone number/i);
      const submitButton = screen.getByRole('button', { name: /submit/i });

      // Test Tab navigation order
      transactionTimeField.focus();
      expect(document.activeElement).toBe(transactionTimeField);

      fireEvent.keyDown(transactionTimeField, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(amountField);
      });

      fireEvent.keyDown(amountField, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(phoneField);
      });

      fireEvent.keyDown(phoneField, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(submitButton);
      });
    });

    it('should support Shift+Tab for reverse navigation', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });

      const amountField = screen.getByLabelText(/amount/i);
      const phoneField = screen.getByLabelText(/phone number/i);

      phoneField.focus();
      expect(document.activeElement).toBe(phoneField);

      fireEvent.keyDown(phoneField, { key: 'Tab', shiftKey: true });
      await waitFor(() => {
        expect(document.activeElement).toBe(amountField);
      });
    });

    it('should allow form submission with Enter key', async () => {
      const user = userEvent.setup();
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      });

      // Fill out form with keyboard
      await user.type(screen.getByLabelText(/transaction time/i), '14:30');
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '+46701234567');

      // Submit with Enter key
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.keyboard('{Enter}');

      // Verify submission attempt
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/verification/submit'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should trap focus in modal dialogs', async () => {
      // Mock fraud warning scenario to trigger modal
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockStoreInfo,
          fraud_warning: true
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText(/security.*notice/i)).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      const closeButton = screen.getByRole('button', { name: /close/i });
      const confirmButton = screen.getByRole('button', { name: /continue/i });

      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      // Tab should move to confirm button, not outside modal
      fireEvent.keyDown(closeButton, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(confirmButton);
      });

      // Tab from last element should wrap to first
      fireEvent.keyDown(confirmButton, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });
    });

    it('should handle Escape key for modal dismissal', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockStoreInfo,
          fraud_warning: true
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Screen Reader Compatibility with ARIA Labels', () => {
    it('should have proper ARIA labels for form fields', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      });

      const transactionTimeField = screen.getByLabelText(/transaction time/i);
      const amountField = screen.getByLabelText(/amount/i);
      const phoneField = screen.getByLabelText(/phone number/i);

      expect(transactionTimeField).toHaveAttribute('aria-required', 'true');
      expect(transactionTimeField).toHaveAttribute('aria-describedby');
      
      expect(amountField).toHaveAttribute('aria-required', 'true');
      expect(amountField).toHaveAttribute('aria-describedby');
      
      expect(phoneField).toHaveAttribute('aria-required', 'true');
      expect(phoneField).toHaveAttribute('aria-describedby');
    });

    it('should announce loading states to screen readers', () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      const loadingElement = screen.getByLabelText(/loading/i);
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
      expect(loadingElement).toHaveAttribute('role', 'status');
    });

    it('should announce errors with proper ARIA attributes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Store is no longer available for feedback'
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveAttribute('aria-live', 'assertive');
        expect(errorElement).toHaveAttribute('aria-atomic', 'true');
      });
    });

    it('should have proper landmark roles', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      });

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('should have accessible form validation messages', async () => {
      const user = userEvent.setup();
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });

      // Trigger validation by entering invalid phone number
      const phoneField = screen.getByLabelText(/phone number/i);
      await user.type(phoneField, 'invalid-phone');
      await user.tab(); // Trigger blur event

      await waitFor(() => {
        const errorMessage = screen.getByText(/invalid.*phone.*number/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(phoneField).toHaveAttribute('aria-describedby', 
          expect.stringContaining(errorMessage.id));
        expect(phoneField).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should have descriptive button labels', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit verification/i });
        expect(submitButton).toBeInTheDocument();
        expect(submitButton).toHaveAttribute('aria-describedby');
      });
    });

    it('should provide context for store information', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const storeSection = screen.getByLabelText(/store information/i);
        expect(storeSection).toBeInTheDocument();
        expect(storeSection).toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('Color Contrast Ratio Requirements (4.5:1 minimum)', () => {
    it('should meet contrast requirements for primary text', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      });

      const heading = screen.getByRole('heading', { level: 1 });
      const styles = window.getComputedStyle(heading);
      
      // Note: In a real test environment, you would use a color contrast testing library
      // For this example, we verify the CSS classes that should ensure proper contrast
      expect(heading).toHaveClass('text-gray-900'); // Should be dark text on light background
    });

    it('should meet contrast requirements for form labels', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const labels = screen.getAllByText(/time|amount|phone/i);
        labels.forEach(label => {
          expect(label).toHaveClass('text-gray-700'); // Sufficient contrast class
        });
      });
    });

    it('should meet contrast requirements for error messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Store is no longer available for feedback'
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toHaveClass('text-red-600'); // High contrast error color
      });
    });

    it('should meet contrast requirements for interactive elements', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        expect(submitButton).toHaveClass('bg-blue-600', 'text-white'); // High contrast button
      });
    });

    it('should maintain contrast in focus states', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const phoneField = screen.getByLabelText(/phone number/i);
        phoneField.focus();
        
        // Verify focus indicator classes
        expect(phoneField).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
      });
    });
  });

  describe('Touch Target Size Requirements (44px minimum)', () => {
    it('should have minimum 44px touch targets for buttons', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        const styles = window.getComputedStyle(submitButton);
        
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      });
    });

    it('should have adequate spacing between touch targets', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Store not found'
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        const backButton = screen.queryByRole('button', { name: /back/i });
        
        if (backButton) {
          const retryRect = retryButton.getBoundingClientRect();
          const backRect = backButton.getBoundingClientRect();
          
          // Buttons should have at least 8px spacing
          const spacing = Math.abs(retryRect.bottom - backRect.top);
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      });
    });

    it('should have touch-friendly form input heights', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const fields = [
          screen.getByLabelText(/transaction time/i),
          screen.getByLabelText(/amount/i),
          screen.getByLabelText(/phone number/i)
        ];
        
        fields.forEach(field => {
          const styles = window.getComputedStyle(field);
          expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
        });
      });
    });

    it('should have accessible close buttons in modals', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockStoreInfo,
          fraud_warning: true
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close/i });
        const styles = window.getComputedStyle(closeButton);
        
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Swedish Accessibility Requirements Compliance', () => {
    it('should support Swedish language attributes', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('lang', 'sv-SE');
      });
    });

    it('should have Swedish error messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Butiken är inte längre tillgänglig för feedback'
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText(/butiken.*tillgänglig/i)).toBeInTheDocument();
      });
    });

    it('should comply with WCAG 2.1 Level AA Success Criteria', async () => {
      const { container } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      });

      const results = await axe(container, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        rules: {
          // Swedish specific accessibility requirements
          'input-image-alt': { enabled: true },
          'link-name': { enabled: true },
          'meta-refresh': { enabled: true },
          'object-alt': { enabled: true },
          'video-caption': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });

    it('should provide alternative formats for complex information', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        // Verify that complex store information has text alternatives
        const logo = screen.queryByAltText(/ica supermarket vasastan.*logo/i);
        if (logo) {
          expect(logo).toHaveAttribute('alt', expect.stringContaining('ICA Supermarket Vasastan'));
        }
        
        // Verify descriptive text is available alongside visual elements
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
        expect(screen.getByText('ICA Sverige AB')).toBeInTheDocument();
      });
    });

    it('should support keyboard-only navigation per Swedish standards', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      });

      // Test that all interactive elements are reachable via keyboard
      const interactiveElements = [
        screen.getByLabelText(/transaction time/i),
        screen.getByLabelText(/amount/i),
        screen.getByLabelText(/phone number/i),
        screen.getByRole('button', { name: /submit/i })
      ];

      let currentElement = interactiveElements[0];
      currentElement.focus();
      
      for (let i = 1; i < interactiveElements.length; i++) {
        fireEvent.keyDown(currentElement, { key: 'Tab' });
        await waitFor(() => {
          expect(document.activeElement).toBe(interactiveElements[i]);
        });
        currentElement = interactiveElements[i];
      }
    });

    it('should meet timing requirements for dynamic content', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      // Verify loading state doesn't timeout too quickly
      const loadingElement = screen.getByTestId('loading-spinner');
      expect(loadingElement).toBeInTheDocument();
      
      // Wait for content to load (should be reasonable time)
      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Accessibility Error Prevention and Recovery', () => {
    it('should provide clear error recovery instructions', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toHaveTextContent(/connection.*error/i);
        
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveAttribute('aria-describedby');
      });
    });

    it('should prevent and handle form submission errors accessibly', async () => {
      const user = userEvent.setup();
      render(<QRLanding params={{ storeId: validStoreId }} />);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });

      // Submit form with missing required fields
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Verify error messages are announced
        const errorElements = screen.getAllByRole('alert');
        expect(errorElements.length).toBeGreaterThan(0);
        
        // Verify focus moves to first error
        const firstErrorField = screen.getByLabelText(/transaction time/i);
        expect(firstErrorField).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should support assistive technology announcements', async () => {
      const { rerender } = render(<QRLanding params={{ storeId: validStoreId }} />);
      
      // Simulate successful form submission
      await waitFor(() => {
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });

      // Mock successful submission
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Verification submitted successfully'
        })
      });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(/transaction time/i), '14:30');
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '+46701234567');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        const successElement = screen.getByRole('status');
        expect(successElement).toHaveAttribute('aria-live', 'polite');
        expect(successElement).toHaveTextContent(/submitted.*successfully/i);
      });
    });
  });
});