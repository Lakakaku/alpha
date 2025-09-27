import { 
  TelephonyService, 
  CallInitiateOptions, 
  CallInitiateResponse, 
  CallStatusResponse,
  TelephonyWebhookEvent,
  ProviderCapabilities,
  PROVIDER_CONFIGS,
  validateSwedishPhoneNumber
} from '@vocilia/types';
import { TelephonyProviderLogModel } from '../../models/TelephonyProviderLog';

interface FortyElksConfig {
  username: string;
  password: string;
  baseUrl: string;
  webhookUrl: string;
}

export class FortyElksService implements TelephonyService {
  provider = '46elks' as const;
  private config: FortyElksConfig;

  constructor() {
    this.config = {
      username: process.env.FORTYELKS_USERNAME || '',
      password: process.env.FORTYELKS_PASSWORD || '',
      baseUrl: process.env.FORTYELKS_BASE_URL || 'https://api.46elks.com',
      webhookUrl: process.env.FORTYELKS_WEBHOOK_URL || '',
    };

    if (!this.config.username || !this.config.password) {
      throw new Error('46elks credentials not configured');
    }
  }

  async initiateCall(options: CallInitiateOptions): Promise<CallInitiateResponse> {
    try {
      // Validate Swedish phone number
      if (!validateSwedishPhoneNumber(options.to)) {
        throw new Error('Invalid Swedish phone number format');
      }

      const payload = {
        to: options.to,
        from: options.from || process.env.FORTYELKS_FROM_NUMBER || '+46766861647',
        voice_start: `${this.config.webhookUrl}/voice-start`,
        timeout: options.timeout || 30,
        record: options.record !== false,
        webhook: `${this.config.webhookUrl}/webhook`,
      };

      const startTime = Date.now();
      
      const response = await fetch(`${this.config.baseUrl}/a1/calls`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload as any),
      });

      const latency = Date.now() - startTime;
      const responseData = await response.json();

      // Log the API call
      await this.logApiCall('initiate', payload, responseData, response.status, latency, response.ok);

      if (!response.ok) {
        return {
          callId: '',
          status: 'failed',
          message: responseData.message || `46elks API error: ${response.status}`,
          cost: 0,
        };
      }

