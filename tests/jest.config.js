/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true
      }
    }]
  },
  collectCoverageFrom: [
    '../packages/**/*.{ts,tsx}',
    '../apps/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  moduleNameMapper: {
    '^@vocilia/(.*)$': '<rootDir>/../packages/$1/src',
    '^@/(.*)$': '<rootDir>/../apps/backend/src/$1'
  },
  testTimeout: 10000,
  projects: [
    {
      displayName: 'contract',
      testMatch: ['<rootDir>/contract/**/test_*.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            strictFunctionTypes: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true
          }
        }]
      }
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/integration/**/test_*.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            strictFunctionTypes: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true
          }
        }]
      }
    },
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/unit/**/test_*.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            strictFunctionTypes: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true
          }
        }]
      }
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/performance/**/test_*.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            strictFunctionTypes: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true
          }
        }]
      }
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/security/**/test_*.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            strict: true,
            noImplicitAny: true,
            strictNullChecks: true,
            strictFunctionTypes: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true
          }
        }]
      }
    }
  ]
};