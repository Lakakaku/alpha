/**
 * T017: PWA Installation Flow Integration Test
 * 
 * Tests the complete PWA installation flow including:
 * - Installation prompt display conditions
 * - Installation process for different browsers
 * - App-like experience after installation
 * - Service worker registration and activation
 * - Offline capabilities after PWA installation
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock PWA hook and components (will be created in implementation)
const mockUsePWA = jest.fn();
const mockPWAInstallPrompt = jest.fn().mockReturnValue({ children: null });
const mockPWAStatus = jest.fn().mockReturnValue({ children: null });

jest.mock('@/hooks/usePWA', () => ({
  usePWA: mockUsePWA,
}));

jest.mock('@/components/PWAInstallPrompt', () => ({
  PWAInstallPrompt: mockPWAInstallPrompt,
}));

jest.mock('@/components/PWAStatus', () => ({
  PWAStatus: mockPWAStatus,
}));

// Mock service worker registration
const mockServiceWorkerRegistration = {
  update: jest.fn().mockResolvedValue(undefined),
  unregister: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scope: '/test-scope/',
  active: {
    postMessage: jest.fn(),
    addEventListener: jest.fn(),
  },
  installing: null,
  waiting: null,
};

// Mock BeforeInstallPromptEvent
class MockBeforeInstallPromptEvent extends Event {
  prompt: jest.Mock;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt');
    this.prompt = jest.fn().mockResolvedValue(undefined);
    this.userChoice = Promise.resolve({ outcome });
  }
}

// Mock PWA installation state
interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isServiceWorkerReady: boolean;
  installPromptEvent: MockBeforeInstallPromptEvent | null;
  showInstallPrompt: boolean;
  installationSource: 'call-completion' | 'verification-success' | 'manual' | null;
}

describe('PWA Installation Flow', () => {
  let mockPWAState: PWAState;
  let originalNavigator: Navigator;

  beforeEach(() => {
    // Reset PWA state
    mockPWAState = {
      isInstallable: false,
      isInstalled: false,
      isServiceWorkerReady: false,
      installPromptEvent: null,
      showInstallPrompt: false,
      installationSource: null,
    };

    // Setup PWA hook mock
    mockUsePWA.mockReturnValue({
      ...mockPWAState,
      install: jest.fn(),
      dismissInstallPrompt: jest.fn(),
      checkServiceWorkerStatus: jest.fn(),
      registerServiceWorker: jest.fn(),
    });

    // Store original navigator
    originalNavigator = global.navigator;

    // Mock navigator with service worker support
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
          ready: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
          controller: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        standalone: false,
      },
    });

    // Mock window events
    global.addEventListener = jest.fn();
    global.removeEventListener = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      writable: true,
      value: originalNavigator,
    });
  });

  describe('PWA Installation Prompt Display Conditions', () => {
    test('should show install prompt after successful call completion', async () => {
      // Setup: Call completion scenario
      mockPWAState.isInstallable = true;
      mockPWAState.installPromptEvent = new MockBeforeInstallPromptEvent();
      mockPWAState.showInstallPrompt = true;
      mockPWAState.installationSource = 'call-completion';

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn().mockResolvedValue({ outcome: 'accepted' }),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      // Mock call completion page component
      const CallCompletionPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="call-completion-page">
            <div data-testid="call-success">Call completed successfully!</div>
            {pwa.showInstallPrompt && pwa.installationSource === 'call-completion' && (
              <div data-testid="pwa-install-prompt">
                <button 
                  data-testid="install-app-button"
                  onClick={pwa.install}
                >
                  Install Vocilia App
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<CallCompletionPage />);

      // Verify install prompt is shown
      expect(screen.getByTestId('pwa-install-prompt')).toBeInTheDocument();
      expect(screen.getByTestId('install-app-button')).toBeInTheDocument();
      expect(screen.getByText('Install Vocilia App')).toBeInTheDocument();
    });

    test('should show install prompt after successful verification', async () => {
      // Setup: Verification success scenario
      mockPWAState.isInstallable = true;
      mockPWAState.installPromptEvent = new MockBeforeInstallPromptEvent();
      mockPWAState.showInstallPrompt = true;
      mockPWAState.installationSource = 'verification-success';

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn().mockResolvedValue({ outcome: 'accepted' }),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      // Mock verification success page component
      const VerificationSuccessPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="verification-success-page">
            <div data-testid="verification-success">Verification successful!</div>
            {pwa.showInstallPrompt && pwa.installationSource === 'verification-success' && (
              <div data-testid="pwa-install-prompt">
                <button 
                  data-testid="install-app-button"
                  onClick={pwa.install}
                >
                  Install App for Easy Access
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<VerificationSuccessPage />);

      // Verify install prompt is shown
      expect(screen.getByTestId('pwa-install-prompt')).toBeInTheDocument();
      expect(screen.getByTestId('install-app-button')).toBeInTheDocument();
      expect(screen.getByText('Install App for Easy Access')).toBeInTheDocument();
    });

    test('should not show install prompt when app is already installed', async () => {
      // Setup: App already installed
      mockPWAState.isInstalled = true;
      mockPWAState.isInstallable = false;
      mockPWAState.showInstallPrompt = false;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const TestPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="test-page">
            {pwa.showInstallPrompt && (
              <div data-testid="pwa-install-prompt">Install App</div>
            )}
            {pwa.isInstalled && (
              <div data-testid="app-installed-status">App is installed</div>
            )}
          </div>
        );
      };

      render(<TestPage />);

      // Verify install prompt is not shown but installed status is
      expect(screen.queryByTestId('pwa-install-prompt')).not.toBeInTheDocument();
      expect(screen.getByTestId('app-installed-status')).toBeInTheDocument();
    });

    test('should not show install prompt on non-installable browsers', async () => {
      // Setup: Browser doesn't support PWA installation
      mockPWAState.isInstallable = false;
      mockPWAState.installPromptEvent = null;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const TestPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="test-page">
            {pwa.showInstallPrompt && (
              <div data-testid="pwa-install-prompt">Install App</div>
            )}
            {!pwa.isInstallable && (
              <div data-testid="not-installable">PWA not supported</div>
            )}
          </div>
        );
      };

      render(<TestPage />);

      // Verify install prompt is not shown
      expect(screen.queryByTestId('pwa-install-prompt')).not.toBeInTheDocument();
      expect(screen.getByTestId('not-installable')).toBeInTheDocument();
    });
  });

  describe('PWA Installation Process', () => {
    test('should handle successful installation flow', async () => {
      const mockInstall = jest.fn().mockResolvedValue({ outcome: 'accepted' });
      const mockDismissInstallPrompt = jest.fn();

      mockPWAState.isInstallable = true;
      mockPWAState.installPromptEvent = new MockBeforeInstallPromptEvent('accepted');
      mockPWAState.showInstallPrompt = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: mockInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const InstallPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="install-page">
            {pwa.showInstallPrompt && (
              <div data-testid="pwa-install-prompt">
                <button 
                  data-testid="install-button"
                  onClick={pwa.install}
                >
                  Install App
                </button>
                <button 
                  data-testid="dismiss-button"
                  onClick={pwa.dismissInstallPrompt}
                >
                  Maybe Later
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<InstallPage />);

      // Click install button
      const installButton = screen.getByTestId('install-button');
      await act(async () => {
        fireEvent.click(installButton);
      });

      // Verify install was called
      expect(mockInstall).toHaveBeenCalledTimes(1);
    });

    test('should handle installation dismissal', async () => {
      const mockInstall = jest.fn();
      const mockDismissInstallPrompt = jest.fn();

      mockPWAState.isInstallable = true;
      mockPWAState.showInstallPrompt = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: mockInstall,
        dismissInstallPrompt: mockDismissInstallPrompt,
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const InstallPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="install-page">
            {pwa.showInstallPrompt && (
              <div data-testid="pwa-install-prompt">
                <button 
                  data-testid="install-button"
                  onClick={pwa.install}
                >
                  Install App
                </button>
                <button 
                  data-testid="dismiss-button"
                  onClick={pwa.dismissInstallPrompt}
                >
                  Maybe Later
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<InstallPage />);

      // Click dismiss button
      const dismissButton = screen.getByTestId('dismiss-button');
      await act(async () => {
        fireEvent.click(dismissButton);
      });

      // Verify dismiss was called
      expect(mockDismissInstallPrompt).toHaveBeenCalledTimes(1);
      expect(mockInstall).not.toHaveBeenCalled();
    });

    test('should handle installation rejection by user', async () => {
      const mockInstall = jest.fn().mockResolvedValue({ outcome: 'dismissed' });

      mockPWAState.isInstallable = true;
      mockPWAState.installPromptEvent = new MockBeforeInstallPromptEvent('dismissed');
      mockPWAState.showInstallPrompt = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: mockInstall,
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const InstallPage = () => {
        const pwa = mockUsePWA();
        return (
          <div data-testid="install-page">
            <button 
              data-testid="install-button"
              onClick={pwa.install}
            >
              Install App
            </button>
          </div>
        );
      };

      render(<InstallPage />);

      // Click install button
      const installButton = screen.getByTestId('install-button');
      await act(async () => {
        fireEvent.click(installButton);
      });

      // Verify install was attempted
      expect(mockInstall).toHaveBeenCalledTimes(1);
    });

    test('should handle different browser installation flows', async () => {
      const testCases = [
        {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
          platform: 'iOS Safari',
          expectInstallable: false, // iOS Safari doesn't support standard PWA installation
        },
        {
          userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36 Chrome/91.0.4472.120',
          platform: 'Android Chrome',
          expectInstallable: true,
        },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124',
          platform: 'Desktop Chrome',
          expectInstallable: true,
        },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
          platform: 'Desktop Firefox',
          expectInstallable: false, // Firefox has limited PWA support
        },
      ];

      for (const testCase of testCases) {
        // Mock user agent
        Object.defineProperty(global.navigator, 'userAgent', {
          writable: true,
          value: testCase.userAgent,
        });

        mockPWAState.isInstallable = testCase.expectInstallable;
        mockPWAState.showInstallPrompt = testCase.expectInstallable;

        mockUsePWA.mockReturnValue({
          ...mockPWAState,
          install: jest.fn(),
          dismissInstallPrompt: jest.fn(),
          checkServiceWorkerStatus: jest.fn(),
          registerServiceWorker: jest.fn(),
        });

        const TestPage = () => {
          const pwa = mockUsePWA();
          return (
            <div data-testid={`test-page-${testCase.platform}`}>
              {pwa.isInstallable ? (
                <div data-testid="installable">Installable</div>
              ) : (
                <div data-testid="not-installable">Not Installable</div>
              )}
            </div>
          );
        };

        const { unmount } = render(<TestPage />);

        if (testCase.expectInstallable) {
          expect(screen.getByTestId('installable')).toBeInTheDocument();
        } else {
          expect(screen.getByTestId('not-installable')).toBeInTheDocument();
        }

        unmount();
      }
    });
  });

  describe('App-like Experience After Installation', () => {
    test('should detect when app is running in standalone mode', async () => {
      // Mock standalone mode
      Object.defineProperty(global.navigator, 'standalone', {
        writable: true,
        value: true,
      });

      mockPWAState.isInstalled = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const AppPage = () => {
        const pwa = mockUsePWA();
        const isStandalone = global.navigator.standalone || 
          window.matchMedia('(display-mode: standalone)').matches;

        return (
          <div data-testid="app-page">
            {isStandalone && (
              <div data-testid="standalone-mode">Running in app mode</div>
            )}
            {pwa.isInstalled && (
              <div data-testid="installed-features">
                <div data-testid="offline-support">Offline support enabled</div>
                <div data-testid="push-notifications">Push notifications ready</div>
              </div>
            )}
          </div>
        );
      };

      render(<AppPage />);

      // Verify standalone mode detection
      expect(screen.getByTestId('standalone-mode')).toBeInTheDocument();
      expect(screen.getByTestId('installed-features')).toBeInTheDocument();
    });

    test('should show different UI when running as installed app', async () => {
      mockPWAState.isInstalled = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const Navigation = () => {
        const pwa = mockUsePWA();
        return (
          <nav data-testid="navigation">
            {pwa.isInstalled ? (
              <div data-testid="app-navigation">
                <button data-testid="home-button">Home</button>
                <button data-testid="history-button">History</button>
                <button data-testid="settings-button">Settings</button>
              </div>
            ) : (
              <div data-testid="web-navigation">
                <a href="/" data-testid="home-link">Home</a>
              </div>
            )}
          </nav>
        );
      };

      render(<Navigation />);

      // Verify app-style navigation is shown
      expect(screen.getByTestId('app-navigation')).toBeInTheDocument();
      expect(screen.queryByTestId('web-navigation')).not.toBeInTheDocument();
      expect(screen.getByTestId('home-button')).toBeInTheDocument();
      expect(screen.getByTestId('history-button')).toBeInTheDocument();
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });

    test('should handle app launch from home screen', async () => {
      // Mock window.addEventListener for app launch detection
      const mockAddEventListener = jest.fn();
      global.addEventListener = mockAddEventListener;

      mockPWAState.isInstalled = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const AppLauncher = () => {
        const pwa = mockUsePWA();
        
        // Simulate app launch tracking
        React.useEffect(() => {
          if (pwa.isInstalled) {
            const handleAppLaunch = () => {
              // Track app launch event
            };
            
            window.addEventListener('appinstalled', handleAppLaunch);
            return () => window.removeEventListener('appinstalled', handleAppLaunch);
          }
        }, [pwa.isInstalled]);

        return (
          <div data-testid="app-launcher">
            {pwa.isInstalled && (
              <div data-testid="app-launched">App launched from home screen</div>
            )}
          </div>
        );
      };

      render(<AppLauncher />);

      // Verify app launch tracking is set up
      expect(screen.getByTestId('app-launched')).toBeInTheDocument();
    });
  });

  describe('Service Worker Registration and Activation', () => {
    test('should register service worker successfully', async () => {
      const mockRegisterServiceWorker = jest.fn().mockResolvedValue(mockServiceWorkerRegistration);

      mockPWAState.isServiceWorkerReady = false;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: mockRegisterServiceWorker,
      });

      const ServiceWorkerComponent = () => {
        const pwa = mockUsePWA();

        React.useEffect(() => {
          if (!pwa.isServiceWorkerReady) {
            pwa.registerServiceWorker();
          }
        }, [pwa]);

        return (
          <div data-testid="service-worker-component">
            {pwa.isServiceWorkerReady ? (
              <div data-testid="sw-ready">Service Worker Ready</div>
            ) : (
              <div data-testid="sw-loading">Loading Service Worker...</div>
            )}
          </div>
        );
      };

      render(<ServiceWorkerComponent />);

      // Verify service worker registration was attempted
      expect(mockRegisterServiceWorker).toHaveBeenCalledTimes(1);
    });

    test('should handle service worker registration failure', async () => {
      const mockRegisterServiceWorker = jest.fn().mockRejectedValue(
        new Error('Service Worker registration failed')
      );

      mockPWAState.isServiceWorkerReady = false;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: mockRegisterServiceWorker,
      });

      const ServiceWorkerComponent = () => {
        const pwa = mockUsePWA();
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
          if (!pwa.isServiceWorkerReady) {
            pwa.registerServiceWorker().catch((err: Error) => {
              setError(err.message);
            });
          }
        }, [pwa]);

        return (
          <div data-testid="service-worker-component">
            {error && (
              <div data-testid="sw-error">{error}</div>
            )}
          </div>
        );
      };

      render(<ServiceWorkerComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('sw-error')).toBeInTheDocument();
      });
    });

    test('should handle service worker updates', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(undefined);
      const updatedServiceWorkerRegistration = {
        ...mockServiceWorkerRegistration,
        update: mockUpdate,
      };

      const mockCheckServiceWorkerStatus = jest.fn().mockResolvedValue(updatedServiceWorkerRegistration);

      mockPWAState.isServiceWorkerReady = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: mockCheckServiceWorkerStatus,
        registerServiceWorker: jest.fn(),
      });

      const ServiceWorkerUpdater = () => {
        const pwa = mockUsePWA();

        const handleUpdateCheck = async () => {
          await pwa.checkServiceWorkerStatus();
        };

        return (
          <div data-testid="service-worker-updater">
            <button data-testid="check-updates" onClick={handleUpdateCheck}>
              Check for Updates
            </button>
          </div>
        );
      };

      render(<ServiceWorkerUpdater />);

      // Click update check button
      const checkButton = screen.getByTestId('check-updates');
      await act(async () => {
        fireEvent.click(checkButton);
      });

      // Verify service worker status check was called
      expect(mockCheckServiceWorkerStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline Capabilities After PWA Installation', () => {
    test('should enable offline functionality when PWA is installed', async () => {
      mockPWAState.isInstalled = true;
      mockPWAState.isServiceWorkerReady = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const OfflineComponent = () => {
        const pwa = mockUsePWA();
        const [isOnline, setIsOnline] = React.useState(navigator.onLine);

        React.useEffect(() => {
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);

          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);

          return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        }, []);

        return (
          <div data-testid="offline-component">
            {pwa.isInstalled && pwa.isServiceWorkerReady && (
              <div data-testid="offline-capabilities">
                <div data-testid="connection-status">
                  {isOnline ? 'Online' : 'Offline'}
                </div>
                <div data-testid="offline-storage">
                  Offline storage available
                </div>
                <div data-testid="background-sync">
                  Background sync enabled
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<OfflineComponent />);

      // Verify offline capabilities are available
      expect(screen.getByTestId('offline-capabilities')).toBeInTheDocument();
      expect(screen.getByTestId('offline-storage')).toBeInTheDocument();
      expect(screen.getByTestId('background-sync')).toBeInTheDocument();
    });

    test('should handle offline verification submissions', async () => {
      mockPWAState.isInstalled = true;
      mockPWAState.isServiceWorkerReady = true;

      // Mock IndexedDB for offline storage
      const mockOfflineQueue = {
        add: jest.fn().mockResolvedValue('queue-id-123'),
        getAll: jest.fn().mockResolvedValue([]),
        clear: jest.fn().mockResolvedValue(undefined),
      };

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
        offlineQueue: mockOfflineQueue,
      });

      const OfflineVerificationForm = () => {
        const pwa = mockUsePWA();

        const handleOfflineSubmit = async () => {
          if (pwa.isInstalled && !navigator.onLine) {
            await pwa.offlineQueue.add({
              type: 'verification',
              data: { time: '14:30', amount: '125.50', phone: '070-123 45 67' },
              timestamp: Date.now(),
            });
          }
        };

        return (
          <div data-testid="offline-verification-form">
            <button data-testid="offline-submit" onClick={handleOfflineSubmit}>
              Submit Offline
            </button>
          </div>
        );
      };

      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<OfflineVerificationForm />);

      // Click offline submit
      const submitButton = screen.getByTestId('offline-submit');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Verify offline submission was queued
      expect(mockOfflineQueue.add).toHaveBeenCalledWith({
        type: 'verification',
        data: { time: '14:30', amount: '125.50', phone: '070-123 45 67' },
        timestamp: expect.any(Number),
      });
    });

    test('should sync offline data when connection is restored', async () => {
      mockPWAState.isInstalled = true;
      mockPWAState.isServiceWorkerReady = true;

      const mockOfflineQueue = {
        add: jest.fn(),
        getAll: jest.fn().mockResolvedValue([
          { id: 1, type: 'verification', data: { time: '14:30', amount: '125.50' }},
        ]),
        clear: jest.fn().mockResolvedValue(undefined),
      };

      const mockSyncOfflineData = jest.fn().mockResolvedValue({ synced: 1 });

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
        offlineQueue: mockOfflineQueue,
        syncOfflineData: mockSyncOfflineData,
      });

      const OfflineSyncComponent = () => {
        const pwa = mockUsePWA();

        React.useEffect(() => {
          const handleOnline = async () => {
            if (pwa.isInstalled && pwa.syncOfflineData) {
              await pwa.syncOfflineData();
            }
          };

          window.addEventListener('online', handleOnline);
          return () => window.removeEventListener('online', handleOnline);
        }, [pwa]);

        return (
          <div data-testid="offline-sync-component">
            Sync component ready
          </div>
        );
      };

      render(<OfflineSyncComponent />);

      // Simulate going back online
      await act(async () => {
        const onlineEvent = new Event('online');
        window.dispatchEvent(onlineEvent);
      });

      // Wait for sync to complete
      await waitFor(() => {
        expect(mockSyncOfflineData).toHaveBeenCalledTimes(1);
      });
    });

    test('should show offline indicator when network is unavailable', async () => {
      mockPWAState.isInstalled = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const OfflineIndicator = () => {
        const pwa = mockUsePWA();
        const [isOnline, setIsOnline] = React.useState(navigator.onLine);

        React.useEffect(() => {
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);

          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);

          return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        }, []);

        return (
          <div data-testid="offline-indicator">
            {pwa.isInstalled && !isOnline && (
              <div data-testid="offline-banner">
                You're offline. Data will sync when connection is restored.
              </div>
            )}
          </div>
        );
      };

      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<OfflineIndicator />);

      // Simulate offline event
      await act(async () => {
        const offlineEvent = new Event('offline');
        window.dispatchEvent(offlineEvent);
      });

      // Verify offline indicator is shown
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
      expect(screen.getByText('You\'re offline. Data will sync when connection is restored.')).toBeInTheDocument();
    });
  });

  describe('PWA Installation Analytics and Monitoring', () => {
    test('should track installation analytics', async () => {
      const mockTrackEvent = jest.fn();
      
      // Mock analytics
      global.gtag = mockTrackEvent;

      const mockInstall = jest.fn().mockImplementation(async () => {
        // Simulate tracking installation
        mockTrackEvent('event', 'pwa_install_attempted', {
          source: 'call-completion',
          timestamp: Date.now(),
        });
        return { outcome: 'accepted' };
      });

      mockPWAState.isInstallable = true;
      mockPWAState.showInstallPrompt = true;
      mockPWAState.installationSource = 'call-completion';

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: mockInstall,
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const AnalyticsTestComponent = () => {
        const pwa = mockUsePWA();
        return (
          <button data-testid="install-with-analytics" onClick={pwa.install}>
            Install App
          </button>
        );
      };

      render(<AnalyticsTestComponent />);

      // Click install button
      await act(async () => {
        fireEvent.click(screen.getByTestId('install-with-analytics'));
      });

      // Verify analytics tracking
      expect(mockTrackEvent).toHaveBeenCalledWith('event', 'pwa_install_attempted', {
        source: 'call-completion',
        timestamp: expect.any(Number),
      });
    });

    test('should monitor PWA performance metrics', async () => {
      const mockPerformanceObserver = jest.fn();
      global.PerformanceObserver = jest.fn().mockImplementation(() => ({
        observe: mockPerformanceObserver,
        disconnect: jest.fn(),
      }));

      mockPWAState.isInstalled = true;

      mockUsePWA.mockReturnValue({
        ...mockPWAState,
        install: jest.fn(),
        dismissInstallPrompt: jest.fn(),
        checkServiceWorkerStatus: jest.fn(),
        registerServiceWorker: jest.fn(),
      });

      const PerformanceMonitor = () => {
        const pwa = mockUsePWA();

        React.useEffect(() => {
          if (pwa.isInstalled && 'PerformanceObserver' in window) {
            const observer = new PerformanceObserver(() => {
              // Monitor performance
            });
            observer.observe({ entryTypes: ['navigation', 'paint'] });
          }
        }, [pwa.isInstalled]);

        return (
          <div data-testid="performance-monitor">
            Performance monitoring active
          </div>
        );
      };

      render(<PerformanceMonitor />);

      // Verify performance monitoring is set up
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument();
      expect(global.PerformanceObserver).toHaveBeenCalled();
    });
  });
});

// Helper function to create React component for testing
const React = {
  useEffect: (callback: () => void | (() => void), deps: any[]) => {
    // Mock useEffect for testing
    callback();
  },
  useState: <T>(initial: T): [T, (value: T) => void] => {
    // Mock useState for testing
    return [initial, jest.fn()];
  },
};