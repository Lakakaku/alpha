import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TemplateManager } from '../../src/services/communication/template-manager';
import { TemplateValidator } from '../../src/services/communication/template-validator';
import { TemplateRenderer } from '../../src/services/communication/template-renderer';
import { supabase } from '@vocilia/database';

// Mock dependencies
jest.mock('../../src/services/communication/template-validator');
jest.mock('../../src/services/communication/template-renderer');
jest.mock('@vocilia/database');

interface MockSupabaseResponse {
  data: any;
  error: any;
}

interface MockValidator {
  validateTemplate: jest.MockedFunction<any>;
  validateVariables: jest.MockedFunction<any>;
  checkBrandingCompliance: jest.MockedFunction<any>;
}

interface MockRenderer {
  renderTemplate: jest.MockedFunction<any>;
  previewTemplate: jest.MockedFunction<any>;
  validateRendering: jest.MockedFunction<any>;
}

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let mockValidator: MockValidator;
  let mockRenderer: MockRenderer;
  let mockSupabase: any;

  const mockTemplate = {
    id: 'tmpl_123',
    template_type: 'sms' as const,
    category: 'reward_notification' as const,
    language: 'sv' as const,
    name: 'Belöningsmeddelande',
    subject: null,
    content: 'Hej {{customer_name}}! Du har fått {{reward_amount}} SEK i belöning för ditt köp på {{store_name}}. Pengarna skickas via Swish inom 24 timmar.',
    variables: ['customer_name', 'reward_amount', 'store_name'],
    version: 1,
    is_active: true,
    created_at: '2025-09-26T10:00:00Z',
    updated_at: '2025-09-26T10:00:00Z',
    created_by: 'admin_123'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TemplateValidator
    mockValidator = {
      validateTemplate: jest.fn(),
      validateVariables: jest.fn(),
      checkBrandingCompliance: jest.fn()
    };
    (TemplateValidator as jest.MockedClass<typeof TemplateValidator>).mockImplementation(() => mockValidator as any);

    // Mock TemplateRenderer
    mockRenderer = {
      renderTemplate: jest.fn(),
      previewTemplate: jest.fn(),
      validateRendering: jest.fn()
    };
    (TemplateRenderer as jest.MockedClass<typeof TemplateRenderer>).mockImplementation(() => mockRenderer as any);

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn()
    };
    (supabase as any) = mockSupabase;

    templateManager = new TemplateManager();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a new template with validation', async () => {
      const newTemplate = {
        template_type: 'sms' as const,
        category: 'payment_confirmation' as const,
        language: 'sv' as const,
        name: 'Betalningsbekräftelse',
        content: 'Hej {{customer_name}}! Din betalning på {{amount}} SEK är mottagen.',
        variables: ['customer_name', 'amount']
      };

      // Mock validation success
      mockValidator.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: []
      });

      mockValidator.checkBrandingCompliance.mockResolvedValue({
        isCompliant: true,
        issues: []
      });

      // Mock database insert
      mockSupabase.single.mockResolvedValue({
        data: { ...mockTemplate, ...newTemplate, id: 'tmpl_456' },
        error: null
      });

      const result = await templateManager.createTemplate(newTemplate);

      expect(mockValidator.validateTemplate).toHaveBeenCalledWith(newTemplate);
      expect(mockValidator.checkBrandingCompliance).toHaveBeenCalledWith(newTemplate);
      expect(result.id).toBe('tmpl_456');
      expect(result.name).toBe('Betalningsbekräftelse');
    });

    it('should reject template with validation errors', async () => {
      const invalidTemplate = {
        template_type: 'sms' as const,
        category: 'reward_notification' as const,
        language: 'sv' as const,
        name: '',
        content: 'Meddelande utan variabler',
        variables: []
      };

      mockValidator.validateTemplate.mockResolvedValue({
        isValid: false,
        errors: ['Template name is required', 'SMS templates must be under 160 characters']
      });

      await expect(templateManager.createTemplate(invalidTemplate))
        .rejects.toThrow('Template validation failed: Template name is required, SMS templates must be under 160 characters');

      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should reject template with branding compliance issues', async () => {
      const nonCompliantTemplate = {
        template_type: 'email' as const,
        category: 'verification_request' as const,
        language: 'sv' as const,
        name: 'Verifieringsbegäran',
        content: 'Unofficial brand message without proper signature',
        variables: []
      };

      mockValidator.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: []
      });

      mockValidator.checkBrandingCompliance.mockResolvedValue({
        isCompliant: false,
        issues: ['Missing official Vocilia signature', 'Brand colors not used']
      });

      await expect(templateManager.createTemplate(nonCompliantTemplate))
        .rejects.toThrow('Branding compliance failed: Missing official Vocilia signature, Brand colors not used');
    });
  });

  describe('updateTemplate', () => {
    it('should create new version when updating active template', async () => {
      const updates = {
        content: 'Hej {{customer_name}}! Du har fått {{reward_amount}} SEK i belöning för ditt köp på {{store_name}}. Pengarna skickas via Swish inom 2 arbetsdagar.',
        variables: ['customer_name', 'reward_amount', 'store_name']
      };

      // Mock current template fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: mockTemplate,
        error: null
      });

      // Mock validation
      mockValidator.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: []
      });

      mockValidator.checkBrandingCompliance.mockResolvedValue({
        isCompliant: true,
        issues: []
      });

      // Mock version creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { ...mockTemplate, ...updates, version: 2, id: 'tmpl_123_v2' },
        error: null
      });

      const result = await templateManager.updateTemplate('tmpl_123', updates);

      expect(result.version).toBe(2);
      expect(result.content).toContain('2 arbetsdagar');
    });

    it('should deactivate old version when creating new version', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockTemplate,
          error: null
        })
        .mockResolvedValueOnce({
          data: { ...mockTemplate, version: 2 },
          error: null
        });

      mockValidator.validateTemplate.mockResolvedValue({ isValid: true, errors: [] });
      mockValidator.checkBrandingCompliance.mockResolvedValue({ isCompliant: true, issues: [] });

      await templateManager.updateTemplate('tmpl_123', {
        content: 'Updated content'
      });

      // Should update old version to inactive
      expect(mockSupabase.update).toHaveBeenCalledWith({
        is_active: false
      });
    });
  });

  describe('renderTemplate', () => {
    it('should render SMS template with customer data', async () => {
      const customerData = {
        customer_name: 'Anna Andersson',
        reward_amount: '45',
        store_name: 'ICA Supermarket Södermalm'
      };

      const expectedRenderedContent = 'Hej Anna Andersson! Du har fått 45 SEK i belöning för ditt köp på ICA Supermarket Södermalm. Pengarna skickas via Swish inom 24 timmar.';

      mockRenderer.renderTemplate.mockResolvedValue({
        content: expectedRenderedContent,
        characterCount: expectedRenderedContent.length,
        isValid: true,
        estimatedParts: 1
      });

      const result = await templateManager.renderTemplate(mockTemplate, customerData);

      expect(mockRenderer.renderTemplate).toHaveBeenCalledWith(mockTemplate, customerData);
      expect(result.content).toBe(expectedRenderedContent);
      expect(result.characterCount).toBe(expectedRenderedContent.length);
      expect(result.estimatedParts).toBe(1);
    });

    it('should handle missing variables gracefully', async () => {
      const incompleteData = {
        customer_name: 'Anna Andersson',
        // Missing reward_amount and store_name
      };

      mockValidator.validateVariables.mockReturnValue({
        isValid: false,
        missingVariables: ['reward_amount', 'store_name'],
        errors: ['Missing required variable: reward_amount', 'Missing required variable: store_name']
      });

      await expect(templateManager.renderTemplate(mockTemplate, incompleteData))
        .rejects.toThrow('Missing required variables: reward_amount, store_name');

      expect(mockValidator.validateVariables).toHaveBeenCalledWith(
        mockTemplate.variables,
        incompleteData
      );
    });

    it('should calculate correct SMS parts for long Swedish messages', async () => {
      const longSwedishContent = 'Hej Anna! Detta är ett mycket långt meddelande på svenska med åäö som kommer att delas upp i flera SMS-delar eftersom det överstiger 160 tecken vilket är standardgränsen för svenska SMS-meddelanden och därför kommer att kosta mer.';

      mockRenderer.renderTemplate.mockResolvedValue({
        content: longSwedishContent,
        characterCount: longSwedishContent.length,
        isValid: true,
        estimatedParts: 2,
        estimatedCost: 1.00
      });

      const result = await templateManager.renderTemplate(mockTemplate, {
        customer_name: 'Anna',
        reward_amount: '45',
        store_name: 'Test Store'
      });

      expect(result.estimatedParts).toBe(2);
      expect(result.estimatedCost).toBe(1.00);
    });
  });

  describe('template versioning', () => {
    it('should list all versions of a template', async () => {
      const templateVersions = [
        { ...mockTemplate, version: 1, is_active: false },
        { ...mockTemplate, version: 2, is_active: true }
      ];

      mockSupabase.single.mockResolvedValue({
        data: templateVersions,
        error: null
      });

      const versions = await templateManager.getTemplateVersions('tmpl_123');

      expect(versions).toHaveLength(2);
      expect(versions[1].is_active).toBe(true);
      expect(versions[1].version).toBe(2);
    });

    it('should restore previous template version', async () => {
      // Mock current active version
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { ...mockTemplate, version: 2, is_active: true },
          error: null
        })
        // Mock version to restore
        .mockResolvedValueOnce({
          data: { ...mockTemplate, version: 1, is_active: false },
          error: null
        })
        // Mock new version creation
        .mockResolvedValueOnce({
          data: { ...mockTemplate, version: 3, is_active: true },
          error: null
        });

      const result = await templateManager.restoreTemplateVersion('tmpl_123', 1);

      expect(result.version).toBe(3);
      expect(result.is_active).toBe(true);
    });
  });

  describe('template categories and types', () => {
    it('should validate template category matches type constraints', async () => {
      // SMS templates should not have subject lines
      const invalidSmsTemplate = {
        template_type: 'sms' as const,
        category: 'reward_notification' as const,
        language: 'sv' as const,
        name: 'SMS med ämnesrad',
        subject: 'Detta ska inte finnas',
        content: 'SMS-innehåll',
        variables: []
      };

      mockValidator.validateTemplate.mockResolvedValue({
        isValid: false,
        errors: ['SMS templates cannot have subject lines']
      });

      await expect(templateManager.createTemplate(invalidSmsTemplate))
        .rejects.toThrow('Template validation failed: SMS templates cannot have subject lines');
    });

    it('should enforce required variables for specific categories', async () => {
      const rewardTemplate = {
        template_type: 'sms' as const,
        category: 'reward_notification' as const,
        language: 'sv' as const,
        name: 'Belöning utan viktiga variabler',
        content: 'Du har fått en belöning!',
        variables: []
      };

      mockValidator.validateTemplate.mockResolvedValue({
        isValid: false,
        errors: ['Reward notification templates must include reward_amount variable']
      });

      await expect(templateManager.createTemplate(rewardTemplate))
        .rejects.toThrow('Reward notification templates must include reward_amount variable');
    });
  });

  describe('template search and filtering', () => {
    it('should search templates by content and variables', async () => {
      const searchResults = [
        { ...mockTemplate, id: 'tmpl_1' },
        { ...mockTemplate, id: 'tmpl_2', content: 'Annat innehåll med {{reward_amount}}' }
      ];

      mockSupabase.single.mockResolvedValue({
        data: searchResults,
        error: null
      });

      const results = await templateManager.searchTemplates({
        query: 'reward_amount',
        type: 'sms',
        language: 'sv'
      });

      expect(results).toHaveLength(2);
      expect(results.every(t => t.variables.includes('reward_amount'))).toBe(true);
    });

    it('should filter templates by multiple criteria', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [mockTemplate],
        error: null
      });

      const results = await templateManager.getTemplates({
        type: 'sms',
        category: 'reward_notification',
        language: 'sv',
        isActive: true
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('template_type', 'sms');
      expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'reward_notification');
      expect(mockSupabase.eq).toHaveBeenCalledWith('language', 'sv');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('template analytics', () => {
    it('should track template usage statistics', async () => {
      const usageStats = {
        templateId: 'tmpl_123',
        totalSent: 1250,
        successRate: 98.4,
        averageDeliveryTime: 15,
        lastUsed: '2025-09-26T10:00:00Z',
        popularVariables: ['customer_name', 'reward_amount', 'store_name']
      };

      mockSupabase.single.mockResolvedValue({
        data: usageStats,
        error: null
      });

      const stats = await templateManager.getTemplateUsageStats('tmpl_123');

      expect(stats.totalSent).toBe(1250);
      expect(stats.successRate).toBe(98.4);
      expect(stats.popularVariables).toContain('reward_amount');
    });

    it('should identify unused templates for cleanup', async () => {
      const unusedTemplates = [
        { ...mockTemplate, id: 'tmpl_old1', last_used: '2025-06-01T10:00:00Z' },
        { ...mockTemplate, id: 'tmpl_old2', last_used: '2025-07-15T10:00:00Z' }
      ];

      mockSupabase.single.mockResolvedValue({
        data: unusedTemplates,
        error: null
      });

      const unused = await templateManager.getUnusedTemplates(90); // 90 days

      expect(unused).toHaveLength(2);
      expect(unused.every(t => t.id.includes('old'))).toBe(true);
    });
  });

  describe('template preview and testing', () => {
    it('should generate template preview with sample data', async () => {
      const sampleData = {
        customer_name: 'Test Kund',
        reward_amount: '50',
        store_name: 'Test Butik'
      };

      mockRenderer.previewTemplate.mockResolvedValue({
        content: 'Hej Test Kund! Du har fått 50 SEK i belöning för ditt köp på Test Butik.',
        characterCount: 67,
        estimatedParts: 1,
        warnings: []
      });

      const preview = await templateManager.previewTemplate('tmpl_123', sampleData);

      expect(preview.content).toContain('Test Kund');
      expect(preview.content).toContain('50 SEK');
      expect(preview.estimatedParts).toBe(1);
      expect(preview.warnings).toHaveLength(0);
    });

    it('should validate template rendering with edge cases', async () => {
      const edgeCaseData = {
        customer_name: 'Väldigt Långt Kundnamn Som Kan Orsaka Problem',
        reward_amount: '999999',
        store_name: 'Butik Med Väldigt Långt Namn Som Överstiger Normala Gränser'
      };

      mockRenderer.validateRendering.mockResolvedValue({
        isValid: false,
        errors: ['Rendered content exceeds SMS character limit'],
        suggestions: ['Shorten store name variable', 'Use abbreviated customer name']
      });

      const validation = await templateManager.validateTemplateRendering('tmpl_123', edgeCaseData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rendered content exceeds SMS character limit');
      expect(validation.suggestions).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection lost'));

      await expect(templateManager.getTemplate('tmpl_123'))
        .rejects.toThrow('Database connection lost');
    });

    it('should handle template not found errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Template not found', code: '404' }
      });

      await expect(templateManager.getTemplate('tmpl_nonexistent'))
        .rejects.toThrow('Template not found');
    });

    it('should validate template permissions before operations', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient permissions', code: '403' }
      });

      await expect(templateManager.deleteTemplate('tmpl_123'))
        .rejects.toThrow('Insufficient permissions');
    });
  });
});