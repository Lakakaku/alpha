/**
 * Integration Test: Inventory & Services Configuration
 *
 * Test Scenario: Business owner configures product categories and services
 * From quickstart.md: Scenario 4 - Inventory & Services Configuration (2 minutes)
 *
 * This test MUST FAIL initially (TDD) - components not implemented yet
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';

// Mock imports (will fail until components implemented)
let InventoryConfigPage: any;
let ContextLayout: any;
let mockRouter: any;

try {
  InventoryConfigPage = require('../../src/app/context/inventory/page').default;
  ContextLayout = require('../../src/app/context/layout').default;
  mockRouter = require('next/router');
} catch (error) {
  console.log('Expected failure: Inventory components not implemented yet');
  InventoryConfigPage = () => <div>Inventory Config Page Not Implemented</div>;
  ContextLayout = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  mockRouter = {
    useRouter: () => ({
      push: jest.fn(),
      pathname: '/context/inventory',
      query: {}
    })
  };
}

// Mock API endpoints
const mockApiServer = {
  baseURL: 'http://localhost:3000',
  authToken: 'mock-business-auth-token',
  storeId: 'test-inventory-config-123'
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Inventory & Services Configuration Integration', () => {
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
      if (url.includes('/context/inventory')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 'inventory-123',
              store_id: mockApiServer.storeId,
              categories: [
                { name: 'Fresh Produce', subcategories: ['Fruits', 'Vegetables', 'Herbs'] },
                { name: 'Dairy & Eggs', subcategories: ['Milk Products', 'Cheese', 'Eggs'] },
                { name: 'Meat & Seafood', subcategories: ['Fresh Meat', 'Seafood', 'Deli'] },
                { name: 'Pantry Staples', subcategories: ['Grains', 'Canned Goods', 'Spices'] },
                { name: 'Frozen Foods', subcategories: ['Frozen Meals', 'Ice Cream', 'Frozen Vegetables'] },
                { name: 'Beverages', subcategories: ['Soft Drinks', 'Juices', 'Water'] },
                { name: 'Health & Beauty', subcategories: ['Personal Care', 'Pharmacy', 'Cosmetics'] },
                { name: 'Household Items', subcategories: ['Cleaning', 'Paper Products', 'Storage'] }
              ],
              payment_methods: ['cash', 'card', 'mobile_pay', 'swish'],
              special_services: ['pharmacy', 'deli_counter', 'bakery'],
              seasonal_variations: true,
              loyalty_program: true
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
              overall_score: 100,
              sections: {
                profile: { completed: true, score: 100 },
                personnel: { completed: true, score: 100 },
                layout: { completed: true, score: 100 },
                inventory: { completed: true, score: 100 }
              },
              next_steps: ['Context configuration complete!']
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

  describe('Scenario 4: Inventory & Services Configuration (2 minutes)', () => {
    test('should load inventory configuration page and display product categories', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false); // Fail until implemented
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Check page loads correctly
      expect(screen.getByText(/inventory.*services/i)).toBeInTheDocument();
      expect(screen.getByText(/configure product categories/i)).toBeInTheDocument();

      // Check category sections are present
      expect(screen.getByText(/product categories/i)).toBeInTheDocument();
      expect(screen.getByText(/payment methods/i)).toBeInTheDocument();
      expect(screen.getByText(/special services/i)).toBeInTheDocument();
      expect(screen.getByText(/seasonal variations/i)).toBeInTheDocument();
    });

    test('should configure product categories with quickstart scenario data', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      const startTime = Date.now();
      renderWithProviders(<InventoryConfigPage />);

      // Select 8 main categories as per quickstart scenario
      const categoryCheckboxes = [
        'Fresh Produce',
        'Dairy & Eggs',
        'Meat & Seafood',
        'Pantry Staples',
        'Frozen Foods',
        'Beverages',
        'Health & Beauty',
        'Household Items'
      ];

      for (const category of categoryCheckboxes) {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(category, 'i') });
        await user.click(checkbox);
      }

      // Configure subcategories for Fresh Produce
      const produceExpander = screen.getByRole('button', { name: /expand fresh produce/i });
      await user.click(produceExpander);

      // Select subcategories
      await user.click(screen.getByRole('checkbox', { name: /fruits/i }));
      await user.click(screen.getByRole('checkbox', { name: /vegetables/i }));
      await user.click(screen.getByRole('checkbox', { name: /herbs/i }));

      // Save categories
      const saveCategoriesButton = screen.getByRole('button', { name: /save categories/i });
      await user.click(saveCategoriesButton);

      // Verify success and timing
      await waitFor(() => {
        expect(screen.getByText(/categories saved successfully/i)).toBeInTheDocument();
      });

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2 * 60 * 1000); // 2 minutes max
    });

    test('should configure payment methods and special services', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Navigate to payment methods tab
      const paymentTab = screen.getByRole('tab', { name: /payment methods/i });
      await user.click(paymentTab);

      // Select payment methods
      await user.click(screen.getByRole('checkbox', { name: /cash/i }));
      await user.click(screen.getByRole('checkbox', { name: /credit.*debit cards/i }));
      await user.click(screen.getByRole('checkbox', { name: /mobile payments/i }));
      await user.click(screen.getByRole('checkbox', { name: /swish/i }));

      // Navigate to special services tab
      const servicesTab = screen.getByRole('tab', { name: /special services/i });
      await user.click(servicesTab);

      // Select special services
      await user.click(screen.getByRole('checkbox', { name: /pharmacy/i }));
      await user.click(screen.getByRole('checkbox', { name: /deli counter/i }));
      await user.click(screen.getByRole('checkbox', { name: /bakery/i }));

      // Configure service hours for pharmacy
      const pharmacyHoursButton = screen.getByRole('button', { name: /configure pharmacy hours/i });
      await user.click(pharmacyHoursButton);

      const pharmacyOpenTime = screen.getByLabelText(/pharmacy open time/i);
      const pharmacyCloseTime = screen.getByLabelText(/pharmacy close time/i);

      await user.clear(pharmacyOpenTime);
      await user.type(pharmacyOpenTime, '09:00');
      await user.clear(pharmacyCloseTime);
      await user.type(pharmacyCloseTime, '19:00');

      // Save services configuration
      const saveServicesButton = screen.getByRole('button', { name: /save services/i });
      await user.click(saveServicesButton);

      await waitFor(() => {
        expect(screen.getByText(/services configuration saved/i)).toBeInTheDocument();
      });
    });

    test('should configure seasonal variations and loyalty program', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Navigate to additional features tab
      const featuresTab = screen.getByRole('tab', { name: /additional features/i });
      await user.click(featuresTab);

      // Enable seasonal variations
      const seasonalToggle = screen.getByRole('switch', { name: /seasonal variations/i });
      await user.click(seasonalToggle);

      // Configure seasonal category: Christmas decorations
      const addSeasonalButton = screen.getByRole('button', { name: /add seasonal category/i });
      await user.click(addSeasonalButton);

      const seasonalNameInput = screen.getByLabelText(/seasonal category name/i);
      await user.type(seasonalNameInput, 'Christmas Decorations');

      const seasonalStartDate = screen.getByLabelText(/start date/i);
      await user.type(seasonalStartDate, '2024-11-15');

      const seasonalEndDate = screen.getByLabelText(/end date/i);
      await user.type(seasonalEndDate, '2024-12-31');

      // Enable loyalty program
      const loyaltyToggle = screen.getByRole('switch', { name: /loyalty program/i });
      await user.click(loyaltyToggle);

      // Configure loyalty program details
      const loyaltyNameInput = screen.getByLabelText(/loyalty program name/i);
      await user.type(loyaltyNameInput, 'Fresh Rewards');

      const pointsRatioInput = screen.getByLabelText(/points per sek/i);
      await user.clear(pointsRatioInput);
      await user.type(pointsRatioInput, '1');

      // Save additional features
      const saveFeaturesButton = screen.getByRole('button', { name: /save features/i });
      await user.click(saveFeaturesButton);

      await waitFor(() => {
        expect(screen.getByText(/additional features saved/i)).toBeInTheDocument();
      });
    });

    test('should verify API integration with complete inventory data', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Fill all required sections quickly
      const categories = ['Fresh Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Pantry Staples'];
      for (const category of categories) {
        await user.click(screen.getByRole('checkbox', { name: new RegExp(category, 'i') }));
      }

      // Switch to payment methods and select all
      const paymentTab = screen.getByRole('tab', { name: /payment methods/i });
      await user.click(paymentTab);

      await user.click(screen.getByRole('checkbox', { name: /cash/i }));
      await user.click(screen.getByRole('checkbox', { name: /cards/i }));

      // Submit complete configuration
      const startTime = Date.now();
      const saveAllButton = screen.getByRole('button', { name: /save inventory configuration/i });
      await user.click(saveAllButton);

      await waitFor(() => {
        expect(screen.getByText(/inventory configuration saved/i)).toBeInTheDocument();
      });

      const responseTime = Date.now() - startTime;

      // Verify performance requirement: <200ms response time
      expect(responseTime).toBeLessThan(200);

      // Verify API call structure
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/business\/stores\/[\\w-]+\/context\/inventory$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Bearer .+/)
          }),
          body: expect.stringContaining('categories')
        })
      );
    });

    test('should achieve 100% context completeness after inventory configuration', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Complete minimal inventory configuration
      await user.click(screen.getByRole('checkbox', { name: /fresh produce/i }));
      await user.click(screen.getByRole('checkbox', { name: /dairy.*eggs/i }));

      const paymentTab = screen.getByRole('tab', { name: /payment methods/i });
      await user.click(paymentTab);
      await user.click(screen.getByRole('checkbox', { name: /cash/i }));

      const saveButton = screen.getByRole('button', { name: /save inventory configuration/i });
      await user.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByText(/inventory configuration saved/i)).toBeInTheDocument();
      });

      // Verify completeness indicator shows 100%
      await waitFor(() => {
        const completenessIndicator = screen.getByTestId('context-completeness');
        expect(within(completenessIndicator).getByText('100%')).toBeInTheDocument();
        expect(within(completenessIndicator).getByText(/context complete/i)).toBeInTheDocument();
      });

      // Verify completion celebration
      expect(screen.getByText(/congratulations/i)).toBeInTheDocument();
      expect(screen.getByText(/context configuration complete/i)).toBeInTheDocument();

      // Verify AI export is now available
      const exportButton = screen.getByRole('button', { name: /export for ai/i });
      expect(exportButton).toBeInTheDocument();
      expect(exportButton).not.toBeDisabled();
    });

    test('should handle category dependencies and validation', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Try to save without selecting any categories
      const saveButton = screen.getByRole('button', { name: /save inventory configuration/i });
      await user.click(saveButton);

      // Verify validation errors
      await waitFor(() => {
        expect(screen.getByText(/at least.*categories.*required/i)).toBeInTheDocument();
      });

      // Select a category that requires special handling
      await user.click(screen.getByRole('checkbox', { name: /health.*beauty/i }));

      // Verify pharmacy service suggestion appears
      await waitFor(() => {
        expect(screen.getByText(/consider adding pharmacy service/i)).toBeInTheDocument();
      });

      // Navigate to services and add pharmacy
      const servicesTab = screen.getByRole('tab', { name: /special services/i });
      await user.click(servicesTab);
      await user.click(screen.getByRole('checkbox', { name: /pharmacy/i }));

      // Verify licensing notice appears
      expect(screen.getByText(/pharmacy service requires.*license/i)).toBeInTheDocument();
    });

    test('should support bulk category import from templates', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Use template import feature
      const templateButton = screen.getByRole('button', { name: /use template/i });
      await user.click(templateButton);

      // Select grocery store template
      const groceryTemplate = screen.getByRole('button', { name: /grocery store template/i });
      await user.click(groceryTemplate);

      // Verify template loads all categories
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /fresh produce/i })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /dairy.*eggs/i })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /meat.*seafood/i })).toBeChecked();
      });

      // Customize template by removing a category
      await user.click(screen.getByRole('checkbox', { name: /meat.*seafood/i }));

      // Save customized template
      const saveCustomButton = screen.getByRole('button', { name: /save custom configuration/i });
      await user.click(saveCustomButton);

      await waitFor(() => {
        expect(screen.getByText(/inventory configuration saved/i)).toBeInTheDocument();
      });
    });

    test('should integrate with existing store context and maintain consistency', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      // Mock existing store context with grocery store type
      const existingContext = {
        profile: { store_type: 'grocery', square_footage: 500 },
        personnel: { total_staff_count: 12 },
        layout: { departments: ['checkout', 'grocery', 'pharmacy'] }
      };

      renderWithProviders(<InventoryConfigPage />);

      // Verify inventory suggestions based on store profile
      expect(screen.getByText(/based on.*grocery.*store/i)).toBeInTheDocument();
      expect(screen.getByText(/recommended categories/i)).toBeInTheDocument();

      // Verify pharmacy category is pre-selected based on layout
      const pharmacyCategory = screen.getByRole('checkbox', { name: /health.*beauty/i });
      expect(pharmacyCategory).toBeChecked();

      // Navigate to services and verify pharmacy service is suggested
      const servicesTab = screen.getByRole('tab', { name: /special services/i });
      await user.click(servicesTab);

      const pharmacyService = screen.getByRole('checkbox', { name: /pharmacy/i });
      expect(pharmacyService).toBeChecked();

      // Verify consistency warning if trying to remove pharmacy
      await user.click(pharmacyService);
      expect(screen.getByText(/pharmacy.*layout.*inconsistent/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling & Performance', () => {
    test('should handle large category lists efficiently', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Measure rendering performance with many categories
      const startTime = Date.now();

      // Simulate expanding all category sections
      const expandButtons = screen.getAllByRole('button', { name: /expand/i });
      for (const button of expandButtons) {
        await user.click(button);
      }

      const renderTime = Date.now() - startTime;

      // Verify performance requirement: <100ms for category expansion
      expect(renderTime).toBeLessThan(100);

      // Verify all subcategories are visible
      expect(screen.getByRole('checkbox', { name: /fruits/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /vegetables/i })).toBeInTheDocument();
    });

    test('should handle API errors gracefully during save', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
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
            error: { message: 'Inventory validation failed' }
          })
        })
      );

      renderWithProviders(<InventoryConfigPage />);

      // Fill and submit configuration
      await user.click(screen.getByRole('checkbox', { name: /fresh produce/i }));
      const saveButton = screen.getByRole('button', { name: /save inventory configuration/i });
      await user.click(saveButton);

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/failed to save inventory/i)).toBeInTheDocument();
        expect(screen.getByText(/please check your selections/i)).toBeInTheDocument();
      });

      // Verify form remains editable
      expect(screen.getByRole('checkbox', { name: /fresh produce/i })).not.toBeDisabled();
      expect(saveButton).not.toBeDisabled();
    });

    test('should validate seasonal date ranges', async () => {
      if (!InventoryConfigPage || InventoryConfigPage.toString().includes('Not Implemented')) {
        expect(true).toBe(false);
        return;
      }

      renderWithProviders(<InventoryConfigPage />);

      // Navigate to features and enable seasonal variations
      const featuresTab = screen.getByRole('tab', { name: /additional features/i });
      await user.click(featuresTab);

      const seasonalToggle = screen.getByRole('switch', { name: /seasonal variations/i });
      await user.click(seasonalToggle);

      // Add seasonal category with invalid date range
      const addSeasonalButton = screen.getByRole('button', { name: /add seasonal category/i });
      await user.click(addSeasonalButton);

      await user.type(screen.getByLabelText(/seasonal category name/i), 'Summer Items');
      await user.type(screen.getByLabelText(/start date/i), '2024-08-01');
      await user.type(screen.getByLabelText(/end date/i), '2024-07-01'); // End before start

      const saveSeasonalButton = screen.getByRole('button', { name: /save seasonal category/i });
      await user.click(saveSeasonalButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
      });
    });
  });
});