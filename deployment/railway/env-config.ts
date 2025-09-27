import { z } from 'zod';

// Environment variable validation schemas
const CommonEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(3000).max(65535)),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(100),
});

const ProductionEnvSchema = CommonEnvSchema.extend({
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(40),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  
  // Security Configuration
  CORS_ORIGIN: z.string().transform(val => val.split(',')),
  JWT_EXPIRES_IN: z.string().default('2h'),
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(10).max(15)).default('12'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(60000)).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(10)).default('100'),
  
  // Monitoring Configuration
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true'),
  
  // Railway-specific
  RAILWAY_ENVIRONMENT: z.enum(['staging', 'production']),
  RAILWAY_PROJECT_ID: z.string().min(20),
  RAILWAY_SERVICE_ID: z.string().min(20),
  
  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(30)).default('60'), // seconds
  HEALTH_CHECK_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(5)).default('10'), // seconds
  
  // SSL and Security
  FORCE_HTTPS: z.string().transform(val => val === 'true').default('true'),
  HELMET_ENABLED: z.string().transform(val => val === 'true').default('true'),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32),
  SESSION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(300)).default('7200'), // 2 hours
  
  // File Upload Limits
  MAX_FILE_SIZE: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1024)).default('10485760'), // 10MB
  MAX_FILES_COUNT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('10'),
  
  // Background Jobs
  ENABLE_BACKGROUND_JOBS: z.string().transform(val => val === 'true').default('true'),
  JOB_CONCURRENCY: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('5'),
  
  // External Service URLs
  CUSTOMER_APP_URL: z.string().url(),
  BUSINESS_APP_URL: z.string().url(),
  ADMIN_APP_URL: z.string().url(),
});

const StagingEnvSchema = CommonEnvSchema.extend({
  // OpenAI Configuration (optional for staging)
  OPENAI_API_KEY: z.string().min(40).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  
  // Less strict security for staging
  CORS_ORIGIN: z.string().transform(val => val.split(',')),
  JWT_EXPIRES_IN: z.string().default('24h'), // Longer for testing
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(8)).default('10'),
  
  // More permissive rate limiting
  RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(60000)).default('300000'), // 5 minutes
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(10)).default('200'),
  
  // Staging-specific
  RAILWAY_ENVIRONMENT: z.literal('staging'),
  RAILWAY_PROJECT_ID: z.string().min(20),
  RAILWAY_SERVICE_ID: z.string().min(20),
  
  // Debug options
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true'),
  
  // External Service URLs
  CUSTOMER_APP_URL: z.string().url(),
  BUSINESS_APP_URL: z.string().url(),
  ADMIN_APP_URL: z.string().url(),
});

const DevelopmentEnvSchema = CommonEnvSchema.extend({
  // Development-specific overrides
  JWT_EXPIRES_IN: z.string().default('7d'), // Long expiry for development
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('4'), // Fast hashing
  
  // No rate limiting in development
  RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val, 10)).default('60000'),
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).default('1000'),
  
  // Development debugging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('false'),
  
  // Local URLs
  CUSTOMER_APP_URL: z.string().url().default('http://localhost:3000'),
  BUSINESS_APP_URL: z.string().url().default('http://localhost:3002'),
  ADMIN_APP_URL: z.string().url().default('http://localhost:3003'),
});

// Type definitions
export type ProductionEnv = z.infer<typeof ProductionEnvSchema>;
export type StagingEnv = z.infer<typeof StagingEnvSchema>;
export type DevelopmentEnv = z.infer<typeof DevelopmentEnvSchema>;
export type EnvironmentConfig = ProductionEnv | StagingEnv | DevelopmentEnv;

// Environment variable configuration maps
export const PRODUCTION_ENV_CONFIG = {
  NODE_ENV: 'production',
  PORT: '3001',
  
  // Database (provided by Railway PostgreSQL addon)
  DATABASE_URL: '${DATABASE_URL}', // Railway will inject this
  
  // Supabase Configuration
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}',
  
  // Authentication & Security
  JWT_SECRET: '${JWT_SECRET}',
  JWT_EXPIRES_IN: '2h',
  SESSION_SECRET: '${SESSION_SECRET}',
  SESSION_TIMEOUT: '7200',
  BCRYPT_ROUNDS: '12',
  
  // CORS Configuration
  CORS_ORIGIN: 'https://vocilia.com,https://business.vocilia.com,https://admin.vocilia.com',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: '900000', // 15 minutes
  RATE_LIMIT_MAX: '100',
  
  // OpenAI Configuration
  OPENAI_API_KEY: '${OPENAI_API_KEY}',
  OPENAI_MODEL: 'gpt-4o-mini',
  
  // Security Headers
  FORCE_HTTPS: 'true',
  HELMET_ENABLED: 'true',
  
  // Monitoring
  LOG_LEVEL: 'info',
  ENABLE_METRICS: 'true',
  SENTRY_DSN: '${SENTRY_DSN}',
  
  // Health Checks
  HEALTH_CHECK_INTERVAL: '60',
  HEALTH_CHECK_TIMEOUT: '10',
  
  // File Uploads
  MAX_FILE_SIZE: '10485760', // 10MB
  MAX_FILES_COUNT: '10',
  
  // Background Jobs
  ENABLE_BACKGROUND_JOBS: 'true',
  JOB_CONCURRENCY: '5',
  
  // Railway Configuration
  RAILWAY_ENVIRONMENT: 'production',
  RAILWAY_PROJECT_ID: '${RAILWAY_PROJECT_ID}',
  RAILWAY_SERVICE_ID: '${RAILWAY_SERVICE_ID}',
  
  // External Services
  CUSTOMER_APP_URL: 'https://vocilia.com',
  BUSINESS_APP_URL: 'https://business.vocilia.com',
  ADMIN_APP_URL: 'https://admin.vocilia.com',
} as const;

