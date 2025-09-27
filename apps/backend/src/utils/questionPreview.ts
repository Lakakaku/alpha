import { CustomQuestion } from '@vocilia/types';
import { performance } from 'perf_hooks';

export interface PreviewOptions {
  format?: 'responsive' | 'mobile' | 'desktop' | 'voice' | 'minimal';
  personalization?: Record<string, any>;
  includeStyles?: boolean;
  includeMetadata?: boolean;
  cacheKey?: string;
}

export interface PreviewResult {
  html: string;
  json: Record<string, any>;
  text: string;
  metadata?: {
    generationTime: number;
    cacheHit: boolean;
    format: string;
    questionType: string;
  };
}

export interface PreviewTemplate {
  html: string;
  placeholders: string[];
  cssClasses: string[];
}

export class QuestionPreviewService {
  private templateCache = new Map<string, PreviewTemplate>();
  private previewCache = new Map<string, { data: PreviewResult; timestamp: number }>();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Preload common templates
    this.initializeTemplates();
  }

  /**
   * Generate optimized preview with performance monitoring
   */
  async generatePreview(
    question: CustomQuestion,
    options: PreviewOptions = {}
  ): Promise<PreviewResult> {
    const startTime = performance.now();
    const format = options.format || 'responsive';
    
    // Generate cache key
    const cacheKey = options.cacheKey || this.generateCacheKey(question, options);
    
    // Check cache first
    const cached = this.getCachedPreview(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          generationTime: performance.now() - startTime,
          cacheHit: true,
        },
      };
    }

    // Generate new preview
    const result = await this.generateNewPreview(question, options);
    
    // Cache the result
    this.cachePreview(cacheKey, result);
    
    const generationTime = performance.now() - startTime;
    
    return {
      ...result,
      metadata: {
        generationTime,
        cacheHit: false,
        format,
        questionType: question.question_type,
      },
    };
  }

  /**
   * Generate cache key for preview
   */
  private generateCacheKey(question: CustomQuestion, options: PreviewOptions): string {
    const keyComponents = [
      question.id,
      question.updated_at?.toISOString() || '',
      options.format || 'responsive',
      JSON.stringify(options.personalization || {}),
      options.includeStyles ? 'styled' : 'plain',
      options.includeMetadata ? 'meta' : 'simple',
    ];
    
    return `preview_${keyComponents.join('_')}`;
  }

  /**
   * Get cached preview if available and not expired
   */
  private getCachedPreview(cacheKey: string): PreviewResult | null {
    const cached = this.previewCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.previewCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache preview result
   */
  private cachePreview(cacheKey: string, result: PreviewResult): void {
    this.previewCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    
    // Cleanup old cache entries if cache gets too large
    if (this.previewCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Generate new preview without cache
   */
  private async generateNewPreview(
    question: CustomQuestion,
    options: PreviewOptions
  ): Promise<PreviewResult> {
    const format = options.format || 'responsive';
    const personalization = options.personalization || {};
    
    // Use parallel generation for better performance
    const [html, json, text] = await Promise.all([
      this.generateHtmlPreview(question, format, options),
      this.generateJsonPreview(question, personalization),
      this.generateTextPreview(question, personalization),
    ]);
    
    return { html, json, text };
  }

  /**
   * Generate optimized HTML preview using templates
   */
  private async generateHtmlPreview(
    question: CustomQuestion,
    format: string,
    options: PreviewOptions
  ): Promise<string> {
    const template = this.getTemplate(question.question_type, format);
    const personalization = options.personalization || {};
    
    // Prepare substitution values
    const substitutions = {
      id: question.id,
      title: this.personalizeText(question.title, personalization),
      questionText: this.personalizeText(question.question_text, personalization),
      required: question.required ? 'required' : '',
      requiredIndicator: question.required ? '*' : '',
      cssClasses: template.cssClasses.join(' '),
      options: this.generateOptionsHtml(question, format),
      metadata: options.includeMetadata ? this.generateMetadataHtml(question) : '',
    };
    
    // Fast template substitution
    let html = template.html;
    for (const [key, value] of Object.entries(substitutions)) {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    // Add styles if requested
    if (options.includeStyles) {
      html = this.addInlineStyles(html, format);
    }
    
    return html;
  }

  /**
   * Generate JSON preview with minimal processing
   */
  private async generateJsonPreview(
    question: CustomQuestion,
    personalization: Record<string, any>
  ): Promise<Record<string, any>> {
    const hasPersonalization = Object.keys(personalization).length > 0;
    
    // Create optimized JSON structure
    const json: Record<string, any> = {
      id: question.id,
      type: question.question_type,
      required: question.required,
    };
    
    // Only personalize if needed
    if (hasPersonalization) {
      json.title = this.personalizeText(question.title, personalization);
      json.questionText = this.personalizeText(question.question_text, personalization);
      json.personalizationApplied = true;
    } else {
      json.title = question.title;
      json.questionText = question.question_text;
      json.personalizationApplied = false;
    }
    
    // Add options for relevant question types
    if (this.hasOptions(question.question_type)) {
      json.options = question.options;
    }
    
    // Add metadata selectively
    if (question.category) {
      json.category = question.category;
    }
    
    if (question.priority !== undefined) {
      json.priority = question.priority;
    }
    
    return json;
  }

  /**
   * Generate text preview optimized for voice interfaces
   */
  private async generateTextPreview(
    question: CustomQuestion,
    personalization: Record<string, any>
  ): Promise<string> {
    const title = this.personalizeText(question.title, personalization);
    const questionText = this.personalizeText(question.question_text, personalization);
    
    let output = `${title}\n\n${questionText}`;
    
    // Add options for relevant types
    if (this.hasOptions(question.question_type)) {
      const optionsText = this.generateOptionsText(question);
      if (optionsText) {
        output += `\n\n${optionsText}`;
      }
    }
    
    // Add required indicator
    if (question.required) {
      output += '\n\n* Required';
    }
    
    return output;
  }

  /**
   * Initialize template cache with common templates
   */
  private initializeTemplates(): void {
    // Responsive template for all question types
    this.templateCache.set('text_responsive', {
      html: `
        <div class="question-preview {{cssClasses}}" data-question-id="{{id}}">
          <h3 class="question-title">{{title}} {{requiredIndicator}}</h3>
          <p class="question-text">{{questionText}}</p>
          <div class="question-input">
            <textarea class="form-textarea" placeholder="Enter your response..." {{required}}></textarea>
          </div>
          {{metadata}}
        </div>
      `,
      placeholders: ['id', 'title', 'questionText', 'required', 'requiredIndicator', 'cssClasses', 'metadata'],
      cssClasses: ['question-preview', 'text-question', 'responsive'],
    });

    this.templateCache.set('multiple_choice_responsive', {
      html: `
        <div class="question-preview {{cssClasses}}" data-question-id="{{id}}">
          <h3 class="question-title">{{title}} {{requiredIndicator}}</h3>
          <p class="question-text">{{questionText}}</p>
          <div class="question-options">
            {{options}}
          </div>
          {{metadata}}
        </div>
      `,
      placeholders: ['id', 'title', 'questionText', 'options', 'requiredIndicator', 'cssClasses', 'metadata'],
      cssClasses: ['question-preview', 'multiple-choice-question', 'responsive'],
    });

    this.templateCache.set('scale_responsive', {
      html: `
        <div class="question-preview {{cssClasses}}" data-question-id="{{id}}">
          <h3 class="question-title">{{title}} {{requiredIndicator}}</h3>
          <p class="question-text">{{questionText}}</p>
          <div class="question-scale">
            {{options}}
          </div>
          {{metadata}}
        </div>
      `,
      placeholders: ['id', 'title', 'questionText', 'options', 'requiredIndicator', 'cssClasses', 'metadata'],
      cssClasses: ['question-preview', 'scale-question', 'responsive'],
    });

    // Voice-optimized templates
    this.templateCache.set('text_voice', {
      html: `
        <div class="voice-preview {{cssClasses}}" data-question-id="{{id}}">
          <div class="voice-prompt">
            <span class="voice-icon">🎤</span>
            <p class="voice-text">{{title}}: {{questionText}}</p>
          </div>
          {{metadata}}
        </div>
      `,
      placeholders: ['id', 'title', 'questionText', 'cssClasses', 'metadata'],
      cssClasses: ['voice-preview', 'text-question'],
    });

    // Mobile-optimized templates
    this.templateCache.set('multiple_choice_mobile', {
      html: `
        <div class="question-preview {{cssClasses}}" data-question-id="{{id}}">
          <h4 class="mobile-title">{{title}} {{requiredIndicator}}</h4>
          <p class="mobile-text">{{questionText}}</p>
          <div class="mobile-options">
            {{options}}
          </div>
          {{metadata}}
        </div>
      `,
      placeholders: ['id', 'title', 'questionText', 'options', 'requiredIndicator', 'cssClasses', 'metadata'],
      cssClasses: ['question-preview', 'multiple-choice-question', 'mobile'],
    });
  }

  /**
   * Get template for question type and format
   */
  private getTemplate(questionType: string, format: string): PreviewTemplate {
    const templateKey = `${questionType}_${format}`;
    
    // Try specific template first
    let template = this.templateCache.get(templateKey);
    
    // Fall back to responsive template
    if (!template) {
      template = this.templateCache.get(`${questionType}_responsive`);
    }
    
    // Fall back to generic template
    if (!template) {
      template = this.templateCache.get('text_responsive');
    }
    
    // Return default template if nothing found
    return template || {
      html: '<div class="question-preview">{{title}}: {{questionText}}</div>',
      placeholders: ['title', 'questionText'],
      cssClasses: ['question-preview', 'fallback'],
    };
  }

  /**
   * Generate options HTML for different question types
   */
  private generateOptionsHtml(question: CustomQuestion, format: string): string {
    if (!this.hasOptions(question.question_type) || !question.options) {
      return '';
    }

    switch (question.question_type) {
      case 'multiple_choice':
        return this.generateMultipleChoiceHtml(question.options, format);
      
      case 'checkbox':
        return this.generateCheckboxHtml(question.options, format);
      
      case 'scale':
        return this.generateScaleHtml(question.options, format);
      
      default:
        return '';
    }
  }

  /**
   * Generate multiple choice options HTML
   */
  private generateMultipleChoiceHtml(options: any, format: string): string {
    if (!options.choices || !Array.isArray(options.choices)) {
      return '';
    }

    const inputType = format === 'voice' ? 'button' : 'radio';
    const containerClass = format === 'mobile' ? 'mobile-option' : 'option';

    return options.choices.map((choice: string, index: number) => {
      if (inputType === 'button') {
        return `<button class="${containerClass} voice-option" data-value="${choice}">${choice}</button>`;
      } else {
        return `
          <div class="${containerClass}">
            <input type="radio" id="option${index}" name="question" value="${choice}">
            <label for="option${index}">${choice}</label>
          </div>
        `;
      }
    }).join('');
  }

  /**
   * Generate checkbox options HTML
   */
  private generateCheckboxHtml(options: any, format: string): string {
    if (!options.choices || !Array.isArray(options.choices)) {
      return '';
    }

    const containerClass = format === 'mobile' ? 'mobile-option' : 'option';

    return options.choices.map((choice: string, index: number) => `
      <div class="${containerClass}">
        <input type="checkbox" id="checkbox${index}" value="${choice}">
        <label for="checkbox${index}">${choice}</label>
      </div>
    `).join('');
  }

  /**
   * Generate scale options HTML
   */
  private generateScaleHtml(options: any, format: string): string {
    const min = options.min_value || 1;
    const max = options.max_value || 5;
    const containerClass = format === 'mobile' ? 'mobile-scale' : 'scale';

    if (format === 'voice') {
      return `<div class="voice-scale">Scale from ${min} to ${max}</div>`;
    }

    let html = `<div class="${containerClass}">`;
    for (let i = min; i <= max; i++) {
      html += `
        <div class="scale-option">
          <input type="radio" id="scale${i}" name="question" value="${i}">
          <label for="scale${i}">${i}</label>
        </div>
      `;
    }
    html += '</div>';

    return html;
  }

  /**
   * Generate options text for voice/text preview
   */
  private generateOptionsText(question: CustomQuestion): string {
    if (!this.hasOptions(question.question_type) || !question.options) {
      return '';
    }

    switch (question.question_type) {
      case 'multiple_choice':
      case 'checkbox':
        if (question.options.choices && Array.isArray(question.options.choices)) {
          return question.options.choices
            .map((choice: string, index: number) => `${index + 1}. ${choice}`)
            .join('\n');
        }
        break;
      
      case 'scale':
        const min = question.options.min_value || 1;
        const max = question.options.max_value || 5;
        return `Scale: ${min} to ${max}`;
      
      default:
        return '';
    }

    return '';
  }

  /**
   * Generate metadata HTML
   */
  private generateMetadataHtml(question: CustomQuestion): string {
    return `
      <div class="question-metadata">
        <small class="metadata-item">Type: ${question.question_type}</small>
        ${question.category ? `<small class="metadata-item">Category: ${question.category}</small>` : ''}
        ${question.priority ? `<small class="metadata-item">Priority: ${question.priority}</small>` : ''}
      </div>
    `;
  }

  /**
   * Add inline styles for standalone previews
   */
  private addInlineStyles(html: string, format: string): string {
    const styles = this.getInlineStyles(format);
    return `<style>${styles}</style>\n${html}`;
  }

  /**
   * Get inline CSS styles for format
   */
  private getInlineStyles(format: string): string {
    const baseStyles = `
      .question-preview { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
      .question-title { color: #1f2937; font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
      .question-text { color: #4b5563; margin-bottom: 1rem; }
      .option { margin-bottom: 0.5rem; }
      .option input { margin-right: 0.5rem; }
      .scale { display: flex; gap: 0.5rem; }
      .question-metadata { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
      .metadata-item { color: #6b7280; margin-right: 1rem; }
    `;

    switch (format) {
      case 'mobile':
        return baseStyles + `
          .question-preview { margin: 10px; font-size: 0.9rem; }
          .mobile-title { font-size: 1.1rem; }
          .mobile-options { display: flex; flex-direction: column; gap: 0.75rem; }
          .mobile-option { padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; }
        `;
      
      case 'voice':
        return baseStyles + `
          .voice-preview { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; }
          .voice-prompt { display: flex; align-items: center; gap: 0.5rem; }
          .voice-icon { font-size: 1.5rem; }
          .voice-option { margin: 0.25rem; padding: 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; }
        `;
      
      default:
        return baseStyles;
    }
  }

  /**
   * Fast text personalization using regex
   */
  private personalizeText(text: string, personalization: Record<string, any>): string {
    if (!text || Object.keys(personalization).length === 0) {
      return text;
    }

    let result = text;
    for (const [key, value] of Object.entries(personalization)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }

    return result;
  }

  /**
   * Check if question type has options
   */
  private hasOptions(questionType: string): boolean {
    return ['multiple_choice', 'checkbox', 'scale'].includes(questionType);
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.previewCache.entries());
    
    // Remove expired entries
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.previewCache.delete(key);
      }
    }
    
    // If still too large, remove oldest entries
    if (this.previewCache.size > 500) {
      const sortedEntries = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.previewCache.size - 500);
      
      for (const [key] of sortedEntries) {
        this.previewCache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.previewCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    previewCacheSize: number;
    templateCacheSize: number;
    hitRate?: number;
  } {
    return {
      previewCacheSize: this.previewCache.size,
      templateCacheSize: this.templateCache.size,
    };
  }

  /**
   * Batch generate previews for multiple questions
   */
  async batchGeneratePreviews(
    questions: CustomQuestion[],
    options: PreviewOptions = {}
  ): Promise<Map<string, PreviewResult>> {
    const results = new Map<string, PreviewResult>();
    
    // Process in batches of 10 for optimal performance
    const batchSize = 10;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (question) => {
        const result = await this.generatePreview(question, options);
        return [question.id, result] as [string, PreviewResult];
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const [id, result] of batchResults) {
        results.set(id, result);
      }
    }
    
    return results;
  }
}