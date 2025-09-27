/**
 * Background Sync Service
 * Handles background synchronization of data when network connectivity is restored
 */

import { offlineQueue, type QueuedSubmission } from './OfflineQueue';

interface SyncTask {
  id: string;
  type: 'verification' | 'support' | 'accessibility' | 'feedback' | 'call-status';
  data: any;
  priority: 'high' | 'medium' | 'low';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  createdAt: number;
}

interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
  retryAfter?: number;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingTasks: number;
  lastSyncAttempt: number | null;
  lastSuccessfulSync: number | null;
  failedTasks: number;
  totalSynced: number;
}

interface BackgroundSyncOptions {
  enableServiceWorkerSync: boolean;
  syncInterval: number;
  maxRetries: number;
  retryDelayBase: number;
  batchSize: number;
  enableNotifications: boolean;
}

const DEFAULT_OPTIONS: BackgroundSyncOptions = {
  enableServiceWorkerSync: true,
  syncInterval: 30000, // 30 seconds
  maxRetries: 5,
  retryDelayBase: 2000, // 2 seconds, exponential backoff
  batchSize: 5,
  enableNotifications: true
};

export class BackgroundSync {
  private options: BackgroundSyncOptions;
  private syncInterval: number | null = null;
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private stats = {
    lastSyncAttempt: null as number | null,
    lastSuccessfulSync: null as number | null,
    totalSynced: 0,
    failedTasks: 0
  };

  constructor(options: Partial<BackgroundSyncOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.initialize();
  }

  /**
   * Initialize background sync service
   */
  private async initialize(): Promise<void> {
    this.setupNetworkListeners();
    this.setupVisibilityListeners();
    this.setupServiceWorkerSync();
    this.startPeriodicSync();

    // Initial sync if online
    if (this.isOnline) {
      setTimeout(() => this.sync(), 1000);
    }
  }

