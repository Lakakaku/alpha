module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@vocilia/types/qr$': '<rootDir>/../../packages/types/src/qr/index.ts',
    '^@vocilia/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@vocilia/database/qr$': '<rootDir>/../../packages/database/src/qr/index.ts',
    '^@vocilia/database$': '<rootDir>/../../packages/database/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};