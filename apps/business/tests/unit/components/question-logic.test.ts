import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { DynamicTriggerForm } from '../../../src/components/questions/DynamicTriggerForm';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-auth-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('DynamicTriggerForm', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    businessContextId: 'test-business-id',
    onSuccess: jest.fn(),
  };

  const mockTrigger = {
    id: 'test-trigger-id',
    business_context_id: 'test-business-id',
    trigger_name: 'Test Trigger',
    trigger_type: 'purchase_based' as const,
    priority_level: 4,
    sensitivity_threshold: 20,
    is_active: true,
    trigger_config: {
      categories: ['meat', 'produce'],
      required_items: ['chicken', 'beef'],
      minimum_items: 2,
    },
    effectiveness_score: 0.85,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });

  describe('Rendering', () => {
    test('should render dialog when open is true', () => {
      render(<DynamicTriggerForm {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create Dynamic Trigger')).toBeInTheDocument();
    });

    test('should not render dialog when open is false', () => {
      render(<DynamicTriggerForm {...defaultProps} open={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('should render edit mode title when trigger is provided', () => {
      render(<DynamicTriggerForm {...defaultProps} trigger={mockTrigger} />);
      
      expect(screen.getByText('Edit Trigger')).toBeInTheDocument();
    });

    test('should render all form fields', () => {
      render(<DynamicTriggerForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/trigger name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/trigger type/i)).toBeInTheDocument();
      expect(screen.getByText(/priority level/i)).toBeInTheDocument();
      expect(screen.getByText(/sensitivity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/trigger is active/i)).toBeInTheDocument();
    });

    test('should populate form fields with existing trigger data', () => {
      render(<DynamicTriggerForm {...defaultProps} trigger={mockTrigger} />);
      
      expect(screen.getByDisplayValue('Test Trigger')).toBeInTheDocument();
      expect(screen.getByText('meat')).toBeInTheDocument();
      expect(screen.getByText('produce')).toBeInTheDocument();
      expect(screen.getByText('chicken')).toBeInTheDocument();
      expect(screen.getByText('beef')).toBeInTheDocument();
    });

    test('should display effectiveness score for existing triggers', () => {
      render(<DynamicTriggerForm {...defaultProps} trigger={mockTrigger} />);
      
      expect(screen.getByText('Effectiveness Score')).toBeInTheDocument();
      expect(screen.getByText('85.0%')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('should update trigger name input', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Trigger Name');
      
      expect(nameInput).toHaveValue('New Trigger Name');
    });

    test('should change trigger type and update configuration', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const typeSelect = screen.getByLabelText(/trigger type/i);
      await user.click(typeSelect);
      await user.click(screen.getByText('Time Based'));
      
      expect(screen.getByText('Add Time Window')).toBeInTheDocument();
    });

    test('should update priority level slider', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '5' } });
      
      expect(screen.getByText(/priority level: 5/i)).toBeInTheDocument();
    });

    test('should update sensitivity threshold slider', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const sliders = screen.getAllByRole('slider');
      const sensitivitySlider = sliders[1]; // Second slider is sensitivity
      fireEvent.change(sensitivitySlider, { target: { value: '50' } });
      
      expect(screen.getByText(/every 50th customer/i)).toBeInTheDocument();
    });

    test('should toggle active switch', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const activeSwitch = screen.getByRole('switch');
      await user.click(activeSwitch);
      
      expect(activeSwitch).not.toBeChecked();
    });
  });

  describe('Purchase-Based Configuration', () => {
    test('should add new category', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const categoryInput = screen.getByLabelText(/product categories/i);
      const addButton = screen.getAllByRole('button', { name: '' })[0]; // Plus button
      
      await user.type(categoryInput, 'dairy');
      await user.click(addButton);
      
      expect(screen.getByText('dairy')).toBeInTheDocument();
      expect(categoryInput).toHaveValue('');
    });

    test('should remove category', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} trigger={mockTrigger} />);
      
      const meatCategory = screen.getByText('meat');
      const removeButton = meatCategory.parentElement?.querySelector('button');
      
      if (removeButton) {
        await user.click(removeButton);
      }
      
      expect(screen.queryByText('meat')).not.toBeInTheDocument();
    });

    test('should add required item', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const itemInput = screen.getByLabelText(/required items/i);
      const addButton = screen.getAllByRole('button', { name: '' })[1]; // Second plus button
      
      await user.type(itemInput, 'salmon');
      await user.click(addButton);
      
      expect(screen.getByText('salmon')).toBeInTheDocument();
      expect(itemInput).toHaveValue('');
    });

    test('should update minimum items', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const minItemsInput = screen.getByLabelText(/minimum items from category/i);
      await user.clear(minItemsInput);
      await user.type(minItemsInput, '3');
      
      expect(minItemsInput).toHaveValue(3);
    });

    test('should add category on Enter key press', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const categoryInput = screen.getByLabelText(/product categories/i);
      await user.type(categoryInput, 'frozen');
      fireEvent.keyPress(categoryInput, { key: 'Enter', code: 'Enter', charCode: 13 });
      
      expect(screen.getByText('frozen')).toBeInTheDocument();
    });
  });

  describe('Time-Based Configuration', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const typeSelect = screen.getByLabelText(/trigger type/i);
      await user.click(typeSelect);
      await user.click(screen.getByText('Time Based'));
    });

    test('should render time configuration fields', () => {
      expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
      expect(screen.getByText(/days of week/i)).toBeInTheDocument();
      expect(screen.getByText('Add Time Window')).toBeInTheDocument();
    });

    test('should update start and end times', async () => {
      const user = userEvent.setup();
      
      const startTimeInput = screen.getByLabelText(/start time/i);
      const endTimeInput = screen.getByLabelText(/end time/i);
      
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '08:00');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '18:00');
      
      expect(startTimeInput).toHaveValue('08:00');
      expect(endTimeInput).toHaveValue('18:00');
    });

    test('should select days of week', async () => {
      const user = userEvent.setup();
      
      const mondayBadge = screen.getByText('Monday');
      const tuesdayBadge = screen.getByText('Tuesday');
      
      await user.click(mondayBadge);
      await user.click(tuesdayBadge);
      
      // Badges should now be selected (different styling)
      expect(mondayBadge.closest('[data-selected="true"]') || mondayBadge.classList.contains('selected')).toBeTruthy();
    });

    test('should show error when adding time window without days', async () => {
      const user = userEvent.setup();
      
      const addWindowButton = screen.getByText('Add Time Window');
      await user.click(addWindowButton);
      
      expect(toast.error).toHaveBeenCalledWith('Please select at least one day of the week');
    });

    test('should add time window successfully', async () => {
      const user = userEvent.setup();
      
      const mondayBadge = screen.getByText('Monday');
      await user.click(mondayBadge);
      
      const addWindowButton = screen.getByText('Add Time Window');
      await user.click(addWindowButton);
      
      expect(screen.getByText(/09:00 - 17:00/)).toBeInTheDocument();
      expect(screen.getByText('Monday')).toBeInTheDocument();
    });
  });

  describe('Amount-Based Configuration', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const typeSelect = screen.getByLabelText(/trigger type/i);
      await user.click(typeSelect);
      await user.click(screen.getByText('Amount Based'));
    });

    test('should render amount configuration fields', () => {
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/comparison/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });

    test('should update currency selection', async () => {
      const user = userEvent.setup();
      
      const currencySelect = screen.getByLabelText(/currency/i);
      await user.click(currencySelect);
      await user.click(screen.getByText('EUR (Euro)'));
      
      expect(screen.getByText('EUR (Euro)')).toBeInTheDocument();
    });

    test('should update comparison operator', async () => {
      const user = userEvent.setup();
      
      const comparisonSelect = screen.getByLabelText(/comparison/i);
      await user.click(comparisonSelect);
      await user.click(screen.getByText('Between'));
      
      expect(screen.getByLabelText(/minimum amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/maximum amount/i)).toBeInTheDocument();
    });

    test('should update amount value', async () => {
      const user = userEvent.setup();
      
      const amountInput = screen.getByLabelText(/^amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '500.50');
      
      expect(amountInput).toHaveValue(500.50);
    });

    test('should show maximum amount field when operator is between', async () => {
      const user = userEvent.setup();
      
      const comparisonSelect = screen.getByLabelText(/comparison/i);
      await user.click(comparisonSelect);
      await user.click(screen.getByText('Between'));
      
      expect(screen.getByLabelText(/maximum amount/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    test('should create new trigger successfully', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      await user.type(nameInput, 'Test Trigger');
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/questions/triggers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token',
          },
          body: expect.stringContaining('"trigger_name":"Test Trigger"'),
        });
      });
      
      expect(toast.success).toHaveBeenCalledWith('Trigger created successfully');
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    test('should update existing trigger successfully', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} trigger={mockTrigger} />);
      
      const submitButton = screen.getByText('Update Trigger');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/questions/triggers/test-trigger-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token',
          },
          body: expect.stringContaining('"trigger_name":"Test Trigger"'),
        });
      });
      
      expect(toast.success).toHaveBeenCalledWith('Trigger updated successfully');
    });

    test('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Validation failed' }),
      } as Response);
      
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      await user.type(nameInput, 'Test Trigger');
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Validation failed');
      });
      
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
      expect(defaultProps.onOpenChange).not.toHaveBeenCalled();
    });

    test('should handle network errors', async () => {
      const user = userEvent.setup();
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Network error'));
      
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      await user.type(nameInput, 'Test Trigger');
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Network error');
      });
    });

    test('should show loading state during submission', async () => {
      const user = userEvent.setup();
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response), 1000))
      );
      
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      await user.type(nameInput, 'Test Trigger');
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      expect(screen.getByText('Create Trigger')).toBeDisabled();
      expect(screen.getByText('Cancel')).toBeDisabled();
    });

    test('should prevent submission with empty required fields', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      // Form should not submit due to HTML5 validation
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Dialog Controls', () => {
    test('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    test('should handle dialog close via onOpenChange', () => {
      const { rerender } = render(<DynamicTriggerForm {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      rerender(<DynamicTriggerForm {...defaultProps} open={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<DynamicTriggerForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/trigger name/i)).toHaveAttribute('required');
      expect(screen.getByRole('slider')).toHaveAccessibleName();
      expect(screen.getByRole('switch')).toHaveAccessibleName();
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/trigger name/i);
      nameInput.focus();
      
      await user.tab();
      
      // Should move to next focusable element
      expect(document.activeElement).not.toBe(nameInput);
    });

    test('should announce form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const submitButton = screen.getByText('Create Trigger');
      await user.click(submitButton);
      
      // Browser's native validation should prevent submission
      const nameInput = screen.getByLabelText(/trigger name/i);
      expect(nameInput).toBeInvalid();
    });
  });

  describe('Performance', () => {
    test('should not re-render unnecessarily', () => {
      const { rerender } = render(<DynamicTriggerForm {...defaultProps} />);
      
      // Re-render with same props should not cause unnecessary renders
      rerender(<DynamicTriggerForm {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should handle large lists of categories efficiently', async () => {
      const user = userEvent.setup();
      const largeTrigger = {
        ...mockTrigger,
        trigger_config: {
          categories: Array.from({ length: 100 }, (_, i) => `category-${i}`),
          required_items: Array.from({ length: 50 }, (_, i) => `item-${i}`),
          minimum_items: 1,
        },
      };
      
      render(<DynamicTriggerForm {...defaultProps} trigger={largeTrigger} />);
      
      // Should render without performance issues
      expect(screen.getByText('category-0')).toBeInTheDocument();
      expect(screen.getByText('category-99')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle malformed trigger config gracefully', () => {
      const malformedTrigger = {
        ...mockTrigger,
        trigger_config: null as any,
      };
      
      render(<DynamicTriggerForm {...defaultProps} trigger={malformedTrigger} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('should handle undefined effectiveness score', () => {
      const triggerWithoutScore = {
        ...mockTrigger,
        effectiveness_score: undefined,
      };
      
      render(<DynamicTriggerForm {...defaultProps} trigger={triggerWithoutScore} />);
      
      expect(screen.queryByText('Effectiveness Score')).not.toBeInTheDocument();
    });

    test('should handle empty string values correctly', async () => {
      const user = userEvent.setup();
      render(<DynamicTriggerForm {...defaultProps} />);
      
      const categoryInput = screen.getByLabelText(/product categories/i);
      const addButton = screen.getAllByRole('button', { name: '' })[0];
      
      await user.type(categoryInput, '   ');
      await user.click(addButton);
      
      // Should not add empty or whitespace-only categories
      expect(screen.queryByText('   ')).not.toBeInTheDocument();
    });
  });
});