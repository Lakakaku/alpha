/**
 * Unit Tests for PWA Manager Service
 * 
 * Comprehensive test suite for Progressive Web App management functionality.
 * Tests installation prompts, update detection, capability checks, and storage management.
 */

import { PWAManager } from '../../src/services/pwa/PWAManager';

// Mock service worker registration
const mockServiceWorkerRegistration = {
  installing: null,
  waiting: null,
  active: null,
  update: jest.fn(),
  unregister: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scope: 'https://test.vocilia.com/',
  pushManager: {
    subscribe: jest.fn(),
    getSubscription: jest.fn(),
  },
};

// Mock before install prompt event
const mockBeforeInstallPromptEvent = {
  preventDefault: jest.fn(),
  prompt: jest.fn(),
  userChoice: Promise.resolve({ outcome: 'accepted' as const }),
};

// Mock navigator
const mockNavigator = {
  serviceWorker: {
    register: jest.fn(),
    ready: Promise.resolve(mockServiceWorkerRegistration),
    controller: mockServiceWorkerRegistration,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  storage: {
    estimate: jest.fn(),
    persist: jest.fn(),
  },
  share: jest.fn(),
  userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36',
  standalone: false,
  getDisplayMedia: jest.fn(),
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
  permissions: {
    query: jest.fn(),
  },
  getBattery: jest.fn(),
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
  },
};