  /**
   * Setup network connectivity listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[BackgroundSync] Network connection restored');
      this.isOnline = true;
      this.notifyStatusChange();
      
      // Immediate sync when coming back online
      this.sync();
    });

    window.addEventListener('offline', () => {
      console.log('[BackgroundSync] Network connection lost');
      this.isOnline = false;
      this.notifyStatusChange();
    });
  }

  /**
   * Setup visibility change listeners
   */
  private setupVisibilityListeners(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        // App became visible and we're online - trigger sync
        console.log('[BackgroundSync] App visible, triggering sync');
        this.sync();
      }
    });
  }

  /**
   * Setup Service Worker background sync
   */
  private async setupServiceWorkerSync(): Promise<void> {
    if (!this.options.enableServiceWorkerSync || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      
      // Listen for sync events from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_SUCCESS') {
          this.handleSyncSuccess(event.data);
        }
      });

      console.log('[BackgroundSync] Service Worker sync enabled');
    } catch (error) {
      console.error('[BackgroundSync] Failed to setup Service Worker sync:', error);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.sync();
      }
    }, this.options.syncInterval);
  }

  /**
   * Main sync method
   */
  async sync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.stats.lastSyncAttempt = Date.now();
    this.notifyStatusChange();

    try {
      console.log('[BackgroundSync] Starting sync...');
      
      // Process offline queue
      await offlineQueue.processQueue();
      
      // Process any additional sync tasks
      await this.processSyncTasks();
      
      // Register service worker background sync if supported
      if (this.serviceWorkerRegistration && 'sync' in this.serviceWorkerRegistration) {
        await (this.serviceWorkerRegistration as any).sync.register('vocilia-background-sync');
      }

      this.stats.lastSuccessfulSync = Date.now();
      console.log('[BackgroundSync] Sync completed successfully');
      
      // Show success notification if enabled
      if (this.options.enableNotifications) {
        this.showSyncNotification('success');
      }

    } catch (error) {
      console.error('[BackgroundSync] Sync failed:', error);
      this.stats.failedTasks++;
      
      // Show error notification if enabled
      if (this.options.enableNotifications) {
        this.showSyncNotification('error', error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Process additional sync tasks beyond the offline queue
   */
  private async processSyncTasks(): Promise<void> {
    const tasks = await this.getSyncTasks();
    
    if (tasks.length === 0) {
      return;
    }

    console.log(`[BackgroundSync] Processing ${tasks.length} sync tasks`);

    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += this.options.batchSize) {
      const batch = tasks.slice(i, i + this.options.batchSize);
      await this.processBatch(batch);
      
      // Small delay between batches to avoid overwhelming the server
      if (i + this.options.batchSize < tasks.length) {
        await this.delay(1000);
      }
    }
  }

  /**
   * Process a batch of sync tasks
   */
  private async processBatch(tasks: SyncTask[]): Promise<void> {
    const promises = tasks.map(task => this.processTask(task));
    await Promise.allSettled(promises);
  }

  /**
   * Process individual sync task
   */
  private async processTask(task: SyncTask): Promise<void> {
    try {
      console.log(`[BackgroundSync] Processing task: ${task.id} (${task.type})`);
      
      const result = await this.executeTask(task);
      
      if (result.success) {
        await this.removeSyncTask(task.id);
        this.stats.totalSynced++;
        console.log(`[BackgroundSync] Task ${task.id} completed successfully`);
      } else {
        await this.handleTaskFailure(task, result.error || 'Unknown error', result.retryAfter);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleTaskFailure(task, errorMessage);
    }
  }

  /**
   * Execute sync task
   */
  private async executeTask(task: SyncTask): Promise<SyncResult> {
    try {
      const response = await fetch(task.url, {
        method: task.method,
        headers: task.headers,
        body: task.method !== 'GET' ? JSON.stringify(task.data) : undefined
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        return { success: true, data };
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}`,
          retryAfter: this.getRetryAfterFromResponse(response)
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(task: SyncTask, error: string, retryAfter?: number): Promise<void> {
    task.retryCount++;
    
    if (task.retryCount >= task.maxRetries) {
      console.warn(`[BackgroundSync] Task ${task.id} failed permanently after ${task.maxRetries} retries`);
      await this.removeSyncTask(task.id);
      this.stats.failedTasks++;
    } else {
      // Calculate next retry time with exponential backoff
      const backoffDelay = Math.min(
        this.options.retryDelayBase * Math.pow(2, task.retryCount - 1),
        300000 // Maximum 5 minutes
      );
      
      task.nextRetryAt = Date.now() + (retryAfter || backoffDelay);
      
      await this.updateSyncTask(task);
      console.log(`[BackgroundSync] Task ${task.id} will retry in ${backoffDelay}ms (attempt ${task.retryCount}/${task.maxRetries})`);
    }
  }

  /**
   * Add task to sync queue
   */
  async addSyncTask(
    type: SyncTask['type'],
    data: any,
    url: string,
    method: SyncTask['method'] = 'POST',
    priority: SyncTask['priority'] = 'medium',
    headers: Record<string, string> = {}
  ): Promise<string> {
    const task: SyncTask = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      url,
      method,
      priority,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      nextRetryAt: Date.now(),
      createdAt: Date.now()
    };

    await this.storeSyncTask(task);
    
    // Trigger immediate sync if online
    if (this.isOnline) {
      setTimeout(() => this.sync(), 100);
    }

    return task.id;
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const tasks = await this.getSyncTasks();
    const pendingTasks = tasks.filter(t => t.nextRetryAt <= Date.now()).length;
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingTasks,
      lastSyncAttempt: this.stats.lastSyncAttempt,
      lastSuccessfulSync: this.stats.lastSuccessfulSync,
      failedTasks: this.stats.failedTasks,
      totalSynced: this.stats.totalSynced
    };
  }

  /**
   * Add status change listener
   */
  addStatusListener(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Force immediate sync
   */
  async forceSync(): Promise<void> {
    if (this.isSyncing) {
      console.warn('[BackgroundSync] Sync already in progress');
      return;
    }

    console.log('[BackgroundSync] Force sync triggered');
    await this.sync();
  }

  /**
   * Pause background sync
   */
  pause(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[BackgroundSync] Paused');
  }

  /**
   * Resume background sync
   */
  resume(): void {
    this.startPeriodicSync();
    console.log('[BackgroundSync] Resumed');
  }

  /**
   * Clear all sync tasks
   */
  async clearTasks(): Promise<void> {
    localStorage.removeItem('vocilia-sync-tasks');
    this.notifyStatusChange();
  }

  /**
   * Private helper methods
   */
  private notifyStatusChange(): void {
    this.getStatus().then(status => {
      this.listeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('[BackgroundSync] Error in status listener:', error);
        }
      });
    });
  }

  private handleSyncSuccess(data: any): void {
    console.log('[BackgroundSync] Service Worker sync success:', data);
    this.stats.totalSynced++;
    this.stats.lastSuccessfulSync = Date.now();
    this.notifyStatusChange();
  }

  private async getSyncTasks(): Promise<SyncTask[]> {
    try {
      const stored = localStorage.getItem('vocilia-sync-tasks');
      if (stored) {
        const tasks = JSON.parse(stored) as SyncTask[];
        // Filter tasks that are ready for retry
        return tasks.filter(task => task.nextRetryAt <= Date.now());
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to load sync tasks:', error);
    }
    return [];
  }

  private async storeSyncTask(task: SyncTask): Promise<void> {
    try {
      const stored = localStorage.getItem('vocilia-sync-tasks');
      const tasks = stored ? JSON.parse(stored) as SyncTask[] : [];
      tasks.push(task);
      localStorage.setItem('vocilia-sync-tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('[BackgroundSync] Failed to store sync task:', error);
    }
  }

  private async updateSyncTask(updatedTask: SyncTask): Promise<void> {
    try {
      const stored = localStorage.getItem('vocilia-sync-tasks');
      if (stored) {
        const tasks = JSON.parse(stored) as SyncTask[];
        const index = tasks.findIndex(t => t.id === updatedTask.id);
        if (index !== -1) {
          tasks[index] = updatedTask;
          localStorage.setItem('vocilia-sync-tasks', JSON.stringify(tasks));
        }
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to update sync task:', error);
    }
  }

  private async removeSyncTask(taskId: string): Promise<void> {
    try {
      const stored = localStorage.getItem('vocilia-sync-tasks');
      if (stored) {
        const tasks = JSON.parse(stored) as SyncTask[];
        const filtered = tasks.filter(t => t.id !== taskId);
        localStorage.setItem('vocilia-sync-tasks', JSON.stringify(filtered));
      }
    } catch (error) {
      console.error('[BackgroundSync] Failed to remove sync task:', error);
    }
  }

  private getRetryAfterFromResponse(response: Response): number | undefined {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter);
      return isNaN(seconds) ? undefined : seconds * 1000;
    }
    return undefined;
  }

  private async showSyncNotification(type: 'success' | 'error', message?: string): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = type === 'success' ? 'Sync slutförd' : 'Sync misslyckades';
      const body = type === 'success' 
        ? 'Alla väntande data har synkroniserats'
        : `Synkronisering misslyckades: ${message || 'Okänt fel'}`;

      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        tag: 'sync-notification',
        silent: true
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.listeners.clear();
  }
}

// Create and export singleton instance
export const backgroundSync = new BackgroundSync();

// Export types for external use
export type { SyncTask, SyncResult, SyncStatus, BackgroundSyncOptions };