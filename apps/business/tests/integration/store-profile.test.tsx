/**
 * Integration Test: Store Profile Configuration
 *
 * Test Scenario: Business owner configures basic store information
 * From quickstart.md: Scenario 1 - Store Profile Configuration (3 minutes)
 *
 * This test MUST FAIL initially (TDD) - components not implemented yet
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';

// Mock imports (will fail until components implemented)
let StoreProfilePage: any;
let ContextLayout: any;
let mockRouter: any;

try {
  StoreProfilePage = require('../../src/app/context/page').default;
  ContextLayout = require('../../src/app/context/layout').default;
  mockRouter = require('next/router');
} catch (error) {
  console.log('Expected failure: Context components not implemented yet');
  StoreProfilePage = () => <div>Store Profile Page Not Implemented</div>;
  ContextLayout = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  mockRouter = {
    useRouter: () => ({
      push: jest.fn(),
      pathname: '/context',
      query: {}
    })
  };
}

// Mock API endpoints
const mockApiServer = {
  baseURL: 'http://localhost:3000',
  authToken: 'mock-business-auth-token',
  storeId: 'test-store-profile-123'
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Store Profile Configuration Integration', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0
        }
      }
    });
    user = userEvent.setup();

    // Mock successful authentication
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      if (url.includes('/context/profile')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'profile-123',
              store_id: mockApiServer.storeId,
              store_type: 'grocery',
              square_footage: 500,
              department_count: 8,
              layout_type: 'grid'
            }
          })
        });
      }
      if (url.includes('/context/completeness')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: {
              overall_score: 25,
              sections: {
                profile: { completed: true, score: 100 },
                personnel: { completed: false, score: 0 },
                layout: { completed: false, score: 0 },
                inventory: { completed: false, score: 0 }
              },
              next_steps: ['Configure personnel information']
            }
          })
        });
      }
      return Promise.reject(new Error('Unhandled mock API call'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ContextLayout>
          {component}
        </ContextLayout>
      </QueryClientProvider>
    );
  };

  describe('Scenario 1: Store Profile Configuration (3 minutes)', () => {
    test('should load context route and display store profile form', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false); // Fail until implemented
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Check page loads correctly
      expect(screen.getByText(/store profile/i)).toBeInTheDocument();
      expect(screen.getByText(/configure basic store information/i)).toBeInTheDocument();

      // Check required form fields are present
      expect(screen.getByLabelText(/store type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/store size/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/number of departments/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/layout type/i)).toBeInTheDocument();
    });

    test('should configure store profile with quickstart scenario data', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      const startTime = Date.now();
      renderWithProviders(<StoreProfilePage />);

      // Fill out store profile form with scenario data
      const storeTypeSelect = screen.getByLabelText(/store type/i);
      const storeSizeInput = screen.getByLabelText(/store size/i);
      const departmentCountInput = screen.getByLabelText(/number of departments/i);
      const layoutTypeSelect = screen.getByLabelText(/layout type/i);

      // Configure store profile as per quickstart scenario
      await user.selectOptions(storeTypeSelect, 'grocery');
      await user.clear(storeSizeInput);
      await user.type(storeSizeInput, '500');
      await user.clear(departmentCountInput);
      await user.type(departmentCountInput, '8');
      await user.selectOptions(layoutTypeSelect, 'grid');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      // Verify API call was made correctly
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/context/profile'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': expect.stringContaining('Bearer')
            }),
            body: expect.stringContaining('"store_type":"grocery"')
          })
        );
      });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3 * 60 * 1000); // 3 minutes max
    });

    test('should configure operating hours as part of profile', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Navigate to operating hours section
      const operatingHoursTab = screen.getByRole('tab', { name: /operating hours/i });
      await user.click(operatingHoursTab);

      // Configure Mon-Fri 8:00-20:00
      const mondayOpenTime = screen.getByLabelText(/monday open time/i);
      const mondayCloseTime = screen.getByLabelText(/monday close time/i);

      await user.clear(mondayOpenTime);
      await user.type(mondayOpenTime, '08:00');
      await user.clear(mondayCloseTime);
      await user.type(mondayCloseTime, '20:00');

      // Copy to weekdays
      const copyToWeekdaysButton = screen.getByRole('button', { name: /copy to weekdays/i });
      await user.click(copyToWeekdaysButton);

      // Configure Sat-Sun 10:00-18:00
      const saturdayOpenTime = screen.getByLabelText(/saturday open time/i);
      const saturdayCloseTime = screen.getByLabelText(/saturday close time/i);

      await user.clear(saturdayOpenTime);
      await user.type(saturdayOpenTime, '10:00');
      await user.clear(saturdayCloseTime);
      await user.type(saturdayCloseTime, '18:00');

      // Copy to Sunday
      const copyToSundayButton = screen.getByRole('button', { name: /copy to sunday/i });
      await user.click(copyToSundayButton);

      // Save operating hours
      const saveHoursButton = screen.getByRole('button', { name: /save hours/i });
      await user.click(saveHoursButton);

      // Verify success message
      await waitFor(() => {
        expect(screen.getByText(/operating hours saved successfully/i)).toBeInTheDocument();
      });
    });

    test('should verify API integration with performance requirements', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Fill minimal required fields
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');
      await user.type(screen.getByLabelText(/store size/i), '500');
      await user.type(screen.getByLabelText(/number of departments/i), '8');
      await user.selectOptions(screen.getByLabelText(/layout type/i), 'grid');

      // Measure save performance
      const startTime = Date.now();
      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/profile saved successfully/i)).toBeInTheDocument();
      });

      const responseTime = Date.now() - startTime;

      // Verify performance requirement: <200ms response time
      expect(responseTime).toBeLessThan(200);

      // Verify API call structure
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/business\/stores\/[\w-]+\/context\/profile$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Bearer .+/)
          })
        })
      );
    });

    test('should update context completeness after profile completion', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Complete profile configuration
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');
      await user.type(screen.getByLabelText(/store size/i), '500');
      await user.type(screen.getByLabelText(/number of departments/i), '8');
      await user.selectOptions(screen.getByLabelText(/layout type/i), 'grid');

      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByText(/profile saved successfully/i)).toBeInTheDocument();
      });

      // Verify completeness indicator updates
      await waitFor(() => {
        const completenessIndicator = screen.getByTestId('context-completeness');
        expect(within(completenessIndicator).getByText('25%')).toBeInTheDocument();
        expect(within(completenessIndicator).getByText(/profile section complete/i)).toBeInTheDocument();
      });

      // Verify next steps guidance
      expect(screen.getByText(/personnel.*next step/i)).toBeInTheDocument();

      // Verify navigation shows Personnel as next step
      const nextStepButton = screen.getByRole('button', { name: /continue to personnel/i });
      expect(nextStepButton).toBeInTheDocument();
      expect(nextStepButton).not.toBeDisabled();
    });

    test('should handle form validation errors gracefully', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      // Verify validation errors appear
      await waitFor(() => {
        expect(screen.getByText(/store type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/store size is required/i)).toBeInTheDocument();
        expect(screen.getByText(/department count is required/i)).toBeInTheDocument();
        expect(screen.getByText(/layout type is required/i)).toBeInTheDocument();
      });

      // Verify form is not submitted
      expect(global.fetch).not.toHaveBeenCalled();

      // Fix validation errors
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');
      await user.type(screen.getByLabelText(/store size/i), '500');
      await user.type(screen.getByLabelText(/number of departments/i), '8');
      await user.selectOptions(screen.getByLabelText(/layout type/i), 'grid');

      // Verify errors disappear
      expect(screen.queryByText(/store type is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/store size is required/i)).not.toBeInTheDocument();
    });

    test('should support form auto-save functionality', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<StoreProfilePage />);

      // Fill store type and wait for auto-save
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');

      // Wait for auto-save indicator
      await waitFor(() => {
        expect(screen.getByText(/auto-saved/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Continue filling form
      await user.type(screen.getByLabelText(/store size/i), '500');

      // Wait for another auto-save
      await waitFor(() => {
        expect(screen.getByText(/auto-saved/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify draft save API calls were made
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/context/profile/draft'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('should integrate with store selection context', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      // Mock multi-store business context
      const multiStoreContext = {
        activeStore: {
          id: 'store-1',
          name: 'Main Store',
          address: '123 Main St'
        },
        stores: [
          { id: 'store-1', name: 'Main Store', address: '123 Main St' },
          { id: 'store-2', name: 'Branch Store', address: '456 Oak Ave' }
        ]
      };

      renderWithProviders(<StoreProfilePage />);

      // Verify store context is displayed
      expect(screen.getByText(/configuring: main store/i)).toBeInTheDocument();
      expect(screen.getByText(/123 main st/i)).toBeInTheDocument();

      // Verify store switcher is available
      const storeSwitcher = screen.getByRole('combobox', { name: /select store/i });
      expect(storeSwitcher).toBeInTheDocument();

      // Test store switching
      await user.click(storeSwitcher);
      await user.click(screen.getByText(/branch store/i));

      // Verify context updates
      await waitFor(() => {
        expect(screen.getByText(/configuring: branch store/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling & Edge Cases', () => {
    test('should handle API errors gracefully', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      // Mock API error
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false,
            error: { message: 'Internal server error' }
          })
        })
      );

      renderWithProviders(<StoreProfilePage />);

      // Fill and submit form
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');
      await user.type(screen.getByLabelText(/store size/i), '500');
      await user.type(screen.getByLabelText(/number of departments/i), '8');
      await user.selectOptions(screen.getByLabelText(/layout type/i), 'grid');

      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/failed to save profile/i)).toBeInTheDocument();
        expect(screen.getByText(/please try again/i)).toBeInTheDocument();
      });

      // Verify form remains editable
      expect(screen.getByLabelText(/store type/i)).not.toBeDisabled();
      expect(saveButton).not.toBeDisabled();
    });

    test('should handle network connectivity issues', async () => {
      if (!StoreProfilePage || StoreProfilePage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      // Mock network error
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      renderWithProviders(<StoreProfilePage />);

      // Fill and submit form
      await user.selectOptions(screen.getByLabelText(/store type/i), 'grocery');
      const saveButton = screen.getByRole('button', { name: /save profile/i });
      await user.click(saveButton);

      // Verify offline handling
      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
        expect(screen.getByText(/will retry automatically/i)).toBeInTheDocument();
      });

      // Verify retry mechanism
      expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument();
    });
  });
});