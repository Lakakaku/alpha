import { Question, Category, Business, Store, TriggerCondition } from '@vocilia/types';

export const mockBusiness: Business = {
  id: 'bus-123',
  name: 'Test Business',
  email: 'test@business.com',
  phone: '+1234567890',
  address: '123 Test St',
  business_type: 'restaurant',
  verification_status: 'approved',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  metadata: {},
};

export const mockStore: Store = {
  id: 'store-123',
  business_id: mockBusiness.id,
  name: 'Test Store',
  address: '123 Store St',
  phone: '+1234567890',
  active: true,
  qr_code_data: 'test-qr-data',
  qr_version: 1,
  qr_generated_at: new Date('2024-01-01'),
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockCategory: Category = {
  id: 'cat-123',
  business_id: mockBusiness.id,
  name: 'General Feedback',
  description: 'General customer feedback questions',
  color: '#3B82F6',
  is_default: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockQuestion: Question = {
  id: 'q-123',
  business_id: mockBusiness.id,
  category_id: mockCategory.id,
  title: 'How was your experience?',
  description: 'Please rate your overall experience',
  type: 'rating',
  required: true,
  active: true,
  position: 1,
  tags: ['experience', 'general'],
  options: [
    { id: 'opt-1', text: '1 - Poor', value: '1' },
    { id: 'opt-2', text: '2 - Fair', value: '2' },
    { id: 'opt-3', text: '3 - Good', value: '3' },
    { id: 'opt-4', text: '4 - Very Good', value: '4' },
    { id: 'opt-5', text: '5 - Excellent', value: '5' },
  ],
  frequency_config: {
    enabled: true,
    window: 'daily',
    max_frequency: 1,
  },
  response_count: 150,
  avg_response_time: 45000,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
};

export const mockTrigger: TriggerCondition = {
  type: 'time_based',
  field: 'current_time',
  operator: 'between',
  value: ['09:00', '17:00'],
};

export const mockTriggerConditions: TriggerCondition[] = [
  mockTrigger,
  {
    type: 'frequency_based',
    field: 'visit_count',
    operator: 'gte',
    value: 3,
  },
  {
    type: 'customer_behavior',
    field: 'avg_session_duration',
    operator: 'gte',
    value: 300,
  },
  {
    type: 'store_context',
    field: 'store_rating',
    operator: 'gte',
    value: 4.0,
  },
];

export const mockQuestionFormData = {
  title: 'Test Question',
  description: 'Test question description',
  type: 'text' as const,
  required: true,
  category_id: mockCategory.id,
  tags: ['test', 'sample'],
  position: 1,
  active: true,
  options: [],
  triggers: [],
  frequency_config: {
    enabled: false,
    window: 'daily' as const,
    max_frequency: 1,
  },
};

export const mockMultipleChoiceQuestion: Question = {
  ...mockQuestion,
  id: 'q-mc-123',
  type: 'multiple_choice',
  title: 'What type of food do you prefer?',
  options: [
    { id: 'opt-1', text: 'Italian', value: 'italian' },
    { id: 'opt-2', text: 'Asian', value: 'asian' },
    { id: 'opt-3', text: 'Mexican', value: 'mexican' },
    { id: 'opt-4', text: 'American', value: 'american' },
  ],
};

export const mockYesNoQuestion: Question = {
  ...mockQuestion,
  id: 'q-yn-123',
  type: 'yes_no',
  title: 'Would you recommend us to a friend?',
  options: [
    { id: 'opt-yes', text: 'Yes', value: 'yes' },
    { id: 'opt-no', text: 'No', value: 'no' },
  ],
};

export const mockTextQuestion: Question = {
  ...mockQuestion,
  id: 'q-text-123',
  type: 'text',
  title: 'Please provide additional feedback',
  description: 'Any additional comments or suggestions?',
  required: false,
  options: [],
};

// Analytics mock data
export const mockQuestionAnalytics = {
  total_questions: 25,
  active_questions: 22,
  questions_by_type: {
    text: 8,
    rating: 10,
    multiple_choice: 5,
    yes_no: 2,
  },
  questions_by_category: {
    'General Feedback': 15,
    'Product Quality': 6,
    'Service': 4,
  },
  avg_response_rate: 0.78,
  avg_response_time: 42000,
  top_performing: [mockQuestion],
  recent_activity: {
    questions_created_last_30d: 5,
    responses_last_30d: 1250,
    avg_daily_responses: 41.7,
  },
};

// Category usage stats
export const mockCategoryUsage = {
  [mockCategory.id]: {
    question_count: 15,
    active_count: 14,
    response_count: 450,
    avg_response_rate: 0.82,
    last_used: new Date('2024-01-15'),
  },
};

// Trigger evaluation context
export const mockTriggerContext = {
  store_id: mockStore.id,
  customer_id: 'cust-456',
  current_time: '14:30',
  current_day: 'tuesday',
  visit_count: 5,
  last_visit: new Date('2024-01-10'),
  avg_session_duration: 420,
  total_spent: 150.50,
  store_rating: 4.2,
  peak_hours: true,
  special_event: false,
};

// Frequency tracking data
export const mockFrequencyData = {
  question_id: mockQuestion.id,
  customer_id: 'cust-456',
  window_start: new Date('2024-01-01'),
  window_end: new Date('2024-01-02'),
  current_count: 0,
  max_allowed: 1,
  window_type: 'daily' as const,
};

// Error scenarios
export const mockDatabaseError = new Error('Database connection failed');
export const mockValidationError = new Error('Validation failed: Title is required');
export const mockPermissionError = new Error('Access denied: Insufficient permissions');
export const mockNotFoundError = new Error('Question not found');

// Bulk operation data
export const mockBulkQuestions = [
  { ...mockQuestion, id: 'q-bulk-1', title: 'Bulk Question 1' },
  { ...mockQuestion, id: 'q-bulk-2', title: 'Bulk Question 2' },
  { ...mockQuestion, id: 'q-bulk-3', title: 'Bulk Question 3' },
];

export const mockBulkUpdateData = {
  active: false,
  category_id: 'cat-456',
  tags: ['updated', 'bulk'],
};

// Export/Import data
export const mockExportData = {
  questions: [mockQuestion, mockMultipleChoiceQuestion, mockYesNoQuestion],
  categories: [mockCategory],
  metadata: {
    exported_at: new Date('2024-01-15'),
    exported_by: 'user-123',
    version: '1.0',
    total_questions: 3,
    total_categories: 1,
  },
};

export const mockImportData = {
  questions: [
    {
      title: 'Imported Question 1',
      type: 'text' as const,
      category_name: 'Imported Category',
      required: true,
      active: true,
    },
    {
      title: 'Imported Question 2',
      type: 'rating' as const,
      category_name: 'Imported Category',
      required: false,
      active: true,
    },
  ],
  categories: [
    {
      name: 'Imported Category',
      description: 'Category from import',
      color: '#10B981',
    },
  ],
};