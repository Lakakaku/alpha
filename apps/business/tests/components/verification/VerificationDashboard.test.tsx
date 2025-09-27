import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VerificationDashboard } from '../../../src/components/verification/VerificationDashboard';

// Mock the hooks and services
jest.mock('../../../src/hooks/useVerificationDashboard', () => ({
  useVerificationDashboard: jest.fn()
}));

jest.mock('../../../src/services/verificationService', () => ({
  verificationService: {
    getDatabases: jest.fn(),
    downloadDatabase: jest.fn(),
    submitVerification: jest.fn()
  }
}));

import { useVerificationDashboard } from '../../../src/hooks/useVerificationDashboard';

describe('VerificationDashboard Component', () => {
  const mockUseVerificationDashboard = useVerificationDashboard as jest.MockedFunction<typeof useVerificationDashboard>;

  const mockDashboardData = {
    databases: [
      {
        id: 'db-1',
        cycle_id: 'cycle-1',
        business_id: 'business-1',
        store_id: 'store-1',
        store_name: 'Test Store 1',
        store_location: 'Stockholm',
        status: 'ready',
        transaction_count: 100,
        verified_count: 0,
        deadline_date: '2025-10-06',
        days_remaining: 5,
        can_download: true,
        can_submit: false,
        created_at: '2025-09-29T00:00:00Z'
      },
      {
        id: 'db-2',
        cycle_id: 'cycle-1',
        business_id: 'business-1',
        store_id: 'store-2',
        store_name: 'Test Store 2',
        store_location: 'Gothenburg',
        status: 'submitted',
        transaction_count: 75,
        verified_count: 65,
        deadline_date: '2025-10-06',
        days_remaining: 5,
        can_download: true,
        can_submit: false,
        created_at: '2025-09-29T00:00:00Z'
      }
    ],
    loading: false,
    error: null,
    refreshData: jest.fn(),
    downloadDatabase: jest.fn(),
    submitVerification: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVerificationDashboard.mockReturnValue(mockDashboardData);
  });

  describe('Rendering', () => {
    it('should render the dashboard with verification databases', () => {
      render(<VerificationDashboard />);

      expect(screen.getByText('Verification Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test Store 1')).toBeInTheDocument();
      expect(screen.getByText('Test Store 2')).toBeInTheDocument();
      expect(screen.getByText('Stockholm')).toBeInTheDocument();
      expect(screen.getByText('Gothenburg')).toBeInTheDocument();
    });

    it('should display correct status badges', () => {
      render(<VerificationDashboard />);

      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('should show transaction counts', () => {
      render(<VerificationDashboard />);

      expect(screen.getByText('100 transactions')).toBeInTheDocument();
      expect(screen.getByText('75 transactions')).toBeInTheDocument();
      expect(screen.getByText('65 verified')).toBeInTheDocument();
    });

    it('should display deadline information', () => {
      render(<VerificationDashboard />);

      expect(screen.getAllByText('5 days remaining')).toHaveLength(2);
      expect(screen.getAllByText('Due: Oct 6, 2025')).toHaveLength(2);
    });

    it('should show download buttons for available databases', () => {
      render(<VerificationDashboard />);

      const downloadButtons = screen.getAllByText('Download');
      expect(downloadButtons).toHaveLength(2);
    });

    it('should show submit button only for ready databases', () => {
      render(<VerificationDashboard />);

      const submitButtons = screen.getAllByText('Submit Verification');
      expect(submitButtons).toHaveLength(1); // Only one database is ready for submission
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        loading: true,
        databases: []
      });

      render(<VerificationDashboard />);

      expect(screen.getByText('Loading verification data...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when there is an error', () => {
      const errorMessage = 'Failed to load verification data';
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        loading: false,
        error: errorMessage,
        databases: []
      });

      render(<VerificationDashboard />);

      expect(screen.getByText('Error loading verification data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call refreshData when retry button is clicked', async () => {
      const mockRefreshData = jest.fn();
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        loading: false,
        error: 'Network error',
        databases: [],
        refreshData: mockRefreshData
      });

      render(<VerificationDashboard />);

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no databases are available', () => {
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        databases: []
      });

      render(<VerificationDashboard />);

      expect(screen.getByText('No verification databases available')).toBeInTheDocument();
      expect(screen.getByText('There are currently no verification databases requiring your attention.')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call downloadDatabase when download button is clicked', async () => {
      const mockDownloadDatabase = jest.fn().mockResolvedValue({ success: true });
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        downloadDatabase: mockDownloadDatabase
      });

      render(<VerificationDashboard />);

      const downloadButtons = screen.getAllByText('Download');
      fireEvent.click(downloadButtons[0]);

      expect(mockDownloadDatabase).toHaveBeenCalledWith('db-1', 'csv');
    });

    it('should call submitVerification when submit button is clicked', async () => {
      const mockSubmitVerification = jest.fn().mockResolvedValue({ success: true });
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        submitVerification: mockSubmitVerification
      });

      render(<VerificationDashboard />);

      const submitButton = screen.getByText('Submit Verification');
      fireEvent.click(submitButton);

      expect(mockSubmitVerification).toHaveBeenCalledWith('db-1');
    });

    it('should show success message after successful download', async () => {
      const mockDownloadDatabase = jest.fn().mockResolvedValue({ 
        success: true, 
        fileName: 'verification_store-1_2025-09-29.csv' 
      });
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        downloadDatabase: mockDownloadDatabase
      });

      render(<VerificationDashboard />);

      const downloadButton = screen.getAllByText('Download')[0];
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('Download completed successfully')).toBeInTheDocument();
      });
    });

    it('should show error message after failed download', async () => {
      const mockDownloadDatabase = jest.fn().mockResolvedValue({ 
        success: false, 
        error: 'Download failed' 
      });
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        downloadDatabase: mockDownloadDatabase
      });

      render(<VerificationDashboard />);

      const downloadButton = screen.getAllByText('Download')[0];
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('Download failed')).toBeInTheDocument();
      });
    });

    it('should refresh data automatically on mount', () => {
      const mockRefreshData = jest.fn();
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        refreshData: mockRefreshData
      });

      render(<VerificationDashboard />);

      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status Logic', () => {
    it('should show correct status colors and text', () => {
      const testCases = [
        { status: 'ready', expectedClass: 'status-ready', expectedText: 'Ready' },
        { status: 'submitted', expectedClass: 'status-submitted', expectedText: 'Submitted' },
        { status: 'processing', expectedClass: 'status-processing', expectedText: 'Processing' },
        { status: 'expired', expectedClass: 'status-expired', expectedText: 'Expired' }
      ];

      testCases.forEach(({ status, expectedClass, expectedText }) => {
        const customData = {
          ...mockDashboardData,
          databases: [{
            ...mockDashboardData.databases[0],
            status,
            id: `db-${status}`
          }]
        };

        mockUseVerificationDashboard.mockReturnValue(customData);

        const { container } = render(<VerificationDashboard />);
        
        expect(screen.getByText(expectedText)).toBeInTheDocument();
        expect(container.querySelector(`.${expectedClass}`)).toBeInTheDocument();
      });
    });

    it('should disable submit button for non-ready databases', () => {
      const customData = {
        ...mockDashboardData,
        databases: [{
          ...mockDashboardData.databases[0],
          status: 'submitted',
          can_submit: false
        }]
      };

      mockUseVerificationDashboard.mockReturnValue(customData);

      render(<VerificationDashboard />);

      const submitButton = screen.queryByText('Submit Verification');
      expect(submitButton).not.toBeInTheDocument();
    });
  });

  describe('Deadline Warnings', () => {
    it('should show warning for databases with deadline approaching', () => {
      const customData = {
        ...mockDashboardData,
        databases: [{
          ...mockDashboardData.databases[0],
          days_remaining: 1
        }]
      };

      mockUseVerificationDashboard.mockReturnValue(customData);

      render(<VerificationDashboard />);

      expect(screen.getByText('1 day remaining')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument(); // Warning icon
    });

    it('should show urgent warning for expired databases', () => {
      const customData = {
        ...mockDashboardData,
        databases: [{
          ...mockDashboardData.databases[0],
          status: 'expired',
          days_remaining: 0
        }]
      };

      mockUseVerificationDashboard.mockReturnValue(customData);

      render(<VerificationDashboard />);

      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('🚨')).toBeInTheDocument(); // Urgent icon
    });
  });

  describe('Format Selection', () => {
    it('should allow selection of download format', async () => {
      const mockDownloadDatabase = jest.fn().mockResolvedValue({ success: true });
      mockUseVerificationDashboard.mockReturnValue({
        ...mockDashboardData,
        downloadDatabase: mockDownloadDatabase
      });

      render(<VerificationDashboard />);

      // Open format dropdown
      const formatButton = screen.getAllByText('CSV')[0];
      fireEvent.click(formatButton);

      // Select Excel format
      const excelOption = screen.getByText('Excel');
      fireEvent.click(excelOption);

      // Click download
      const downloadButton = screen.getAllByText('Download')[0];
      fireEvent.click(downloadButton);

      expect(mockDownloadDatabase).toHaveBeenCalledWith('db-1', 'xlsx');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<VerificationDashboard />);

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByLabelText('Verification databases list')).toBeInTheDocument();
      
      const downloadButtons = screen.getAllByRole('button', { name: /download/i });
      expect(downloadButtons[0]).toHaveAttribute('aria-describedby');
      
      const submitButton = screen.getByRole('button', { name: /submit verification/i });
      expect(submitButton).toHaveAttribute('aria-describedby');
    });

    it('should support keyboard navigation', () => {
      render(<VerificationDashboard />);

      const downloadButton = screen.getAllByText('Download')[0];
      downloadButton.focus();
      expect(downloadButton).toHaveFocus();

      // Tab to next button
      fireEvent.keyDown(downloadButton, { key: 'Tab' });
      const submitButton = screen.getByText('Submit Verification');
      submitButton.focus();
      expect(submitButton).toHaveFocus();
    });

    it('should announce status changes to screen readers', async () => {
      render(<VerificationDashboard />);

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeInTheDocument();
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(<VerificationDashboard />);

      expect(container.querySelector('.mobile-layout')).toBeInTheDocument();
      expect(container.querySelector('.desktop-layout')).not.toBeInTheDocument();
    });

    it('should show desktop layout for larger screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { container } = render(<VerificationDashboard />);

      expect(container.querySelector('.desktop-layout')).toBeInTheDocument();
      expect(container.querySelector('.mobile-layout')).not.toBeInTheDocument();
    });
  });
});