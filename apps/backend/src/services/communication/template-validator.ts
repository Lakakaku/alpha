import Handlebars from 'handlebars';
import type { 
  CommunicationTemplate,
  NotificationType,
  CommunicationChannel 
} from '@vocilia/types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100 quality score
}

export interface ValidationError {
  type: 'syntax' | 'content' | 'compliance' | 'security';
  field: 'content' | 'subject' | 'variables';
  message: string;
  line?: number;
}

export interface ValidationWarning {
  type: 'style' | 'performance' | 'accessibility' | 'best_practice';
  field: 'content' | 'subject' | 'variables';
  message: string;
  suggestion?: string;
}

export class TemplateValidatorService {
  private brandingKeywords: string[] = ['vocilia', 'belöningar', 'feedback', 'kvalitet'];
  private complianceRules: ComplianceRule[] = [];

  constructor() {
    this.initializeComplianceRules();
  }

  /**
   * Comprehensive template validation
   */
  async validateTemplate(template: Partial<CommunicationTemplate>): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Syntax validation
    const syntaxResult = this.validateSyntax(template.content || '');
    errors.push(...syntaxResult.errors);
    warnings.push(...syntaxResult.warnings);

    // Content validation
    const contentResult = this.validateContent(template);
    errors.push(...contentResult.errors);
    warnings.push(...contentResult.warnings);

    // Compliance validation
    const complianceResult = this.validateCompliance(template);
    errors.push(...complianceResult.errors);
    warnings.push(...complianceResult.warnings);

    // Security validation
    const securityResult = this.validateSecurity(template.content || '');
    errors.push(...securityResult.errors);
    warnings.push(...securityResult.warnings);

    // Branding consistency
    const brandingResult = this.validateBranding(template);
    warnings.push(...brandingResult.warnings);

    // Performance validation
    const performanceResult = this.validatePerformance(template);
    warnings.push(...performanceResult.warnings);

