import { OpenAIService } from './openai';
import { ContextEntry } from '../models/context-entry';
import { AISuggestion } from '../models/ai-suggestion';
import { ValidationResult } from '../models/validation-result';

interface SuggestionContext {
  storeId: string;
  existingContext: ContextEntry[];
  validationResult?: ValidationResult;
  recentMessages?: string[];
  userGoals?: string[];
}

interface SuggestionTemplate {
  type: 'context_addition' | 'context_improvement' | 'question_suggestion' | 'process_optimization';
  category: string;
  priority: 'high' | 'medium' | 'low';
  template: string;
  triggers: string[];
}

const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  {
    type: 'context_addition',
    category: 'business_info',
    priority: 'high',
    template: 'Add your business hours to help customers know when to visit and provide more relevant feedback.',
    triggers: ['missing_hours', 'low_business_info_score']
  },
  {
    type: 'context_addition',
    category: 'products_services',
    priority: 'high',
    template: 'Describe your main products or services so customers can give specific feedback about what matters most.',
    triggers: ['missing_offerings', 'low_products_services_score']
  },
  {
    type: 'context_improvement',
    category: 'customer_demographics',
    priority: 'medium',
    template: 'Define your target customer demographics to get more relevant feedback from the right audience.',
    triggers: ['vague_demographics', 'low_customer_demographics_score']
  },
  {
    type: 'context_addition',
    category: 'quality_standards',
    priority: 'medium',
    template: 'Set clear service quality expectations to help the AI focus feedback on areas that matter to your business.',
    triggers: ['missing_standards', 'low_quality_standards_score']
  },
  {
    type: 'process_optimization',
    category: 'operational_details',
    priority: 'low',
    template: 'Share your peak business hours to help optimize when customers are prompted for feedback.',
    triggers: ['missing_peak_hours', 'feedback_timing_issues']
  }
];

export class SuggestionGenerationService {
  private openAI: OpenAIService;

  constructor(openAI?: OpenAIService) {
    this.openAI = openAI || new OpenAIService();
  }

