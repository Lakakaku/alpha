// Offline submission and sync types for PWA functionality

export type OfflineSubmissionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineSubmissionQueue {
  id: string; // UUID primary key
  customer_id: string | null; // UUID, optional customer identifier
  submission_data: OfflineSubmissionData; // JSONB verification data
  status: OfflineSubmissionStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
  synced_at: string | null; // ISO timestamp
  error_message: string | null;
}

export interface OfflineSubmissionData {
  store_id: string;
  session_token: string;
  transaction_time: string; // HH:MM format
  transaction_amount: number;
  phone_number: string;
  client_timestamp: string; // ISO timestamp when submitted offline
  device_info?: {
    user_agent: string;
    screen_resolution: string;
    network_type: string;
  };
}

export interface OfflineSubmitRequest {
  submissions: OfflineSubmissionData[];
  client_info: {
    device_id: string;
    app_version: string;
    sync_timestamp: string;
  };
}

export interface OfflineSubmitResponse {
  success: boolean;
  queued_count: number;
  queue_ids: string[];
  estimated_sync_time: string;
}

export interface OfflineSyncRequest {
  device_id: string;
  last_sync_timestamp: string | null;
}

export interface OfflineSyncResponse {
  success: boolean;
  synced_submissions: Array<{
    queue_id: string;
    verification_id: string | null;
    status: 'success' | 'failed';
    error_message?: string;
  }>;
  failed_submissions: Array<{
    queue_id: string;
    error_message: string;
    retry_after: string;
  }>;
  next_sync_recommended: string; // ISO timestamp
}

// IndexedDB storage types for offline capability
export interface OfflineStorage {
  submissions: OfflineSubmissionData[];
  settings: OfflineSettings;
  metadata: OfflineMetadata;
}

export interface OfflineSettings {
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  max_queue_size: number;
  retry_strategy: 'immediate' | 'exponential' | 'linear';
}

export interface OfflineMetadata {
  last_sync_timestamp: string | null;
  device_id: string;
  app_version: string;
  storage_version: string;
}

// Network status types
export type NetworkStatus = 'online' | 'offline' | 'slow';

export interface NetworkInfo {
  status: NetworkStatus;
  effective_type: string; // '2g', '3g', '4g', etc.
  downlink: number; // Mbps
  rtt: number; // milliseconds
}

// Background sync types
export interface BackgroundSyncTask {
  id: string;
  type: 'submission_sync' | 'data_fetch' | 'cache_update';
  data: any;
  scheduled_at: string;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}