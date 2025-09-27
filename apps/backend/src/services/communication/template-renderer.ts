import Handlebars from 'handlebars';
import { format, formatDistance, isAfter, isBefore, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import type { 
  CommunicationTemplate,
  NotificationType,
  RecipientType 
} from '@vocilia/types';
import { CommunicationTemplateModel } from '@vocilia/database';

export interface RenderContext {
  recipient_type: RecipientType;
  recipient_id: string;
  language: string;
  timezone: string;
  data: Record<string, any>;
}

export interface RenderResult {
  success: boolean;
  subject?: string;
  content?: string;
  error?: string;
  metadata: {
    template_id: string;
    template_version: number;
    render_time_ms: number;
    character_count: number;
    estimated_segments: number;
  };
}

export class TemplateRendererService {
  private compiledCache: Map<string, CompiledTemplate> = new Map();
  private partialCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.registerCustomHelpers();
    this.registerPartials();
  }

  /**
   * Render template with context data
   */
  async renderTemplate(
    notificationType: NotificationType,
    channel: string,
    context: RenderContext
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      // Get active template
      const template = await CommunicationTemplateModel.getByTypeAndChannel(
        notificationType, 
        channel, 
        context.language
      );

      if (!template) {
        return {
          success: false,
          error: `No template found for ${notificationType} ${channel} ${context.language}`,
          metadata: {
            template_id: '',
            template_version: 0,
            render_time_ms: Date.now() - startTime,
            character_count: 0,
            estimated_segments: 0
          }
        };
      }

      // Get compiled template
      const compiled = await this.getCompiledTemplate(template);

      // Prepare render data
      const renderData = this.prepareRenderData(context);

      // Render content
      const content = compiled.content(renderData);
      let subject: string | undefined;

      if (template.subject) {
        subject = compiled.subject ? compiled.subject(renderData) : template.subject;
      }

      const characterCount = content.length;
      const estimatedSegments = this.calculateSMSSegments(content);

      return {
        success: true,
        subject,
        content,
        metadata: {
          template_id: template.id,
          template_version: template.version,
          render_time_ms: Date.now() - startTime,
          character_count: characterCount,
          estimated_segments: estimatedSegments
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown rendering error',
        metadata: {
          template_id: '',
          template_version: 0,
          render_time_ms: Date.now() - startTime,
          character_count: 0,
          estimated_segments: 0
        }
      };
    }
  }

  /**
   * Render template by ID with custom data
   */
  async renderTemplateById(
    templateId: string,
    data: Record<string, any>,
    language: string = 'sv'
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      const template = await CommunicationTemplateModel.getById(templateId);
      if (!template) {
        return {
          success: false,
          error: 'Template not found',
          metadata: {
            template_id: templateId,
            template_version: 0,
            render_time_ms: Date.now() - startTime,
            character_count: 0,
            estimated_segments: 0
          }
        };
      }

      const compiled = await this.getCompiledTemplate(template);
      const renderData = this.prepareRenderData({
        recipient_type: 'customer',
        recipient_id: 'preview',
        language,
        timezone: 'Europe/Stockholm',
        data
      });

      const content = compiled.content(renderData);
      let subject: string | undefined;

      if (template.subject && compiled.subject) {
        subject = compiled.subject(renderData);
      }

      const characterCount = content.length;
      const estimatedSegments = this.calculateSMSSegments(content);

      return {
        success: true,
        subject,
        content,
        metadata: {
          template_id: template.id,
          template_version: template.version,
          render_time_ms: Date.now() - startTime,
          character_count: characterCount,
          estimated_segments: estimatedSegments
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown rendering error',
        metadata: {
          template_id: templateId,
          template_version: 0,
          render_time_ms: Date.now() - startTime,
          character_count: 0,
          estimated_segments: 0
        }
      };
    }
  }

  /**
   * Batch render multiple templates
   */
  async renderBatch(requests: Array<{
    notificationType: NotificationType;
    channel: string;
    context: RenderContext;
  }>): Promise<RenderResult[]> {
    const results = await Promise.all(
      requests.map(req => this.renderTemplate(req.notificationType, req.channel, req.context))
    );

    return results;
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(templateId: string): Promise<RenderResult & { sampleData: Record<string, any> }> {
    const template = await CommunicationTemplateModel.getById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const sampleData = this.generateSampleData(template.variables);
    const result = await this.renderTemplateById(templateId, sampleData);

    return {
      ...result,
      sampleData
    };
  }

  /**
   * Get or compile template
   */
  private async getCompiledTemplate(template: CommunicationTemplate): Promise<CompiledTemplate> {
    const cacheKey = `${template.id}-${template.version}`;
    
    let compiled = this.compiledCache.get(cacheKey);
    if (!compiled) {
      try {
        const contentCompiled = Handlebars.compile(template.content, {
          noEscape: false,
          strict: false
        });

        let subjectCompiled: HandlebarsTemplateDelegate | undefined;
        if (template.subject) {
          subjectCompiled = Handlebars.compile(template.subject, {
            noEscape: false,
            strict: false
          });
        }

        compiled = {
          template,
          content: contentCompiled,
          subject: subjectCompiled
        };

        this.compiledCache.set(cacheKey, compiled);
      } catch (error) {
        throw new Error(`Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return compiled;
  }

  /**
   * Prepare data for template rendering
   */
  private prepareRenderData(context: RenderContext): Record<string, any> {
    const now = new Date();
    const timeZone = context.timezone || 'Europe/Stockholm';

    return {
      ...context.data,
      // System variables
      company_name: 'Vocilia',
      support_phone: process.env.SUPPORT_PHONE_NUMBER || '+46 8 123 456',
      support_email: process.env.SUPPORT_EMAIL || 'support@vocilia.se',
      website_url: process.env.WEBSITE_URL || 'https://vocilia.se',
      
      // Date/time variables
      today: format(now, 'yyyy-MM-dd', { locale: sv }),
      today_long: format(now, 'EEEE, d MMMM yyyy', { locale: sv }),
      time: format(now, 'HH:mm'),
      year: now.getFullYear(),
      month: format(now, 'MMMM', { locale: sv }),
      week: format(now, 'w', { locale: sv }),
      
      // User context
      recipient_type: context.recipient_type,
      recipient_id: context.recipient_id,
      language: context.language,
      
      // Utility functions for templates
      is_business: context.recipient_type === 'business',
      is_customer: context.recipient_type === 'customer',
      is_swedish: context.language === 'sv',
      is_english: context.language === 'en'
    };
  }

  /**
   * Calculate SMS segments for character count
   */
  private calculateSMSSegments(content: string): number {
    // SMS encoding logic:
    // - Basic GSM 7-bit: 160 chars per segment
    // - UCS-2 (Unicode): 70 chars per segment
    // - Swedish characters (åäö) use GSM 7-bit extended
    
    const hasUnicodeChars = /[^\x00-\x7F]/.test(content) && !/^[åäöÅÄÖ]*$/.test(content.match(/[^\x00-\x7F]/g)?.join('') || '');
    const charsPerSegment = hasUnicodeChars ? 67 : 153; // Concatenated SMS has less chars per segment
    
    if (content.length <= (hasUnicodeChars ? 70 : 160)) {
      return 1;
    }
    
    return Math.ceil(content.length / charsPerSegment);
  }

  /**
   * Generate sample data for template variables
   */
  private generateSampleData(variables: string[]): Record<string, any> {
    const samples: Record<string, any> = {};

    const sampleMappings: Record<string, any> = {
      // Customer data
      customer_name: 'Anna Andersson',
      customer_phone: '+46 70 123 45 67',
      customer_email: 'anna.andersson@example.com',
      
      // Business data
      business_name: 'Café Stockholm AB',
      store_name: 'Café Stockholm Södermalm',
      store_address: 'Götgatan 123, Stockholm',
      
      // Financial data
      reward_amount: '25.50',
      payment_amount: '125.00',
      total_amount: '250.75',
      admin_fee: '50.15',
      currency: 'SEK',
      
      // Transaction data
      transaction_id: 'TX20250925001',
      batch_id: 'B20250925001',
      reference_number: 'REF123456',
      
      // Dates
      due_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      verification_deadline: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'dd/MM yyyy'),
      
      // Support data
      ticket_id: 'SUP-2025-001',
      ticket_status: 'open',
      response_time: '2 timmar',
      
      // Scores and ratings
      quality_score: '85',
      feedback_rating: '4.5',
      performance_score: '92',
      
      // Counts and statistics
      feedback_count: '15',
      reward_count: '8',
      total_rewards: '425.50',
      
      // System data
      maintenance_start: '23:00',
      maintenance_end: '01:00',
      system_status: 'operational',
      
      // Boolean flags
      is_urgent: false,
      is_reminder: true,
      is_final_notice: false,
      
      // Arrays (for #each loops)
      items: [
        { name: 'Feedback #1', amount: '12.50' },
        { name: 'Feedback #2', amount: '8.25' },
        { name: 'Feedback #3', amount: '15.75' }
      ],
      
      stores: [
        { name: 'Café Stockholm City', rewards: '45.00' },
        { name: 'Café Stockholm Söder', rewards: '32.50' }
      ]
    };

    variables.forEach(variable => {
      if (sampleMappings.hasOwnProperty(variable)) {
        samples[variable] = sampleMappings[variable];
      } else {
        // Generate reasonable default based on variable name
        if (variable.includes('amount') || variable.includes('price')) {
          samples[variable] = '99.50';
        } else if (variable.includes('date')) {
          samples[variable] = format(new Date(), 'yyyy-MM-dd');
        } else if (variable.includes('time')) {
          samples[variable] = format(new Date(), 'HH:mm');
        } else if (variable.includes('count') || variable.includes('number')) {
          samples[variable] = '5';
        } else if (variable.includes('id')) {
          samples[variable] = 'ID123456';
        } else if (variable.includes('name')) {
          samples[variable] = 'Exempel Namn';
        } else {
          samples[variable] = `[${variable}]`;
        }
      }
    });

    return samples;
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerCustomHelpers(): void {
    // Currency formatting
    Handlebars.registerHelper('currency', function(amount: string | number, currency: string = 'SEK') {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: currency
      }).format(num);
    });

    // Date formatting
    Handlebars.registerHelper('date', function(date: string | Date, formatStr: string = 'yyyy-MM-dd') {
      const d = typeof date === 'string' ? parseISO(date) : date;
      return format(d, formatStr, { locale: sv });
    });

    // Relative date (e.g., "om 5 dagar")
    Handlebars.registerHelper('dateFromNow', function(date: string | Date) {
      const d = typeof date === 'string' ? parseISO(date) : date;
      return formatDistance(d, new Date(), { 
        locale: sv, 
        addSuffix: true 
      });
    });

    // Conditional helpers
    Handlebars.registerHelper('if_eq', function(a: any, b: any, options: any) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('if_gt', function(a: number, b: number, options: any) {
      return a > b ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('if_lt', function(a: number, b: number, options: any) {
      return a < b ? options.fn(this) : options.inverse(this);
    });

    // String helpers
    Handlebars.registerHelper('upper', function(str: string) {
      return str ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lower', function(str: string) {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('capitalize', function(str: string) {
      return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    });

    Handlebars.registerHelper('truncate', function(str: string, length: number) {
      if (!str || str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // Math helpers
    Handlebars.registerHelper('add', function(a: number, b: number) {
      return a + b;
    });

    Handlebars.registerHelper('subtract', function(a: number, b: number) {
      return a - b;
    });

    Handlebars.registerHelper('multiply', function(a: number, b: number) {
      return a * b;
    });

    Handlebars.registerHelper('percentage', function(value: number, total: number) {
      return Math.round((value / total) * 100);
    });

    // Swedish language helpers
    Handlebars.registerHelper('plural_sv', function(count: number, singular: string, plural: string) {
      return count === 1 ? singular : plural;
    });

    // SMS optimization helper
    Handlebars.registerHelper('sms_optimize', function(text: string) {
      return text
        .replace(/och/g, '&')
        .replace(/kr/g, 'kr')
        .replace(/kronor/g, 'kr');
    });

    // Safe output (prevent XSS in dynamic content)
    Handlebars.registerHelper('safe', function(str: string) {
      return new Handlebars.SafeString(str);
    });
  }

  /**
   * Register common template partials
   */
  private registerPartials(): void {
    // Common footer partial
    Handlebars.registerPartial('footer', 
      'Mvh Vocilia | Support: {{support_phone}} | {{website_url}}'
    );

    // Opt-out partial for SMS
    Handlebars.registerPartial('sms_optout', 
      'Svara STOPP för att avsluta SMS.'
    );

    // Company signature
    Handlebars.registerPartial('signature', 
      'Med vänlig hälsning\nVocilia Team'
    );

    // Support contact
    Handlebars.registerPartial('support_contact', 
      'Behöver du hjälp? Kontakta oss på {{support_phone}} eller {{support_email}}'
    );
  }

  /**
   * Clear compiled template cache
   */
  clearCache(): void {
    this.compiledCache.clear();
    this.partialCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    compiled_templates: number;
    partials: number;
    memory_usage_mb: number;
  } {
    return {
      compiled_templates: this.compiledCache.size,
      partials: this.partialCache.size,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  }
}

interface CompiledTemplate {
  template: CommunicationTemplate;
  content: HandlebarsTemplateDelegate;
  subject?: HandlebarsTemplateDelegate;
}