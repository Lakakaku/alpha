import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestionForm } from '../../src/components/questions/QuestionForm';
import { Question, Category } from '@vocilia/types';
import { questionsApi } from '../../src/services/questionsApi';

// Mock the API
jest.mock('../../src/services/questionsApi');
const mockQuestionsApi = questionsApi as jest.Mocked<typeof questionsApi>;

// Mock categories
const mockCategories: Category[] = [
  {
    id: 'cat-1',
    business_id: 'bus-1',
    name: 'General Feedback',
    description: 'General customer feedback',
    color: '#3B82F6',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'cat-2',
    business_id: 'bus-1',
    name: 'Product Quality',
    description: 'Product quality feedback',
    color: '#10B981',
    is_default: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

// Mock question for editing
const mockQuestion: Question = {
  id: 'q-1',
  business_id: 'bus-1',
  category_id: 'cat-1',
  title: 'How was your experience?',
  description: 'Please rate your overall experience',
  type: 'rating',
  required: true,
  active: true,
  position: 1,
  tags: ['experience', 'general'],
  options: [],
  frequency_config: {
    enabled: true,
    window: 'daily',
    max_frequency: 1,
  },
  response_count: 0,
  avg_response_time: 0,
  created_at: new Date(),
  updated_at: new Date(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('QuestionForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    mockQuestionsApi.getCategories.mockResolvedValue({
      categories: mockCategories,
      usage_stats: {},
    });
  });

  describe('rendering', () => {
    it('should render create form with default values', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('textbox', { name: /question title/i })).toHaveValue('');
      expect(screen.getByRole('combobox', { name: /question type/i })).toHaveValue('text');
      expect(screen.getByRole('checkbox', { name: /required/i })).not.toBeChecked();
      expect(screen.getByRole('button', { name: /create question/i })).toBeInTheDocument();
    });

    it('should render edit form with existing question data', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          question={mockQuestion}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockQuestion.title)).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue(mockQuestion.description!)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /question type/i })).toHaveValue('rating');
      expect(screen.getByRole('checkbox', { name: /required/i })).toBeChecked();
      expect(screen.getByRole('button', { name: /update question/i })).toBeInTheDocument();
    });

    it('should load and display categories', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockQuestionsApi.getCategories).toHaveBeenCalledWith('bus-1');
      });

      const categorySelect = screen.getByRole('combobox', { name: /category/i });
      await user.click(categorySelect);

      expect(screen.getByText('General Feedback')).toBeInTheDocument();
      expect(screen.getByText('Product Quality')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      mockQuestionsApi.getCategories.mockReturnValue(new Promise(() => {})); // Never resolves

      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should validate required title field', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create question/i })).toBeInTheDocument();
      });

      // Try to submit without title
      await user.click(screen.getByRole('button', { name: /create question/i }));

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should validate title length', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/question title/i);
      const longTitle = 'a'.repeat(201); // Over 200 characters
      
      await user.type(titleInput, longTitle);
      await user.click(screen.getByRole('button', { name: /create question/i }));

      expect(screen.getByText(/title must be 200 characters or less/i)).toBeInTheDocument();
    });

    it('should validate multiple choice options', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      // Change to multiple choice
      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'multiple_choice');

      // Add title
      await user.type(screen.getByLabelText(/question title/i), 'Test Question');

      // Try to submit without options
      await user.click(screen.getByRole('button', { name: /create question/i }));

      expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument();
    });

    it('should validate tag format', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      // Add title
      await user.type(screen.getByLabelText(/question title/i), 'Test Question');

      // Add empty tag
      const tagsInput = screen.getByLabelText(/tags/i);
      await user.type(tagsInput, ', '); // Empty tag
      
      await user.click(screen.getByRole('button', { name: /create question/i }));

      expect(screen.getByText(/tags cannot be empty/i)).toBeInTheDocument();
    });
  });

  describe('question type handling', () => {
    it('should show options section for multiple choice', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'multiple_choice');

      expect(screen.getByText(/options/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
    });

    it('should show options section for yes/no', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'yes_no');

      expect(screen.getByText(/options/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Yes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('No')).toBeInTheDocument();
    });

    it('should hide options section for text and rating', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      // Default is text
      expect(screen.queryByText(/options/i)).not.toBeInTheDocument();

      // Change to rating
      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'rating');

      expect(screen.queryByText(/options/i)).not.toBeInTheDocument();
    });
  });

  describe('options management', () => {
    it('should add multiple choice options', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      // Change to multiple choice
      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'multiple_choice');

      // Add first option
      await user.click(screen.getByRole('button', { name: /add option/i }));
      
      const optionInputs = screen.getAllByPlaceholderText(/option text/i);
      expect(optionInputs).toHaveLength(1);
      
      await user.type(optionInputs[0], 'Option 1');

      // Add second option
      await user.click(screen.getByRole('button', { name: /add option/i }));
      
      const updatedOptionInputs = screen.getAllByPlaceholderText(/option text/i);
      expect(updatedOptionInputs).toHaveLength(2);
      
      await user.type(updatedOptionInputs[1], 'Option 2');

      expect(screen.getByDisplayValue('Option 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Option 2')).toBeInTheDocument();
    });

    it('should remove options', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      // Change to multiple choice and add options
      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'multiple_choice');

      await user.click(screen.getByRole('button', { name: /add option/i }));
      await user.click(screen.getByRole('button', { name: /add option/i }));

      const optionInputs = screen.getAllByPlaceholderText(/option text/i);
      await user.type(optionInputs[0], 'Option 1');
      await user.type(optionInputs[1], 'Option 2');

      // Remove first option
      const removeButtons = screen.getAllByRole('button', { name: /remove option/i });
      await user.click(removeButtons[0]);

      expect(screen.queryByDisplayValue('Option 1')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Option 2')).toBeInTheDocument();
    });

    it('should reorder options', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /question type/i })).toBeInTheDocument();
      });

      // Change to multiple choice and add options
      const typeSelect = screen.getByRole('combobox', { name: /question type/i });
      await user.selectOptions(typeSelect, 'multiple_choice');

      await user.click(screen.getByRole('button', { name: /add option/i }));
      await user.click(screen.getByRole('button', { name: /add option/i }));

      const optionInputs = screen.getAllByPlaceholderText(/option text/i);
      await user.type(optionInputs[0], 'First Option');
      await user.type(optionInputs[1], 'Second Option');

      // Move first option down
      const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
      await user.click(moveDownButtons[0]);

      // Check order changed
      const updatedInputs = screen.getAllByPlaceholderText(/option text/i);
      expect(updatedInputs[0]).toHaveValue('Second Option');
      expect(updatedInputs[1]).toHaveValue('First Option');
    });
  });

  describe('trigger configuration', () => {
    it('should show trigger configuration section', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/trigger conditions/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /add trigger/i })).toBeInTheDocument();
    });

    it('should add trigger conditions', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add trigger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add trigger/i }));

      expect(screen.getByRole('combobox', { name: /trigger type/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /field/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /operator/i })).toBeInTheDocument();
    });

    it('should remove trigger conditions', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add trigger/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /add trigger/i }));
      expect(screen.getByRole('combobox', { name: /trigger type/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /remove trigger/i }));
      expect(screen.queryByRole('combobox', { name: /trigger type/i })).not.toBeInTheDocument();
    });
  });

  describe('frequency configuration', () => {
    it('should show frequency configuration section', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText(/frequency limits/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('checkbox', { name: /enable frequency limits/i })).toBeInTheDocument();
    });

    it('should enable/disable frequency configuration', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /enable frequency limits/i })).toBeInTheDocument();
      });

      const enableCheckbox = screen.getByRole('checkbox', { name: /enable frequency limits/i });
      
      // Initially disabled
      expect(screen.queryByRole('combobox', { name: /time window/i })).not.toBeInTheDocument();

      // Enable frequency limits
      await user.click(enableCheckbox);
      
      expect(screen.getByRole('combobox', { name: /time window/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /max frequency/i })).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should create new question', async () => {
      const newQuestion = { ...mockQuestion, id: 'new-q-1' };
      mockQuestionsApi.createQuestion.mockResolvedValue(newQuestion);

      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByLabelText(/question title/i), 'New Question');
      await user.type(screen.getByLabelText(/description/i), 'Question description');
      await user.click(screen.getByRole('checkbox', { name: /required/i }));

      // Submit
      await user.click(screen.getByRole('button', { name: /create question/i }));

      await waitFor(() => {
        expect(mockQuestionsApi.createQuestion).toHaveBeenCalledWith('bus-1', expect.objectContaining({
          title: 'New Question',
          description: 'Question description',
          required: true,
        }));
      });

      expect(mockOnSave).toHaveBeenCalledWith(newQuestion);
    });

    it('should update existing question', async () => {
      const updatedQuestion = { ...mockQuestion, title: 'Updated Question' };
      mockQuestionsApi.updateQuestion.mockResolvedValue(updatedQuestion);

      render(
        <QuestionForm
          businessId="bus-1"
          question={mockQuestion}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockQuestion.title)).toBeInTheDocument();
      });

      // Update title
      const titleInput = screen.getByDisplayValue(mockQuestion.title);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Question');

      // Submit
      await user.click(screen.getByRole('button', { name: /update question/i }));

      await waitFor(() => {
        expect(mockQuestionsApi.updateQuestion).toHaveBeenCalledWith(
          mockQuestion.id,
          expect.objectContaining({
            title: 'Updated Question',
          })
        );
      });

      expect(mockOnSave).toHaveBeenCalledWith(updatedQuestion);
    });

    it('should handle submission errors', async () => {
      const error = new Error('Failed to create question');
      mockQuestionsApi.createQuestion.mockRejectedValue(error);

      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByLabelText(/question title/i), 'Test Question');

      // Submit
      await user.click(screen.getByRole('button', { name: /create question/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to create question/i)).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('form cancellation', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show confirmation dialog when form has changes', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      // Make changes
      await user.type(screen.getByLabelText(/question title/i), 'Some text');

      // Try to cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue editing/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper form labels', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/question type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/required/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument();
    });

    it('should have proper form validation messages', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create question/i })).toBeInTheDocument();
      });

      // Submit without required fields
      await user.click(screen.getByRole('button', { name: /create question/i }));

      const errorMessage = screen.getByText(/title is required/i);
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });

    it('should support keyboard navigation', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/question title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/question title/i);
      titleInput.focus();

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/question type/i)).toHaveFocus();
    });
  });

  describe('tag management', () => {
    it('should add and remove tags', async () => {
      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      });

      const tagsInput = screen.getByLabelText(/tags/i);
      
      // Add tags
      await user.type(tagsInput, 'tag1, tag2, tag3');
      
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();

      // Remove a tag
      const removeTagButtons = screen.getAllByRole('button', { name: /remove tag/i });
      await user.click(removeTagButtons[0]);

      expect(screen.queryByText('tag1')).not.toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should suggest existing tags', async () => {
      // Mock existing tags
      mockQuestionsApi.getTags.mockResolvedValue(['existing1', 'existing2', 'common']);

      render(
        <QuestionForm
          businessId="bus-1"
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
      });

      const tagsInput = screen.getByLabelText(/tags/i);
      await user.type(tagsInput, 'ex');

      // Should show suggestions
      expect(screen.getByText('existing1')).toBeInTheDocument();
      expect(screen.getByText('existing2')).toBeInTheDocument();
    });
  });
});