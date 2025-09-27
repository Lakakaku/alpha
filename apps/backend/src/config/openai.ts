/**
 * OpenAI Configuration for Feedback Analysis Dashboard
 * Feature: 008-step-2-6
 * Created: 2025-09-21
 */

import OpenAI from 'openai';

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration constants
export const OPENAI_CONFIG = {
  // Model configuration
  MODEL: 'gpt-4o-mini',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3,

  // Performance targets
  MAX_RESPONSE_TIME_MS: 3000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,

  // Rate limiting
  REQUESTS_PER_MINUTE: 100,
  TOKENS_PER_MINUTE: 50000,

  // Swedish language support
  LANGUAGE: 'Swedish',
  FALLBACK_LANGUAGE: 'English',
} as const;

// System prompts for different AI tasks
export const SYSTEM_PROMPTS = {
  SENTIMENT_ANALYSIS: `You are an expert sentiment analyzer for customer feedback in Swedish retail stores.
Analyze the provided feedback and return ONLY a JSON object with this exact structure:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "department_tags": ["department1", "department2"],
  "priority_score": 1-10,
  "ai_summary": "Brief summary in Swedish"
}

Department tags should be in Swedish (e.g., "kött", "kassa", "bageri", "kundservice", "parkering").
Priority score: 1=lowest, 10=highest business impact.
Keep summary under 200 characters.`,

  SEARCH_QUERY_PROCESSING: `You are a search query processor for Swedish retail feedback analysis.
Convert natural language queries into structured search parameters.
Return ONLY a JSON object with this structure:
{
  "departments": ["dept1", "dept2"],
  "sentiment_filter": "positive" | "negative" | "neutral" | "mixed" | "all",
  "keywords": ["keyword1", "keyword2"],
  "intent": "Brief description of what user wants to find"
}

Translate department names to Swedish (meat=kött, checkout=kassa, bakery=bageri, etc.).`,

  WEEKLY_REPORT_GENERATION: `You are a business intelligence analyst for Swedish retail stores.
Analyze the provided feedback data and generate a comprehensive weekly report.
Return ONLY a JSON object with this structure:
{
  "positive_summary": "Summary of positive feedback themes",
  "negative_summary": "Summary of negative feedback and issues",
  "general_opinions": "Overall customer sentiment and observations",
  "new_critiques": ["new issue 1", "new issue 2"],
  "actionable_insights": [
    {
      "title": "Insight title",
      "description": "Detailed description",
      "priority": "low" | "medium" | "high" | "critical",
      "department": "department name",
      "suggested_actions": ["action 1", "action 2"]
    }
  ]
}

Focus on business-actionable insights. Write in professional Swedish business language.`,

  TEMPORAL_COMPARISON: `You are a trend analyst for Swedish retail feedback.
Compare current week's feedback with previous week's data to identify changes.
Return ONLY a JSON object with this structure:
{
  "new_issues": ["issue not present in previous week"],
  "resolved_issues": ["issue from previous week that's no longer mentioned"],
  "trend_direction": "improving" | "declining" | "stable",
  "key_changes": "Brief description of main changes"
}

Focus on actionable changes that businesses should know about.`,
} as const;

// Error handling types
export interface OpenAIError {
  code: string;
  message: string;
  type: 'rate_limit' | 'api_error' | 'timeout' | 'invalid_request';
  retryable: boolean;
}