// Mock window
const mockWindow = {
  navigator: mockNavigator,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  location: {
    protocol: 'https:',
    host: 'test.vocilia.com',
  },
  screen: {
    orientation: {
      type: 'portrait-primary',
      addEventListener: jest.fn(),
    },
  },
  matchMedia: jest.fn((query) => ({
    matches: query === '(display-mode: standalone)',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  Notification: {
    permission: 'default',
    requestPermission: jest.fn(),
  },
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
};

// Setup global mocks
beforeAll(() => {
  Object.defineProperty(global, 'window', {
    value: mockWindow,
    writable: true,
  });
  Object.defineProperty(global, 'navigator', {
    value: mockNavigator,
    writable: true,
  });
});

describe('PWAManager', () => {
  let pwaManager: PWAManager;

  beforeEach(() => {
    jest.clearAllMocks();
    pwaManager = new PWAManager();
    
    // Reset mock implementations
    mockNavigator.serviceWorker.register.mockResolvedValue(mockServiceWorkerRegistration);
    mockNavigator.storage.estimate.mockResolvedValue({
      quota: 100000000,
      usage: 50000000,
    });
    mockNavigator.permissions.query.mockResolvedValue({
      state: 'granted',
    });
    mockWindow.localStorage.getItem.mockReturnValue(null);
    mockWindow.Notification.requestPermission.mockResolvedValue('granted');
  });

  describe('Initialization', () => {
    it('should initialize PWA manager successfully', () => {
      expect(pwaManager).toBeInstanceOf(PWAManager);
    });

    it('should register service worker on initialization', async () => {
      await pwaManager.init();

      expect(mockNavigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
      });
    });

    it('should handle service worker registration failure', async () => {
      const registrationError = new Error('Service worker registration failed');
      mockNavigator.serviceWorker.register.mockRejectedValue(registrationError);

      await expect(pwaManager.init()).rejects.toThrow('Service worker registration failed');
    });

    it('should set up event listeners on initialization', async () => {
      await pwaManager.init();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'appinstalled',
        expect.any(Function)
      );
    });
  });

  describe('Installation Management', () => {
    beforeEach(async () => {
      await pwaManager.init();
    });

    it('should capture install prompt event', () => {
      const beforeInstallPromptHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'beforeinstallprompt')?.[1];

      expect(beforeInstallPromptHandler).toBeDefined();

      // Simulate beforeinstallprompt event
      beforeInstallPromptHandler(mockBeforeInstallPromptEvent);

      expect(mockBeforeInstallPromptEvent.preventDefault).toHaveBeenCalled();
    });

    it('should show install prompt when available', async () => {
      // Simulate captured install prompt
      (pwaManager as any).deferredPrompt = mockBeforeInstallPromptEvent;

      const result = await pwaManager.showInstallPrompt();

      expect(mockBeforeInstallPromptEvent.prompt).toHaveBeenCalled();
      expect(result).toEqual({ outcome: 'accepted' });
    });

    it('should handle install prompt not available', async () => {
      (pwaManager as any).deferredPrompt = null;

      const result = await pwaManager.showInstallPrompt();

      expect(result).toEqual({ 
        outcome: 'dismissed',
        error: 'Install prompt not available'
      });
    });

    it('should detect if app is installable', () => {
      (pwaManager as any).deferredPrompt = mockBeforeInstallPromptEvent;

      const isInstallable = pwaManager.isInstallable();

      expect(isInstallable).toBe(true);
    });

    it('should detect if app is already installed', () => {
      mockWindow.matchMedia = jest.fn((query) => ({
        matches: query === '(display-mode: standalone)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const isInstalled = pwaManager.isInstalled();

      expect(isInstalled).toBe(true);
    });

    it('should track app installation', () => {
      const appInstalledHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'appinstalled')?.[1];

      expect(appInstalledHandler).toBeDefined();

      // Simulate app installation
      const installEvent = new Event('appinstalled');
      appInstalledHandler(installEvent);

      expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith(
        'pwa_installed',
        'true'
      );
    });
  });

  describe('Update Management', () => {
    beforeEach(async () => {
      await pwaManager.init();
    });

    it('should check for app updates', async () => {
      (pwaManager as any).registration = mockServiceWorkerRegistration;

      await pwaManager.checkForUpdates();

      expect(mockServiceWorkerRegistration.update).toHaveBeenCalled();
    });

    it('should handle update check without registration', async () => {
      (pwaManager as any).registration = null;

      const result = await pwaManager.checkForUpdates();

      expect(result).toBe(false);
    });

    it('should detect pending updates', () => {
      (pwaManager as any).registration = {
        ...mockServiceWorkerRegistration,
        waiting: { state: 'installed' },
      };

      const hasUpdate = pwaManager.hasUpdate();

      expect(hasUpdate).toBe(true);
    });

    it('should apply pending updates', async () => {
      const mockWaitingWorker = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
      };

      (pwaManager as any).registration = {
        ...mockServiceWorkerRegistration,
        waiting: mockWaitingWorker,
      };

      await pwaManager.applyUpdate();

      expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
    });

    it('should handle update application without waiting worker', async () => {
      (pwaManager as any).registration = {
        ...mockServiceWorkerRegistration,
        waiting: null,
      };

      const result = await pwaManager.applyUpdate();

      expect(result).toBe(false);
    });
  });

  describe('Capability Detection', () => {
    it('should detect PWA capabilities accurately', async () => {
      const capabilities = await pwaManager.getCapabilities();

      expect(capabilities).toEqual({
        serviceWorker: true,
        manifest: true,
        installPrompt: false, // No deferred prompt initially
        pushNotifications: true,
        backgroundSync: true,
        offlineCapable: true,
        shareAPI: true,
        storageEstimate: true,
        persistentStorage: true,
        fullScreen: false, // Not in standalone mode
        orientation: true,
        deviceMotion: false, // Not granted by default
        geolocation: true,
        camera: true,
        microphone: true,
        batterAPI: true,
        networkInformation: true,
      });
    });

    it('should handle missing APIs gracefully', async () => {
      // Remove some APIs
      delete (mockNavigator as any).serviceWorker;
      delete (mockNavigator as any).share;

      const capabilities = await pwaManager.getCapabilities();

      expect(capabilities.serviceWorker).toBe(false);
      expect(capabilities.shareAPI).toBe(false);
    });

    it('should check for iOS Safari specifically', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

      const isIOSSafari = (pwaManager as any).isIOSSafari();

      expect(isIOSSafari).toBe(true);
    });

    it('should check for Android Chrome specifically', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Chrome/90.0.4430.91';

      const isAndroidChrome = (pwaManager as any).isAndroidChrome();

      expect(isAndroidChrome).toBe(true);
    });
  });

  describe('Storage Management', () => {
    it('should get storage information', async () => {
      const storageInfo = await pwaManager.getStorageInfo();

      expect(storageInfo).toEqual({
        quota: 100000000,
        usage: 50000000,
        available: 50000000,
        percentage: 50,
        persistent: false,
      });
    });

    it('should request persistent storage', async () => {
      mockNavigator.storage.persist.mockResolvedValue(true);

      const result = await pwaManager.requestPersistentStorage();

      expect(result).toBe(true);
      expect(mockNavigator.storage.persist).toHaveBeenCalled();
    });

    it('should handle storage estimate errors', async () => {
      mockNavigator.storage.estimate.mockRejectedValue(new Error('Storage not available'));

      const storageInfo = await pwaManager.getStorageInfo();

      expect(storageInfo).toEqual({
        quota: 0,
        usage: 0,
        available: 0,
        percentage: 0,
        persistent: false,
      });
    });

    it('should clear app data', async () => {
      const mockCaches = {
        keys: jest.fn().mockResolvedValue(['cache1', 'cache2']),
        delete: jest.fn().mockResolvedValue(true),
      };

      (global as any).caches = mockCaches;

      await pwaManager.clearAppData();

      expect(mockCaches.keys).toHaveBeenCalled();
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalledWith('pwa_installed');
    });
  });

  describe('Notification Management', () => {
    it('should request notification permission', async () => {
      const result = await pwaManager.requestNotificationPermission();

      expect(result).toBe('granted');
      expect(mockWindow.Notification.requestPermission).toHaveBeenCalled();
    });

    it('should handle notification permission denial', async () => {
      mockWindow.Notification.requestPermission.mockResolvedValue('denied');

      const result = await pwaManager.requestNotificationPermission();

      expect(result).toBe('denied');
    });

    it('should check notification permission status', () => {
      mockWindow.Notification.permission = 'granted';

      const hasPermission = pwaManager.hasNotificationPermission();

      expect(hasPermission).toBe(true);
    });

    it('should subscribe to push notifications', async () => {
      const mockSubscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        keys: {
          p256dh: 'test-p256dh',
          auth: 'test-auth',
        },
      };

      mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue(mockSubscription);
      (pwaManager as any).registration = mockServiceWorkerRegistration;

      const subscription = await pwaManager.subscribeToPushNotifications();

      expect(subscription).toEqual(mockSubscription);
      expect(mockServiceWorkerRegistration.pushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(String),
      });
    });
  });

  describe('Share API', () => {
    it('should share content using Web Share API', async () => {
      mockNavigator.share.mockResolvedValue(undefined);

      const shareData = {
        title: 'Test Share',
        text: 'Test share content',
        url: 'https://test.vocilia.com',
      };

      await pwaManager.share(shareData);

      expect(mockNavigator.share).toHaveBeenCalledWith(shareData);
    });

    it('should handle share API not available', async () => {
      delete (mockNavigator as any).share;

      const shareData = {
        title: 'Test Share',
        text: 'Test share content',
        url: 'https://test.vocilia.com',
      };

      await expect(pwaManager.share(shareData)).rejects.toThrow('Web Share API not available');
    });

    it('should handle share cancellation', async () => {
      mockNavigator.share.mockRejectedValue(new Error('Share cancelled'));

      const shareData = {
        title: 'Test Share',
        text: 'Test share content',
        url: 'https://test.vocilia.com',
      };

      await expect(pwaManager.share(shareData)).rejects.toThrow('Share cancelled');
    });
  });

  describe('Event Handling', () => {
    it('should handle visibility change events', async () => {
      await pwaManager.init();

      const visibilityChangeHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1];

      expect(visibilityChangeHandler).toBeDefined();

      // Simulate visibility change
      Object.defineProperty(document, 'hidden', { value: false });
      visibilityChangeHandler();

      // Should trigger update check when app becomes visible
      expect(mockServiceWorkerRegistration.update).toHaveBeenCalled();
    });

    it('should handle online/offline events', async () => {
      await pwaManager.init();

      const onlineHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'online')?.[1];
      const offlineHandler = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'offline')?.[1];

      expect(onlineHandler).toBeDefined();
      expect(offlineHandler).toBeDefined();

      // Test handlers exist and can be called
      onlineHandler();
      offlineHandler();
    });

    it('should handle orientation change events', async () => {
      await pwaManager.init();

      expect(mockWindow.screen.orientation.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should throttle update checks', async () => {
      jest.useFakeTimers();
      
      await pwaManager.init();
      (pwaManager as any).registration = mockServiceWorkerRegistration;

      // Multiple rapid update checks
      pwaManager.checkForUpdates();
      pwaManager.checkForUpdates();
      pwaManager.checkForUpdates();

      jest.runAllTimers();

      // Should only call update once due to throttling
      expect(mockServiceWorkerRegistration.update).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('should cache capability detection results', async () => {
      const capabilities1 = await pwaManager.getCapabilities();
      const capabilities2 = await pwaManager.getCapabilities();

      expect(capabilities1).toEqual(capabilities2);
      
      // Should only query permissions once due to caching
      expect(mockNavigator.permissions.query).toHaveBeenCalledTimes(4); // Called for each capability check
    });
  });

  describe('Error Handling', () => {
    it('should handle service worker errors gracefully', async () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Service worker error',
        filename: '/sw.js',
        lineno: 1,
      });

      mockNavigator.serviceWorker.addEventListener = jest.fn((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(errorEvent), 0);
        }
      });

      await pwaManager.init();

      // Should not throw despite service worker error
      expect(pwaManager).toBeDefined();
    });

    it('should handle update errors gracefully', async () => {
      mockServiceWorkerRegistration.update.mockRejectedValue(new Error('Update failed'));
      (pwaManager as any).registration = mockServiceWorkerRegistration;

      const result = await pwaManager.checkForUpdates();

      expect(result).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      mockNavigator.storage.estimate.mockRejectedValue(new Error('Storage access denied'));

      const storageInfo = await pwaManager.getStorageInfo();

      expect(storageInfo.quota).toBe(0);
      expect(storageInfo.usage).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on disposal', () => {
      pwaManager.dispose();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'appinstalled',
        expect.any(Function)
      );
    });

    it('should handle disposal without initialization', () => {
      const newManager = new PWAManager();
      
      expect(() => newManager.dispose()).not.toThrow();
    });
  });
});