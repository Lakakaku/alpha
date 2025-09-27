import Handlebars from 'handlebars';
import type { 
  CommunicationTemplate,
  NotificationType,
  TemplateStatus,
  CommunicationChannel
} from '@vocilia/types';
import { CommunicationTemplateModel } from '@vocilia/database';

export class TemplateManagerService {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  /**
   * Create a new template
   */
  async createTemplate(templateData: {
    name: string;
    notification_type: NotificationType;
    channel: CommunicationChannel;
    language: string;
    subject?: string;
    content: string;
    variables: string[];
    created_by: string;
  }): Promise<CommunicationTemplate> {
    try {
      // Validate template syntax
      const validation = await this.validateTemplate(templateData.content, templateData.variables);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for naming conflicts
      const existing = await CommunicationTemplateModel.getByName(templateData.name);
      if (existing) {
        throw new Error(`Template with name '${templateData.name}' already exists`);
      }

      // Create template with version 1
      const template = await CommunicationTemplateModel.create({
        ...templateData,
        version: 1,
        status: 'draft',
        is_default: false
      });

      console.log(`Template created: ${template.id} (${template.name})`);
      return template;

    } catch (error) {
      console.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * Update existing template (creates new version)
   */
  async updateTemplate(
    templateId: string, 
    updates: {
      content?: string;
      subject?: string;
      variables?: string[];
    },
    updatedBy: string
  ): Promise<CommunicationTemplate> {
    try {
      const existing = await CommunicationTemplateModel.getById(templateId);
      if (!existing) {
        throw new Error('Template not found');
      }

      // Validate new content if provided
      if (updates.content) {
        const validation = await this.validateTemplate(
          updates.content, 
          updates.variables || existing.variables
        );
        if (!validation.valid) {
          throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Create new version
      const newVersion = await CommunicationTemplateModel.createVersion({
        template_id: existing.id,
        content: updates.content || existing.content,
        subject: updates.subject || existing.subject,
        variables: updates.variables || existing.variables,
        created_by: updatedBy,
        version: existing.version + 1
      });

      // Clear cached compiled template
      this.clearCompiledTemplate(existing.notification_type, existing.channel, existing.language);

      console.log(`Template updated: ${templateId} (new version: ${newVersion.version})`);
      return newVersion;

    } catch (error) {
      console.error('Failed to update template:', error);
      throw error;
    }
  }

  /**
   * Activate template version (makes it live)
   */
  async activateTemplate(templateId: string, activatedBy: string): Promise<CommunicationTemplate> {
    try {
      const template = await CommunicationTemplateModel.getById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Final validation before activation
      const validation = await this.validateTemplate(template.content, template.variables);
      if (!validation.valid) {
        throw new Error(`Cannot activate invalid template: ${validation.errors.join(', ')}`);
      }

      // Deactivate current active template of same type/channel/language
      await CommunicationTemplateModel.deactivateType(
        template.notification_type, 
        template.channel, 
        template.language
      );

      // Activate this template
      const activated = await CommunicationTemplateModel.updateStatus(templateId, 'active');

      // Clear cache to force reload
      this.clearCompiledTemplate(template.notification_type, template.channel, template.language);

      console.log(`Template activated: ${templateId} (${template.name})`);
      return activated;

    } catch (error) {
      console.error('Failed to activate template:', error);
      throw error;
    }
  }

  /**
   * Deactivate template
   */
  async deactivateTemplate(templateId: string): Promise<CommunicationTemplate> {
    try {
      const template = await CommunicationTemplateModel.updateStatus(templateId, 'inactive');
      
      // Clear cache
      this.clearCompiledTemplate(template.notification_type, template.channel, template.language);

      console.log(`Template deactivated: ${templateId}`);
      return template;

    } catch (error) {
      console.error('Failed to deactivate template:', error);
      throw error;
    }
  }

  /**
   * Archive old template
   */
  async archiveTemplate(templateId: string): Promise<CommunicationTemplate> {
    try {
      const template = await CommunicationTemplateModel.updateStatus(templateId, 'archived');
      
      // Clear cache
      this.clearCompiledTemplate(template.notification_type, template.channel, template.language);

      console.log(`Template archived: ${templateId}`);
      return template;

    } catch (error) {
      console.error('Failed to archive template:', error);
      throw error;
    }
  }

  /**
   * Get active template for rendering
   */
  async getActiveTemplate(
    notificationType: NotificationType, 
    channel: CommunicationChannel, 
    language: string = 'sv'
  ): Promise<CommunicationTemplate | null> {
    try {
      return await CommunicationTemplateModel.getByTypeAndChannel(notificationType, channel, language);
    } catch (error) {
      console.error('Failed to get active template:', error);
      throw error;
    }
  }

  /**
   * Render template with data
   */
  async renderTemplate(
    templateId: string, 
    data: Record<string, any>
  ): Promise<{ subject?: string; content: string }> {
    try {
      const template = await CommunicationTemplateModel.getById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Get or compile template
      const compiled = await this.getCompiledTemplate(template);

      // Prepare data with defaults
      const templateData = this.prepareTemplateData(data);

      // Render content
      const content = compiled(templateData);

      // Render subject if present
      let subject: string | undefined;
      if (template.subject) {
        const subjectCompiled = Handlebars.compile(template.subject);
        subject = subjectCompiled(templateData);
      }

      return { subject, content };

    } catch (error) {
      console.error('Failed to render template:', error);
      throw error;
    }
  }

  /**
   * Validate template syntax and variables
   */
  async validateTemplate(content: string, variables: string[]): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check Handlebars syntax
      Handlebars.compile(content);
    } catch (error) {
      errors.push(`Handlebars syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check content length
    if (content.length > 1600) {
      warnings.push(`Content is very long (${content.length} chars). SMS may be split into multiple messages.`);
    }

    // Check for required variables
    const requiredVars = ['company_name']; // Always required
    for (const reqVar of requiredVars) {
      if (!content.includes(`{{${reqVar}}}`)) {
        warnings.push(`Missing recommended variable: {{${reqVar}}}`);
      }
    }

    // Check for unused variables
    for (const variable of variables) {
      if (!content.includes(`{{${variable}}}`)) {
        warnings.push(`Variable '${variable}' declared but not used in template`);
      }
    }

    // Check for Swedish compliance (opt-out text)
    if (content.length > 160 && !/(?:svara stopp|stop|avbryt)/i.test(content)) {
      warnings.push('Long SMS should include opt-out instructions (STOPP, STOP, AVBRYT)');
    }

    // Check for suspicious content
    const suspiciousPatterns = [
      { pattern: /lösenord|password/i, message: 'Template contains password reference' },
      { pattern: /klicka här|click here/i, message: 'Template contains "click here" text' },
      { pattern: /brådskande|urgent|omedelbart/i, message: 'Template contains urgency language' }
    ];

    for (const { pattern, message } of suspiciousPatterns) {
      if (pattern.test(content)) {
        warnings.push(message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateId: string): Promise<{
    subject?: string;
    content: string;
    sampleData: Record<string, any>;
  }> {
    try {
      const template = await CommunicationTemplateModel.getById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Generate sample data based on template variables
      const sampleData = this.generateSampleData(template.variables);

      // Render with sample data
      const rendered = await this.renderTemplate(templateId, sampleData);

      return {
        ...rendered,
        sampleData
      };

    } catch (error) {
      console.error('Failed to preview template:', error);
      throw error;
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(templateId: string, days: number = 30): Promise<{
    total_sent: number;
    successful_deliveries: number;
    failed_deliveries: number;
    delivery_rate: number;
    avg_response_time: number;
  }> {
    try {
      // This would query communication_logs table for usage statistics
      return {
        total_sent: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        delivery_rate: 0,
        avg_response_time: 0
      };

    } catch (error) {
      console.error('Failed to get template stats:', error);
      throw error;
    }
  }

  /**
   * Duplicate existing template
   */
  async duplicateTemplate(
    templateId: string, 
    newName: string, 
    createdBy: string
  ): Promise<CommunicationTemplate> {
    try {
      const original = await CommunicationTemplateModel.getById(templateId);
      if (!original) {
        throw new Error('Template not found');
      }

      const duplicate = await this.createTemplate({
        name: newName,
        notification_type: original.notification_type,
        channel: original.channel,
        language: original.language,
        subject: original.subject,
        content: original.content,
        variables: original.variables,
        created_by: createdBy
      });

      console.log(`Template duplicated: ${templateId} -> ${duplicate.id}`);
      return duplicate;

    } catch (error) {
      console.error('Failed to duplicate template:', error);
      throw error;
    }
  }

  /**
   * Get compiled template (cached)
   */
  private async getCompiledTemplate(template: CommunicationTemplate): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `${template.notification_type}-${template.channel}-${template.language}`;
    
    let compiled = this.compiledTemplates.get(cacheKey);
    if (!compiled) {
      compiled = Handlebars.compile(template.content);
      this.compiledTemplates.set(cacheKey, compiled);
    }

    return compiled;
  }

  /**
   * Clear compiled template from cache
   */
  private clearCompiledTemplate(
    notificationType: NotificationType, 
    channel: CommunicationChannel, 
    language: string
  ): void {
    const cacheKey = `${notificationType}-${channel}-${language}`;
    this.compiledTemplates.delete(cacheKey);
  }

  /**
   * Prepare template data with common variables
   */
  private prepareTemplateData(data: Record<string, any>): Record<string, any> {
    return {
      ...data,
      company_name: 'Vocilia',
      support_phone: process.env.SUPPORT_PHONE_NUMBER || '+46 8 123 456',
      support_email: process.env.SUPPORT_EMAIL || 'support@vocilia.se',
      today: new Date().toLocaleDateString('sv-SE'),
      time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      year: new Date().getFullYear()
    };
  }

  /**
   * Generate sample data for template preview
   */
  private generateSampleData(variables: string[]): Record<string, any> {
    const sampleData: Record<string, any> = {};

    for (const variable of variables) {
      switch (variable) {
        case 'customer_name':
          sampleData[variable] = 'Anna Andersson';
          break;
        case 'business_name':
          sampleData[variable] = 'Café Stockholm AB';
          break;
        case 'reward_amount':
          sampleData[variable] = '25.50';
          break;
        case 'payment_amount':
          sampleData[variable] = '125.00';
          break;
        case 'transaction_id':
          sampleData[variable] = 'TX123456789';
          break;
        case 'due_date':
          sampleData[variable] = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
          break;
        case 'store_name':
          sampleData[variable] = 'Café Stockholm Södermalm';
          break;
        case 'ticket_id':
          sampleData[variable] = 'SUP-2025-001';
          break;
        case 'verification_deadline':
          sampleData[variable] = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
          break;
        default:
          sampleData[variable] = `[${variable}]`;
      }
    }

    return sampleData;
  }

  /**
   * Bulk import templates from JSON
   */
  async importTemplates(templates: any[], importedBy: string): Promise<{
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    for (const templateData of templates) {
      try {
        await this.createTemplate({
          ...templateData,
          created_by: importedBy
        });
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${templateData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Clear all compiled template cache
   */
  clearAllCache(): void {
    this.compiledTemplates.clear();
    console.log('Template cache cleared');
  }
}