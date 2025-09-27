import { Database } from '@vocilia/types';

export type ConversationTranscript = Database['public']['Tables']['conversation_transcripts']['Row'];
export type ConversationTranscriptInsert = Database['public']['Tables']['conversation_transcripts']['Insert'];
export type ConversationTranscriptUpdate = Database['public']['Tables']['conversation_transcripts']['Update'];

export type Speaker = 'ai' | 'customer';
export type MessageType = 'question' | 'response' | 'system' | 'error';

export interface CreateConversationTranscriptData {
  call_session_id: string;
  speaker: Speaker;
  message_order: number;
  content: string;
  timestamp_ms: number;
  confidence_score?: number;
  language_detected?: string;
  message_type: MessageType;
}

export interface ConversationMessage {
  speaker: Speaker;
  content: string;
  timestamp_ms: number;
  message_order: number;
  confidence_score?: number;
  message_type: MessageType;
  language_detected?: string;
}

export interface TranscriptWithMetadata extends ConversationTranscript {
  call_session_id: string;
  total_messages?: number;
  conversation_duration_ms?: number;
}

export const SPEAKER_VALUES: Speaker[] = ['ai', 'customer'];
export const MESSAGE_TYPE_VALUES: MessageType[] = ['question', 'response', 'system', 'error'];
export const DEFAULT_LANGUAGE = 'sv';
export const MAX_CONTENT_LENGTH = 2000;