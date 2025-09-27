/**
 * Jest Configuration for Security Testing
 * Specialized setup for security and penetration testing scenarios
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Security test file patterns
  testMatch: [
    '<rootDir>/tests/contract/security-*.test.ts',
    '<rootDir>/tests/contract/privacy-*.test.ts',
    '<rootDir>/tests/contract/gdpr-*.test.ts',
    '<rootDir>/tests/integration/authentication-security.test.ts',
    '<rootDir>/tests/integration/data-privacy-protection.test.ts',
    '<rootDir>/tests/integration/gdpr-compliance.test.ts',
    '<rootDir>/tests/integration/ai-model-security.test.ts',
    '<rootDir>/src/testing/security/**/*.test.ts'
  ],

  // Exclude regular unit tests
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/tests/unit/',
    '<rootDir>/tests/performance/'
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }]
  },

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@vocilia/(.*)$': '<rootDir>/../../packages/$1/src'
  },

  // Coverage configuration for security testing
  collectCoverageFrom: [
    'src/middleware/auth.ts',
    'src/middleware/admin-auth.ts',
    'src/middleware/security/**/*.ts',
    'src/services/security/**/*.ts',
    'src/routes/security/**/*.ts',
    'src/routes/privacy/**/*.ts',
    'src/models/Security*.ts',
    'src/models/Privacy*.ts',
    'src/models/GDPR*.ts'
  ],

  coverageDirectory: 'coverage/security',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // Minimum coverage thresholds for security code
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/middleware/auth.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/security/': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    }
  },

  // Test setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/src/testing/security/jest-security-setup.ts'
  ],

  // Extended timeout for security tests (penetration testing can be slow)
  testTimeout: 30000,

  // Environment variables for security testing
  setupFiles: ['<rootDir>/src/testing/security/jest-env-setup.ts'],

  // Verbose output for security test debugging
  verbose: true,

  // Clear mocks between tests for clean security testing
  clearMocks: true,
  restoreMocks: true,

  // Performance monitoring
  maxWorkers: 2, // Limit concurrent tests to prevent performance impact

  // Security test specific reporters
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/security',
      filename: 'security-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Security Test Report'
    }]
  ],

  // Global test configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true,
          strictFunctionTypes: true
        }
      }
    }
  },

  // Test execution settings
  bail: false, // Continue running tests even if some fail
  detectOpenHandles: true, // Detect async operations that prevent Jest from exiting
  forceExit: false, // Don't force exit (let security tests complete properly)

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};