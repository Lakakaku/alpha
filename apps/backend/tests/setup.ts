// Jest setup file for backend tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// QR Verification environment variables
process.env.QR_SESSION_EXPIRY_MINUTES = '30';
process.env.FRAUD_DETECTION_RATE_LIMIT = '10';
process.env.FRAUD_DETECTION_WINDOW_MINUTES = '60';
process.env.VERIFICATION_TIME_TOLERANCE_MINUTES = '2';
process.env.VERIFICATION_AMOUNT_TOLERANCE_SEK = '2';
process.env.SESSION_TOKEN_LENGTH = '64';
process.env.RATE_LIMIT_WINDOW_MS = '3600000';
process.env.RATE_LIMIT_MAX_REQUESTS = '10';

// Custom Jest matchers
expect.extend({
  toBeOneOf(received: any, items: any[]) {
    const pass = items.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${items.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${items.join(', ')}`,
        pass: false,
      };
    }
  },
});

// Export to make this a module for TypeScript
export {};