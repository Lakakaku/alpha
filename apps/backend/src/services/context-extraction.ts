import { OpenAIService } from './openai';
import { ContextEntry } from '../models/context-entry';
import { AISuggestion } from '../models/ai-suggestion';

interface ExtractedContext {
  category: string;
  type: string;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

interface ContextExtractionResult {
  extracted: ExtractedContext[];
  suggestions: string[];
  gaps: string[];
}

export class ContextExtractionService {
  private openAI: OpenAIService;

  constructor(openAI?: OpenAIService) {
    this.openAI = openAI || new OpenAIService();
  }

  async extractContextFromMessage(
    message: string,
    storeId: string,
    existingContext: ContextEntry[] = []
  ): Promise<ContextExtractionResult> {
    try {
      const systemPrompt = this.buildExtractionPrompt(existingContext);
      
      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: message }],
        systemPrompt
      );

      return this.parseExtractionResponse(content);
    } catch (error) {
      console.error('Context extraction error:', error);
      throw new Error('Failed to extract context from message');
    }
  }

  async identifyContextGaps(
    storeId: string,
    existingContext: ContextEntry[]
  ): Promise<string[]> {
    try {
      const contextSummary = this.summarizeExistingContext(existingContext);
      
      const systemPrompt = `You are an expert at identifying missing information for business context.
      
      Required context categories for a business store:
      - Business Information: name, type, size, hours, location
      - Products/Services: main offerings, specialties, price ranges
      - Customer Demographics: target audience, typical customers
      - Store Environment: atmosphere, layout, unique features
      - Operational Details: staff size, peak hours, processes
      - Goals & Challenges: business objectives, pain points
      - Quality Standards: service expectations, standards
      
      Analyze the existing context and identify specific gaps that would help improve customer feedback quality.
      Return a JSON array of strings describing specific missing information.`;

      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: `Existing context: ${contextSummary}` }],
        systemPrompt
      );

      try {
        return JSON.parse(content);
      } catch {
        return this.parseGapsFromText(content);
      }
    } catch (error) {
      console.error('Gap identification error:', error);
      return [];
    }
  }

  async generateContextSuggestions(
    storeId: string,
    existingContext: ContextEntry[],
    gaps: string[]
  ): Promise<AISuggestion[]> {
    try {
      const contextSummary = this.summarizeExistingContext(existingContext);
      
      const systemPrompt = `You are an AI assistant helping business owners build comprehensive store context.
      
      Based on the existing context and identified gaps, generate specific, actionable suggestions for improving the store context.
      Each suggestion should be practical and help gather better customer feedback.
      
      Return suggestions as a JSON array with this format:
      [
        {
          "type": "context_addition",
          "category": "category_name",
          "title": "Suggestion Title",
          "description": "Detailed description",
          "priority": "high|medium|low",
          "impact": "Brief impact description"
        }
      ]`;

      const message = `Existing context: ${contextSummary}\n\nIdentified gaps: ${gaps.join(', ')}`;
      
      const { content } = await this.openAI.getChatCompletion(
        [{ role: 'user', content: message }],
        systemPrompt
      );

      try {
        const parsed = JSON.parse(content);
        return parsed.map((suggestion: any) => ({
          id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          storeId,
          type: suggestion.type,
          category: suggestion.category,
          title: suggestion.title,
          description: suggestion.description,
          priority: suggestion.priority,
          impact: suggestion.impact,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Suggestion generation error:', error);
      return [];
    }
  }

  private buildExtractionPrompt(existingContext: ContextEntry[]): string {
    const contextSummary = this.summarizeExistingContext(existingContext);
    
    return `You are an AI assistant that extracts structured business context from natural language.

    Extract information that falls into these categories:
    - business_info: name, type, size, hours, location
    - products_services: offerings, specialties, prices
    - customer_demographics: target audience, typical customers
    - store_environment: atmosphere, layout, features
    - operational_details: staff, hours, processes
    - goals_challenges: objectives, pain points
    - quality_standards: service expectations, standards

    Existing context: ${contextSummary}

    From the user's message, extract new information and return as JSON:
    {
      "extracted": [
        {
          "category": "category_name",
          "type": "specific_type",
          "content": "extracted content",
          "confidence": 0.95,
          "metadata": {}
        }
      ],
      "suggestions": ["suggestion 1", "suggestion 2"],
      "gaps": ["missing info 1", "missing info 2"]
    }`;
  }

  private summarizeExistingContext(context: ContextEntry[]): string {
    if (context.length === 0) {
      return "No existing context available.";
    }

    const grouped = context.reduce((acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = [];
      }
      acc[entry.category].push(`${entry.type}: ${entry.content}`);
      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(grouped)
      .map(([category, entries]) => `${category}: ${entries.join(', ')}`)
      .join('\n');
  }

  private parseExtractionResponse(response: string): ContextExtractionResult {
    try {
      return JSON.parse(response);
    } catch {
      return {
        extracted: [],
        suggestions: [],
        gaps: []
      };
    }
  }

  private parseGapsFromText(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    return lines
      .filter(line => line.includes('-') || line.match(/^\d+\./))
      .map(line => line.replace(/^[-\d.\s]+/, '').trim())
      .filter(gap => gap.length > 10);
  }
}

export const contextExtractionService = new ContextExtractionService();