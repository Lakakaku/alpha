import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import VerificationForm from '../../src/components/verification/VerificationForm';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Verification Form Component', () => {
  const mockSessionToken = 'valid-session-token-123';
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    sessionToken: mockSessionToken,
    onSuccess: mockOnSuccess,
    onError: mockOnError
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful submission by default
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        verification_id: '110e8400-e29b-41d4-a716-446655440000',
        validation_results: {
          time_validation: {
            status: 'valid',
            difference_minutes: 1,
            tolerance_range: '14:30 - 14:34'
          },
          amount_validation: {
            status: 'valid',
            difference_sek: 1.50,
            tolerance_range: '123.50 - 127.50 SEK'
          },
          phone_validation: {
            status: 'valid',
            e164_format: '+46701234567',
            national_format: '070-123 45 67'
          },
          overall_valid: true
        },
        next_steps: 'Your verification is complete. You\'ll receive a feedback call within 24 hours.'
      })
    });
  });

  describe('Form rendering', () => {
    it('should render all required form fields', () => {
      render(<VerificationForm {...defaultProps} />);

      expect(screen.getByLabelText(/transaction time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('should have proper input types for mobile keyboards', () => {
      render(<VerificationForm {...defaultProps} />);

      const timeInput = screen.getByLabelText(/transaction time/i);
      const amountInput = screen.getByLabelText(/amount/i);
      const phoneInput = screen.getByLabelText(/phone number/i);

      expect(timeInput).toHaveAttribute('type', 'time');
      expect(amountInput).toHaveAttribute('inputmode', 'decimal');
      expect(phoneInput).toHaveAttribute('type', 'tel');
    });

    it('should pre-populate time field with current time', () => {
      render(<VerificationForm {...defaultProps} />);

      const timeInput = screen.getByLabelText(/transaction time/i) as HTMLInputElement;
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5);
      
      expect(timeInput.value).toBe(currentTime);
    });

    it('should have submit button disabled initially', () => {
      render(<VerificationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeDisabled();
    });

    it('should have proper ARIA attributes', () => {
      render(<VerificationForm {...defaultProps} />);

      expect(screen.getByLabelText(/transaction time/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/amount/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/phone number/i)).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Form validation', () => {
    it('should enable submit button when all fields are valid', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Fill in valid data
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).toBeEnabled();
    });

    it('should show real-time validation feedback for phone number', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      
      // Enter invalid phone number
      await user.type(phoneInput, '123-456-789');
      await user.tab(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/invalid.*phone.*format/i)).toBeInTheDocument();
      });
    });

    it('should show success feedback for valid phone number', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      
      // Enter valid phone number
      await user.type(phoneInput, '070-123 45 67');
      await user.tab(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/✓/)).toBeInTheDocument(); // Success indicator
      });
    });

    it('should show validation error for negative amount', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const amountInput = screen.getByLabelText(/amount/i);
      
      await user.type(amountInput, '-10.50');
      await user.tab(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/amount.*must.*positive/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for amount too large', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const amountInput = screen.getByLabelText(/amount/i);
      
      await user.type(amountInput, '100000.00'); // Over 99999.99 limit
      await user.tab(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/amount.*too.*large/i)).toBeInTheDocument();
      });
    });

    it('should validate time format correctly', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const timeInput = screen.getByLabelText(/transaction time/i);
      
      // Clear pre-populated time and enter invalid format
      await user.clear(timeInput);
      await user.type(timeInput, '25:70'); // Invalid time
      await user.tab(); // Trigger onBlur

      await waitFor(() => {
        expect(screen.getByText(/invalid.*time/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form submission', () => {
    it('should submit form with valid data', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Fill in valid data
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/verification/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': mockSessionToken
          },
          body: JSON.stringify({
            transaction_time: expect.stringMatching(/^\d{2}:\d{2}$/),
            transaction_amount: 125.50,
            phone_number: '070-123 45 67'
          })
        });
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(<VerificationForm {...defaultProps} />);

      // Fill in valid data
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      expect(screen.getByText(/submitting/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should call onSuccess callback on successful submission', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Fill in valid data and submit
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          verification_id: '110e8400-e29b-41d4-a716-446655440000',
          validation_results: expect.any(Object),
          next_steps: expect.any(String)
        });
      });
    });

    it('should handle validation failures gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock API response with validation failures
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          verification_id: '110e8400-e29b-41d4-a716-446655440000',
          validation_results: {
            time_validation: {
              status: 'out_of_tolerance',
              difference_minutes: 5,
              tolerance_range: '14:30 - 14:34'
            },
            amount_validation: {
              status: 'out_of_tolerance',
              difference_sek: 10.50,
              tolerance_range: '123.50 - 127.50 SEK'
            },
            phone_validation: {
              status: 'not_swedish'
            },
            overall_valid: false
          },
          next_steps: 'Please review and correct the highlighted fields.'
        })
      });

      render(<VerificationForm {...defaultProps} />);

      // Fill in data and submit
      await user.type(screen.getByLabelText(/amount/i), '140.00');
      await user.type(screen.getByLabelText(/phone number/i), '+1-555-123-4567');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/time.*out.*tolerance/i)).toBeInTheDocument();
        expect(screen.getByText(/amount.*out.*tolerance/i)).toBeInTheDocument();
        expect(screen.getByText(/swedish.*mobile.*number/i)).toBeInTheDocument();
      });
    });

    it('should handle API errors properly', async () => {
      const user = userEvent.setup();
      
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Invalid session token'
        })
      });

      render(<VerificationForm {...defaultProps} />);

      // Fill in data and submit
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith({
          error: 'UNAUTHORIZED',
          message: 'Invalid session token'
        });
      });
    });
  });

  describe('Error states', () => {
    it('should display appropriate error messages', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Test required field validation
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/amount.*required/i)).toBeInTheDocument();
        expect(screen.getByText(/phone.*required/i)).toBeInTheDocument();
      });
    });

    it('should clear error messages when user starts typing', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Trigger validation errors
      await user.click(screen.getByRole('button', { name: /submit/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/amount.*required/i)).toBeInTheDocument();
      });

      // Start typing in amount field
      await user.type(screen.getByLabelText(/amount/i), '1');

      await waitFor(() => {
        expect(screen.queryByText(/amount.*required/i)).not.toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<VerificationForm {...defaultProps} />);

      // Fill in data and submit
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'NETWORK_ERROR',
            message: expect.stringContaining('connection')
          })
        );
      });
    });
  });

  describe('Mobile optimization', () => {
    it('should have touch-friendly button size', () => {
      render(<VerificationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /submit/i });
      const styles = window.getComputedStyle(submitButton);
      
      // Button should be at least 48px tall (WCAG AAA standard)
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(48);
    });

    it('should have proper spacing between form fields', () => {
      render(<VerificationForm {...defaultProps} />);

      const timeInput = screen.getByLabelText(/transaction time/i);
      const amountInput = screen.getByLabelText(/amount/i);
      
      const timeRect = timeInput.getBoundingClientRect();
      const amountRect = amountInput.getBoundingClientRect();
      
      // Should have adequate spacing (at least 16px)
      expect(amountRect.top - timeRect.bottom).toBeGreaterThanOrEqual(16);
    });

    it('should handle virtual keyboard appropriately', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      const amountInput = screen.getByLabelText(/amount/i);
      
      await user.click(amountInput);
      
      // Input should trigger decimal keyboard on mobile
      expect(amountInput).toHaveAttribute('inputmode', 'decimal');
      expect(amountInput).toHaveAttribute('pattern', '[0-9]*\\.?[0-9]*');
    });
  });

  describe('Success state', () => {
    it('should display success message after successful submission', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Fill and submit form
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/verification.*complete/i)).toBeInTheDocument();
        expect(screen.getByText(/feedback.*call.*24.*hours/i)).toBeInTheDocument();
      });
    });

    it('should disable form after successful submission', async () => {
      const user = userEvent.setup();
      render(<VerificationForm {...defaultProps} />);

      // Fill and submit form
      await user.type(screen.getByLabelText(/amount/i), '125.50');
      await user.type(screen.getByLabelText(/phone number/i), '070-123 45 67');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/transaction time/i)).toBeDisabled();
        expect(screen.getByLabelText(/amount/i)).toBeDisabled();
        expect(screen.getByLabelText(/phone number/i)).toBeDisabled();
        expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
      });
    });
  });
});