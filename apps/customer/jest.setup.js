import '@testing-library/jest-dom';
import { configureAxe } from 'jest-axe';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
  usePathname() {
    return '';
  },
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001';

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Configure axe for accessibility testing
const axe = configureAxe({
  rules: {
    // Disable color contrast check in tests as it's not reliable in jsdom
    'color-contrast': { enabled: false },
  },
});

// Add custom matchers for accessibility testing
expect.extend({
  toHaveNoViolations: axe.toHaveNoViolations,
});

// Mock PWA APIs for testing
Object.defineProperty(window, 'navigator', {
  writable: true,
  value: {
    ...window.navigator,
    serviceWorker: {
      register: jest.fn().mockResolvedValue({
        update: jest.fn(),
        unregister: jest.fn(),
      }),
      ready: jest.fn().mockResolvedValue({
        update: jest.fn(),
      }),
    },
  },
});

// Mock beforeinstallprompt event for PWA testing
global.BeforeInstallPromptEvent = class {
  constructor() {
    this.prompt = jest.fn();
    this.userChoice = Promise.resolve({ outcome: 'accepted' });
  }
};