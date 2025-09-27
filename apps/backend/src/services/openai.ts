import OpenAI from 'openai';
import { ChatCompletionChunk } from 'openai/resources/chat/completions';

interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface StreamingChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamingResponse {
  chunk: string;
  isComplete: boolean;
  totalTokens?: number;
}

export class OpenAIService {
  private client: OpenAI;
  private config: OpenAIConfig;

  constructor(config?: Partial<OpenAIConfig>) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      maxTokens: 2000,
      temperature: 0.7,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey
    });
  }

  async *streamChatCompletion(
    messages: StreamingChatMessage[],
    systemPrompt?: string
  ): AsyncGenerator<StreamingResponse, void, unknown> {
    try {
      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      if (systemPrompt) {
        chatMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      chatMessages.push(...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: chatMessages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true
      });

      let totalTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content || '';
        const isComplete = chunk.choices[0]?.finish_reason !== null;

        if (chunk.usage) {
          totalTokens = chunk.usage.total_tokens || 0;
        }

        yield {
          chunk: content,
          isComplete,
          totalTokens: isComplete ? totalTokens : undefined
        };

        if (isComplete) {
          break;
        }
      }
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw new Error('Failed to stream chat completion');
    }
  }

  async getChatCompletion(
    messages: StreamingChatMessage[],
    systemPrompt?: string
  ): Promise<{ content: string; tokens: number }> {
    try {
      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      if (systemPrompt) {
        chatMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      chatMessages.push(...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: chatMessages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });

      const content = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;

      return { content, tokens };
    } catch (error) {
      console.error('OpenAI completion error:', error);
      throw new Error('Failed to get chat completion');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  getModel(): string {
    return this.config.model;
  }

  getMaxTokens(): number {
    return this.config.maxTokens;
  }
}

export const openAIService = new OpenAIService();