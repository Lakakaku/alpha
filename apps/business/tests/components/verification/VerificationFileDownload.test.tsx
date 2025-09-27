import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VerificationFileDownload } from '../../../src/components/verification/VerificationFileDownload';

// Mock the verification service
jest.mock('../../../src/services/verificationService', () => ({
  verificationService: {
    downloadDatabase: jest.fn(),
    getDownloadFormats: jest.fn()
  }
}));

import { verificationService } from '../../../src/services/verificationService';

describe('VerificationFileDownload Component', () => {
  const mockProps = {
    databaseId: 'db-123',
    storeName: 'Test Store',
    transactionCount: 150,
    onDownloadComplete: jest.fn(),
    onDownloadError: jest.fn()
  };

  const mockFormats = [
    { value: 'csv', label: 'CSV', description: 'Comma-separated values (Excel compatible)' },
    { value: 'xlsx', label: 'Excel', description: 'Microsoft Excel format' },
    { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (verificationService.getDownloadFormats as jest.Mock).mockReturnValue(mockFormats);
  });

  describe('Rendering', () => {
    it('should render download component with store information', () => {
      render(<VerificationFileDownload {...mockProps} />);

      expect(screen.getByText('Download Verification Database')).toBeInTheDocument();
      expect(screen.getByText('Test Store')).toBeInTheDocument();
      expect(screen.getByText('150 transactions')).toBeInTheDocument();
    });

    it('should render format selection dropdown', () => {
      render(<VerificationFileDownload {...mockProps} />);

      expect(screen.getByLabelText('File Format')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });

    it('should show format descriptions', () => {
      render(<VerificationFileDownload {...mockProps} />);

      // Open dropdown
      const formatSelect = screen.getByLabelText('File Format');
      fireEvent.click(formatSelect);

      expect(screen.getByText('Comma-separated values (Excel compatible)')).toBeInTheDocument();
      expect(screen.getByText('Microsoft Excel format')).toBeInTheDocument();
      expect(screen.getByText('JavaScript Object Notation')).toBeInTheDocument();
    });

    it('should render download button', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeInTheDocument();
      expect(downloadButton).not.toBeDisabled();
    });

    it('should show file size estimate', () => {
      render(<VerificationFileDownload {...mockProps} />);

      expect(screen.getByText(/estimated file size/i)).toBeInTheDocument();
    });
  });

  describe('Format Selection', () => {
    it('should change format when dropdown selection changes', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      
      // Change to Excel format
      fireEvent.change(formatSelect, { target: { value: 'xlsx' } });
      
      expect(formatSelect).toHaveValue('xlsx');
      expect(screen.getByText('Excel')).toBeInTheDocument();
    });

    it('should update file size estimate when format changes', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      
      // Get initial estimate
      const initialEstimate = screen.getByText(/estimated file size/i).textContent;
      
      // Change format
      fireEvent.change(formatSelect, { target: { value: 'json' } });
      
      // Check that estimate changed
      const newEstimate = screen.getByText(/estimated file size/i).textContent;
      expect(newEstimate).not.toBe(initialEstimate);
    });

    it('should default to CSV format', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format') as HTMLSelectElement;
      expect(formatSelect.value).toBe('csv');
    });
  });

  describe('Download Process', () => {
    it('should initiate download when button is clicked', async () => {
      const mockDownload = jest.fn().mockResolvedValue({
        success: true,
        fileName: 'verification_test-store_2025-09-29.csv',
        fileSize: 12500
      });
      (verificationService.downloadDatabase as jest.Mock).mockImplementation(mockDownload);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      expect(mockDownload).toHaveBeenCalledWith('db-123', 'csv');
    });

    it('should show loading state during download', async () => {
      const mockDownload = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );
      (verificationService.downloadDatabase as jest.Mock).mockImplementation(mockDownload);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      expect(screen.getByText('Downloading...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(downloadButton).toBeDisabled();
    });

    it('should call onDownloadComplete on successful download', async () => {
      const mockResult = {
        success: true,
        fileName: 'verification_test-store_2025-09-29.csv',
        fileSize: 12500
      };
      (verificationService.downloadDatabase as jest.Mock).mockResolvedValue(mockResult);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockProps.onDownloadComplete).toHaveBeenCalledWith(mockResult);
      });
    });

    it('should call onDownloadError on failed download', async () => {
      const mockError = {
        success: false,
        error: 'Network connection failed'
      };
      (verificationService.downloadDatabase as jest.Mock).mockResolvedValue(mockError);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockProps.onDownloadError).toHaveBeenCalledWith(mockError.error);
      });
    });

    it('should handle download service exceptions', async () => {
      const mockError = new Error('Service unavailable');
      (verificationService.downloadDatabase as jest.Mock).mockRejectedValue(mockError);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockProps.onDownloadError).toHaveBeenCalledWith('Service unavailable');
      });
    });

    it('should reset loading state after download completion', async () => {
      (verificationService.downloadDatabase as jest.Mock).mockResolvedValue({
        success: true,
        fileName: 'test.csv'
      });

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      // Should show loading initially
      expect(screen.getByText('Downloading...')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Downloading...')).not.toBeInTheDocument();
      });

      // Button should be enabled again
      expect(downloadButton).not.toBeDisabled();
    });
  });

  describe('Progress Tracking', () => {
    it('should show download progress when available', async () => {
      const mockDownload = jest.fn().mockImplementation(() => {
        // Simulate progress updates
        const progressEvent = new CustomEvent('downloadProgress', {
          detail: { loaded: 5000, total: 10000 }
        });
        window.dispatchEvent(progressEvent);
        
        return Promise.resolve({ success: true });
      });
      (verificationService.downloadDatabase as jest.Mock).mockImplementation(mockDownload);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('should show indeterminate progress when no total size available', async () => {
      const mockDownload = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      (verificationService.downloadDatabase as jest.Mock).mockImplementation(mockDownload);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).not.toHaveAttribute('value');
    });
  });

  describe('File Size Estimates', () => {
    it('should calculate CSV file size estimate', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const estimate = screen.getByText(/estimated file size/i);
      expect(estimate).toHaveTextContent(/\d+\.?\d*\s*(KB|MB)/);
    });

    it('should show larger estimate for JSON format', () => {
      render(<VerificationFileDownload {...mockProps} />);

      // Get CSV estimate
      const csvEstimate = screen.getByText(/estimated file size/i).textContent;

      // Change to JSON
      const formatSelect = screen.getByLabelText('File Format');
      fireEvent.change(formatSelect, { target: { value: 'json' } });

      // JSON should be larger
      const jsonEstimate = screen.getByText(/estimated file size/i).textContent;
      
      // Extract numeric values for comparison
      const csvSize = parseFloat(csvEstimate?.match(/[\d.]+/)?.[0] || '0');
      const jsonSize = parseFloat(jsonEstimate?.match(/[\d.]+/)?.[0] || '0');
      
      expect(jsonSize).toBeGreaterThan(csvSize);
    });

    it('should scale estimate with transaction count', () => {
      const largeProps = { ...mockProps, transactionCount: 1000 };
      const { rerender } = render(<VerificationFileDownload {...mockProps} />);

      const smallEstimate = screen.getByText(/estimated file size/i).textContent;

      rerender(<VerificationFileDownload {...largeProps} />);

      const largeEstimate = screen.getByText(/estimated file size/i).textContent;
      
      // Extract numeric values
      const smallSize = parseFloat(smallEstimate?.match(/[\d.]+/)?.[0] || '0');
      const largeSize = parseFloat(largeEstimate?.match(/[\d.]+/)?.[0] || '0');
      
      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<VerificationFileDownload {...mockProps} />);

      expect(screen.getByLabelText('File Format')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download/i })).toHaveAttribute('aria-describedby');
    });

    it('should announce download status to screen readers', async () => {
      (verificationService.downloadDatabase as jest.Mock).mockResolvedValue({
        success: true,
        fileName: 'test.csv'
      });

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toHaveTextContent('Download completed successfully');
      });
    });

    it('should support keyboard navigation', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      const downloadButton = screen.getByRole('button', { name: /download/i });

      // Tab navigation
      formatSelect.focus();
      expect(formatSelect).toHaveFocus();

      fireEvent.keyDown(formatSelect, { key: 'Tab' });
      downloadButton.focus();
      expect(downloadButton).toHaveFocus();

      // Enter key should trigger download
      fireEvent.keyDown(downloadButton, { key: 'Enter' });
      expect(verificationService.downloadDatabase).toHaveBeenCalled();
    });

    it('should have proper focus management during loading', async () => {
      const mockDownload = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      (verificationService.downloadDatabase as jest.Mock).mockImplementation(mockDownload);

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      downloadButton.focus();
      fireEvent.click(downloadButton);

      // Button should retain focus but be disabled
      expect(downloadButton).toHaveFocus();
      expect(downloadButton).toBeDisabled();

      await waitFor(() => {
        expect(downloadButton).not.toBeDisabled();
        expect(downloadButton).toHaveFocus();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message for invalid file format', () => {
      const invalidProps = { ...mockProps };
      render(<VerificationFileDownload {...invalidProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      fireEvent.change(formatSelect, { target: { value: 'invalid' } });

      expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
    });

    it('should disable download for unsupported formats', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      fireEvent.change(formatSelect, { target: { value: 'pdf' } });

      const downloadButton = screen.getByRole('button', { name: /download/i });
      expect(downloadButton).toBeDisabled();
    });

    it('should show retry option after failed download', async () => {
      (verificationService.downloadDatabase as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Server error'
      });

      render(<VerificationFileDownload {...mockProps} />);

      const downloadButton = screen.getByRole('button', { name: /download/i });
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('Retry Download')).toBeInTheDocument();
      });
    });
  });

  describe('File Naming', () => {
    it('should show expected filename preview', () => {
      render(<VerificationFileDownload {...mockProps} />);

      expect(screen.getByText(/filename:/i)).toBeInTheDocument();
      expect(screen.getByText(/verification_test-store_\d{4}-\d{2}-\d{2}\.csv/)).toBeInTheDocument();
    });

    it('should update filename preview when format changes', () => {
      render(<VerificationFileDownload {...mockProps} />);

      const formatSelect = screen.getByLabelText('File Format');
      fireEvent.change(formatSelect, { target: { value: 'xlsx' } });

      expect(screen.getByText(/\.xlsx$/)).toBeInTheDocument();
    });
  });
});