import OpenAI from 'openai';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CallEvent } from '../../models/CallEvent';
import { CallResponse } from '../../models/CallResponse';

export interface VoiceSessionConfig {
  sessionId: string;
  businessId: string;
  questions: Array<{
    id: string;
    text: string;
    responseType: 'rating' | 'text' | 'boolean';
  }>;
  customerName?: string;
  businessName: string;
  maxDurationMinutes?: number;
}

export interface VoiceResponse {
  questionId: string;
  responseText: string;
  confidence: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  extractedValue?: string | number | boolean;
}

export class OpenAIVoiceService extends EventEmitter {
  private client: OpenAI;
  private websocket: WebSocket | null = null;
  private sessionConfig: VoiceSessionConfig | null = null;
  private currentQuestionIndex = 0;
  private conversationStartTime: Date | null = null;
  private responses: VoiceResponse[] = [];

  constructor() {
    super();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.client = new OpenAI({ apiKey });
  }

  async startVoiceSession(config: VoiceSessionConfig): Promise<void> {
    this.sessionConfig = config;
    this.currentQuestionIndex = 0;
    this.conversationStartTime = new Date();
    this.responses = [];

    try {
      // Create WebSocket connection to OpenAI Realtime API
      this.websocket = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.setupWebSocketHandlers();
      
      // Log session start
      await CallEvent.create({
        sessionId: config.sessionId,
        eventType: 'ai_session_started',
        providerId: 'openai',
        eventData: {
          model: 'gpt-4o-realtime-preview',
          questionsCount: config.questions.length,
          businessName: config.businessName
        }
      });

    } catch (error) {
      console.error('Failed to start OpenAI voice session:', error);
      
      await CallEvent.create({
        sessionId: config.sessionId,
        eventType: 'ai_session_failed',
        providerId: 'openai',
        eventData: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket || !this.sessionConfig) return;

    this.websocket.on('open', () => {
      console.log('OpenAI WebSocket connected');
      this.configureSession();
    });

    this.websocket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleOpenAIMessage(message);
      } catch (error) {
        console.error('Failed to parse OpenAI message:', error);
      }
    });