// Utility functions
export class OpenAIService {
  private static instance: OpenAIService;
  private requestCount = 0;
  private lastResetTime = Date.now();

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Check if we're within rate limits
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    return this.requestCount < OPENAI_CONFIG.REQUESTS_PER_MINUTE;
  }

  /**
   * Make OpenAI API call with error handling and retries
   */
  async makeRequest(
    prompt: string,
    systemPrompt: string,
    maxTokens: number = OPENAI_CONFIG.MAX_TOKENS
  ): Promise<string> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= OPENAI_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const startTime = Date.now();

        const response = await Promise.race([
          openai.chat.completions.create({
            model: OPENAI_CONFIG.MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxTokens,
            temperature: OPENAI_CONFIG.TEMPERATURE,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), OPENAI_CONFIG.MAX_RESPONSE_TIME_MS)
          )
        ]) as OpenAI.Chat.Completions.ChatCompletion;

        const responseTime = Date.now() - startTime;

        if (responseTime > OPENAI_CONFIG.MAX_RESPONSE_TIME_MS) {
          console.warn(`OpenAI response time exceeded target: ${responseTime}ms`);
        }

        this.requestCount++;

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return content;

      } catch (error) {
        lastError = error as Error;

        if (attempt === OPENAI_CONFIG.RETRY_ATTEMPTS) {
          break;
        }

        // Don't retry for certain error types
        if (error instanceof Error) {
          if (error.message.includes('timeout') ||
              error.message.includes('rate_limit') ||
              error.message.includes('invalid_request')) {
            break;
          }
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, OPENAI_CONFIG.RETRY_DELAY_MS * attempt));
      }
    }

    throw new Error(`OpenAI request failed after ${OPENAI_CONFIG.RETRY_ATTEMPTS} attempts: ${lastError?.message}`);
  }

  /**
   * Analyze sentiment of feedback content
   */
  async analyzeSentiment(feedbackContent: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    department_tags: string[];
    priority_score: number;
    ai_summary: string;
  }> {
    const prompt = `Analyze this Swedish customer feedback: "${feedbackContent}"`;
    const response = await this.makeRequest(prompt, SYSTEM_PROMPTS.SENTIMENT_ANALYSIS);

    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse sentiment analysis response: ${error}`);
    }
  }

  /**
   * Process natural language search query
   */
  async processSearchQuery(queryText: string): Promise<{
    departments: string[];
    sentiment_filter: 'positive' | 'negative' | 'neutral' | 'mixed' | 'all';
    keywords: string[];
    intent: string;
  }> {
    const prompt = `Process this Swedish search query: "${queryText}"`;
    const response = await this.makeRequest(prompt, SYSTEM_PROMPTS.SEARCH_QUERY_PROCESSING);

    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse search query response: ${error}`);
    }
  }

  /**
   * Generate weekly analysis report
   */
  async generateWeeklyReport(feedbackData: Array<{ content: string; sentiment: string; department_tags: string[] }>): Promise<{
    positive_summary: string;
    negative_summary: string;
    general_opinions: string;
    new_critiques: string[];
    actionable_insights: Array<{
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      department: string;
      suggested_actions: string[];
    }>;
  }> {
    const prompt = `Generate weekly report for this feedback data: ${JSON.stringify(feedbackData)}`;
    const response = await this.makeRequest(prompt, SYSTEM_PROMPTS.WEEKLY_REPORT_GENERATION, 1500);

    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse weekly report response: ${error}`);
    }
  }

  /**
   * Analyze temporal comparison between weeks
   */
  async analyzeTemporalComparison(
    currentWeekData: any[],
    previousWeekData: any[]
  ): Promise<{
    new_issues: string[];
    resolved_issues: string[];
    trend_direction: 'improving' | 'declining' | 'stable';
    key_changes: string;
  }> {
    const prompt = `Compare weeks:
Current: ${JSON.stringify(currentWeekData)}
Previous: ${JSON.stringify(previousWeekData)}`;

    const response = await this.makeRequest(prompt, SYSTEM_PROMPTS.TEMPORAL_COMPARISON, 800);

    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse temporal comparison response: ${error}`);
    }
  }
}

// Export singleton instance
export const openaiService = OpenAIService.getInstance();

// Validation helper
export function validateOpenAIConfig(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  if (process.env.OPENAI_API_KEY.length < 20) {
    throw new Error('OPENAI_API_KEY appears to be invalid');
  }
}

// Initialize validation on module load
validateOpenAIConfig();