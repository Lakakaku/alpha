/**
 * T035: Business Configuration UI Integration Test
 * 
 * Integration test for business user interface configuration of advanced question logic.
 * Validates end-to-end configuration flows for question combination rules,
 * dynamic triggers, frequency harmonizers, and performance optimization.
 * 
 * Performance Requirement: All configuration operations must complete < 500ms
 * Business Requirement: Production-ready configuration interface with real data
 * 
 * @fileoverview Integration test for business question logic configuration UI
 * @version 1.0.0
 * @since 2025-09-24
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClient } from '@supabase/supabase-js';
import type { 
  QuestionCombinationRule, 
  DynamicTrigger, 
  FrequencyHarmonizer,
  TriggerType,
  ResolutionStrategy,
  PriorityLevel 
} from '@vocilia/types';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/dashboard/questions/configuration',
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  })),
  auth: {
    getSession: jest.fn(),
    signOut: jest.fn(),
  },
  realtime: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Import components after mocks are set up
import QuestionLogicConfigurationPage from '../../src/app/questions/configuration/page';
import CombinationRulesConfig from '../../src/components/questions/CombinationRulesConfig';
import DynamicTriggersConfig from '../../src/components/questions/DynamicTriggersConfig';
import FrequencyHarmonizerConfig from '../../src/components/questions/FrequencyHarmonizerConfig';

describe('T035: Business Configuration UI Integration', () => {
  const mockBusinessContextId = 'test-business-context-123';
  const mockUserId = 'test-user-456';
  
  // Performance tracking
  let startTime: number;
  const performanceThreshold = 500; // 500ms requirement

  // Mock data
  const mockCombinationRule: QuestionCombinationRule = {
    id: 'rule-001',
    business_context_id: mockBusinessContextId,
    rule_name: 'Premium Customer Questions',
    max_call_duration_seconds: 120,
    priority_threshold_critical: 5,
    priority_threshold_high: 4,
    priority_threshold_medium: 3,
    priority_threshold_low: 2,
    question_group_limits: {
      critical: 3,
      high: 5,
      medium: 7,
      low: 10,
    },
    time_distribution: {
      critical: 40,
      high: 35,
      medium: 20,
      low: 5,
    },
    is_active: true,
    created_at: '2025-09-24T10:00:00Z',
    updated_at: '2025-09-24T10:00:00Z',
  };

  const mockDynamicTrigger: DynamicTrigger = {
    id: 'trigger-001',
    business_context_id: mockBusinessContextId,
    trigger_name: 'High Value Purchase',
    trigger_type: 'purchase_based' as TriggerType,
    trigger_conditions: {
      purchase_amount_threshold: 500,
      product_categories: ['electronics', 'premium'],
      time_window_minutes: 30,
      customer_tier: ['gold', 'platinum'],
    },
    priority_level: 4 as PriorityLevel,
    question_templates: ['q-template-001', 'q-template-002'],
    activation_rules: {
      max_frequency_per_day: 2,
      min_interval_hours: 6,
      exclude_time_ranges: [
        { start: '22:00', end: '08:00' },
      ],
    },
    is_active: true,
    created_at: '2025-09-24T10:00:00Z',
    updated_at: '2025-09-24T10:00:00Z',
  };

  const mockFrequencyHarmonizer: FrequencyHarmonizer = {
    id: 'harmonizer-001',
    business_context_id: mockBusinessContextId,
    harmonizer_name: 'Customer Fatigue Prevention',
    conflict_detection_rules: {
      max_questions_per_call: 8,
      min_interval_between_calls_hours: 24,
      priority_override_threshold: 5,
    },
    resolution_strategy: 'priority' as ResolutionStrategy,
    resolution_config: {
      priority_weights: {
        critical: 1.0,
        high: 0.8,
        medium: 0.6,
        low: 0.4,
      },
      time_slot_preferences: ['morning', 'afternoon'],
      fallback_strategy: 'combine',
    },
    is_active: true,
    created_at: '2025-09-24T10:00:00Z',
    updated_at: '2025-09-24T10:00:00Z',
  };

  beforeAll(async () => {
    // Mock session and authentication
    (mockSupabaseClient.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: mockUserId },
          access_token: 'mock-token',
        },
      },
      error: null,
    });
  });

  beforeEach(() => {
    startTime = performance.now();
    jest.clearAllMocks();
    
    // Setup default mock responses
    (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
      const chainMethods = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      // Return appropriate mock data based on table
      const finalPromise = Promise.resolve({
        data: table === 'question_combination_rules' ? [mockCombinationRule] :
              table === 'dynamic_triggers' ? [mockDynamicTrigger] :
              table === 'frequency_harmonizers' ? [mockFrequencyHarmonizer] : [],
        error: null,
      });

      // Chain all methods to return the final promise
      Object.keys(chainMethods).forEach(method => {
        (chainMethods as any)[method].mockImplementation(() => {
          const result = { ...chainMethods };
          (result as any).then = finalPromise.then.bind(finalPromise);
          (result as any).catch = finalPromise.catch.bind(finalPromise);
          return result;
        });
      });

      return chainMethods;
    });
  });

  afterEach(() => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`Test execution time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(performanceThreshold);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe('Configuration Page Integration', () => {
    it('should load configuration page with all components', async () => {
      const user = userEvent.setup();
      
      render(<QuestionLogicConfigurationPage />);

      // Check main page elements load
      await waitFor(() => {
        expect(screen.getByText('Advanced Question Logic Configuration')).toBeInTheDocument();
      });

      // Verify all configuration sections are present
      expect(screen.getByText('Combination Rules')).toBeInTheDocument();
      expect(screen.getByText('Dynamic Triggers')).toBeInTheDocument();
      expect(screen.getByText('Frequency Harmonization')).toBeInTheDocument();

      // Check performance requirement
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(performanceThreshold);
    });

    it('should handle tab navigation between configuration sections', async () => {
      const user = userEvent.setup();
      
      render(<QuestionLogicConfigurationPage />);

      await waitFor(() => {
        expect(screen.getByText('Advanced Question Logic Configuration')).toBeInTheDocument();
      });

      // Test tab switching
      const triggersTab = screen.getByRole('tab', { name: /dynamic triggers/i });
      await user.click(triggersTab);
      
      await waitFor(() => {
        expect(screen.getByText('Configure Dynamic Triggers')).toBeInTheDocument();
      });

      const harmonizersTab = screen.getByRole('tab', { name: /frequency harmonization/i });
      await user.click(harmonizersTab);
      
      await waitFor(() => {
        expect(screen.getByText('Frequency Harmonizer Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Combination Rules Configuration', () => {
    it('should display and edit combination rules', async () => {
      const user = userEvent.setup();
      
      render(<CombinationRulesConfig businessContextId={mockBusinessContextId} />);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Premium Customer Questions')).toBeInTheDocument();
      });

      // Test editing rule name
      const ruleNameInput = screen.getByDisplayValue('Premium Customer Questions');
      await user.clear(ruleNameInput);
      await user.type(ruleNameInput, 'Updated Premium Rule');

      // Test duration slider
      const durationSlider = screen.getByLabelText(/max call duration/i);
      expect(durationSlider).toHaveValue('120');
      
      await user.clear(durationSlider);
      await user.type(durationSlider, '150');

      // Test priority thresholds
      const criticalThreshold = screen.getByLabelText(/critical priority threshold/i);
      expect(criticalThreshold).toHaveValue('5');
    });

    it('should create new combination rule', async () => {
      const user = userEvent.setup();
      
      // Mock successful creation
      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        insert: jest.fn().mockResolvedValue({
          data: [{ ...mockCombinationRule, id: 'new-rule-002' }],
          error: null,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      }));

      render(<CombinationRulesConfig businessContextId={mockBusinessContextId} />);

      // Click create new rule button
      const createButton = screen.getByRole('button', { name: /create new rule/i });
      await user.click(createButton);

      // Fill out form
      const ruleNameInput = screen.getByLabelText(/rule name/i);
      await user.type(ruleNameInput, 'New Customer Rule');

      const durationInput = screen.getByLabelText(/max call duration/i);
      await user.clear(durationInput);
      await user.type(durationInput, '90');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      await user.click(saveButton);

      // Verify success
      await waitFor(() => {
        expect(screen.getByText('Rule created successfully')).toBeInTheDocument();
      });
    });

    it('should validate combination rule constraints', async () => {
      const user = userEvent.setup();
      
      render(<CombinationRulesConfig businessContextId={mockBusinessContextId} />);

      const createButton = screen.getByRole('button', { name: /create new rule/i });
      await user.click(createButton);

      // Test invalid duration (too short)
      const durationInput = screen.getByLabelText(/max call duration/i);
      await user.clear(durationInput);
      await user.type(durationInput, '30'); // Below 60-second minimum

      const saveButton = screen.getByRole('button', { name: /save rule/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/duration must be between 60 and 180 seconds/i)).toBeInTheDocument();
      });

      // Test invalid priority threshold
      const criticalThreshold = screen.getByLabelText(/critical priority threshold/i);
      await user.clear(criticalThreshold);
      await user.type(criticalThreshold, '0'); // Invalid priority

      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/priority must be between 1 and 5/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Triggers Configuration', () => {
    it('should configure purchase-based triggers', async () => {
      const user = userEvent.setup();
      
      render(<DynamicTriggersConfig businessContextId={mockBusinessContextId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('High Value Purchase')).toBeInTheDocument();
      });

      // Test trigger type selection
      const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
      expect(triggerTypeSelect).toHaveValue('purchase_based');

      // Test purchase amount threshold
      const amountInput = screen.getByLabelText(/purchase amount threshold/i);
      expect(amountInput).toHaveValue('500');
      
      await user.clear(amountInput);
      await user.type(amountInput, '750');

      // Test product categories
      const categoriesInput = screen.getByLabelText(/product categories/i);
      expect(categoriesInput).toHaveDisplayValue('electronics, premium');
    });

    it('should configure time-based triggers', async () => {
      const user = userEvent.setup();
      
      // Mock time-based trigger
      const timeTrigger = {
        ...mockDynamicTrigger,
        trigger_type: 'time_based' as TriggerType,
        trigger_conditions: {
          time_intervals: ['09:00-12:00', '14:00-17:00'],
          timezone: 'Europe/Stockholm',
          weekdays_only: true,
          exclude_holidays: true,
        },
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          data: [timeTrigger],
          error: null,
        }),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      }));

      render(<DynamicTriggersConfig businessContextId={mockBusinessContextId} />);

      // Switch to time-based trigger
      const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
      await user.selectOptions(triggerTypeSelect, 'time_based');

      await waitFor(() => {
        expect(screen.getByLabelText(/time intervals/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
      });

      // Test time interval configuration
      const intervalsInput = screen.getByLabelText(/time intervals/i);
      expect(intervalsInput).toHaveDisplayValue('09:00-12:00, 14:00-17:00');

      // Test timezone selection
      const timezoneSelect = screen.getByLabelText(/timezone/i);
      expect(timezoneSelect).toHaveValue('Europe/Stockholm');
    });

    it('should configure amount-based triggers with tier logic', async () => {
      const user = userEvent.setup();
      
      // Mock amount-based trigger
      const amountTrigger = {
        ...mockDynamicTrigger,
        trigger_type: 'amount_based' as TriggerType,
        trigger_conditions: {
          amount_tiers: {
            bronze: { min: 0, max: 100, questions: 2 },
            silver: { min: 101, max: 500, questions: 4 },
            gold: { min: 501, max: 1000, questions: 6 },
            platinum: { min: 1001, max: null, questions: 8 },
          },
          cumulative_period_days: 30,
        },
      };

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          data: [amountTrigger],
          error: null,
        }),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      }));

      render(<DynamicTriggersConfig businessContextId={mockBusinessContextId} />);

      // Switch to amount-based trigger
      const triggerTypeSelect = screen.getByLabelText(/trigger type/i);
      await user.selectOptions(triggerTypeSelect, 'amount_based');

      await waitFor(() => {
        expect(screen.getByText(/amount tiers configuration/i)).toBeInTheDocument();
      });

      // Test tier configuration
      const bronzeTier = within(screen.getByTestId('bronze-tier'));
      expect(bronzeTier.getByLabelText(/max amount/i)).toHaveValue('100');
      expect(bronzeTier.getByLabelText(/questions/i)).toHaveValue('2');

      const platinumTier = within(screen.getByTestId('platinum-tier'));
      expect(platinumTier.getByLabelText(/min amount/i)).toHaveValue('1001');
      expect(platinumTier.getByLabelText(/questions/i)).toHaveValue('8');
    });
  });

  describe('Frequency Harmonization Configuration', () => {
    it('should configure frequency harmonizer settings', async () => {
      const user = userEvent.setup();
      
      render(<FrequencyHarmonizerConfig businessContextId={mockBusinessContextId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Customer Fatigue Prevention')).toBeInTheDocument();
      });

      // Test conflict detection rules
      const maxQuestionsInput = screen.getByLabelText(/max questions per call/i);
      expect(maxQuestionsInput).toHaveValue('8');

      const minIntervalInput = screen.getByLabelText(/min interval between calls/i);
      expect(minIntervalInput).toHaveValue('24');

      // Test resolution strategy
      const strategySelect = screen.getByLabelText(/resolution strategy/i);
      expect(strategySelect).toHaveValue('priority');

      await user.selectOptions(strategySelect, 'combine');
      
      await waitFor(() => {
        expect(screen.getByText(/combination settings/i)).toBeInTheDocument();
      });
    });

    it('should configure priority weights for resolution', async () => {
      const user = userEvent.setup();
      
      render(<FrequencyHarmonizerConfig businessContextId={mockBusinessContextId} />);

      await waitFor(() => {
        expect(screen.getByText('Priority Weights Configuration')).toBeInTheDocument();
      });

      // Test priority weight sliders
      const criticalWeight = screen.getByLabelText(/critical weight/i);
      expect(criticalWeight).toHaveValue('1.0');

      const highWeight = screen.getByLabelText(/high weight/i);
      expect(highWeight).toHaveValue('0.8');

      // Adjust weights
      await user.clear(highWeight);
      await user.type(highWeight, '0.9');

      const mediumWeight = screen.getByLabelText(/medium weight/i);
      await user.clear(mediumWeight);
      await user.type(mediumWeight, '0.7');
    });

    it('should validate harmonizer conflict resolution', async () => {
      const user = userEvent.setup();
      
      render(<FrequencyHarmonizerConfig businessContextId={mockBusinessContextId} />);

      // Test invalid max questions (too high)
      const maxQuestionsInput = screen.getByLabelText(/max questions per call/i);
      await user.clear(maxQuestionsInput);
      await user.type(maxQuestionsInput, '25'); // Exceeds reasonable limit

      const saveButton = screen.getByRole('button', { name: /save harmonizer/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/max questions should not exceed 15 per call/i)).toBeInTheDocument();
      });

      // Test invalid interval (too short)
      const minIntervalInput = screen.getByLabelText(/min interval between calls/i);
      await user.clear(minIntervalInput);
      await user.type(minIntervalInput, '0.5'); // Less than 1 hour

      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/minimum interval must be at least 1 hour/i)).toBeInTheDocument();
      });
    });
  });

  describe('End-to-End Configuration Workflow', () => {
    it('should complete full configuration workflow', async () => {
      const user = userEvent.setup();
      
      render(<QuestionLogicConfigurationPage />);

      // Step 1: Configure combination rules
      await waitFor(() => {
        expect(screen.getByText('Combination Rules')).toBeInTheDocument();
      });

      const createRuleButton = screen.getByRole('button', { name: /create combination rule/i });
      await user.click(createRuleButton);

      const ruleNameInput = screen.getByLabelText(/rule name/i);
      await user.type(ruleNameInput, 'Full Workflow Rule');

      const saveRuleButton = screen.getByRole('button', { name: /save rule/i });
      await user.click(saveRuleButton);

      // Step 2: Configure dynamic triggers
      const triggersTab = screen.getByRole('tab', { name: /dynamic triggers/i });
      await user.click(triggersTab);

      const createTriggerButton = screen.getByRole('button', { name: /create trigger/i });
      await user.click(createTriggerButton);

      const triggerNameInput = screen.getByLabelText(/trigger name/i);
      await user.type(triggerNameInput, 'Full Workflow Trigger');

      const saveTriggerButton = screen.getByRole('button', { name: /save trigger/i });
      await user.click(saveTriggerButton);

      // Step 3: Configure frequency harmonizer
      const harmonizersTab = screen.getByRole('tab', { name: /frequency harmonization/i });
      await user.click(harmonizersTab);

      const createHarmonizerButton = screen.getByRole('button', { name: /create harmonizer/i });
      await user.click(createHarmonizerButton);

      const harmonizerNameInput = screen.getByLabelText(/harmonizer name/i);
      await user.type(harmonizerNameInput, 'Full Workflow Harmonizer');

      const saveHarmonizerButton = screen.getByRole('button', { name: /save harmonizer/i });
      await user.click(saveHarmonizerButton);

      // Verify full configuration completion
      await waitFor(() => {
        expect(screen.getByText('Configuration saved successfully')).toBeInTheDocument();
      });
    });

    it('should handle configuration preview and validation', async () => {
      const user = userEvent.setup();
      
      render(<QuestionLogicConfigurationPage />);

      // Access preview functionality
      const previewButton = screen.getByRole('button', { name: /preview configuration/i });
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Configuration Preview')).toBeInTheDocument();
      });

      // Verify preview shows current settings
      expect(screen.getByText('Combination Rules: 1 active')).toBeInTheDocument();
      expect(screen.getByText('Dynamic Triggers: 1 active')).toBeInTheDocument();
      expect(screen.getByText('Frequency Harmonizers: 1 active')).toBeInTheDocument();

      // Test validation
      const validateButton = screen.getByRole('button', { name: /validate configuration/i });
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText('Configuration is valid')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock API error
      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        eq: jest.fn().mockReturnThis(),
      }));

      render(<QuestionLogicConfigurationPage />);

      await waitFor(() => {
        expect(screen.getByText('Error loading configuration')).toBeInTheDocument();
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle concurrent user modifications', async () => {
      const user = userEvent.setup();
      
      render(<CombinationRulesConfig businessContextId={mockBusinessContextId} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Premium Customer Questions')).toBeInTheDocument();
      });

      // Simulate concurrent modification error
      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        update: jest.fn().mockRejectedValue(new Error('Row was updated by another user')),
        eq: jest.fn().mockReturnThis(),
      }));

      const ruleNameInput = screen.getByDisplayValue('Premium Customer Questions');
      await user.clear(ruleNameInput);
      await user.type(ruleNameInput, 'Modified Rule');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/configuration was modified by another user/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload latest/i })).toBeInTheDocument();
      });
    });

    it('should maintain performance under load', async () => {
      const user = userEvent.setup();
      
      // Mock large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...mockCombinationRule,
        id: `rule-${i.toString().padStart(3, '0')}`,
        rule_name: `Rule ${i + 1}`,
      }));

      (mockSupabaseClient.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          data: largeDataset,
          error: null,
        }),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
      }));

      render(<CombinationRulesConfig businessContextId={mockBusinessContextId} />);

      // Wait for large dataset to load
      await waitFor(() => {
        expect(screen.getByText('Rule 1')).toBeInTheDocument();
        expect(screen.getByText('Rule 100')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Verify performance is within threshold
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(performanceThreshold);

      // Test pagination/virtualization
      const paginationInfo = screen.getByText(/showing 1-50 of 100/i);
      expect(paginationInfo).toBeInTheDocument();

      const nextPageButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextPageButton);

      await waitFor(() => {
        expect(screen.getByText(/showing 51-100 of 100/i)).toBeInTheDocument();
      });
    });
  });
});