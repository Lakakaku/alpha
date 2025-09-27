/**
 * Integration Test: Personnel Management
 *
 * Test Scenario: Business configures staff information and service points
 * From quickstart.md: Scenario 2 - Personnel Management (4 minutes)
 *
 * This test MUST FAIL initially (TDD) - components not implemented yet
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';

// Mock imports (will fail until components implemented)
let PersonnelManagementPage: any;
let ContextLayout: any;
let mockRouter: any;

try {
  PersonnelManagementPage = require('../../src/app/context/personnel/page').default;
  ContextLayout = require('../../src/app/context/layout').default;
  mockRouter = require('next/router');
} catch (error) {
  console.log('Expected failure: Personnel components not implemented yet');
  PersonnelManagementPage = () => <div>Personnel Management Page Not Implemented</div>;
  ContextLayout = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  mockRouter = {
    useRouter: () => ({
      push: jest.fn(),
      pathname: '/context/personnel',
      query: {}
    })
  };
}

// Mock API endpoints
const mockApiServer = {
  baseURL: 'http://localhost:3000',
  authToken: 'mock-business-auth-token',
  storeId: 'test-store-personnel-123'
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Personnel Management Integration', () => {
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

    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      if (url.includes('/context/personnel')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'personnel-123',
              store_id: mockApiServer.storeId,
              total_staff_count: 12,
              manager_name: 'Anna Svensson',
              customer_service_points: [
                {
                  location: 'main entrance',
                  type: 'information_desk',
                  staff_count: 2,
                  hours: '09:00-21:00'
                }
              ],
              department_heads: {
                grocery: 'Erik Johansson',
                electronics: 'Maria Lindberg'
              }
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
              overall_score: 50,
              sections: {
                profile: { completed: true, score: 100 },
                personnel: { completed: true, score: 100 },
                layout: { completed: false, score: 0 },
                inventory: { completed: false, score: 0 }
              },
              next_steps: ['Configure store layout']
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

  describe('Scenario 2: Personnel Management (4 minutes)', () => {
    test('should load personnel section with basic staff configuration', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false); // Fail until implemented
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Check page loads correctly
      expect(screen.getByText(/personnel management/i)).toBeInTheDocument();
      expect(screen.getByText(/configure staff information/i)).toBeInTheDocument();

      // Check required form fields are present
      expect(screen.getByLabelText(/total staff count/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/store manager/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/assistant manager/i)).toBeInTheDocument();
    });

    test('should configure personnel details as per quickstart scenario', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      const startTime = Date.now();
      renderWithProviders(<PersonnelManagementPage />);

      // Configure personnel details from quickstart scenario
      const totalStaffInput = screen.getByLabelText(/total staff count/i);
      const managerNameInput = screen.getByLabelText(/store manager/i);
      const assistantManagerInput = screen.getByLabelText(/assistant manager/i);

      // Fill basic personnel information
      await user.clear(totalStaffInput);
      await user.type(totalStaffInput, '12');
      await user.clear(managerNameInput);
      await user.type(managerNameInput, 'Anna Svensson');
      await user.clear(assistantManagerInput);
      await user.type(assistantManagerInput, 'Erik Johansson');

      // Verify form accepts Swedish names correctly
      expect(totalStaffInput).toHaveValue(12);
      expect(managerNameInput).toHaveValue('Anna Svensson');
      expect(assistantManagerInput).toHaveValue('Erik Johansson');

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(4 * 60 * 1000); // 4 minutes max
    });

    test('should configure service points with proper staff allocation', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Navigate to service points section
      const servicePointsTab = screen.getByRole('tab', { name: /service points/i });
      await user.click(servicePointsTab);

      // Add main entrance info desk
      const addServicePointButton = screen.getByRole('button', { name: /add service point/i });
      await user.click(addServicePointButton);

      // Configure service point details
      const locationSelect = screen.getByLabelText(/location/i);
      const typeSelect = screen.getByLabelText(/service type/i);
      const staffCountInput = screen.getByLabelText(/staff count/i);
      const hoursInput = screen.getByLabelText(/operating hours/i);

      await user.selectOptions(locationSelect, 'main entrance');
      await user.selectOptions(typeSelect, 'information_desk');
      await user.clear(staffCountInput);
      await user.type(staffCountInput, '2');
      await user.clear(hoursInput);
      await user.type(hoursInput, '09:00-21:00');

      // Save service point
      const saveServicePointButton = screen.getByRole('button', { name: /save service point/i });
      await user.click(saveServicePointButton);

      // Verify service point was added
      await waitFor(() => {
        expect(screen.getByText(/main entrance info desk/i)).toBeInTheDocument();
        expect(screen.getByText(/2 staff/i)).toBeInTheDocument();
        expect(screen.getByText(/09:00-21:00/i)).toBeInTheDocument();
      });
    });

    test('should configure department heads for key departments', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Navigate to department heads section
      const departmentHeadsTab = screen.getByRole('tab', { name: /department heads/i });
      await user.click(departmentHeadsTab);

      // Configure department heads as per scenario
      const groceryHeadInput = screen.getByLabelText(/grocery department head/i);
      const electronicsHeadInput = screen.getByLabelText(/electronics department head/i);

      await user.clear(groceryHeadInput);
      await user.type(groceryHeadInput, 'Erik Johansson');
      await user.clear(electronicsHeadInput);
      await user.type(electronicsHeadInput, 'Maria Lindberg');

      // Add customer service department head
      const addDepartmentButton = screen.getByRole('button', { name: /add department/i });
      await user.click(addDepartmentButton);

      const newDepartmentSelect = screen.getByLabelText(/department/i);
      const newHeadInput = screen.getByLabelText(/department head name/i);

      await user.selectOptions(newDepartmentSelect, 'customer_service');
      await user.clear(newHeadInput);
      await user.type(newHeadInput, 'Anna Svensson');

      // Save department heads
      const saveDepartmentHeadsButton = screen.getByRole('button', { name: /save department heads/i });
      await user.click(saveDepartmentHeadsButton);

      // Verify department heads configuration
      await waitFor(() => {
        expect(screen.getByText(/erik johansson.*grocery/i)).toBeInTheDocument();
        expect(screen.getByText(/maria lindberg.*electronics/i)).toBeInTheDocument();
        expect(screen.getByText(/anna svensson.*customer service/i)).toBeInTheDocument();
      });
    });

    test('should configure shift schedules with staff allocation', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Navigate to shift configuration
      const shiftsTab = screen.getByRole('tab', { name: /shifts/i });
      await user.click(shiftsTab);

      // Configure morning shift (6-14)
      const addShiftButton = screen.getByRole('button', { name: /add shift/i });
      await user.click(addShiftButton);

      let shiftNameInput = screen.getByLabelText(/shift name/i);
      let startTimeInput = screen.getByLabelText(/start time/i);
      let endTimeInput = screen.getByLabelText(/end time/i);
      let staffCountInput = screen.getByLabelText(/total staff/i);

      await user.clear(shiftNameInput);
      await user.type(shiftNameInput, 'Morning');
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '06:00');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '14:00');
      await user.clear(staffCountInput);
      await user.type(staffCountInput, '8');

      // Configure department allocation for morning shift
      const checkoutAllocationInput = screen.getByLabelText(/checkout allocation/i);
      const groceryAllocationInput = screen.getByLabelText(/grocery allocation/i);
      const electronicsAllocationInput = screen.getByLabelText(/electronics allocation/i);

      await user.clear(checkoutAllocationInput);
      await user.type(checkoutAllocationInput, '3');
      await user.clear(groceryAllocationInput);
      await user.type(groceryAllocationInput, '3');
      await user.clear(electronicsAllocationInput);
      await user.type(electronicsAllocationInput, '2');

      // Save morning shift
      const saveShiftButton = screen.getByRole('button', { name: /save shift/i });
      await user.click(saveShiftButton);

      // Add afternoon shift (14-22)
      await user.click(addShiftButton);

      // Get fresh references after re-render
      shiftNameInput = screen.getByLabelText(/shift name/i);
      startTimeInput = screen.getByLabelText(/start time/i);
      endTimeInput = screen.getByLabelText(/end time/i);
      staffCountInput = screen.getByLabelText(/total staff/i);

      await user.clear(shiftNameInput);
      await user.type(shiftNameInput, 'Afternoon');
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '14:00');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '22:00');
      await user.clear(staffCountInput);
      await user.type(staffCountInput, '6');

      // Configure department allocation for afternoon shift
      const afternoonCheckoutInput = screen.getAllByLabelText(/checkout allocation/i)[1];
      const afternoonGroceryInput = screen.getAllByLabelText(/grocery allocation/i)[1];
      const afternoonElectronicsInput = screen.getAllByLabelText(/electronics allocation/i)[1];

      await user.clear(afternoonCheckoutInput);
      await user.type(afternoonCheckoutInput, '2');
      await user.clear(afternoonGroceryInput);
      await user.type(afternoonGroceryInput, '2');
      await user.clear(afternoonElectronicsInput);
      await user.type(afternoonElectronicsInput, '2');

      await user.click(saveShiftButton);

      // Verify shift calculations display correctly
      await waitFor(() => {
        expect(screen.getByText(/morning.*8 staff/i)).toBeInTheDocument();
        expect(screen.getByText(/afternoon.*6 staff/i)).toBeInTheDocument();
        expect(screen.getByText(/total coverage.*14 staff-hours/i)).toBeInTheDocument();
      });
    });

    test('should save complete personnel configuration and update completeness', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Fill basic personnel data
      await user.type(screen.getByLabelText(/total staff count/i), '12');
      await user.type(screen.getByLabelText(/store manager/i), 'Anna Svensson');

      // Quick setup service point
      const servicePointsTab = screen.getByRole('tab', { name: /service points/i });
      await user.click(servicePointsTab);

      const addServicePointButton = screen.getByRole('button', { name: /add service point/i });
      await user.click(addServicePointButton);

      await user.selectOptions(screen.getByLabelText(/location/i), 'main entrance');
      await user.selectOptions(screen.getByLabelText(/service type/i), 'information_desk');
      await user.type(screen.getByLabelText(/staff count/i), '2');

      // Save entire personnel configuration
      const saveAllButton = screen.getByRole('button', { name: /save personnel configuration/i });

      const startTime = Date.now();
      await user.click(saveAllButton);
      const responseTime = Date.now() - startTime;

      // Verify API integration
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/context/personnel'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': expect.stringContaining('Bearer')
            }),
            body: expect.stringContaining('"total_staff_count":12')
          })
        );
      });

      // Verify performance requirement
      expect(responseTime).toBeLessThan(200);

      // Verify success notification
      await waitFor(() => {
        expect(screen.getByText(/personnel configuration saved successfully/i)).toBeInTheDocument();
      });

      // Verify completeness updates to 50%
      await waitFor(() => {
        const completenessIndicator = screen.getByTestId('context-completeness');
        expect(within(completenessIndicator).getByText('50%')).toBeInTheDocument();
        expect(within(completenessIndicator).getByText(/personnel section complete/i)).toBeInTheDocument();
      });

      // Verify next step guidance
      expect(screen.getByText(/layout.*next step/i)).toBeInTheDocument();
    });

    test('should validate shift allocation totals match staff count', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Navigate to shifts
      const shiftsTab = screen.getByRole('tab', { name: /shifts/i });
      await user.click(shiftsTab);

      // Add shift with mismatched allocation
      const addShiftButton = screen.getByRole('button', { name: /add shift/i });
      await user.click(addShiftButton);

      await user.type(screen.getByLabelText(/shift name/i), 'Morning');
      await user.type(screen.getByLabelText(/start time/i), '06:00');
      await user.type(screen.getByLabelText(/end time/i), '14:00');
      await user.type(screen.getByLabelText(/total staff/i), '8');

      // Configure mismatched allocation (total = 10, but staff = 8)
      await user.type(screen.getByLabelText(/checkout allocation/i), '4');
      await user.type(screen.getByLabelText(/grocery allocation/i), '6'); // Total = 10

      // Try to save
      const saveShiftButton = screen.getByRole('button', { name: /save shift/i });
      await user.click(saveShiftButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/allocation total.*must equal staff count/i)).toBeInTheDocument();
        expect(screen.getByText(/current total: 10, staff count: 8/i)).toBeInTheDocument();
      });

      // Fix allocation
      await user.clear(screen.getByLabelText(/grocery allocation/i));
      await user.type(screen.getByLabelText(/grocery allocation/i), '4'); // Total = 8

      await user.click(saveShiftButton);

      // Verify error disappears and save succeeds
      await waitFor(() => {
        expect(screen.queryByText(/allocation total.*must equal/i)).not.toBeInTheDocument();
        expect(screen.getByText(/shift saved successfully/i)).toBeInTheDocument();
      });
    });

    test('should handle overlapping shift times validation', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      const shiftsTab = screen.getByRole('tab', { name: /shifts/i });
      await user.click(shiftsTab);

      // Add first shift
      const addShiftButton = screen.getByRole('button', { name: /add shift/i });
      await user.click(addShiftButton);

      await user.type(screen.getByLabelText(/shift name/i), 'Morning');
      await user.type(screen.getByLabelText(/start time/i), '06:00');
      await user.type(screen.getByLabelText(/end time/i), '14:00');
      await user.type(screen.getByLabelText(/total staff/i), '8');
      await user.type(screen.getByLabelText(/checkout allocation/i), '8');

      await user.click(screen.getByRole('button', { name: /save shift/i }));

      // Add overlapping shift
      await user.click(addShiftButton);

      await user.type(screen.getByLabelText(/shift name/i), 'Overlap');
      await user.type(screen.getByLabelText(/start time/i), '12:00'); // Overlaps with morning
      await user.type(screen.getByLabelText(/end time/i), '16:00');
      await user.type(screen.getByLabelText(/total staff/i), '4');
      await user.type(screen.getByLabelText(/checkout allocation/i), '4');

      await user.click(screen.getByRole('button', { name: /save shift/i }));

      // Verify overlap warning/handling
      await waitFor(() => {
        expect(screen.getByText(/shift overlap detected/i)).toBeInTheDocument();
        expect(screen.getByText(/12:00-14:00 overlaps with morning shift/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling & Performance', () => {
    test('should handle API validation errors gracefully', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      // Mock validation error from API
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              details: [
                { field: 'manager_name', message: 'Manager name is required' }
              ]
            }
          })
        })
      );

      renderWithProviders(<PersonnelManagementPage />);

      // Submit incomplete form
      await user.type(screen.getByLabelText(/total staff count/i), '5');
      const saveButton = screen.getByRole('button', { name: /save personnel configuration/i });
      await user.click(saveButton);

      // Verify API error handling
      await waitFor(() => {
        expect(screen.getByText(/manager name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/please correct the errors/i)).toBeInTheDocument();
      });

      // Verify form remains interactive
      expect(screen.getByLabelText(/store manager/i)).not.toBeDisabled();
      expect(saveButton).not.toBeDisabled();
    });

    test('should maintain performance with large staff counts', async () => {
      if (!PersonnelManagementPage || PersonnelManagementPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<PersonnelManagementPage />);

      // Test with large staff count
      const startTime = Date.now();
      await user.type(screen.getByLabelText(/total staff count/i), '250');
      const inputTime = Date.now() - startTime;

      // Verify input responsiveness
      expect(inputTime).toBeLessThan(1000);

      // Test shift allocation with large numbers
      const shiftsTab = screen.getByRole('tab', { name: /shifts/i });
      await user.click(shiftsTab);

      const addShiftButton = screen.getByRole('button', { name: /add shift/i });
      await user.click(addShiftButton);

      await user.type(screen.getByLabelText(/total staff/i), '100');
      await user.type(screen.getByLabelText(/checkout allocation/i), '50');
      await user.type(screen.getByLabelText(/grocery allocation/i), '50');

      // Verify calculation performance
      const calcStartTime = Date.now();
      await user.click(screen.getByRole('button', { name: /save shift/i }));
      const calcTime = Date.now() - calcStartTime;

      expect(calcTime).toBeLessThan(500);
    });
  });
});