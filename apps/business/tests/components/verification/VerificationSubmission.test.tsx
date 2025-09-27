import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VerificationSubmission } from '../../../src/components/verification/VerificationSubmission';

// Mock the verification service
jest.mock('../../../src/services/verificationService', () => ({
  verificationService: {
    submitVerification: jest.fn(),
    getVerificationSummary: jest.fn()
  }
}));

import { verificationService } from '../../../src/services/verificationService';

describe('VerificationSubmission Component', () => {
  const mockProps = {
    databaseId: 'db-123',
    storeName: 'Test Store',
    transactionCount: 100,
    verifiedCount: 85,
    onSubmissionComplete: jest.fn(),
    onSubmissionError: jest.fn(),
    onCancel: jest.fn()
  };

  const mockSummary = {
    totalTransactions: 100,
    verifiedTransactions: 85,
    fakeTransactions: 5,
    pendingTransactions: 10,
    verificationRate: 85,
    estimatedReward: 170.50, // 85 * 2% average
    processingFee: 5.00,
    netReward: 165.50
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (verificationService.getVerificationSummary as jest.Mock).mockResolvedValue(mockSummary);
  });

  describe('Rendering', () => {
    it('should render submission form with store information', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Submit Verification')).toBeInTheDocument();
        expect(screen.getByText('Test Store')).toBeInTheDocument();
        expect(screen.getByText('100 total transactions')).toBeInTheDocument();
      });
    });

    it('should display verification summary', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('85 verified')).toBeInTheDocument();
        expect(screen.getByText('5 flagged as fake')).toBeInTheDocument();
        expect(screen.getByText('10 pending')).toBeInTheDocument();
        expect(screen.getByText('85% verification rate')).toBeInTheDocument();
      });
    });

    it('should show reward calculation', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('170.50 SEK')).toBeInTheDocument(); // Estimated reward
        expect(screen.getByText('5.00 SEK')).toBeInTheDocument(); // Processing fee
        expect(screen.getByText('165.50 SEK')).toBeInTheDocument(); // Net reward
      });
    });

    it('should render submission confirmation checkbox', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { 
          name: /i confirm that i have verified all transactions/i 
        });
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should show submit and cancel buttons', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit verification/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while fetching summary', () => {
      (verificationService.getVerificationSummary as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSummary), 1000))
      );

      render(<VerificationSubmission {...mockProps} />);

      expect(screen.getByText('Loading verification summary...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show loading state during submission', async () => {
      const mockSubmit = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );
      (verificationService.submitVerification as jest.Mock).mockImplementation(mockSubmit);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      // Check confirmation checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Submitting verification...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Validation', () => {
    it('should disable submit button until confirmation is checked', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit verification/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it('should enable submit button when confirmation is checked', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button', { name: /submit verification/i });

        fireEvent.click(checkbox);
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show warning for low verification rate', async () => {
      const lowRateSummary = { ...mockSummary, verificationRate: 45 };
      (verificationService.getVerificationSummary as jest.Mock).mockResolvedValue(lowRateSummary);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/verification rate is below 50%/i)).toBeInTheDocument();
        expect(screen.getByText('⚠️')).toBeInTheDocument();
      });
    });

    it('should show error for incomplete verification', async () => {
      const incompleteSummary = { ...mockSummary, pendingTransactions: 25 };
      (verificationService.getVerificationSummary as jest.Mock).mockResolvedValue(incompleteSummary);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/25 transactions still pending/i)).toBeInTheDocument();
        expect(screen.getByText('Please complete verification before submitting')).toBeInTheDocument();
      });
    });

    it('should disable submit for incomplete verification', async () => {
      const incompleteSummary = { ...mockSummary, pendingTransactions: 25 };
      (verificationService.getVerificationSummary as jest.Mock).mockResolvedValue(incompleteSummary);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        const submitButton = screen.getByRole('button', { name: /submit verification/i });
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Submission Process', () => {
    it('should submit verification when form is valid', async () => {
      const mockSubmit = jest.fn().mockResolvedValue({
        success: true,
        submissionId: 'sub-123',
        timestamp: '2025-09-29T10:00:00Z'
      });
      (verificationService.submitVerification as jest.Mock).mockImplementation(mockSubmit);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      expect(mockSubmit).toHaveBeenCalledWith('db-123', {
        confirmed: true,
        summary: mockSummary
      });
    });

    it('should call onSubmissionComplete on successful submission', async () => {
      const mockResult = {
        success: true,
        submissionId: 'sub-123',
        timestamp: '2025-09-29T10:00:00Z'
      };
      (verificationService.submitVerification as jest.Mock).mockResolvedValue(mockResult);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onSubmissionComplete).toHaveBeenCalledWith(mockResult);
      });
    });

    it('should call onSubmissionError on failed submission', async () => {
      const mockError = {
        success: false,
        error: 'Submission deadline has passed'
      };
      (verificationService.submitVerification as jest.Mock).mockResolvedValue(mockError);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onSubmissionError).toHaveBeenCalledWith(mockError.error);
      });
    });

    it('should handle submission service exceptions', async () => {
      (verificationService.submitVerification as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onSubmissionError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should call onCancel when cancel button is clicked', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
      });

      expect(mockProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Summary Display', () => {
    it('should format currency values correctly', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('170.50 SEK')).toBeInTheDocument();
        expect(screen.getByText('5.00 SEK')).toBeInTheDocument();
        expect(screen.getByText('165.50 SEK')).toBeInTheDocument();
      });
    });

    it('should show percentage values correctly', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('should display zero values appropriately', async () => {
      const zeroSummary = { ...mockSummary, fakeTransactions: 0 };
      (verificationService.getVerificationSummary as jest.Mock).mockResolvedValue(zeroSummary);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('0 flagged as fake')).toBeInTheDocument();
      });
    });

    it('should show breakdown when expanded', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const expandButton = screen.getByText('Show Details');
        fireEvent.click(expandButton);

        expect(screen.getByText('Reward Calculation Breakdown')).toBeInTheDocument();
        expect(screen.getByText('85 verified transactions × 2.00 SEK')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when summary fetch fails', async () => {
      (verificationService.getVerificationSummary as jest.Mock).mockRejectedValue(
        new Error('Failed to load summary')
      );

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load verification summary')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry summary fetch when retry button is clicked', async () => {
      const mockSummaryFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSummary);
      
      (verificationService.getVerificationSummary as jest.Mock).mockImplementation(mockSummaryFetch);

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('85 verified')).toBeInTheDocument();
      });

      expect(mockSummaryFetch).toHaveBeenCalledTimes(2);
    });

    it('should reset loading state after failed submission', async () => {
      (verificationService.submitVerification as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Server error'
      });

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Submitting verification...')).not.toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and descriptions', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAttribute('aria-describedby');

        const submitButton = screen.getByRole('button', { name: /submit verification/i });
        expect(submitButton).toHaveAttribute('aria-describedby');
      });
    });

    it('should announce submission status to screen readers', async () => {
      (verificationService.submitVerification as jest.Mock).mockResolvedValue({
        success: true,
        submissionId: 'sub-123'
      });

      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
      });

      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveTextContent('Verification submitted successfully');
      });
    });

    it('should support keyboard navigation', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button', { name: /submit verification/i });
        const cancelButton = screen.getByRole('button', { name: /cancel/i });

        // Tab through elements
        checkbox.focus();
        expect(checkbox).toHaveFocus();

        fireEvent.keyDown(checkbox, { key: 'Tab' });
        submitButton.focus();
        expect(submitButton).toHaveFocus();

        fireEvent.keyDown(submitButton, { key: 'Tab' });
        cancelButton.focus();
        expect(cancelButton).toHaveFocus();
      });
    });

    it('should handle Space key for checkbox', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        checkbox.focus();
        
        fireEvent.keyDown(checkbox, { key: ' ' });
        expect(checkbox).toBeChecked();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        expect(container.querySelector('.mobile-layout')).toBeInTheDocument();
      });
    });

    it('should stack elements vertically on small screens', async () => {
      render(<VerificationSubmission {...mockProps} />);

      await waitFor(() => {
        const summarySection = screen.getByTestId('verification-summary');
        expect(summarySection).toHaveClass('flex-col');
      });
    });
  });
});