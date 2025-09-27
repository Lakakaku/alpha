/**
 * Integration Test T020: Call Completion Confirmation
 * 
 * Tests the complete call completion flow including:
 * - Real-time call status polling
 * - Call completion confirmation
 * - Reward timeline display
 * - Quality feedback submission
 * - Status persistence across page refreshes
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: jest.fn(),
    forward: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams('sessionId=test-session-123'),
  useParams: () => ({ sessionId: 'test-session-123' }),
  usePathname: () => '/call-status/test-session-123',
}));

// Mock API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

const sessionStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock components (to be implemented)
const CallStatusPage = ({ sessionId }: { sessionId: string }) => {
  return <div data-testid="call-status-page">Call Status: {sessionId}</div>;
};

const CallCompletionPage = ({ sessionId }: { sessionId: string }) => {
  return <div data-testid="call-completion-page">Call Completion: {sessionId}</div>;
};

const RewardTimelinePage = ({ verificationId }: { verificationId: string }) => {
  return <div data-testid="reward-timeline-page">Rewards: {verificationId}</div>;
};

// Test data
const TEST_SESSION_ID = 'test-session-123';
const TEST_VERIFICATION_ID = 'verification-456';
const TEST_STORE_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockCallSessionData = {
  sessionId: TEST_SESSION_ID,
  storeId: TEST_STORE_ID,
  storeName: 'Test Butik',
  status: 'in_progress',
  startedAt: '2025-09-22T10:00:00Z',
  estimatedDuration: 180, // 3 minutes
  phoneNumber: '+46701234567',
  verificationId: null,
  callQuality: null,
  completedAt: null,
};

const mockCompletedSessionData = {
  ...mockCallSessionData,
  status: 'completed',
  completedAt: '2025-09-22T10:03:15Z',
  verificationId: TEST_VERIFICATION_ID,
  callQuality: 'good',
};

const mockRewardTimelineData = {
  verificationId: TEST_VERIFICATION_ID,
  status: 'verified',
  rewardAmount: 25.0,
  currency: 'SEK',
  estimatedPayoutDate: '2025-09-29T00:00:00Z',
  milestones: [
    {
      id: 'verification',
      title: 'Verifiering slutförd',
      description: 'Din transaktion har verifierats',
      status: 'completed',
      completedAt: '2025-09-22T10:03:15Z',
    },
    {
      id: 'quality_check',
      title: 'Kvalitetskontroll',
      description: 'Samtalet granskas för kvalitet',
      status: 'in_progress',
      estimatedCompletion: '2025-09-23T12:00:00Z',
    },
    {
      id: 'payment_processing',
      title: 'Betalning behandlas',
      description: 'Din belöning bearbetas för utbetalning',
      status: 'pending',
      estimatedCompletion: '2025-09-28T00:00:00Z',
    },
    {
      id: 'payout',
      title: 'Utbetalning',
      description: 'Belöningen betalas ut till ditt konto',
      status: 'pending',
      estimatedCompletion: '2025-09-29T00:00:00Z',
    },
  ],
};

describe('Call Completion Confirmation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    
    // Set up default session storage
    sessionStorage.setItem('vocilia_session_token', 'valid-session-token');
  });

  describe('Real-time Call Status Polling', () => {
    it('should poll call status every 5 seconds during active call', async () => {
      // Mock API responses for polling
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompletedSessionData,
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Verify initial call status fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3001/api/calls/${TEST_SESSION_ID}/status`,
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'X-Session-Token': 'valid-session-token',
            }),
          })
        );
      });

      // Fast-forward timer to trigger polling
      jest.useFakeTimers();
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should poll again after 5 seconds
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Fast-forward again to get completion
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      jest.useRealTimers();
    });

    it('should display real-time call progress indicators', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockCallSessionData,
          currentPhase: 'introduction',
          progress: 0.3,
          estimatedTimeRemaining: 120,
        }),
      });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('call-progress-bar')).toBeInTheDocument();
        expect(screen.getByTestId('current-phase')).toHaveTextContent('introduction');
        expect(screen.getByTestId('estimated-time-remaining')).toHaveTextContent('2 min');
      });
    });

    it('should handle connection errors during polling gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Initial load should work
      await waitFor(() => {
        expect(screen.getByTestId('call-status-page')).toBeInTheDocument();
      });

      jest.useFakeTimers();
      
      // Trigger polling that will fail
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should show connection error but continue polling
      await waitFor(() => {
        expect(screen.getByTestId('connection-warning')).toBeInTheDocument();
      });

      // Next poll should succeed and clear error
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('connection-warning')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Call Completion Confirmation', () => {
    it('should automatically redirect to completion page when call ends', async () => {
      // Start with in-progress call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompletedSessionData,
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      jest.useFakeTimers();
      
      // Trigger polling that returns completed status
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          `/call-completion/${TEST_SESSION_ID}`
        );
      });

      jest.useRealTimers();
    });

    it('should display call completion confirmation UI', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('call-completion-success')).toBeInTheDocument();
        expect(screen.getByTestId('call-duration')).toHaveTextContent('3 min 15 sek');
        expect(screen.getByTestId('store-name')).toHaveTextContent('Test Butik');
        expect(screen.getByTestId('verification-id')).toHaveTextContent(TEST_VERIFICATION_ID);
      });
    });

    it('should allow manual completion confirmation', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, verificationId: TEST_VERIFICATION_ID }),
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Wait for call status to load
      await waitFor(() => {
        expect(screen.getByTestId('manual-completion-button')).toBeInTheDocument();
      });

      // Click manual completion
      const user = userEvent.setup();
      await user.click(screen.getByTestId('manual-completion-button'));

      // Should call completion API
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3001/api/calls/${TEST_SESSION_ID}/confirm-completion`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-Session-Token': 'valid-session-token',
            }),
          })
        );
      });

      // Should redirect to reward timeline
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          `/rewards/${TEST_VERIFICATION_ID}`
        );
      });
    });

    it('should handle completion confirmation errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Call session not found' }),
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('manual-completion-button')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('manual-completion-button'));

      await waitFor(() => {
        expect(screen.getByTestId('completion-error')).toBeInTheDocument();
        expect(screen.getByTestId('completion-error')).toHaveTextContent('Call session not found');
      });
    });
  });

  describe('Quality Feedback Submission', () => {
    it('should display quality feedback form after call completion', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('quality-feedback-form')).toBeInTheDocument();
        expect(screen.getByTestId('call-quality-rating')).toBeInTheDocument();
        expect(screen.getByTestId('feedback-comments')).toBeInTheDocument();
      });
    });

    it('should submit quality feedback successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompletedSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('quality-feedback-form')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      
      // Select quality rating
      await user.click(screen.getByTestId('quality-rating-4'));
      
      // Add feedback comment
      await user.type(
        screen.getByTestId('feedback-comments'),
        'Bra samtal, tydlig röst och bra frågor'
      );

      // Submit feedback
      await user.click(screen.getByTestId('submit-feedback-button'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3001/api/calls/${TEST_SESSION_ID}/feedback`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              qualityRating: 4,
              comments: 'Bra samtal, tydlig röst och bra frågor',
            }),
          })
        );
      });

      // Should show success message
      await waitFor(() => {
        expect(screen.getByTestId('feedback-success-message')).toBeInTheDocument();
      });
    });

    it('should allow skipping feedback submission', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('skip-feedback-button')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId('skip-feedback-button'));

      // Should redirect to reward timeline without submitting feedback
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          `/rewards/${TEST_VERIFICATION_ID}`
        );
      });
    });
  });

  describe('Reward Timeline Display', () => {
    it('should display reward timeline with all milestones', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockRewardTimelineData,
      });

      render(<RewardTimelinePage verificationId={TEST_VERIFICATION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('reward-amount')).toHaveTextContent('25,00 SEK');
        expect(screen.getByTestId('estimated-payout-date')).toHaveTextContent('29 sep 2025');
      });

      // Check all milestones are displayed
      mockRewardTimelineData.milestones.forEach((milestone) => {
        expect(screen.getByTestId(`milestone-${milestone.id}`)).toBeInTheDocument();
        expect(screen.getByTestId(`milestone-${milestone.id}-status`))
          .toHaveAttribute('data-status', milestone.status);
      });
    });

    it('should show progress indicators for active milestones', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockRewardTimelineData,
      });

      render(<RewardTimelinePage verificationId={TEST_VERIFICATION_ID} />);

      await waitFor(() => {
        // Completed milestone should show check mark
        expect(screen.getByTestId('milestone-verification-icon'))
          .toHaveClass('completed');
        
        // In-progress milestone should show spinner
        expect(screen.getByTestId('milestone-quality_check-icon'))
          .toHaveClass('in-progress');
        
        // Pending milestones should show waiting state
        expect(screen.getByTestId('milestone-payment_processing-icon'))
          .toHaveClass('pending');
      });
    });

    it('should display estimated completion times', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockRewardTimelineData,
      });

      render(<RewardTimelinePage verificationId={TEST_VERIFICATION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('milestone-quality_check-estimated'))
          .toHaveTextContent('Beräknas klar: 23 sep 12:00');
        expect(screen.getByTestId('milestone-payout-estimated'))
          .toHaveTextContent('Beräknas klar: 29 sep 2025');
      });
    });

    it('should update timeline when milestones complete', async () => {
      // Start with quality check in progress
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRewardTimelineData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ...mockRewardTimelineData,
            milestones: mockRewardTimelineData.milestones.map(m => 
              m.id === 'quality_check' 
                ? { ...m, status: 'completed', completedAt: '2025-09-22T14:30:00Z' }
                : m
            ),
          }),
        });

      render(<RewardTimelinePage verificationId={TEST_VERIFICATION_ID} />);

      // Initial state - quality check in progress
      await waitFor(() => {
        expect(screen.getByTestId('milestone-quality_check-status'))
          .toHaveAttribute('data-status', 'in_progress');
      });

      jest.useFakeTimers();
      
      // Simulate polling update
      act(() => {
        jest.advanceTimersByTime(30000); // 30 seconds
      });

      // Quality check should now be completed
      await waitFor(() => {
        expect(screen.getByTestId('milestone-quality_check-status'))
          .toHaveAttribute('data-status', 'completed');
      });

      jest.useRealTimers();
    });
  });

  describe('Status Persistence Across Page Refreshes', () => {
    it('should restore call status from localStorage after refresh', () => {
      // Store status in localStorage as would happen during actual usage
      localStorage.setItem(`call_status_${TEST_SESSION_ID}`, JSON.stringify({
        ...mockCallSessionData,
        lastUpdated: Date.now(),
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCallSessionData,
      });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Should display cached status immediately
      expect(screen.getByTestId('call-status-page')).toBeInTheDocument();
      
      // Should still fetch fresh data in background
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/calls/${TEST_SESSION_ID}/status`,
        expect.any(Object)
      );
    });

    it('should restore completion status from sessionStorage', () => {
      sessionStorage.setItem(`call_completion_${TEST_SESSION_ID}`, JSON.stringify({
        verificationId: TEST_VERIFICATION_ID,
        completedAt: '2025-09-22T10:03:15Z',
        qualityRating: 4,
      }));

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      // Should display completion info from cache
      expect(screen.getByTestId('call-completion-page')).toBeInTheDocument();
    });

    it('should handle stale cache data gracefully', async () => {
      // Store old data (more than 5 minutes old)
      localStorage.setItem(`call_status_${TEST_SESSION_ID}`, JSON.stringify({
        ...mockCallSessionData,
        lastUpdated: Date.now() - (6 * 60 * 1000), // 6 minutes ago
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Should ignore stale cache and fetch fresh data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Should redirect if call is now completed
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          `/call-completion/${TEST_SESSION_ID}`
        );
      });
    });

    it('should clear cached data when session ends', async () => {
      localStorage.setItem(`call_status_${TEST_SESSION_ID}`, JSON.stringify(mockCallSessionData));
      sessionStorage.setItem(`call_completion_${TEST_SESSION_ID}`, JSON.stringify({
        verificationId: TEST_VERIFICATION_ID,
        completedAt: '2025-09-22T10:03:15Z',
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      // Navigate to reward timeline (session completion)
      const user = userEvent.setup();
      await user.click(screen.getByTestId('view-rewards-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/rewards/${TEST_VERIFICATION_ID}`);
      });

      // Cache should be cleared
      expect(localStorage.getItem(`call_status_${TEST_SESSION_ID}`)).toBeNull();
      expect(sessionStorage.getItem(`call_completion_${TEST_SESSION_ID}`)).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid session ID', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' }),
      });

      render(<CallStatusPage sessionId="invalid-session" />);

      await waitFor(() => {
        expect(screen.getByTestId('session-not-found-error')).toBeInTheDocument();
        expect(screen.getByTestId('back-to-home-button')).toBeInTheDocument();
      });
    });

    it('should handle expired session tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Session expired' }),
      });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('session-expired-error')).toBeInTheDocument();
        expect(screen.getByTestId('return-to-verification-button')).toBeInTheDocument();
      });
    });

    it('should handle network timeouts gracefully', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 1000)
        )
      );

      jest.useFakeTimers();

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      // Fast-forward past timeout
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(screen.getByTestId('network-timeout-error')).toBeInTheDocument();
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should prevent multiple simultaneous completion confirmations', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              ok: true,
              json: async () => ({ success: true, verificationId: TEST_VERIFICATION_ID }),
            }), 2000)
          )
        );

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('manual-completion-button')).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const completionButton = screen.getByTestId('manual-completion-button');

      // Click multiple times rapidly
      await user.click(completionButton);
      await user.click(completionButton);
      await user.click(completionButton);

      // Button should be disabled after first click
      expect(completionButton).toBeDisabled();
      expect(screen.getByTestId('completion-loading')).toBeInTheDocument();

      // Should only make one API call
      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for status, 1 for completion
    });
  });

  describe('Accessibility and Mobile Experience', () => {
    it('should be keyboard navigable', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByTestId('quality-feedback-form')).toBeInTheDocument();
      });

      // Tab through quality rating buttons
      const ratingButtons = screen.getAllByTestId(/quality-rating-\d/);
      ratingButtons[0].focus();
      
      fireEvent.keyDown(ratingButtons[0], { key: 'ArrowRight' });
      expect(ratingButtons[1]).toHaveFocus();

      fireEvent.keyDown(ratingButtons[1], { key: 'ArrowRight' });
      expect(ratingButtons[2]).toHaveFocus();

      // Tab to comment field
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      expect(screen.getByTestId('feedback-comments')).toHaveFocus();
    });

    it('should announce status changes to screen readers', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCallSessionData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompletedSessionData,
        });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Samtal pågår');
      });

      jest.useFakeTimers();
      
      // Trigger status update
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Samtal avslutat');
      });

      jest.useRealTimers();
    });

    it('should have proper touch targets for mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCompletedSessionData,
      });

      render(<CallCompletionPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-feedback-button');
        const buttonRect = submitButton.getBoundingClientRect();
        
        // Touch target should be at least 44px (iOS guidelines)
        expect(buttonRect.height).toBeGreaterThanOrEqual(44);
        expect(buttonRect.width).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should debounce rapid status updates', async () => {
      const statusUpdates = Array.from({ length: 5 }, (_, i) => ({
        ...mockCallSessionData,
        progress: (i + 1) * 0.2,
        lastUpdated: Date.now() + i * 100,
      }));

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        const response = statusUpdates[callCount++] || mockCallSessionData;
        return Promise.resolve({
          ok: true,
          json: async () => response,
        });
      });

      render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      jest.useFakeTimers();

      // Rapid fire multiple updates
      for (let i = 0; i < 5; i++) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }

      // Should debounce and not call API too frequently
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 debounced calls

      jest.useRealTimers();
    });

    it('should cleanup polling when component unmounts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCallSessionData,
      });

      const { unmount } = render(<CallStatusPage sessionId={TEST_SESSION_ID} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Unmount component
      unmount();

      // Should clear polling interval
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Advance timer - should not make more API calls
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1); // Still just the initial call

      jest.useRealTimers();
      clearIntervalSpy.mockRestore();
    });
  });
});