    // Calculate quality score
    const score = this.calculateQualityScore(errors, warnings, template);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }

  /**
   * Validate Handlebars syntax and template structure
   */
  private validateSyntax(content: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!content || content.trim().length === 0) {
      errors.push({
        type: 'syntax',
        field: 'content',
        message: 'Template content cannot be empty'
      });
      return { errors, warnings };
    }

    try {
      // Test Handlebars compilation
      const compiled = Handlebars.compile(content);
      
      // Test with empty data to catch missing variables
      try {
        compiled({});
      } catch (renderError) {
        warnings.push({
          type: 'best_practice',
          field: 'content',
          message: 'Template may fail with empty data',
          suggestion: 'Add default values or conditional blocks'
        });
      }

      // Check for proper variable syntax
      const variablePattern = /\{\{[^}]+\}\}/g;
      const variables = content.match(variablePattern) || [];
      
      for (const variable of variables) {
        // Check for proper spacing
        if (!/\{\{\s*[\w.]+\s*\}\}/.test(variable)) {
          warnings.push({
            type: 'style',
            field: 'content',
            message: `Inconsistent variable formatting: ${variable}`,
            suggestion: 'Use consistent spacing: {{ variable }}'
          });
        }

        // Check for potentially dangerous operations
        if (variable.includes('eval') || variable.includes('script')) {
          errors.push({
            type: 'security',
            field: 'content',
            message: `Potentially dangerous variable: ${variable}`
          });
        }
      }

      // Check for balanced blocks
      const blockPattern = /\{\{#[\w.]+\}\}.*?\{\{\/[\w.]+\}\}/gs;
      const helperPattern = /\{\{#(\w+)/g;
      const closingPattern = /\{\{\/(\w+)/g;
      
      const openBlocks = Array.from(content.matchAll(helperPattern)).map(m => m[1]);
      const closeBlocks = Array.from(content.matchAll(closingPattern)).map(m => m[1]);
      
      for (const block of openBlocks) {
        if (!closeBlocks.includes(block)) {
          errors.push({
            type: 'syntax',
            field: 'content',
            message: `Unclosed block helper: {{#${block}}}`
          });
        }
      }

    } catch (error) {
      errors.push({
        type: 'syntax',
        field: 'content',
        message: `Handlebars syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate content quality and structure
   */
  private validateContent(template: Partial<CommunicationTemplate>): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const content = template.content || '';

    // Length validation
    if (template.channel === 'sms') {
      if (content.length > 1600) {
        errors.push({
          type: 'content',
          field: 'content',
          message: `SMS content too long: ${content.length} characters (max 1600)`
        });
      } else if (content.length > 160) {
        warnings.push({
          type: 'performance',
          field: 'content',
          message: `SMS will be split into multiple parts: ${Math.ceil(content.length / 160)} segments`,
          suggestion: 'Consider shortening for better delivery rates'
        });
      }
    }

    // Language validation for Swedish content
    if (template.language === 'sv') {
      const swedishCharPattern = /[åäöÅÄÖ]/;
      if (!swedishCharPattern.test(content) && content.length > 50) {
        warnings.push({
          type: 'accessibility',
          field: 'content',
          message: 'Swedish template contains no Swedish characters',
          suggestion: 'Verify content is in correct language'
        });
      }
    }

    // Check for required elements based on notification type
    if (template.notification_type) {
      const requirements = this.getRequiredElements(template.notification_type);
      for (const requirement of requirements) {
        if (!content.includes(requirement.element)) {
          if (requirement.required) {
            errors.push({
              type: 'content',
              field: 'content',
              message: `Missing required element: ${requirement.element}`,
            });
          } else {
            warnings.push({
              type: 'best_practice',
              field: 'content',
              message: `Recommended element missing: ${requirement.element}`,
              suggestion: requirement.suggestion
            });
          }
        }
      }
    }

    // Readability checks
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    
    if (avgSentenceLength > 20) {
      warnings.push({
        type: 'accessibility',
        field: 'content',
        message: 'Average sentence length is quite long',
        suggestion: 'Consider shorter sentences for better readability'
      });
    }

    // Check for excessive capitalization
    const capsRatio = (content.match(/[A-ZÅÄÖ]/g) || []).length / content.length;
    if (capsRatio > 0.3) {
      warnings.push({
        type: 'style',
        field: 'content',
        message: 'Excessive use of capital letters',
        suggestion: 'Use normal case for better readability'
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate regulatory compliance
   */
  private validateCompliance(template: Partial<CommunicationTemplate>): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const content = template.content || '';

    // Swedish PTS (Post- och telestyrelsen) compliance for SMS
    if (template.channel === 'sms') {
      // Check for opt-out instructions in long messages
      if (content.length > 160) {
        const hasOptOut = /(?:svara\s+stopp|stopp|stop|avbryt)/i.test(content);
        if (!hasOptOut) {
          errors.push({
            type: 'compliance',
            field: 'content',
            message: 'Long SMS messages must include opt-out instructions (STOPP, STOP, AVBRYT)'
          });
        }
      }

      // Check for sender identification for marketing messages
      const marketingTypes: NotificationType[] = ['weekly_summary', 'reward_earned'];
      if (template.notification_type && marketingTypes.includes(template.notification_type)) {
        const hasCompanyId = /vocilia|från\s+vocilia/i.test(content);
        if (!hasCompanyId) {
          warnings.push({
            type: 'best_practice',
            field: 'content',
            message: 'Marketing messages should clearly identify sender',
            suggestion: 'Include "från Vocilia" or company name'
          });
        }
      }
    }

    // GDPR compliance checks
    const gdprSensitivePatterns = [
      { pattern: /personnummer|social.?security/i, message: 'Personal ID number reference' },
      { pattern: /lösenord|password/i, message: 'Password reference' },
      { pattern: /bankkonto|bank.?account/i, message: 'Bank account reference' }
    ];

    for (const { pattern, message } of gdprSensitivePatterns) {
      if (pattern.test(content)) {
        warnings.push({
          type: 'best_practice',
          field: 'content',
          message: `GDPR sensitive content detected: ${message}`,
          suggestion: 'Avoid including sensitive personal data in templates'
        });
      }
    }

    // Financial message compliance
    if (template.notification_type?.includes('payment') || template.notification_type?.includes('invoice')) {
      if (!content.includes('{{amount}}') && !content.includes('{{total}}')) {
        warnings.push({
          type: 'best_practice',
          field: 'content',
          message: 'Financial notifications should include amount information',
          suggestion: 'Add {{amount}} or {{total}} variable'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate security aspects
   */
  private validateSecurity(content: string): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for potential phishing patterns
    const phishingPatterns = [
      { pattern: /klicka\s+här|click\s+here/i, message: 'Generic "click here" text' },
      { pattern: /verifiera.*omedelbart|verify.*immediately/i, message: 'Urgency language for verification' },
      { pattern: /kontot.*blockerat|account.*blocked/i, message: 'Account blocking threat' },
      { pattern: /uppdatera.*information|update.*information/i, message: 'Information update request' }
    ];

    for (const { pattern, message } of phishingPatterns) {
      if (pattern.test(content)) {
        warnings.push({
          type: 'security',
          field: 'content',
          message: `Potential phishing pattern: ${message}`,
          suggestion: 'Use clear, non-threatening language'
        });
      }
    }

    // Check for suspicious URLs
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlPattern) || [];
    
    for (const url of urls) {
      if (!url.includes('vocilia.se') && !url.includes('localhost')) {
        warnings.push({
          type: 'security',
          field: 'content',
          message: `External URL detected: ${url}`,
          suggestion: 'Verify all URLs point to trusted domains'
        });
      }
    }

    // Check for script injection attempts
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onclick=/i,
      /eval\(/i
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        errors.push({
          type: 'security',
          field: 'content',
          message: 'Potential script injection detected'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate branding consistency
   */
  private validateBranding(template: Partial<CommunicationTemplate>): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = [];
    const content = template.content || '';

    // Check for brand name consistency
    const brandMentions = content.match(/vocilia/gi) || [];
    const incorrectCasing = brandMentions.filter(mention => mention !== 'Vocilia');
    
    if (incorrectCasing.length > 0) {
      warnings.push({
        type: 'style',
        field: 'content',
        message: 'Inconsistent brand name casing',
        suggestion: 'Always use "Vocilia" with capital V'
      });
    }

    // Check for brand voice consistency (Swedish templates)
    if (template.language === 'sv') {
      // Check for formal vs informal address
      const formalAddress = /\b(ni|er|ert)\b/gi.test(content);
      const informalAddress = /\b(du|dig|din|ditt)\b/gi.test(content);
      
      if (formalAddress && informalAddress) {
        warnings.push({
          type: 'style',
          field: 'content',
          message: 'Mixed formal/informal address (du/ni)',
          suggestion: 'Maintain consistent tone throughout'
        });
      }
    }

    // Check for required branding elements
    const brandingElements = ['support', 'hjälp', 'kontakt'];
    const hasBrandingElement = brandingElements.some(element => 
      content.toLowerCase().includes(element)
    );

    if (!hasBrandingElement && template.notification_type !== 'fraud_alert') {
      warnings.push({
        type: 'best_practice',
        field: 'content',
        message: 'No contact/support information found',
        suggestion: 'Include support contact information'
      });
    }

    return { warnings };
  }

  /**
   * Validate performance aspects
   */
  private validatePerformance(template: Partial<CommunicationTemplate>): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = [];
    const content = template.content || '';

    // Check for complex Handlebars operations
    const complexOperations = [
      /\{\{#each.*#each\}\}/gs, // Nested loops
      /\{\{#if.*#if.*#if\}\}/gs, // Deep nested conditions
      /\{\{lookup.*lookup\}\}/gs // Nested lookups
    ];

    for (const pattern of complexOperations) {
      if (pattern.test(content)) {
        warnings.push({
          type: 'performance',
          field: 'content',
          message: 'Complex template operations detected',
          suggestion: 'Consider simplifying template logic for better performance'
        });
      }
    }

    // Check for excessive variable usage
    const variableCount = (content.match(/\{\{[^}]+\}\}/g) || []).length;
    if (variableCount > 20) {
      warnings.push({
        type: 'performance',
        field: 'content',
        message: `High number of variables: ${variableCount}`,
        suggestion: 'Consider reducing template complexity'
      });
    }

    return { warnings };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    errors: ValidationError[], 
    warnings: ValidationWarning[],
    template: Partial<CommunicationTemplate>
  ): number {
    let score = 100;

    // Deduct points for errors
    score -= errors.length * 20;

    // Deduct points for warnings by type
    const warningPenalties = {
      security: 15,
      compliance: 10,
      accessibility: 8,
      best_practice: 5,
      style: 3,
      performance: 2
    };

    for (const warning of warnings) {
      score -= warningPenalties[warning.type] || 1;
    }

    // Bonus points for good practices
    const content = template.content || '';
    
    // Bonus for including support information
    if (/support|hjälp|kontakt/i.test(content)) {
      score += 5;
    }

    // Bonus for proper variable usage
    if (template.variables && template.variables.length > 0) {
      score += 3;
    }

    // Bonus for appropriate length
    if (template.channel === 'sms' && content.length > 50 && content.length <= 160) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get required elements for notification types
   */
  private getRequiredElements(type: NotificationType): Array<{ element: string; required: boolean; suggestion?: string }> {
    const requirements: Record<NotificationType, Array<{ element: string; required: boolean; suggestion?: string }>> = {
      reward_earned: [
        { element: '{{amount}}', required: true },
        { element: 'belöning', required: true },
        { element: 'support', required: false, suggestion: 'Include support contact' }
      ],
      payment_confirmation: [
        { element: '{{amount}}', required: true },
        { element: 'betalning', required: true },
        { element: '{{transaction_id}}', required: false, suggestion: 'Include transaction reference' }
      ],
      verification_request: [
        { element: '{{deadline}}', required: true },
        { element: 'verifiering', required: true },
        { element: 'företag', required: false }
      ],
      support_ticket_created: [
        { element: '{{ticket_id}}', required: true },
        { element: 'support', required: true }
      ],
      payment_overdue: [
        { element: '{{amount}}', required: true },
        { element: 'förfallen', required: true },
        { element: '{{due_date}}', required: true }
      ],
      weekly_summary: [
        { element: 'vecka', required: true },
        { element: '{{total_rewards}}', required: false }
      ],
      fraud_alert: [
        { element: 'säkerhet', required: true },
        { element: 'omedelbart', required: false }
      ],
      payment_failed: [
        { element: '{{amount}}', required: true },
        { element: 'misslyckades', required: true }
      ],
      verification_failed: [
        { element: 'verifiering', required: true },
        { element: 'misslyckades', required: true }
      ],
      system_maintenance: [
        { element: 'underhåll', required: true },
        { element: '{{start_time}}', required: false }
      ],
      support_message_received: [
        { element: '{{ticket_id}}', required: true },
        { element: 'meddelande', required: true }
      ],
      support_ticket_updated: [
        { element: '{{ticket_id}}', required: true },
        { element: '{{status}}', required: true }
      ]
    };

    return requirements[type] || [];
  }

  /**
   * Initialize compliance rules
   */
  private initializeComplianceRules(): void {
    this.complianceRules = [
      {
        name: 'Swedish SMS Opt-out',
        pattern: /(?:svara\s+stopp|stopp|stop|avbryt)/i,
        required: true,
        channels: ['sms'],
        condition: (template) => (template.content?.length || 0) > 160
      },
      {
        name: 'GDPR Privacy Notice',
        pattern: /personuppgifter|privacy|integritet/i,
        required: false,
        channels: ['sms', 'email'],
        condition: (template) => template.notification_type?.includes('verification') || false
      }
    ];
  }
}

interface ComplianceRule {
  name: string;
  pattern: RegExp;
  required: boolean;
  channels: string[];
  condition: (template: Partial<CommunicationTemplate>) => boolean;
}