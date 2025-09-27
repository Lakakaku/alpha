import { TelephonyProvider, CallInitiateOptions, CallInitiateResponse, CallStatus, TelephonyWebhookPayload, TelephonyConfig } from '@vocilia/types';
import { CallEvent } from '../../models/CallEvent';
import { CallSession } from '../../models/CallSession';
import Twilio from 'twilio';

export class TwilioService implements TelephonyProvider {
  private client: Twilio.Twilio;
  private config: TelephonyConfig;

  constructor(config?: TelephonyConfig) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = Twilio(accountSid, authToken);
    this.config = {
      providerId: 'twilio',
      webhookUrl: process.env.TWILIO_WEBHOOK_URL || 'http://localhost:3000/api/calls/webhooks/twilio',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '+46812345678',
      ...config
    };
  }

  async initiateCall(options: CallInitiateOptions): Promise<CallInitiateResponse> {
    try {
      const call = await this.client.calls.create({
        to: options.to,
        from: options.from || this.config.fromNumber,
        url: `${this.config.webhookUrl}/voice-start`,
        statusCallback: `${this.config.webhookUrl}/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        timeout: 30,
        record: false // Privacy compliance
      });

      // Log the call initiation
      if (options.sessionId) {
        await CallEvent.create({
          sessionId: options.sessionId,
          eventType: 'call_initiated',
          providerId: this.config.providerId,
          providerCallId: call.sid,
          eventData: {
            to: options.to,
            from: options.from || this.config.fromNumber,
            callSid: call.sid
          }
        });
      }

      return {
        success: true,
        callId: call.sid,
        status: this.mapTwilioStatus(call.status),
        providerId: this.config.providerId,
        estimatedCost: this.estimateCallCost(),
        webhook: {
          url: `${this.config.webhookUrl}/voice-start`,
          method: 'POST'
        }
      };
    } catch (error) {
      console.error('Twilio call initiation failed:', error);
      
      // Log the failure
      if (options.sessionId) {
        await CallEvent.create({
          sessionId: options.sessionId,
          eventType: 'call_failed',
          providerId: this.config.providerId,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            to: options.to
          }
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Call initiation failed',
        providerId: this.config.providerId
      };
    }
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    try {
      const call = await this.client.calls(callId).fetch();
      return this.mapTwilioStatus(call.status);
    } catch (error) {
      console.error('Failed to get Twilio call status:', error);
      return 'failed';
    }
  }

  async handleWebhook(payload: TelephonyWebhookPayload): Promise<void> {
    try {
      const { CallSid, CallStatus, From, To, Duration } = payload.data;

      // Find the associated call session
      const session = await CallSession.findByProviderCallId(CallSid);
      if (!session) {
        console.warn(`No session found for Twilio call ${CallSid}`);
        return;
      }

      // Map Twilio status to our standard status
      const status = this.mapTwilioStatus(CallStatus);

      // Create call event
      await CallEvent.create({
        sessionId: session.id,
        eventType: this.mapStatusToEventType(status),
        providerId: this.config.providerId,
        providerCallId: CallSid,
        eventData: {
          status: CallStatus,
          from: From,
          to: To,
          duration: Duration ? parseInt(Duration) : undefined,
          timestamp: new Date().toISOString()
        }
      });

      // Update session status if it's a terminal state
      if (['completed', 'failed', 'timeout'].includes(status)) {
        await session.updateStatus(status, {
          actualDuration: Duration ? parseInt(Duration) : undefined,
          actualCost: Duration ? this.calculateActualCost(parseInt(Duration)) : undefined
        });
      }

    } catch (error) {
      console.error('Twilio webhook handling failed:', error);
    }
  }

  async endCall(callId: string): Promise<boolean> {
    try {
      await this.client.calls(callId).update({ status: 'completed' });
      return true;
    } catch (error) {
      console.error('Failed to end Twilio call:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test by fetching account info
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return true;
    } catch (error) {
      console.error('Twilio connection test failed:', error);
      return false;
    }
  }

  generateTwiML(instructions: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="sv-SE">${instructions}</Say>
    <Pause length="1"/>
</Response>`;
  }

  private mapTwilioStatus(twilioStatus: string): CallStatus {
    const statusMap: Record<string, CallStatus> = {
      'queued': 'initiated',
      'initiated': 'initiated', 
      'ringing': 'connecting',
      'in-progress': 'in_progress',
      'answered': 'in_progress',
      'completed': 'completed',
      'busy': 'failed',
      'failed': 'failed',
      'no-answer': 'failed',
      'canceled': 'failed'
    };

    return statusMap[twilioStatus] || 'failed';
  }

  private mapStatusToEventType(status: CallStatus): string {
    const eventMap: Record<CallStatus, string> = {
      'initiated': 'call_initiated',
      'connecting': 'call_connecting', 
      'in_progress': 'call_answered',
      'completed': 'call_completed',
      'failed': 'call_failed',
      'timeout': 'call_timeout'
    };

    return eventMap[status] || 'call_event';
  }

  private estimateCallCost(): number {
    // Twilio pricing: ~$0.12 per minute for Swedish numbers
    const estimatedDurationMinutes = 2;
    return 0.12 * estimatedDurationMinutes;
  }

  private calculateActualCost(durationSeconds: number): number {
    const durationMinutes = Math.ceil(durationSeconds / 60);
    return 0.12 * durationMinutes;
  }

  getConfig(): TelephonyConfig {
    return { ...this.config };
  }
}