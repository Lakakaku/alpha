/**
 * PWA Manager Service
 * Handles PWA installation, updates, and related functionality
 */

interface PWAInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWACapabilities {
  installable: boolean;
  installed: boolean;
  updateAvailable: boolean;
  standalone: boolean;
  notifications: boolean;
  backgroundSync: boolean;
  persistentStorage: boolean;
  canShare: boolean;
}

interface PWAInstallationStatus {
  isInstallable: boolean;
  isInstalled: boolean;
  canPrompt: boolean;
  installSource: 'browser' | 'homescreen' | 'system' | null;
  installDate: Date | null;
}

interface PWAUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string | null;
  newVersion: string | null;
  updateSize: number | null;
  releaseNotes: string | null;
}

export class PWAManager {
  private installPrompt: PWAInstallPromptEvent | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private checkUpdateInterval: number | null = null;
  private installPromptDelay = 3 * 60 * 1000; // 3 minutes
  private promptShown = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize PWA Manager
   */
  private async initialize(): Promise<void> {
    await this.setupServiceWorker();
    this.setupInstallPromptListener();
    this.setupAppInstalledListener();
    this.detectInstallationStatus();
    this.startUpdateChecker();
    
    // Setup delayed install prompt
    this.scheduleInstallPrompt();
  }

  /**
   * Setup service worker
   */
  private async setupServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('Service Worker registered:', this.registration.scope);