    this.websocket.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
      this.emit('error', error);
    });

    this.websocket.on('close', () => {
      console.log('OpenAI WebSocket closed');
      this.emit('session_ended');
    });
  }

  private configureSession(): void {
    if (!this.websocket || !this.sessionConfig) return;

    const systemPrompt = this.generateSystemPrompt();

    // Configure the session
    this.websocket.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: systemPrompt,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: [],
        tool_choice: 'none',
        temperature: 0.7,
        max_response_output_tokens: 'inf'
      }
    }));

    // Start the conversation
    this.startConversation();
  }

  private generateSystemPrompt(): string {
    const { businessName, customerName, questions } = this.sessionConfig!;
    
    return `Du är en AI-assistent som ringer från ${businessName} för att samla feedback från kunder. Du pratar svenska och är vänlig och professionell.

UPPGIFT:
- Ring till ${customerName ? customerName : 'kunden'} från ${businessName}
- Ställ ${questions.length} förbestämda frågor
- Håll samtalet kort (max 2 minuter)
- Var trevlig men effektiv

SAMTALSSTRUKTUR:
1. Hälsa och presentera dig från ${businessName}
2. Förklara kort syftet (feedback för förbättring)
3. Ställ frågorna en i taget
4. Vänta på svar efter varje fråga
5. Bekräfta svaret kort
6. Tacka och avsluta

FRÅGOR ATT STÄLLA:
${questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

RIKTLINJER:
- Använd naturligt svenskt språk
- Var tålmodig med kundernas svar
- Upprepa frågor om de inte förstås
- Håll svaren korta och relevanta
- Avsluta om kunden vill avbryta
- Markera tydligt när en fråga är besvarad

Börja samtalet nu.`;
  }

  private startConversation(): void {
    if (!this.websocket) return;

    const greeting = `Hej! Jag ringer från ${this.sessionConfig!.businessName}. Vi gör en kort kundundersökning för att förbättra vår service. Har du en minut för några snabba frågor?`;

    this.websocket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: greeting
          }
        ]
      }
    }));

    this.websocket.send(JSON.stringify({
      type: 'response.create'
    }));
  }

  private async handleOpenAIMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'session.created':
        console.log('OpenAI session created');
        break;

      case 'input_audio_buffer.speech_started':
        // Customer started speaking
        this.emit('customer_speaking_started');
        break;

      case 'input_audio_buffer.speech_stopped':
        // Customer stopped speaking
        this.emit('customer_speaking_stopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Customer's speech was transcribed
        await this.handleCustomerResponse(message.transcript);
        break;

      case 'response.audio.delta':
        // AI is speaking (audio chunk)
        this.emit('ai_audio', message.delta);
        break;

      case 'response.done':
        // AI finished responding
        this.handleAIResponseComplete(message.response);
        break;

      case 'error':
        console.error('OpenAI API error:', message.error);
        this.emit('error', new Error(message.error.message));
        break;
    }
  }

  private async handleCustomerResponse(transcript: string): Promise<void> {
    if (!this.sessionConfig) return;

    const currentQuestion = this.sessionConfig.questions[this.currentQuestionIndex];
    if (!currentQuestion) return;

    // Analyze and extract the response
    const response = await this.analyzeResponse(transcript, currentQuestion);
    this.responses.push(response);

    // Store the response in database
    await CallResponse.create({
      sessionId: this.sessionConfig.sessionId,
      questionId: currentQuestion.id,
      responseText: transcript,
      extractedValue: response.extractedValue,
      confidence: response.confidence,
      sentiment: response.sentiment
    });

    // Log the response
    await CallEvent.create({
      sessionId: this.sessionConfig.sessionId,
      eventType: 'question_answered',
      providerId: 'openai',
      eventData: {
        questionIndex: this.currentQuestionIndex,
        questionId: currentQuestion.id,
        responseText: transcript,
        confidence: response.confidence
      }
    });

    // Move to next question or end conversation
    this.currentQuestionIndex++;
    
    if (this.currentQuestionIndex < this.sessionConfig.questions.length) {
      await this.askNextQuestion();
    } else {
      await this.endConversation();
    }
  }

  private async analyzeResponse(transcript: string, question: any): Promise<VoiceResponse> {
    try {
      // Use OpenAI to analyze the response
      const analysis = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analysera kundens svar på feedback-frågan. Extrahera värdet baserat på svarstypen.

SVARSTYP: ${question.responseType}
FRÅGA: ${question.text}
KUNDERNAS SVAR: ${transcript}

Returnera JSON med:
- extractedValue: Extraherat värde (number för rating, boolean för yes/no, string för text)
- confidence: Säkerhet 0-1
- sentiment: positive/neutral/negative`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const result = JSON.parse(analysis.choices[0].message.content || '{}');
      
      return {
        questionId: question.id,
        responseText: transcript,
        confidence: result.confidence || 0.5,
        sentiment: result.sentiment,
        extractedValue: result.extractedValue
      };

    } catch (error) {
      console.error('Failed to analyze response:', error);
      
      return {
        questionId: question.id,
        responseText: transcript,
        confidence: 0.3,
        extractedValue: transcript
      };
    }
  }

  private async askNextQuestion(): Promise<void> {
    if (!this.websocket || !this.sessionConfig) return;

    const question = this.sessionConfig.questions[this.currentQuestionIndex];
    if (!question) return;

    this.websocket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Tack för svaret. Nästa fråga: ${question.text}`
          }
        ]
      }
    }));

    this.websocket.send(JSON.stringify({
      type: 'response.create'
    }));
  }

  private async endConversation(): Promise<void> {
    if (!this.websocket || !this.sessionConfig) return;

    const farewell = `Tack så mycket för din tid och dina svar! De hjälper oss att förbättra vår service. Ha en bra dag!`;

    this.websocket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: farewell
          }
        ]
      }
    }));

    this.websocket.send(JSON.stringify({
      type: 'response.create'
    }));

    // End session after farewell
    setTimeout(() => {
      this.endSession();
    }, 3000);
  }

  private handleAIResponseComplete(response: any): void {
    // AI finished speaking, ready for customer response
    this.emit('ai_response_complete', response);
  }

  async endSession(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.sessionConfig) {
      // Log session completion
      await CallEvent.create({
        sessionId: this.sessionConfig.sessionId,
        eventType: 'ai_session_completed',
        providerId: 'openai',
        eventData: {
          duration: this.conversationStartTime 
            ? Date.now() - this.conversationStartTime.getTime() 
            : 0,
          questionsAnswered: this.responses.length,
          totalQuestions: this.sessionConfig.questions.length
        }
      });
    }

    this.emit('session_ended');
  }

  getResponses(): VoiceResponse[] {
    return [...this.responses];
  }

  getCurrentQuestion(): number {
    return this.currentQuestionIndex;
  }

  isSessionActive(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }
}