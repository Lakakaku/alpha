import { FortySixElks } from 'fortysixelks-node';
import { ConnectionQuality } from '../../models/callQualityMetrics';

export class PhoneService {
  private client: FortySixElks;
  private webhookBaseUrl: string;

  constructor() {
    this.client = new FortySixElks({
      username: process.env.FORTYSIXELKS_USERNAME!,
      password: process.env.FORTYSIXELKS_PASSWORD!,
    });
    this.webhookBaseUrl = process.env.API_BASE_URL || 'https://api.vocilia.com';
  }

  async initiateCall(callRequest: CallInitiationRequest): Promise<CallInitiationResponse> {
    try {
      const call = await this.client.calls.create({
        from: process.env.VOCILIA_PHONE_NUMBER!,
        to: callRequest.customerPhone,
        voice_start: `${this.webhookBaseUrl}/webhooks/phone-events/call-start`,
        voice_end: `${this.webhookBaseUrl}/webhooks/phone-events/call-end`,
        timeout: 30, // 30 seconds ring timeout
        recording: false, // We use OpenAI Realtime for audio handling
        custom: {
          call_session_id: callRequest.callSessionId,
          store_id: callRequest.storeId,
          customer_verification_id: callRequest.customerVerificationId
        }
      });

      return {
        external_call_id: call.id,
        status: 'initiated',
        estimated_connection_time: new Date(Date.now() + 10000), // ~10 seconds
        webhook_urls: {
          call_start: `${this.webhookBaseUrl}/webhooks/phone-events/call-start`,
          call_end: `${this.webhookBaseUrl}/webhooks/phone-events/call-end`,
          call_events: `${this.webhookBaseUrl}/webhooks/phone-events/events`
        }
      };
    } catch (error: any) {
      throw new PhoneServiceError(`Failed to initiate call: ${error.message}`, error.code);
    }
  }

  async getCallStatus(externalCallId: string): Promise<CallStatusResponse> {
    try {
      const call = await this.client.calls.get(externalCallId);
      
      return {
        external_call_id: externalCallId,
        status: this.mapElksStatusToVocilia(call.state),
        duration_seconds: call.duration || 0,
        start_time: call.created ? new Date(call.created) : undefined,
        end_time: call.ended ? new Date(call.ended) : undefined,
        failure_reason: call.error || undefined,
        quality_metrics: this.extractQualityMetrics(call)
      };
    } catch (error: any) {
      throw new PhoneServiceError(`Failed to get call status: ${error.message}`, error.code);
    }
  }

  async endCall(externalCallId: string, reason?: string): Promise<void> {
    try {
      await this.client.calls.hangup(externalCallId);
    } catch (error: any) {
      throw new PhoneServiceError(`Failed to end call: ${error.message}`, error.code);
    }
  }

  async validatePhoneNumber(phoneNumber: string): Promise<PhoneValidationResult> {
    // Swedish phone number validation
    const swedishPhoneRegex = /^\+46[0-9]{8,9}$/;
    const isValidFormat = swedishPhoneRegex.test(phoneNumber);
    
    if (!isValidFormat) {
      return {
        is_valid: false,
        formatted_number: phoneNumber,
        country_code: null,
        carrier: null,
        line_type: null,
        validation_errors: ['Invalid Swedish phone number format. Must be +46XXXXXXXXX']
      };
    }

    try {
      // Use 46elks number lookup service for additional validation
      const lookup = await this.client.lookup.phonenumber({
        phonenumber: phoneNumber
      });

      return {
        is_valid: true,
        formatted_number: phoneNumber,
        country_code: 'SE',
        carrier: lookup.carrier || null,
        line_type: lookup.type || null,
        validation_errors: []
      };
    } catch (error: any) {
      return {
        is_valid: isValidFormat, // Format is correct even if lookup fails
        formatted_number: phoneNumber,
        country_code: 'SE',
        carrier: null,
        line_type: null,
        validation_errors: [`Lookup failed: ${error.message}`]
      };
    }
  }

  processWebhookEvent(eventData: any): ProcessedWebhookEvent {
    const eventType = this.determineEventType(eventData);
    
    return {
      event_type: eventType,
      external_call_id: eventData.id,
      call_session_id: eventData.custom?.call_session_id,
      timestamp: new Date(eventData.created || Date.now()),
      event_data: {
        status: eventData.state,
        duration: eventData.duration,
        direction: eventData.direction,
        from: eventData.from,
        to: eventData.to,
        error: eventData.error,
        custom_data: eventData.custom
      },
      quality_metrics: this.extractQualityMetrics(eventData)
    };
  }