  async generateSuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    try {
      const suggestions: AISuggestion[] = [];

      const templateSuggestions = await this.generateTemplateSuggestions(context);
      suggestions.push(...templateSuggestions);

      const aiSuggestions = await this.generateAISuggestions(context);
      suggestions.push(...aiSuggestions);

      const contextualSuggestions = await this.generateContextualSuggestions(context);
      suggestions.push(...contextualSuggestions);

      return this.deduplicateAndRank(suggestions);
    } catch (error) {
      console.error('Suggestion generation error:', error);
      return [];
    }
  }

  async generateImprovementSuggestions(
    storeId: string,
    contextEntry: ContextEntry,
    allContext: ContextEntry[]
  ): Promise<AISuggestion[]> {
    try {
      const systemPrompt = `You are an expert business consultant helping improve store context information.
      
      Analyze the given context entry and suggest specific improvements that would make it more valuable for generating customer feedback questions.
      
      Focus on:
      - Clarity and specificity
      - Actionable details
      - Missing complementary information
      - Potential for better customer insights
      
      Return suggestions as JSON array:
      [
        {
          "type": "context_improvement",
          "category": "category_name",
          "title": "Specific improvement title",
          "description": "Detailed description of the improvement",
          "priority": "high|medium|low",
          "impact": "How this improves feedback quality"
        }
      ]`;

      const message = `Context entry to improve:
      Category: ${contextEntry.category}
      Type: ${contextEntry.type}
      Content: ${contextEntry.content}
      
      Related context in same category:
      ${this.getRelatedContext(contextEntry, allContext)}`;

      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: message }],
        systemPrompt
      );

      try {
        const parsed = JSON.parse(content);
        return this.convertToAISuggestions(parsed, storeId);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Improvement suggestion error:', error);
      return [];
    }
  }

  async generateQuestionSuggestions(
    storeId: string,
    contextEntries: ContextEntry[],
    feedbackGoals: string[] = []
  ): Promise<AISuggestion[]> {
    try {
      const contextSummary = this.summarizeContext(contextEntries);
      
      const systemPrompt = `You are an expert at creating customer feedback questions based on business context.
      
      Generate specific question suggestions that would gather valuable customer insights based on the business context provided.
      
      Focus on:
      - Questions that reveal customer experience details
      - Insights that help improve business operations
      - Feedback that aligns with business goals
      - Questions that are natural for customers to answer
      
      Return as JSON array:
      [
        {
          "type": "question_suggestion",
          "category": "relevant_category",
          "title": "Question suggestion title",
          "description": "The actual question and why it's valuable",
          "priority": "high|medium|low",
          "impact": "What insights this question provides"
        }
      ]`;

      const message = `Business context: ${contextSummary}
      
      Feedback goals: ${feedbackGoals.join(', ') || 'General customer experience improvement'}`;

      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: message }],
        systemPrompt
      );

      try {
        const parsed = JSON.parse(content);
        return this.convertToAISuggestions(parsed, storeId);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Question suggestion error:', error);
      return [];
    }
  }

  private async generateTemplateSuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];
    const triggers = this.identifyTriggers(context);

    for (const template of SUGGESTION_TEMPLATES) {
      const hasMatchingTrigger = template.triggers.some(trigger => triggers.includes(trigger));
      
      if (hasMatchingTrigger) {
        suggestions.push({
          id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          storeId: context.storeId,
          type: template.type,
          category: template.category,
          title: `Improve ${template.category.replace('_', ' ')}`,
          description: template.template,
          priority: template.priority,
          impact: 'Enhances context completeness and feedback quality',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return suggestions;
  }

  private async generateAISuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    try {
      const contextSummary = this.summarizeContext(context.existingContext);
      const recentActivity = context.recentMessages?.join('\n') || 'No recent activity';

      const systemPrompt = `You are an AI assistant helping business owners optimize their store context for better customer feedback.
      
      Based on the current context and recent conversation, suggest specific improvements that would help generate better, more targeted customer feedback questions.
      
      Return 2-3 high-value suggestions as JSON:
      [
        {
          "type": "context_addition|context_improvement|process_optimization",
          "category": "category_name",
          "title": "Actionable suggestion title",
          "description": "Specific description with clear next steps",
          "priority": "high|medium|low",
          "impact": "How this improves feedback collection"
        }
      ]`;

      const message = `Current context: ${contextSummary}
      
      Recent conversation: ${recentActivity}
      
      Validation score: ${context.validationResult?.overallScore || 'Not calculated'}`;

      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: message }],
        systemPrompt
      );

      try {
        const parsed = JSON.parse(content);
        return this.convertToAISuggestions(parsed, context.storeId);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('AI suggestion generation error:', error);
      return [];
    }
  }

  private async generateContextualSuggestions(context: SuggestionContext): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];

    if (context.validationResult) {
      const missingHighPriority = context.validationResult.missingFields
        .filter(field => field.priority === 'high')
        .slice(0, 2);

      for (const missing of missingHighPriority) {
        suggestions.push({
          id: `contextual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          storeId: context.storeId,
          type: 'context_addition',
          category: missing.category,
          title: `Add ${missing.field.replace('_', ' ')}`,
          description: `Adding ${missing.field.replace('_', ' ')} information will significantly improve your context completeness score.`,
          priority: 'high',
          impact: 'Increases context score and enables more targeted feedback questions',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return suggestions;
  }

  private identifyTriggers(context: SuggestionContext): string[] {
    const triggers: string[] = [];

    if (!context.validationResult) {
      return triggers;
    }

    if (context.validationResult.overallScore < 50) {
      triggers.push('low_overall_score');
    }

    for (const [category, score] of Object.entries(context.validationResult.categoryScores)) {
      if (score.percentage < 50) {
        triggers.push(`low_${category}_score`);
      }
    }

    const categoryTypes = this.groupContextByCategory(context.existingContext);
    
    if (!categoryTypes.business_info?.some(e => e.type.includes('hours'))) {
      triggers.push('missing_hours');
    }

    if (!categoryTypes.products_services?.length) {
      triggers.push('missing_offerings');
    }

    return triggers;
  }

  private deduplicateAndRank(suggestions: AISuggestion[]): AISuggestion[] {
    const unique = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => 
        s.category === suggestion.category && 
        s.type === suggestion.type &&
        s.title === suggestion.title
      )
    );

    return unique
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 8);
  }

  private convertToAISuggestions(parsed: any[], storeId: string): AISuggestion[] {
    return parsed.map(item => ({
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      storeId,
      type: item.type,
      category: item.category,
      title: item.title,
      description: item.description,
      priority: item.priority,
      impact: item.impact,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  private summarizeContext(contextEntries: ContextEntry[]): string {
    if (contextEntries.length === 0) {
      return "No context information available.";
    }

    const grouped = this.groupContextByCategory(contextEntries);
    
    return Object.entries(grouped)
      .map(([category, entries]) => 
        `${category}: ${entries.map(e => `${e.type} (${e.content.substring(0, 50)}...)`).join(', ')}`
      )
      .join('\n');
  }

  private groupContextByCategory(entries: ContextEntry[]): Record<string, ContextEntry[]> {
    return entries.reduce((acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = [];
      }
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<string, ContextEntry[]>);
  }

  private getRelatedContext(entry: ContextEntry, allContext: ContextEntry[]): string {
    const related = allContext.filter(e => 
      e.category === entry.category && e.id !== entry.id
    );

    if (related.length === 0) {
      return "No related context in this category.";
    }

    return related.map(e => `${e.type}: ${e.content}`).join('\n');
  }
}

export const suggestionGenerationService = new SuggestionGenerationService();