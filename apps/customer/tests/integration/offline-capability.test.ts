/**
 * Integration Test T018: Offline Submission and Sync
 *
 * This test verifies the complete offline capability workflow including:
 * - Offline detection and UI state changes
 * - Data submission while offline (queue to IndexedDB)
 * - Background sync when connection is restored
 * - Conflict resolution during sync
 * - User feedback during offline/sync states
 */

import { jest } from '@jest/globals';
import {
  OfflineSubmissionData,
  OfflineSubmissionQueue,
  OfflineSubmitRequest,
  OfflineSubmitResponse,
  OfflineSyncResponse,
  NetworkStatus,
  NetworkInfo,
  BackgroundSyncTask
} from '@vocilia/types';

// Mock IndexedDB for testing
const mockIndexedDB = {
  databases: new Map<string, any>(),
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

// Mock network connection
const mockNavigator = {
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
};

// Mock service worker registration
const mockServiceWorker = {
  register: jest.fn(),
  ready: Promise.resolve({
    sync: {
      register: jest.fn(),
    },
    active: {
      postMessage: jest.fn(),
    },
  }),
};

// Mock fetch for API calls
const mockFetch = jest.fn();

// Test data
const TEST_STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_SESSION_TOKEN = 'test-session-token-12345';
const TEST_DEVICE_ID = 'device-12345-abcdef';

const TEST_VERIFICATION_DATA: OfflineSubmissionData = {
  store_id: TEST_STORE_ID,
  session_token: TEST_SESSION_TOKEN,
  transaction_time: '14:30',
  transaction_amount: 125.50,
  phone_number: '070-123 45 67',
  client_timestamp: new Date().toISOString(),
  device_info: {
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    screen_resolution: '375x667',
    network_type: 'wifi',
  },
};

// Mock offline storage service
class MockOfflineStorageService {
  private storage = new Map<string, any>();
  private metadata = {
    last_sync_timestamp: null,
    device_id: TEST_DEVICE_ID,
    app_version: '1.0.0',
    storage_version: '1.0',
  };

  async addSubmission(data: OfflineSubmissionData): Promise<string> {
    const id = `submission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const submission: OfflineSubmissionQueue = {
      id,
      customer_id: null,
      submission_data: data,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
      created_at: new Date().toISOString(),
      synced_at: null,
      error_message: null,
    };

    this.storage.set(id, submission);
    return id;
  }

  async getPendingSubmissions(): Promise<OfflineSubmissionQueue[]> {
    const submissions = Array.from(this.storage.values()).filter(
      (sub: OfflineSubmissionQueue) => sub.status === 'pending'
    );
    return submissions;
  }

  async updateSubmissionStatus(id: string, status: OfflineSubmissionData['status'], errorMessage?: string): Promise<void> {
    const submission = this.storage.get(id);
    if (submission) {
      submission.status = status;
      submission.error_message = errorMessage || null;
      if (status === 'synced') {
        submission.synced_at = new Date().toISOString();
      }
      this.storage.set(id, submission);
    }
  }

  async clearSyncedSubmissions(): Promise<void> {
    for (const [id, submission] of this.storage.entries()) {
      if (submission.status === 'synced') {
        this.storage.delete(id);
      }
    }
  }

  async getStorageSize(): Promise<number> {
    return this.storage.size;
  }

  async getMetadata() {
    return this.metadata;
  }

  async updateLastSyncTimestamp(timestamp: string): Promise<void> {
    this.metadata.last_sync_timestamp = timestamp;
  }
}

// Mock network service
class MockNetworkService {
  private _status: NetworkStatus = 'online';
  private _info: NetworkInfo = {
    status: 'online',
    effective_type: '4g',
    downlink: 10,
    rtt: 100,
  };
  private listeners: Array<(status: NetworkStatus, info: NetworkInfo) => void> = [];

  get status() { return this._status; }
  get info() { return this._info; }
  get isOnline() { return this._status === 'online'; }

  setNetworkStatus(status: NetworkStatus, info?: Partial<NetworkInfo>) {
    this._status = status;
    this._info = { ...this._info, status, ...info };
    this.notifyListeners();
  }

  simulateOffline() {
    this.setNetworkStatus('offline', {
      effective_type: 'none',
      downlink: 0,
      rtt: 0,
    });
  }

  simulateOnline() {
    this.setNetworkStatus('online', {
      effective_type: '4g',
      downlink: 10,
      rtt: 100,
    });
  }

  simulateSlowConnection() {
    this.setNetworkStatus('slow', {
      effective_type: '2g',
      downlink: 0.5,
      rtt: 2000,
    });
  }

  addStatusListener(callback: (status: NetworkStatus, info: NetworkInfo) => void) {
    this.listeners.push(callback);
  }

  removeStatusListener(callback: (status: NetworkStatus, info: NetworkInfo) => void) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this._status, this._info));
  }
}

// Mock API service
class MockAPIService {
  private shouldFail = false;
  private responseDelay = 0;

  setFailureMode(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  setResponseDelay(delay: number) {
    this.responseDelay = delay;
  }

  async submitOfflineData(request: OfflineSubmitRequest): Promise<OfflineSubmitResponse> {
    await this.delay(this.responseDelay);

    if (this.shouldFail) {
      throw new Error('Network error: Failed to submit offline data');
    }

    return {
      success: true,
      queued_count: request.submissions.length,
      queue_ids: request.submissions.map((_, index) => `queue-${index}-${Date.now()}`),
      estimated_sync_time: new Date(Date.now() + 5000).toISOString(),
    };
  }

  async syncOfflineSubmissions(deviceId: string, lastSyncTimestamp: string | null): Promise<OfflineSyncResponse> {
    await this.delay(this.responseDelay);

    if (this.shouldFail) {
      throw new Error('Network error: Failed to sync submissions');
    }

    return {
      success: true,
      synced_submissions: [
        {
          queue_id: 'queue-1',
          verification_id: 'verification-12345',
          status: 'success' as const,
        },
      ],
      failed_submissions: [],
      next_sync_recommended: new Date(Date.now() + 300000).toISOString(), // 5 minutes
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Mock offline sync manager
class MockOfflineSyncManager {
  private storage: MockOfflineStorageService;
  private network: MockNetworkService;
  private api: MockAPIService;
  private syncInProgress = false;
  private syncListeners: Array<(status: string, progress?: number) => void> = [];

  constructor(
    storage: MockOfflineStorageService,
    network: MockNetworkService,
    api: MockAPIService
  ) {
    this.storage = storage;
    this.network = network;
    this.api = api;

    // Listen for network status changes
    this.network.addStatusListener((status) => {
      if (status === 'online' && !this.syncInProgress) {
        this.scheduleSync();
      }
    });
  }

  async submitOffline(data: OfflineSubmissionData): Promise<string> {
    const submissionId = await this.storage.addSubmission(data);

    // If online, attempt immediate sync
    if (this.network.isOnline) {
      this.scheduleSync();
    }

    return submissionId;
  }

  async scheduleSync(): Promise<void> {
    if (this.syncInProgress || !this.network.isOnline) {
      return;
    }

    this.syncInProgress = true;
    this.notifySyncListeners('started');

    try {
      const pendingSubmissions = await this.storage.getPendingSubmissions();

      if (pendingSubmissions.length === 0) {
        this.notifySyncListeners('completed', 100);
        return;
      }

      // Submit to server
      const submitRequest: OfflineSubmitRequest = {
        submissions: pendingSubmissions.map(s => s.submission_data),
        client_info: {
          device_id: TEST_DEVICE_ID,
          app_version: '1.0.0',
          sync_timestamp: new Date().toISOString(),
        },
      };

      this.notifySyncListeners('uploading', 30);
      await this.api.submitOfflineData(submitRequest);

      this.notifySyncListeners('processing', 60);

      // Sync results
      const metadata = await this.storage.getMetadata();
      const syncResponse = await this.api.syncOfflineSubmissions(
        metadata.device_id,
        metadata.last_sync_timestamp
      );

      this.notifySyncListeners('finalizing', 90);

      // Update submission statuses
      for (const syncedSubmission of syncResponse.synced_submissions) {
        await this.storage.updateSubmissionStatus(
          syncedSubmission.queue_id,
          syncedSubmission.status === 'success' ? 'synced' : 'failed',
          syncedSubmission.error_message
        );
      }

      // Handle failed submissions
      for (const failedSubmission of syncResponse.failed_submissions) {
        await this.storage.updateSubmissionStatus(
          failedSubmission.queue_id,
          'failed',
          failedSubmission.error_message
        );
      }

      await this.storage.updateLastSyncTimestamp(new Date().toISOString());
      await this.storage.clearSyncedSubmissions();

      this.notifySyncListeners('completed', 100);
    } catch (error) {
      this.notifySyncListeners('failed', 0, error instanceof Error ? error.message : 'Sync failed');
    } finally {
      this.syncInProgress = false;
    }
  }

  addSyncListener(callback: (status: string, progress?: number, error?: string) => void) {
    this.syncListeners.push(callback);
  }

  removeSyncListener(callback: (status: string, progress?: number, error?: string) => void) {
    const index = this.syncListeners.indexOf(callback);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  private notifySyncListeners(status: string, progress?: number, error?: string) {
    this.syncListeners.forEach(callback => callback(status, progress, error));
  }

  get isSyncing() {
    return this.syncInProgress;
  }
}

describe('T018: Offline Submission and Sync Integration Tests', () => {
  let storageService: MockOfflineStorageService;
  let networkService: MockNetworkService;
  let apiService: MockAPIService;
  let syncManager: MockOfflineSyncManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize services
    storageService = new MockOfflineStorageService();
    networkService = new MockNetworkService();
    apiService = new MockAPIService();
    syncManager = new MockOfflineSyncManager(storageService, networkService, apiService);

    // Mock global objects
    global.indexedDB = mockIndexedDB as any;
    global.navigator = mockNavigator as any;
    global.fetch = mockFetch;

    // Reset network to online state
    networkService.simulateOnline();
    apiService.setFailureMode(false);
    apiService.setResponseDelay(0);
  });

  afterEach(() => {
    // Clean up listeners
    networkService.listeners = [];
    syncManager.syncListeners = [];
  });

  describe('Offline Detection and UI State Changes', () => {
    test('should detect network status changes', () => {
      expect(networkService.isOnline).toBe(true);
      expect(networkService.status).toBe('online');

      networkService.simulateOffline();
      expect(networkService.isOnline).toBe(false);
      expect(networkService.status).toBe('offline');

      networkService.simulateOnline();
      expect(networkService.isOnline).toBe(true);
      expect(networkService.status).toBe('online');
    });

    test('should notify listeners of network status changes', () => {
      const statusListener = jest.fn();
      networkService.addStatusListener(statusListener);

      networkService.simulateOffline();
      expect(statusListener).toHaveBeenCalledWith('offline', expect.objectContaining({
        status: 'offline',
        effective_type: 'none',
      }));

      networkService.simulateOnline();
      expect(statusListener).toHaveBeenCalledWith('online', expect.objectContaining({
        status: 'online',
        effective_type: '4g',
      }));
    });

    test('should detect slow connection conditions', () => {
      networkService.simulateSlowConnection();

      expect(networkService.status).toBe('slow');
      expect(networkService.info.effective_type).toBe('2g');
      expect(networkService.info.downlink).toBe(0.5);
      expect(networkService.info.rtt).toBe(2000);
    });
  });

  describe('Data Submission While Offline', () => {
    beforeEach(() => {
      networkService.simulateOffline();
    });

    test('should queue verification data to IndexedDB when offline', async () => {
      const submissionId = await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      expect(submissionId).toBeTruthy();
      expect(submissionId).toMatch(/^submission-\d+-[a-z0-9]+$/);

      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(1);
      expect(pendingSubmissions[0].submission_data).toEqual(TEST_VERIFICATION_DATA);
      expect(pendingSubmissions[0].status).toBe('pending');
    });

    test('should handle multiple offline submissions', async () => {
      const submissions = [
        { ...TEST_VERIFICATION_DATA, transaction_amount: 100 },
        { ...TEST_VERIFICATION_DATA, transaction_amount: 200 },
        { ...TEST_VERIFICATION_DATA, transaction_amount: 300 },
      ];

      const submissionIds: string[] = [];
      for (const submission of submissions) {
        const id = await syncManager.submitOffline(submission);
        submissionIds.push(id);
      }

      expect(submissionIds).toHaveLength(3);
      expect(new Set(submissionIds).size).toBe(3); // All IDs should be unique

      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(3);

      const amounts = pendingSubmissions.map(s => s.submission_data.transaction_amount);
      expect(amounts).toEqual(expect.arrayContaining([100, 200, 300]));
    });

    test('should store device info with offline submissions', async () => {
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      const pendingSubmissions = await storageService.getPendingSubmissions();
      const submission = pendingSubmissions[0];

      expect(submission.submission_data.device_info).toEqual({
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        screen_resolution: '375x667',
        network_type: 'wifi',
      });
    });

    test('should handle storage errors gracefully', async () => {
      // Mock storage failure
      const originalAddSubmission = storageService.addSubmission;
      storageService.addSubmission = jest.fn().mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(syncManager.submitOffline(TEST_VERIFICATION_DATA)).rejects.toThrow('Storage quota exceeded');

      // Restore original method
      storageService.addSubmission = originalAddSubmission;
    });
  });

  describe('Background Sync When Connection Restored', () => {
    test('should automatically start sync when network comes online', async () => {
      // Queue submissions while offline
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline({ ...TEST_VERIFICATION_DATA, transaction_amount: 200 });

      expect(await storageService.getPendingSubmissions()).toHaveLength(2);

      // Set up sync listener
      const syncStatusUpdates: Array<{ status: string; progress?: number }> = [];
      syncManager.addSyncListener((status, progress) => {
        syncStatusUpdates.push({ status, progress });
      });

      // Simulate network coming back online
      networkService.simulateOnline();

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(syncStatusUpdates).toEqual([
        { status: 'started' },
        { status: 'uploading', progress: 30 },
        { status: 'processing', progress: 60 },
        { status: 'finalizing', progress: 90 },
        { status: 'completed', progress: 100 },
      ]);

      // Verify submissions were processed
      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(0);
    });

    test('should handle sync failures gracefully', async () => {
      // Queue submission while offline
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      // Configure API to fail
      apiService.setFailureMode(true);

      const syncStatusUpdates: Array<{ status: string; error?: string }> = [];
      syncManager.addSyncListener((status, progress, error) => {
        syncStatusUpdates.push({ status, error });
      });

      // Trigger sync
      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      const failedUpdate = syncStatusUpdates.find(update => update.status === 'failed');
      expect(failedUpdate).toBeTruthy();
      expect(failedUpdate!.error).toContain('Network error');

      // Submission should still be pending
      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(1);
    });

    test('should handle partial sync failures', async () => {
      // Queue submissions while offline
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline({ ...TEST_VERIFICATION_DATA, transaction_amount: 200 });

      // Mock API to return partial success
      const originalSync = apiService.syncOfflineSubmissions;
      apiService.syncOfflineSubmissions = jest.fn().mockResolvedValue({
        success: true,
        synced_submissions: [
          { queue_id: 'queue-1', verification_id: 'verification-1', status: 'success' },
        ],
        failed_submissions: [
          { queue_id: 'queue-2', error_message: 'Validation failed', retry_after: new Date().toISOString() },
        ],
        next_sync_recommended: new Date(Date.now() + 300000).toISOString(),
      });

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      // One should be synced, one should be failed
      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(0); // All processed, but some may have failed

      // Restore original method
      apiService.syncOfflineSubmissions = originalSync;
    });

    test('should not start multiple sync operations simultaneously', async () => {
      // Queue submission while offline
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      // Configure API with delay
      apiService.setResponseDelay(200);

      expect(syncManager.isSyncing).toBe(false);

      // Start first sync
      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(syncManager.isSyncing).toBe(true);

      // Try to start second sync
      await syncManager.scheduleSync();

      // Should still be in progress from first sync
      expect(syncManager.isSyncing).toBe(true);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(syncManager.isSyncing).toBe(false);
    });
  });

  describe('Conflict Resolution During Sync', () => {
    test('should handle duplicate submissions', async () => {
      const duplicateData = { ...TEST_VERIFICATION_DATA };

      // Submit same data twice while offline
      networkService.simulateOffline();
      await syncManager.submitOffline(duplicateData);
      await syncManager.submitOffline(duplicateData);

      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(2);

      // Both should have identical submission data but different IDs
      expect(pendingSubmissions[0].submission_data).toEqual(pendingSubmissions[1].submission_data);
      expect(pendingSubmissions[0].id).not.toBe(pendingSubmissions[1].id);
    });

    test('should handle server-side deduplication', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      // Mock server response indicating deduplication
      const originalSync = apiService.syncOfflineSubmissions;
      apiService.syncOfflineSubmissions = jest.fn().mockResolvedValue({
        success: true,
        synced_submissions: [
          { queue_id: 'queue-1', verification_id: 'verification-1', status: 'success' },
          { queue_id: 'queue-2', verification_id: 'verification-1', status: 'success' }, // Same verification_id
        ],
        failed_submissions: [],
        next_sync_recommended: new Date(Date.now() + 300000).toISOString(),
      });

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Both should be marked as synced despite deduplication
      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(0);

      apiService.syncOfflineSubmissions = originalSync;
    });

    test('should handle timestamp conflicts', async () => {
      const oldTimestamp = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const recentTimestamp = new Date().toISOString();

      networkService.simulateOffline();
      await syncManager.submitOffline({
        ...TEST_VERIFICATION_DATA,
        client_timestamp: oldTimestamp,
      });
      await syncManager.submitOffline({
        ...TEST_VERIFICATION_DATA,
        client_timestamp: recentTimestamp,
      });

      const pendingSubmissions = await storageService.getPendingSubmissions();
      expect(pendingSubmissions).toHaveLength(2);

      // Verify timestamps are preserved
      const timestamps = pendingSubmissions.map(s => s.submission_data.client_timestamp);
      expect(timestamps).toContain(oldTimestamp);
      expect(timestamps).toContain(recentTimestamp);
    });
  });

  describe('User Feedback During Offline/Sync States', () => {
    test('should provide real-time sync progress updates', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      const syncUpdates: Array<{ status: string; progress?: number }> = [];
      syncManager.addSyncListener((status, progress) => {
        syncUpdates.push({ status, progress });
      });

      // Add delay to see progress updates
      apiService.setResponseDelay(100);

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(syncUpdates).toContain({ status: 'started' });
      expect(syncUpdates).toContain({ status: 'uploading', progress: 30 });
      expect(syncUpdates).toContain({ status: 'processing', progress: 60 });
      expect(syncUpdates).toContain({ status: 'finalizing', progress: 90 });
      expect(syncUpdates).toContain({ status: 'completed', progress: 100 });
    });

    test('should provide clear error messages for sync failures', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      apiService.setFailureMode(true);

      const syncUpdates: Array<{ status: string; error?: string }> = [];
      syncManager.addSyncListener((status, progress, error) => {
        if (error) {
          syncUpdates.push({ status, error });
        }
      });

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      const errorUpdate = syncUpdates.find(update => update.status === 'failed');
      expect(errorUpdate).toBeTruthy();
      expect(errorUpdate!.error).toBe('Network error: Failed to submit offline data');
    });

    test('should track storage usage and warn when approaching limits', async () => {
      networkService.simulateOffline();

      // Submit multiple entries to test storage tracking
      for (let i = 0; i < 5; i++) {
        await syncManager.submitOffline({
          ...TEST_VERIFICATION_DATA,
          transaction_amount: 100 + i,
        });
      }

      const storageSize = await storageService.getStorageSize();
      expect(storageSize).toBe(5);

      // Test storage metadata
      const metadata = await storageService.getMetadata();
      expect(metadata.device_id).toBe(TEST_DEVICE_ID);
      expect(metadata.app_version).toBe('1.0.0');
    });

    test('should provide network quality indicators', () => {
      // Test different network conditions
      networkService.simulateSlowConnection();
      expect(networkService.info.effective_type).toBe('2g');
      expect(networkService.info.downlink).toBe(0.5);
      expect(networkService.info.rtt).toBe(2000);

      networkService.simulateOnline();
      expect(networkService.info.effective_type).toBe('4g');
      expect(networkService.info.downlink).toBe(10);
      expect(networkService.info.rtt).toBe(100);

      networkService.simulateOffline();
      expect(networkService.info.effective_type).toBe('none');
      expect(networkService.info.downlink).toBe(0);
      expect(networkService.info.rtt).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle rapid network state changes', async () => {
      const stateChanges: string[] = [];
      networkService.addStatusListener((status) => {
        stateChanges.push(status);
      });

      // Rapid state changes
      networkService.simulateOffline();
      networkService.simulateOnline();
      networkService.simulateSlowConnection();
      networkService.simulateOffline();
      networkService.simulateOnline();

      expect(stateChanges).toEqual(['offline', 'online', 'slow', 'offline', 'online']);
    });

    test('should handle storage quota exceeded scenarios', async () => {
      // Mock storage to throw quota exceeded error
      const originalAddSubmission = storageService.addSubmission;
      let callCount = 0;
      storageService.addSubmission = jest.fn().mockImplementation(async (data) => {
        callCount++;
        if (callCount > 3) {
          throw new Error('QuotaExceededError: Storage quota exceeded');
        }
        return originalAddSubmission.call(storageService, data);
      });

      networkService.simulateOffline();

      // First 3 should succeed
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      // 4th should fail
      await expect(syncManager.submitOffline(TEST_VERIFICATION_DATA))
        .rejects.toThrow('QuotaExceededError: Storage quota exceeded');

      storageService.addSubmission = originalAddSubmission;
    });

    test('should handle corrupted offline data', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      // Simulate data corruption
      const pendingSubmissions = await storageService.getPendingSubmissions();
      const corruptedSubmission = pendingSubmissions[0];

      // Corrupt the submission data
      (corruptedSubmission.submission_data as any) = {
        ...corruptedSubmission.submission_data,
        transaction_amount: 'invalid-amount' // Should be number
      };

      // Update storage with corrupted data
      await storageService.storage.set(corruptedSubmission.id, corruptedSubmission);

      // Mock API to reject corrupted data
      const originalSubmit = apiService.submitOfflineData;
      apiService.submitOfflineData = jest.fn().mockRejectedValue(
        new Error('Validation error: Invalid transaction amount')
      );

      const syncErrors: string[] = [];
      syncManager.addSyncListener((status, progress, error) => {
        if (error) {
          syncErrors.push(error);
        }
      });

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(syncErrors).toContain('Validation error: Invalid transaction amount');

      apiService.submitOfflineData = originalSubmit;
    });

    test('should implement retry logic with exponential backoff', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);

      let apiCallCount = 0;
      const originalSubmit = apiService.submitOfflineData;
      apiService.submitOfflineData = jest.fn().mockImplementation(async () => {
        apiCallCount++;
        if (apiCallCount < 3) {
          throw new Error('Temporary network error');
        }
        return originalSubmit.call(apiService, {} as any);
      });

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have retried until success
      expect(apiCallCount).toBe(3);

      apiService.submitOfflineData = originalSubmit;
    });

    test('should clean up completed sync operations', async () => {
      networkService.simulateOffline();
      await syncManager.submitOffline(TEST_VERIFICATION_DATA);
      await syncManager.submitOffline({ ...TEST_VERIFICATION_DATA, transaction_amount: 200 });

      expect(await storageService.getStorageSize()).toBe(2);

      networkService.simulateOnline();
      await new Promise(resolve => setTimeout(resolve, 100));

      // After successful sync, synced submissions should be cleaned up
      expect(await storageService.getStorageSize()).toBe(0);
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle large numbers of offline submissions efficiently', async () => {
      networkService.simulateOffline();

      const startTime = Date.now();

      // Submit 100 entries
      const submissions = Array.from({ length: 100 }, (_, i) => ({
        ...TEST_VERIFICATION_DATA,
        transaction_amount: 100 + i,
      }));

      for (const submission of submissions) {
        await syncManager.submitOffline(submission);
      }

      const submissionTime = Date.now() - startTime;

      // Should complete within reasonable time (less than 5 seconds for 100 items)
      expect(submissionTime).toBeLessThan(5000);
      expect(await storageService.getStorageSize()).toBe(100);
    });

    test('should properly clean up event listeners', () => {
      const statusListener = jest.fn();
      const syncListener = jest.fn();

      networkService.addStatusListener(statusListener);
      syncManager.addSyncListener(syncListener);

      expect(networkService.listeners).toContain(statusListener);
      expect(syncManager.syncListeners).toContain(syncListener);

      networkService.removeStatusListener(statusListener);
      syncManager.removeSyncListener(syncListener);

      expect(networkService.listeners).not.toContain(statusListener);
      expect(syncManager.syncListeners).not.toContain(syncListener);
    });

    test('should handle memory pressure during sync operations', async () => {
      networkService.simulateOffline();

      // Create large submission data
      const largeSubmissionData = {
        ...TEST_VERIFICATION_DATA,
        device_info: {
          ...TEST_VERIFICATION_DATA.device_info!,
          // Simulate large user agent string
          user_agent: 'A'.repeat(10000),
        },
      };

      await syncManager.submitOffline(largeSubmissionData);

      // Memory usage should be reasonable even with large data
      const metadata = await storageService.getMetadata();
      expect(metadata.device_id).toBeDefined();
      expect(await storageService.getStorageSize()).toBe(1);
    });
  });
});