export const STAGING_ENV_CONFIG = {
  NODE_ENV: 'staging',
  PORT: '3001',
  
  // Database
  DATABASE_URL: '${DATABASE_URL}',
  
  // Supabase Configuration
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_SERVICE_ROLE_KEY: '${SUPABASE_SERVICE_ROLE_KEY}',
  
  // Authentication & Security (less strict)
  JWT_SECRET: '${JWT_SECRET}',
  JWT_EXPIRES_IN: '24h',
  SESSION_SECRET: '${SESSION_SECRET}',
  SESSION_TIMEOUT: '3600', // 1 hour
  BCRYPT_ROUNDS: '10',
  
  // CORS Configuration
  CORS_ORIGIN: 'https://staging.vocilia.com,https://business-staging.vocilia.com,https://admin-staging.vocilia.com',
  
  // Rate Limiting (more permissive)
  RATE_LIMIT_WINDOW: '300000', // 5 minutes
  RATE_LIMIT_MAX: '200',
  
  // OpenAI Configuration (optional)
  OPENAI_API_KEY: '${OPENAI_API_KEY}',
  OPENAI_MODEL: 'gpt-4o-mini',
  
  // Monitoring
  LOG_LEVEL: 'debug',
  ENABLE_METRICS: 'true',
  
  // Railway Configuration
  RAILWAY_ENVIRONMENT: 'staging',
  RAILWAY_PROJECT_ID: '${RAILWAY_PROJECT_ID}',
  RAILWAY_SERVICE_ID: '${RAILWAY_SERVICE_ID}',
  
  // External Services
  CUSTOMER_APP_URL: 'https://staging.vocilia.com',
  BUSINESS_APP_URL: 'https://business-staging.vocilia.com',
  ADMIN_APP_URL: 'https://admin-staging.vocilia.com',
} as const;

// Validation functions
export function validateEnvironmentConfig(env: string = process.env.NODE_ENV || 'development'): EnvironmentConfig {
  switch (env) {
    case 'production':
      return ProductionEnvSchema.parse(process.env);
    case 'staging':
      return StagingEnvSchema.parse(process.env);
    case 'development':
      return DevelopmentEnvSchema.parse(process.env);
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
}

// Environment-specific configuration getter
export function getEnvironmentConfig(environment: 'production' | 'staging'): Record<string, string> {
  switch (environment) {
    case 'production':
      return PRODUCTION_ENV_CONFIG;
    case 'staging':
      return STAGING_ENV_CONFIG;
    default:
      throw new Error(`Invalid environment: ${environment}`);
  }
}

// Railway deployment configuration
export interface RailwayDeploymentConfig {
  environment: 'production' | 'staging';
  projectId: string;
  serviceId: string;
  environmentVariables: Record<string, string>;
  secrets: string[];
  healthCheckPath: string;
  buildCommand?: string;
  startCommand: string;
  memoryLimit: string;
  cpuLimit: string;
  autoScale: boolean;
  minInstances: number;
  maxInstances: number;
}

export const PRODUCTION_RAILWAY_CONFIG: RailwayDeploymentConfig = {
  environment: 'production',
  projectId: '${RAILWAY_PROJECT_ID}',
  serviceId: '${RAILWAY_SERVICE_ID}',
  environmentVariables: PRODUCTION_ENV_CONFIG,
  secrets: [
    'JWT_SECRET',
    'SESSION_SECRET',
    'OPENAI_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SENTRY_DSN',
    'DATABASE_URL'
  ],
  healthCheckPath: '/health',
  buildCommand: 'pnpm build',
  startCommand: 'pnpm start',
  memoryLimit: '2GB',
  cpuLimit: '2',
  autoScale: true,
  minInstances: 2,
  maxInstances: 10,
};

export const STAGING_RAILWAY_CONFIG: RailwayDeploymentConfig = {
  environment: 'staging',
  projectId: '${RAILWAY_PROJECT_ID}',
  serviceId: '${RAILWAY_SERVICE_ID}',
  environmentVariables: STAGING_ENV_CONFIG,
  secrets: [
    'JWT_SECRET',
    'SESSION_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL'
  ],
  healthCheckPath: '/health',
  buildCommand: 'pnpm build',
  startCommand: 'pnpm start',
  memoryLimit: '1GB',
  cpuLimit: '1',
  autoScale: false,
  minInstances: 1,
  maxInstances: 2,
};

// Helper function to get missing environment variables
export function getMissingEnvVars(environment: string): string[] {
  try {
    validateEnvironmentConfig(environment);
    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors.map(err => err.path.join('.'));
    }
    return ['Validation failed'];
  }
}

// Helper function to check if all required secrets are set
export function validateSecrets(environment: 'production' | 'staging'): { valid: boolean; missing: string[] } {
  const config = environment === 'production' ? PRODUCTION_RAILWAY_CONFIG : STAGING_RAILWAY_CONFIG;
  const missing: string[] = [];
  
  for (const secret of config.secrets) {
    if (!process.env[secret]) {
      missing.push(secret);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

export default {
  validateEnvironmentConfig,
  getEnvironmentConfig,
  getMissingEnvVars,
  validateSecrets,
  PRODUCTION_ENV_CONFIG,
  STAGING_ENV_CONFIG,
  PRODUCTION_RAILWAY_CONFIG,
  STAGING_RAILWAY_CONFIG,
};