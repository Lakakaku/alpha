// Telephony Provider Types for 46elks and Twilio integration

export type TelephonyProvider = '46elks' | 'twilio';

export type TelephonyOperation =
  | 'initiate'
  | 'connect'
  | 'record'
  | 'hangup'
  | 'webhook';

// Generic telephony interfaces
export interface TelephonyConfig {
  provider: TelephonyProvider;
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  webhookUrl: string;
}

export interface CallInitiateOptions {
  to: string; // Swedish phone number (+46...)
  from?: string; // Provider phone number
  timeout?: number; // Call timeout in seconds
  record?: boolean; // Enable call recording
  maxDuration?: number; // Maximum call duration in seconds
  webhookUrl?: string; // Override default webhook URL
}

export interface CallInitiateResponse {
  callId: string;
  status: 'initiated' | 'failed';
  message?: string;
  cost?: number;
  estimatedDuration?: number;
}

export interface CallStatusResponse {
  callId: string;
  status: 'initiated' | 'ringing' | 'answered' | 'busy' | 'failed' | 'completed';
  duration?: number;
  cost?: number;
  recordingUrl?: string;
  hangupCause?: string;
}

// Webhook event types
export type TelephonyWebhookEventType =
  | 'call_initiated'
  | 'call_ringing'
  | 'call_answered'
  | 'call_completed'
  | 'call_failed'
  | 'recording_available';

export interface TelephonyWebhookEvent {
  eventType: TelephonyWebhookEventType;
  callId: string;
  sessionId?: string;
  timestamp: string;
  data: Record<string, any>;
}

// 46elks specific types
export interface FortyElksConfig extends TelephonyConfig {
  provider: '46elks';
  baseUrl: 'https://api.46elks.com';
}

export interface FortyElksCallRequest {
  to: string;
  from?: string;
  voice_start?: string; // URL to initial voice instructions
  timeout?: number;
  record?: boolean;
  webhook?: string;
}

export interface FortyElksCallResponse {
  id: string;
  direction: 'outbound';
  from: string;
  to: string;
  created: string;
  state: 'ongoing' | 'completed' | 'failed';
  duration?: number;
  cost?: number;
  recording?: string;
}

export interface FortyElksWebhookData {
  event: 'call_created' | 'call_completed' | 'call_failed';
  id: string;
  direction: 'outbound';
  from: string;
  to: string;
  state: string;
  duration?: string;
  cost?: string;
  recording?: string;
  created: string;
}

// Twilio specific types
export interface TwilioConfig extends TelephonyConfig {
  provider: 'twilio';
  accountSid: string;
  baseUrl: 'https://api.twilio.com';
}

export interface TwilioCallRequest {
  To: string;
  From: string;
  Url?: string; // TwiML URL for call flow
  Timeout?: number;
  Record?: boolean;
  StatusCallback?: string;
  StatusCallbackMethod?: 'GET' | 'POST';
}

export interface TwilioCallResponse {
  sid: string;
  account_sid: string;
  from: string;
  to: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer';
  date_created: string;
  date_updated: string;
  duration?: string;
  price?: string;
  recording_url?: string;
}

export interface TwilioWebhookData {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'initiated' | 'ringing' | 'answered' | 'completed' | 'busy' | 'failed' | 'no-answer';
  Direction: 'inbound' | 'outbound-api';
  Duration?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  Timestamp: string;
}

// Provider log entry
export interface TelephonyProviderLog {
  id: string;
  call_session_id: string;
  provider: TelephonyProvider;
  provider_call_id: string;
  operation: TelephonyOperation;
  request_payload: Record<string, any>;
  response_payload: Record<string, any>;
  status_code: number;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

// Quality metrics
export interface CallQualityMetrics {
  provider: TelephonyProvider;
  callId: string;
  audioQuality?: number; // 0-1 score
  latency?: number; // milliseconds
  dropouts?: number; // number of audio dropouts
  signalStrength?: number; // 0-1 score
  packetLoss?: number; // percentage
}

// Error handling
export interface TelephonyError extends Error {
  provider: TelephonyProvider;
  operation: TelephonyOperation;
  statusCode?: number;
  providerError?: string;
  retryable: boolean;
}

// Provider capabilities
export interface ProviderCapabilities {
  recording: boolean;
  webhooks: boolean;
  realTimeStatus: boolean;
  qualityMetrics: boolean;
  swedishNumbers: boolean;
  maxCallDuration: number; // seconds
  costPerMinute: number; // USD
}

// Service interface that both providers must implement
export interface TelephonyService {
  provider: TelephonyProvider;

  initiateCall(options: CallInitiateOptions): Promise<CallInitiateResponse>;
  getCallStatus(callId: string): Promise<CallStatusResponse>;
  hangupCall(callId: string): Promise<boolean>;
  getRecording(callId: string): Promise<string | null>;
  getCapabilities(): ProviderCapabilities;

  // Webhook handling
  validateWebhook(payload: any, signature?: string): boolean;
  parseWebhookEvent(payload: any): TelephonyWebhookEvent;
}

// Configuration validation
export const SWEDISH_PHONE_REGEX = /^\+46[0-9]{7,9}$/;

export const PROVIDER_CONFIGS = {
  '46elks': {
    maxCallDuration: 7200, // 2 hours
    costPerMinute: 0.02, // $0.02 per minute
    swedishNumbers: true,
    recording: true,
    webhooks: true,
    realTimeStatus: true,
    qualityMetrics: false,
  },
  'twilio': {
    maxCallDuration: 14400, // 4 hours
    costPerMinute: 0.04, // $0.04 per minute
    swedishNumbers: true,
    recording: true,
    webhooks: true,
    realTimeStatus: true,
    qualityMetrics: true,
  },
} as const satisfies Record<TelephonyProvider, ProviderCapabilities>;

// Utility functions for phone number validation
export function validateSwedishPhoneNumber(phone: string): boolean {
  return SWEDISH_PHONE_REGEX.test(phone);
}

export function formatSwedishPhoneNumber(phone: string): string {
  // Remove any non-digits and ensure +46 prefix
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('46')) {
    return `+${digits}`;
  } else if (digits.startsWith('0')) {
    return `+46${digits.slice(1)}`;
  } else {
    return `+46${digits}`;
  }
}