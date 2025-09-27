import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  CommunicationTemplate, 
  NotificationType, 
  CommunicationChannel,
  TemplateStatus
} from '@vocilia/types/communication';

export class CommunicationTemplateModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new communication template
   */
  async create(template: Omit<CommunicationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationTemplate> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return data;
  }

  /**
   * Get template by ID
   */
  async findById(id: string): Promise<CommunicationTemplate | null> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Find template by type, channel, and language
   */
  async findByTypeChannelLanguage(
    notificationType: NotificationType,
    channel: CommunicationChannel,
    language: string = 'sv'
  ): Promise<CommunicationTemplate | null> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('notification_type', notificationType)
      .eq('channel', channel)
      .eq('language', language)
      .eq('status', 'active')
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Get all templates with filtering options
   */
  async findAll(options: {
    notificationType?: NotificationType;
    channel?: CommunicationChannel;
    language?: string;
    status?: TemplateStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<CommunicationTemplate[]> {
    let query = this.supabase
      .from('communication_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.notificationType) {
      query = query.eq('notification_type', options.notificationType);
    }

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }

    if (options.language) {
      query = query.eq('language', options.language);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update template
   */
  async update(
    id: string, 
    updates: Partial<Omit<CommunicationTemplate, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<CommunicationTemplate> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('communication_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return data;
  }

  /**
   * Create new version of template
   */
  async createVersion(
    baseTemplateId: string,
    updates: Pick<CommunicationTemplate, 'subject' | 'content_template' | 'variables' | 'version_notes'>
  ): Promise<CommunicationTemplate> {
    // Get base template
    const baseTemplate = await this.findById(baseTemplateId);
    if (!baseTemplate) {
      throw new Error('Base template not found');
    }

    // Get latest version number
    const { data: latestVersion } = await this.supabase
      .from('communication_templates')
      .select('version')
      .eq('notification_type', baseTemplate.notification_type)
      .eq('channel', baseTemplate.channel)
      .eq('language', baseTemplate.language)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestVersion?.version || 1) + 1;

    // Deactivate current default template
    await this.supabase
      .from('communication_templates')
      .update({ 
        is_default: false,
        updated_at: new Date().toISOString()
      })
      .eq('notification_type', baseTemplate.notification_type)
      .eq('channel', baseTemplate.channel)
      .eq('language', baseTemplate.language)
      .eq('is_default', true);

    // Create new version
    const newTemplate = {
      ...baseTemplate,
      id: undefined,
      subject: updates.subject || baseTemplate.subject,
      content_template: updates.content_template,
      variables: updates.variables || baseTemplate.variables,
      version: newVersion,
      version_notes: updates.version_notes,
      is_default: true,
      status: 'draft' as TemplateStatus,
      created_at: undefined,
      updated_at: undefined
    };

    return await this.create(newTemplate);
  }

  /**
   * Activate template version
   */
  async activateVersion(id: string): Promise<CommunicationTemplate> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Start transaction-like operations
    // Deactivate other versions
    await this.supabase
      .from('communication_templates')
      .update({ 
        status: 'inactive',
        is_default: false,
        updated_at: new Date().toISOString()
      })
      .eq('notification_type', template.notification_type)
      .eq('channel', template.channel)
      .eq('language', template.language)
      .neq('id', id);

    // Activate this version
    return await this.update(id, { 
      status: 'active',
      is_default: true
    });
  }

  /**
   * Preview template with sample data
   */
  async preview(
    id: string, 
    sampleData: Record<string, any>
  ): Promise<{
    rendered_subject: string;
    rendered_content: string;
    variables_used: string[];
    missing_variables: string[];
  }> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Import Handlebars for server-side rendering
    const Handlebars = require('handlebars');

    try {
      // Compile templates
      const subjectTemplate = Handlebars.compile(template.subject || '');
      const contentTemplate = Handlebars.compile(template.content_template);

      // Render with sample data
      const rendered_subject = subjectTemplate(sampleData);
      const rendered_content = contentTemplate(sampleData);

      // Find variables used in templates
      const subjectVars = (template.subject?.match(/\{\{([^}]+)\}\}/g) || [])
        .map(v => v.replace(/[{}]/g, '').trim());
      const contentVars = (template.content_template.match(/\{\{([^}]+)\}\}/g) || [])
        .map(v => v.replace(/[{}]/g, '').trim());
      
      const variables_used = [...new Set([...subjectVars, ...contentVars])];
      const missing_variables = variables_used.filter(v => !(v in sampleData));

      return {
        rendered_subject,
        rendered_content,
        variables_used,
        missing_variables
      };
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Validate template syntax
   */
  async validate(template: Pick<CommunicationTemplate, 'subject' | 'content_template' | 'variables'>): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Import Handlebars for validation
    const Handlebars = require('handlebars');

    try {
      // Test compilation
      if (template.subject) {
        Handlebars.compile(template.subject);
      }
      Handlebars.compile(template.content_template);

      // Check for required variables
      const contentVars = (template.content_template.match(/\{\{([^}]+)\}\}/g) || [])
        .map(v => v.replace(/[{}]/g, '').trim());
      
      const definedVars = template.variables?.map(v => v.name) || [];
      const undefinedVars = contentVars.filter(v => !definedVars.includes(v));
      
      if (undefinedVars.length > 0) {
        warnings.push(`Variables used but not defined: ${undefinedVars.join(', ')}`);
      }

      // Check for unused defined variables
      const unusedVars = definedVars.filter(v => !contentVars.includes(v));
      if (unusedVars.length > 0) {
        warnings.push(`Variables defined but not used: ${unusedVars.join(', ')}`);
      }

      // Content length checks
      if (template.content_template.length > 1600) {
        warnings.push('SMS content may exceed character limit when rendered');
      }

    } catch (error) {
      errors.push(`Template syntax error: ${error.message}`);
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get template usage statistics
   */
  async getUsageStats(
    id: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total_sent: number;
    successful_deliveries: number;
    failed_deliveries: number;
    success_rate: number;
    last_used: string | null;
  }> {
    let query = this.supabase
      .from('communication_notifications')
      .select('status, created_at')
      .eq('template_id', id);

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch template usage stats: ${error.message}`);
    }

    const stats = {
      total_sent: data?.length || 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      success_rate: 0,
      last_used: null as string | null
    };

    if (data && data.length > 0) {
      stats.successful_deliveries = data.filter(n => ['sent', 'delivered'].includes(n.status)).length;
      stats.failed_deliveries = data.filter(n => n.status === 'failed').length;
      stats.success_rate = (stats.successful_deliveries / stats.total_sent) * 100;
      stats.last_used = Math.max(...data.map(n => new Date(n.created_at).getTime()));
      stats.last_used = new Date(stats.last_used).toISOString();
    }

    return stats;
  }

  /**
   * Duplicate template to different language
   */
  async duplicateToLanguage(
    id: string, 
    targetLanguage: string,
    translations: {
      subject?: string;
      content_template: string;
      version_notes?: string;
    }
  ): Promise<CommunicationTemplate> {
    const sourceTemplate = await this.findById(id);
    if (!sourceTemplate) {
      throw new Error('Source template not found');
    }

    // Check if template already exists for target language
    const existingTemplate = await this.findByTypeChannelLanguage(
      sourceTemplate.notification_type,
      sourceTemplate.channel,
      targetLanguage
    );

    if (existingTemplate) {
      throw new Error(`Template already exists for language: ${targetLanguage}`);
    }

    // Create new template for target language
    const newTemplate = {
      ...sourceTemplate,
      id: undefined,
      language: targetLanguage,
      subject: translations.subject || sourceTemplate.subject,
      content_template: translations.content_template,
      version: 1,
      version_notes: translations.version_notes || `Translated from ${sourceTemplate.language}`,
      status: 'draft' as TemplateStatus,
      created_at: undefined,
      updated_at: undefined
    };

    return await this.create(newTemplate);
  }

  /**
   * Delete template (soft delete by setting status to deleted)
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('communication_templates')
      .update({ 
        status: 'deleted',
        is_default: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Restore deleted template
   */
  async restore(id: string): Promise<CommunicationTemplate> {
    return await this.update(id, { status: 'draft' });
  }

  /**
   * Get template history (all versions)
   */
  async getHistory(
    notificationType: NotificationType,
    channel: CommunicationChannel,
    language: string
  ): Promise<CommunicationTemplate[]> {
    const { data, error } = await this.supabase
      .from('communication_templates')
      .select('*')
      .eq('notification_type', notificationType)
      .eq('channel', channel)
      .eq('language', language)
      .order('version', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch template history: ${error.message}`);
    }

    return data || [];
  }
}