      return {
        callId: responseData.id,
        status: 'initiated',
        cost: this.estimateCallCost(options.maxDuration || 120),
        estimatedDuration: options.maxDuration || 120,
      };

    } catch (error) {
      console.error('46elks initiate call error:', error);
      
      // Log the error
      await this.logApiCall('initiate', options, { error: error.message }, 0, 0, false);

      return {
        callId: '',
        status: 'failed',
        message: error.message,
        cost: 0,
      };
    }
  }

  async getCallStatus(callId: string): Promise<CallStatusResponse> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.config.baseUrl}/a1/calls/${callId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
        },
      });

      const latency = Date.now() - startTime;
      const responseData = await response.json();

      // Log the API call
      await this.logApiCall('status', { callId }, responseData, response.status, latency, response.ok);

      if (!response.ok) {
        throw new Error(`Failed to get call status: ${response.status}`);
      }

      return {
        callId: responseData.id,
        status: this.mapFortyElksStatus(responseData.state),
        duration: responseData.duration ? parseInt(responseData.duration) : undefined,
        cost: responseData.cost ? parseFloat(responseData.cost) : undefined,
        recordingUrl: responseData.recording || undefined,
        hangupCause: responseData.hangup_cause || undefined,
      };

    } catch (error) {
      console.error('46elks get call status error:', error);
      throw new Error(`Failed to get call status: ${error.message}`);
    }
  }

  async hangupCall(callId: string): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.config.baseUrl}/a1/calls/${callId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ state: 'hangup' }),
      });

      const latency = Date.now() - startTime;
      const responseData = await response.json();

      // Log the API call
      await this.logApiCall('hangup', { callId }, responseData, response.status, latency, response.ok);

      return response.ok;

    } catch (error) {
      console.error('46elks hangup call error:', error);
      return false;
    }
  }

  async getRecording(callId: string): Promise<string | null> {
    try {
      const status = await this.getCallStatus(callId);
      return status.recordingUrl || null;
    } catch (error) {
      console.error('46elks get recording error:', error);
      return null;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return PROVIDER_CONFIGS['46elks'];
  }

  validateWebhook(payload: any, signature?: string): boolean {
    // 46elks doesn't use signature validation by default
    // In production, you might want to validate the webhook came from a trusted source
    return true;
  }

  parseWebhookEvent(payload: any): TelephonyWebhookEvent {
    const eventTypeMap: Record<string, any> = {
      'call_created': 'call_initiated',
      'call_completed': 'call_completed',
      'call_failed': 'call_failed',
      'call_answered': 'call_answered',
    };

    return {
      eventType: eventTypeMap[payload.event] || payload.event,
      callId: payload.id,
      timestamp: new Date().toISOString(),
      data: {
        direction: payload.direction,
        from: payload.from,
        to: payload.to,
        state: payload.state,
        duration: payload.duration,
        cost: payload.cost,
        recording: payload.recording,
        created: payload.created,
      },
    };
  }

  private mapFortyElksStatus(state: string): CallStatusResponse['status'] {
    const statusMap: Record<string, CallStatusResponse['status']> = {
      'ongoing': 'answered',
      'completed': 'completed',
      'failed': 'failed',
      'busy': 'busy',
      'no-answer': 'failed',
      'timeout': 'failed',
    };

    return statusMap[state] || 'failed';
  }

  private estimateCallCost(durationSeconds: number): number {
    const costPerMinute = PROVIDER_CONFIGS['46elks'].costPerMinute;
    const minutes = Math.ceil(durationSeconds / 60);
    return minutes * costPerMinute;
  }

  private async logApiCall(
    operation: string,
    request: any,
    response: any,
    statusCode: number,
    latency: number,
    success: boolean
  ): Promise<void> {
    try {
      await TelephonyProviderLogModel.create({
        call_session_id: '', // This would be set by the caller
        provider: '46elks',
        provider_call_id: response.id || '',
        operation: operation as any,
        request_payload: request,
        response_payload: response,
        status_code: statusCode,
        latency_ms: latency,
        success,
        error_message: success ? null : (response.error || response.message || 'Unknown error'),
      });
    } catch (error) {
      console.warn('Failed to log 46elks API call:', error);
    }
  }

  // Voice instruction handling for 46elks
  generateVoiceInstructions(sessionId: string, aiServiceUrl: string): string {
    // This would return TwiML-like instructions for 46elks
    // 46elks uses a simple JSON format for voice instructions
    return JSON.stringify({
      connect: {
        websocket: {
          url: `${aiServiceUrl}/voice/${sessionId}`,
          content_type: 'audio/raw;rate=8000',
        },
      },
    });
  }

  // Helper method for webhook handling
  async handleWebhookEvent(payload: any, sessionId?: string): Promise<void> {
    try {
      const event = this.parseWebhookEvent(payload);
      
      // Update call session if sessionId is provided
      if (sessionId) {
        const { CallSessionModel } = await import('../../models/CallSession');
        const { CallEventModel } = await import('../../models/CallEvent');

        switch (event.eventType) {
          case 'call_answered':
            await CallSessionModel.updateStatus(sessionId, 'in_progress', {
              connected_at: new Date().toISOString(),
            });
            await CallEventModel.createAnsweredEvent(sessionId, event.data);
            break;

          case 'call_completed':
            const duration = event.data.duration ? parseInt(event.data.duration) : 0;
            const cost = event.data.cost ? parseFloat(event.data.cost) : 0;
            
            await CallSessionModel.updateStatus(sessionId, 'completed', {
              ended_at: new Date().toISOString(),
              duration_seconds: duration,
              cost_estimate: cost,
              recording_url: event.data.recording,
            });
            await CallEventModel.createCompletedEvent(sessionId, event.data);
            break;

          case 'call_failed':
            await CallSessionModel.updateStatus(sessionId, 'failed', {
              ended_at: new Date().toISOString(),
            });
            await CallEventModel.createFailedEvent(sessionId, {
              reason: 'telephony_failure',
              provider_error: event.data,
            });
            break;
        }
      }

      // Log the webhook event
      await this.logApiCall('webhook', payload, event, 200, 0, true);

    } catch (error) {
      console.error('Error handling 46elks webhook:', error);
      throw error;
    }
  }

  // Testing and diagnostics
  async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.config.baseUrl}/a1/me`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
        },
      });

      const latency = Date.now() - startTime;
      const responseData = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: `Connected to 46elks as ${responseData.name}`,
          latency,
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${responseData.message || response.status}`,
          latency,
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
  }

  async getAccountBalance(): Promise<{ balance: number; currency: string } | null> {
    try {
      const response = await fetch(`${this.config.baseUrl}/a1/me`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          balance: parseFloat(data.balance || '0'),
          currency: data.currency || 'SEK',
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting 46elks account balance:', error);
      return null;
    }
  }
}

// Mock TelephonyProviderLogModel for now
class TelephonyProviderLogModel {
  static async create(data: any) {
    console.log('46elks API call logged:', data);
    return { id: 'mock-log-id', ...data };
  }
}