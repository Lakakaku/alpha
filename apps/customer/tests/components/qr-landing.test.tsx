import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import QRLanding from '../../src/app/qr/[storeId]/page';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('QR Landing Page Component', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(validParams);
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        session_token: 'valid-session-token-123',
        store_info: {
          store_id: validStoreId,
          store_name: 'ICA Supermarket Vasastan',
          business_name: 'ICA Sverige AB',
          logo_url: 'https://cdn.vocilia.com/logos/ica-vasastan.png'
        },
        fraud_warning: false
      })
    });
  });

  describe('Valid QR scan', () => {
    it('should display store information correctly', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText('ICA Supermarket Vasastan')).toBeInTheDocument();
        expect(screen.getByText('ICA Sverige AB')).toBeInTheDocument();
      });
    });

    it('should render verification form with all required fields', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      });
    });

    it('should display form in mobile-optimized layout', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        const container = screen.getByTestId('qr-landing-container');
        expect(container).toHaveClass('mobile-optimized'); // Assuming CSS class
      });
    });

    it('should show loading state initially', () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should make API call with correct parameters', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/v1/qr/verify/${validStoreId}?v=12345&t=${validParams.get('t')}`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('"ip_address"')
          })
        );
      });
    });
  });

  describe('Error states', () => {
    it('should display error for invalid store ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'STORE_NOT_FOUND',
          message: 'Store is no longer available for feedback'
        })
      });

      render(<QRLanding params={{ storeId: 'invalid-uuid' }} />);

      await waitFor(() => {
        expect(screen.getByText(/store.*not.*available/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should display error for missing QR parameters', async () => {
      const invalidParams = {
        get: jest.fn(() => null) // Missing v and t parameters
      };
      (useSearchParams as jest.Mock).mockReturnValue(invalidParams);

      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText(/invalid.*qr.*code/i)).toBeInTheDocument();
        expect(screen.getByText(/missing.*parameters/i)).toBeInTheDocument();
      });
    });

    it('should display error for expired QR code', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'QR_EXPIRED',
          message: 'QR code has expired. Please request a new one from the business'
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText(/qr.*expired/i)).toBeInTheDocument();
        expect(screen.getByText(/request.*new.*one/i)).toBeInTheDocument();
      });
    });

    it('should display error for network issues', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText(/connection.*error/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should display fraud warning when detected', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session_token: 'session-with-warning',
          store_info: {
            store_id: validStoreId,
            store_name: 'Test Store',
            business_name: 'Test Business'
          },
          fraud_warning: true
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText(/security.*notice/i)).toBeInTheDocument();
        expect(screen.getByText(/verify.*identity/i)).toBeInTheDocument();
      });
    });

    it('should not display form when QR verification fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
        expect(screen.queryByLabelText(/transaction time/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/amount/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile responsive layout', () => {
    it('should have touch-friendly button sizes', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        const styles = window.getComputedStyle(submitButton);
        
        // Button should be at least 48px tall (WCAG AAA standard)
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(48);
      });
    });

    it('should display logo when available', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        const logo = screen.getByAltText(/ica supermarket vasastan.*logo/i);
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveAttribute('src', 'https://cdn.vocilia.com/logos/ica-vasastan.png');
      });
    });

    it('should handle missing logo gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          session_token: 'valid-session-token-123',
          store_info: {
            store_id: validStoreId,
            store_name: 'Test Store',
            business_name: 'Test Business'
            // logo_url missing
          },
          fraud_warning: false
        })
      });

      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByText('Test Store')).toBeInTheDocument();
        expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        // Store name should be main heading
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ICA Supermarket Vasastan');
        
        // Business name should be secondary
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('ICA Sverige AB');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toHaveAttribute('aria-required', 'true');
        expect(screen.getByLabelText(/amount/i)).toHaveAttribute('aria-required', 'true');
        expect(screen.getByLabelText(/phone number/i)).toHaveAttribute('aria-required', 'true');
      });
    });

    it('should announce loading state to screen readers', () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('should announce errors to screen readers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
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
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveTextContent(/store.*not.*available/i);
      });
    });
  });

  describe('User interactions', () => {
    it('should provide retry functionality for errors', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            session_token: 'retry-success-token',
            store_info: {
              store_id: validStoreId,
              store_name: 'Retry Success Store',
              business_name: 'Test Business'
            },
            fraud_warning: false
          })
        });

      render(<QRLanding params={{ storeId: validStoreId }} />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/connection.*error/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.click();

      // Should show loading again
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText('Retry Success Store')).toBeInTheDocument();
      });
    });

    it('should handle back navigation', async () => {
      render(<QRLanding params={{ storeId: validStoreId }} />);

      await waitFor(() => {
        const backButton = screen.queryByRole('button', { name: /back/i });
        if (backButton) {
          backButton.click();
          expect(mockPush).toHaveBeenCalledWith('/');
        }
      });
    });
  });
});