        // Listen for service worker updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.emit('updateAvailable', { registration: this.registration });
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Setup install prompt listener
   */
  private setupInstallPromptListener(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent default mini-infobar
      event.preventDefault();
      
      // Store for later use
      this.installPrompt = event as PWAInstallPromptEvent;
      
      console.log('PWA install prompt available');
      this.emit('installPromptAvailable', { canInstall: true });
    });
  }

  /**
   * Setup app installed listener
   */
  private setupAppInstalledListener(): void {
    window.addEventListener('appinstalled', (event) => {
      console.log('PWA was installed');
      this.installPrompt = null;
      this.recordInstallation('browser');
      this.emit('appInstalled', { source: 'browser' });
    });
  }

  /**
   * Detect current installation status
   */
  private detectInstallationStatus(): void {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    if (isStandalone) {
      this.recordInstallation('homescreen');
      this.emit('appInstalled', { source: 'homescreen' });
    }
  }

  /**
   * Start periodic update checker
   */
  private startUpdateChecker(): void {
    // Check for updates every 30 minutes
    this.checkUpdateInterval = window.setInterval(() => {
      this.checkForUpdates();
    }, 30 * 60 * 1000);

    // Initial check after 5 seconds
    setTimeout(() => this.checkForUpdates(), 5000);
  }

  /**
   * Schedule install prompt after delay
   */
  private scheduleInstallPrompt(): void {
    setTimeout(() => {
      if (this.canShowInstallPrompt() && !this.promptShown) {
        this.emit('suggestInstall', { reason: 'engagement' });
      }
    }, this.installPromptDelay);
  }

  /**
   * Show install prompt
   */
  async showInstallPrompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform: string } | null> {
    if (!this.installPrompt) {
      console.warn('Install prompt not available');
      return null;
    }

    try {
      this.promptShown = true;
      await this.installPrompt.prompt();
      const result = await this.installPrompt.userChoice;
      
      console.log('Install prompt result:', result);
      
      // Track the result
      this.trackInstallPromptResult(result.outcome);
      
      if (result.outcome === 'accepted') {
        this.emit('installPromptAccepted', result);
      } else {
        this.emit('installPromptDismissed', result);
      }

      return result;
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return null;
    }
  }

  /**
   * Check if install prompt can be shown
   */
  canShowInstallPrompt(): boolean {
    return !!this.installPrompt && 
           !this.isInstalled() && 
           !this.hasPromptBeenDismissedRecently();
  }

  /**
   * Check if app is installed
   */
  isInstalled(): boolean {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');
    
    return isStandalone || this.hasInstallationRecord();
  }

  /**
   * Get PWA capabilities
   */
  async getCapabilities(): Promise<PWACapabilities> {
    const capabilities: PWACapabilities = {
      installable: !!this.installPrompt,
      installed: this.isInstalled(),
      updateAvailable: await this.hasUpdateAvailable(),
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      notifications: 'Notification' in window && Notification.permission === 'granted',
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      persistentStorage: 'storage' in navigator && 'persist' in navigator.storage,
      canShare: 'share' in navigator
    };

    return capabilities;
  }

  /**
   * Get installation status
   */
  async getInstallationStatus(): Promise<PWAInstallationStatus> {
    const installData = this.getStoredInstallData();
    
    return {
      isInstallable: !!this.installPrompt,
      isInstalled: this.isInstalled(),
      canPrompt: this.canShowInstallPrompt(),
      installSource: (installData?.source as "browser" | "homescreen" | "system" | null) || null,
      installDate: installData?.date || null
    };
  }

  /**
   * Get update information
   */
  async getUpdateInfo(): Promise<PWAUpdateInfo> {
    const updateAvailable = await this.hasUpdateAvailable();
    
    return {
      updateAvailable,
      currentVersion: await this.getCurrentVersion(),
      newVersion: await this.getNewVersion(),
      updateSize: null, // Not easily available in web
      releaseNotes: null // Would need to be provided by app
    };
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      const hasUpdate = await this.hasUpdateAvailable();
      
      if (hasUpdate) {
        this.emit('updateFound', await this.getUpdateInfo());
      }
      
      return hasUpdate;
    } catch (error) {
      console.error('Update check failed:', error);
      return false;
    }
  }

  /**
   * Apply pending update
   */
  async applyUpdate(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      throw new Error('No update available');
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Reload the page to activate the new service worker
    window.location.reload();
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const granted = await navigator.storage.persist();
        console.log('Persistent storage granted:', granted);
        return granted;
      } catch (error) {
        console.error('Persistent storage request failed:', error);
      }
    }
    return false;
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<{ used: number; quota: number; percentage: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;
        
        return { used, quota, percentage };
      } catch (error) {
        console.error('Storage estimate failed:', error);
      }
    }
    return null;
  }

  /**
   * Clear app data
   */
  async clearAppData(): Promise<void> {
    try {
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear IndexedDB
      const databases = await indexedDB.databases();
      await Promise.all(databases.map(db => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(db.name!);
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = () => reject(deleteReq.error);
          });
        }
        return Promise.resolve(); // Return resolved promise for databases without names
      }));

      console.log('App data cleared');
      this.emit('dataCleared', {});
    } catch (error) {
      console.error('Failed to clear app data:', error);
      throw error;
    }
  }

  /**
   * Share content (if supported)
   */
  async share(data: { title?: string; text?: string; url?: string; files?: File[] }): Promise<boolean> {
    if ('share' in navigator) {
      try {
        await navigator.share(data);
        return true;
      } catch (error) {
        console.error('Share failed:', error);
      }
    }
    return false;
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Private helper methods
   */
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  private handleServiceWorkerMessage(data: any): void {
    switch (data.type) {
      case 'UPDATE_AVAILABLE':
        this.emit('updateAvailable', data);
        break;
      case 'SYNC_SUCCESS':
        this.emit('syncComplete', data);
        break;
      default:
        console.log('Unknown service worker message:', data);
    }
  }

  private async hasUpdateAvailable(): Promise<boolean> {
    return !!(this.registration && this.registration.waiting);
  }

  private async getCurrentVersion(): Promise<string | null> {
    if (!this.registration || !this.registration.active) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.version || null);
      };

      this.registration!.active!.postMessage(
        { type: 'GET_VERSION' },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }

  private async getNewVersion(): Promise<string | null> {
    // Would need to be implemented based on app versioning strategy
    return null;
  }

  private recordInstallation(source: 'browser' | 'homescreen' | 'system'): void {
    const installData = {
      source,
      date: new Date(),
      timestamp: Date.now()
    };
    
    localStorage.setItem('pwa-install-data', JSON.stringify(installData));
  }

  private getStoredInstallData(): { source: string; date: Date; timestamp: number } | null {
    try {
      const stored = localStorage.getItem('pwa-install-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          date: new Date(parsed.date)
        };
      }
    } catch (error) {
      console.error('Failed to parse install data:', error);
    }
    return null;
  }

  private hasInstallationRecord(): boolean {
    return !!this.getStoredInstallData();
  }

  private trackInstallPromptResult(outcome: 'accepted' | 'dismissed'): void {
    const promptData = {
      outcome,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    localStorage.setItem('pwa-prompt-result', JSON.stringify(promptData));
  }

  private hasPromptBeenDismissedRecently(): boolean {
    try {
      const stored = localStorage.getItem('pwa-prompt-result');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.outcome === 'dismissed') {
          // Don't show again for 7 days after dismissal
          const dismissalAge = Date.now() - parsed.timestamp;
          return dismissalAge < (7 * 24 * 60 * 60 * 1000);
        }
      }
    } catch (error) {
      console.error('Failed to check prompt history:', error);
    }
    return false;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.checkUpdateInterval) {
      clearInterval(this.checkUpdateInterval);
      this.checkUpdateInterval = null;
    }
    
    this.listeners.clear();
  }
}

// Create and export singleton instance
export const pwaManager = new PWAManager();

// Export types for external use
export type { PWACapabilities, PWAInstallationStatus, PWAUpdateInfo };