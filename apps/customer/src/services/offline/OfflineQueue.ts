/**
 * Offline Queue Service
 * Manages offline data submissions and queue processing for PWA functionality
 */

interface QueuedSubmission {
  id: string;
  type: 'verification' | 'support' | 'accessibility' | 'feedback';
  data: any;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
}

interface QueueStatus {
  totalItems: number;
  pendingItems: number;
  failedItems: number;
  syncInProgress: boolean;
  lastSyncAttempt: number | null;
  lastSuccessfulSync: number | null;
}

interface OfflineQueueOptions {
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  storeName: string;
  enableBackgroundSync: boolean;
}

const DEFAULT_OPTIONS: OfflineQueueOptions = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  maxQueueSize: 100,
  storeName: 'vocilia-offline-queue',
  enableBackgroundSync: true
};

export class OfflineQueue {
  private dbName = 'VociliaOfflineDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private options: OfflineQueueOptions;
  private listeners: Set<(status: QueueStatus) => void> = new Set();
  private syncInProgress = false;

  constructor(options: Partial<OfflineQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.initializeDatabase();
    this.setupNetworkListener();
    this.setupVisibilityListener();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('OfflineQueue database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create submissions store
        if (!db.objectStoreNames.contains('submissions')) {
          const submissionsStore = db.createObjectStore('submissions', { keyPath: 'id' });
          submissionsStore.createIndex('type', 'type', { unique: false });
          submissionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          submissionsStore.createIndex('priority', 'priority', { unique: false });
        }

        // Create sync status store
        if (!db.objectStoreNames.contains('syncStatus')) {
          db.createObjectStore('syncStatus', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Add item to offline queue
   */
  async enqueue(
    type: QueuedSubmission['type'],
    data: any,
    url: string,
    method: QueuedSubmission['method'] = 'POST',
    priority: QueuedSubmission['priority'] = 'medium',
    headers: Record<string, string> = {}
  ): Promise<string> {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const submission: QueuedSubmission = {
      id,
      type,
      data,
      url,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      priority
    };

    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      
      const request = store.add(submission);
      
      request.onsuccess = () => {
        console.log(`Queued ${type} submission:`, id);
        this.notifyStatusChange();
        
        // Try immediate sync if online
        if (navigator.onLine) {
          this.processQueue();
        }
        
        // Register background sync if supported
        if (this.options.enableBackgroundSync && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            if ('sync' in registration) {
              (registration as any).sync.register('vocilia-offline-sync');
            }
          });
        }
        
        resolve(id);
      };
      
      request.onerror = () => {
        console.error('Failed to queue submission:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Process the queue and attempt to sync items
   */
  async processQueue(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    this.notifyStatusChange();

    try {
      await this.ensureDatabase();
      
      const submissions = await this.getQueuedSubmissions();
      
      // Sort by priority and timestamp
      submissions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

      for (const submission of submissions) {
        try {
          await this.processSubmission(submission);
        } catch (error) {
          console.error(`Failed to process submission ${submission.id}:`, error);
          await this.handleFailedSubmission(submission);
        }
      }

      await this.updateSyncStatus('lastSuccessfulSync', Date.now());
    } catch (error) {
      console.error('Queue processing failed:', error);
    } finally {
      this.syncInProgress = false;
      await this.updateSyncStatus('lastSyncAttempt', Date.now());
      this.notifyStatusChange();
    }
  }

  /**
   * Process individual submission
   */
  private async processSubmission(submission: QueuedSubmission): Promise<void> {
    const response = await fetch(submission.url, {
      method: submission.method,
      headers: submission.headers,
      body: JSON.stringify(submission.data)
    });

    if (response.ok) {
      // Success - remove from queue
      await this.removeSubmission(submission.id);
      console.log(`Successfully synced submission: ${submission.id}`);
      
      // Notify service worker of successful sync
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_SUCCESS',
          submissionId: submission.id,
          submissionType: submission.type
        });
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Handle failed submission (retry or mark as failed)
   */
  private async handleFailedSubmission(submission: QueuedSubmission): Promise<void> {
    submission.retryCount++;

    if (submission.retryCount >= submission.maxRetries) {
      // Max retries reached - optionally remove or mark as failed
      console.warn(`Max retries reached for submission ${submission.id}`);
      await this.removeSubmission(submission.id);
    } else {
      // Update retry count and delay next attempt
      await this.updateSubmission(submission);
      console.log(`Retry ${submission.retryCount}/${submission.maxRetries} for submission ${submission.id}`);
    }
  }

  /**
   * Get all queued submissions
   */
  private async getQueuedSubmissions(): Promise<QueuedSubmission[]> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readonly');
      const store = transaction.objectStore('submissions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove submission from queue
   */
  private async removeSubmission(id: string): Promise<void> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update submission in queue
   */
  private async updateSubmission(submission: QueuedSubmission): Promise<void> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      const request = store.put(submission);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    await this.ensureDatabase();
    
    const submissions = await this.getQueuedSubmissions();
    const failedSubmissions = submissions.filter(s => s.retryCount >= s.maxRetries);
    
    const lastSyncAttempt = await this.getSyncStatus('lastSyncAttempt');
    const lastSuccessfulSync = await this.getSyncStatus('lastSuccessfulSync');

    return {
      totalItems: submissions.length,
      pendingItems: submissions.length - failedSubmissions.length,
      failedItems: failedSubmissions.length,
      syncInProgress: this.syncInProgress,
      lastSyncAttempt,
      lastSuccessfulSync
    };
  }

  /**
   * Clear all items from queue
   */
  async clearQueue(): Promise<void> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readwrite');
      const store = transaction.objectStore('submissions');
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('Offline queue cleared');
        this.notifyStatusChange();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get submissions by type
   */
  async getSubmissionsByType(type: QueuedSubmission['type']): Promise<QueuedSubmission[]> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readonly');
      const store = transaction.objectStore('submissions');
      const index = store.index('type');
      const request = index.getAll(type);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add status change listener
   */
  addStatusListener(callback: (status: QueueStatus) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Check if specific submission exists
   */
  async hasSubmission(id: string): Promise<boolean> {
    await this.ensureDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['submissions'], 'readonly');
      const store = transaction.objectStore('submissions');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Private helper methods
   */
  private async ensureDatabase(): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }
  }

  private async getSyncStatus(key: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncStatus'], 'readonly');
      const store = transaction.objectStore('syncStatus');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async updateSyncStatus(key: string, value: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncStatus'], 'readwrite');
      const store = transaction.objectStore('syncStatus');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private notifyStatusChange(): void {
    this.getStatus().then(status => {
      this.listeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in status listener:', error);
        }
      });
    });
  }

  private setupNetworkListener(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored - processing queue');
      setTimeout(() => this.processQueue(), 1000); // Small delay to ensure connection is stable
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost - queue will accumulate submissions');
    });
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // App became visible and we're online - try to sync
        this.processQueue();
      }
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.listeners.clear();
  }
}

// Create and export singleton instance
export const offlineQueue = new OfflineQueue();

// Export types for external use
export type { QueuedSubmission, QueueStatus, OfflineQueueOptions };