  async getCallRecording(externalCallId: string): Promise<CallRecordingResponse | null> {
    try {
      const recordings = await this.client.recordings.list({
        call: externalCallId
      });

      if (recordings.data.length === 0) {
        return null;
      }

      const recording = recordings.data[0];
      return {
        recording_id: recording.id,
        duration_seconds: recording.duration || 0,
        file_size_bytes: recording.size || 0,
        download_url: recording.url,
        format: 'wav',
        created_at: new Date(recording.created)
      };
    } catch (error: any) {
      throw new PhoneServiceError(`Failed to get call recording: ${error.message}`, error.code);
    }
  }

  async getAccountBalance(): Promise<AccountBalanceResponse> {
    try {
      const subaccount = await this.client.subaccounts.get();
      return {
        balance_sek: parseFloat(subaccount.balance || '0'),
        currency: 'SEK',
        last_updated: new Date()
      };
    } catch (error: any) {
      throw new PhoneServiceError(`Failed to get account balance: ${error.message}`, error.code);
    }
  }

  private mapElksStatusToVocilia(elksStatus: string): CallStatus {
    switch (elksStatus.toLowerCase()) {
      case 'ringing':
        return 'ringing';
      case 'ongoing':
      case 'answered':
        return 'connected';
      case 'completed':
        return 'completed';
      case 'busy':
        return 'busy';
      case 'no-answer':
        return 'no_answer';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  private determineEventType(eventData: any): WebhookEventType {
    const state = eventData.state?.toLowerCase();
    
    switch (state) {
      case 'ringing':
        return 'call_initiated';
      case 'answered':
      case 'ongoing':
        return 'call_connected';
      case 'completed':
        return 'call_ended';
      case 'busy':
      case 'no-answer':
      case 'failed':
        return 'call_failed';
      default:
        return 'call_status_update';
    }
  }

  private extractQualityMetrics(callData: any): Partial<CallQualityMetrics> {
    // Extract available quality information from 46elks call data
    const metrics: Partial<CallQualityMetrics> = {};

    if (callData.duration) {
      // Estimate connection quality based on call duration and completion status
      if (callData.state === 'completed' && callData.duration >= 60) {
        metrics.connection_quality = 'good';
      } else if (callData.state === 'completed') {
        metrics.connection_quality = 'fair';
      } else if (callData.error) {
        metrics.connection_quality = 'poor';
      }
    }

    // Add any other quality metrics available from 46elks
    if (callData.price) {
      metrics.bandwidth_usage_kb = this.estimateBandwidthFromPrice(parseFloat(callData.price));
    }

    return metrics;
  }

  private estimateBandwidthFromPrice(priceSEK: number): number {
    // Rough estimation: ~0.5 SEK per minute, ~64kbps average
    const estimatedMinutes = priceSEK / 0.5;
    const estimatedBandwidthKb = estimatedMinutes * 60 * 64 / 8; // Convert to KB
    return Math.round(estimatedBandwidthKb);
  }
}

// Type definitions
export interface CallInitiationRequest {
  callSessionId: string;
  customerPhone: string;
  storeId: string;
  customerVerificationId: string;
  priority?: 'normal' | 'high';
}

export interface CallInitiationResponse {
  external_call_id: string;
  status: 'initiated' | 'failed';
  estimated_connection_time?: Date;
  webhook_urls: {
    call_start: string;
    call_end: string;
    call_events: string;
  };
  error?: string;
}

export type CallStatus = 'ringing' | 'connected' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'cancelled' | 'unknown';

export interface CallStatusResponse {
  external_call_id: string;
  status: CallStatus;
  duration_seconds: number;
  start_time?: Date;
  end_time?: Date;
  failure_reason?: string;
  quality_metrics?: Partial<CallQualityMetrics>;
}

export interface PhoneValidationResult {
  is_valid: boolean;
  formatted_number: string;
  country_code: string | null;
  carrier: string | null;
  line_type: string | null;
  validation_errors: string[];
}

export type WebhookEventType = 
  | 'call_initiated' 
  | 'call_connected' 
  | 'call_ended' 
  | 'call_failed' 
  | 'call_status_update';

export interface ProcessedWebhookEvent {
  event_type: WebhookEventType;
  external_call_id: string;
  call_session_id?: string;
  timestamp: Date;
  event_data: {
    status: string;
    duration?: number;
    direction?: string;
    from?: string;
    to?: string;
    error?: string;
    custom_data?: any;
  };
  quality_metrics?: Partial<CallQualityMetrics>;
}

export interface CallRecordingResponse {
  recording_id: string;
  duration_seconds: number;
  file_size_bytes: number;
  download_url: string;
  format: string;
  created_at: Date;
}

export interface AccountBalanceResponse {
  balance_sek: number;
  currency: string;
  last_updated: Date;
}

export interface CallQualityMetrics {
  connection_quality: ConnectionQuality;
  bandwidth_usage_kb?: number;
}

export class PhoneServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PhoneServiceError';
  }
}