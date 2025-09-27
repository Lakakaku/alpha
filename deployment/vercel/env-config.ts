import { z } from 'zod';

// Common environment variable schema for all Vercel apps
const CommonVercelEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(100),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

// Customer app specific schema
const CustomerAppEnvSchema = CommonVercelEnvSchema.extend({
  // Customer-specific environment variables
  NEXT_PUBLIC_ENABLE_PWA: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_OFFLINE: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_QR_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(30)).default('300'), // 5 minutes
  NEXT_PUBLIC_SESSION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(300)).default('1800'), // 30 minutes
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_HOTJAR_ID: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default('support@vocilia.com'),
  NEXT_PUBLIC_SUPPORT_PHONE: z.string().default('+46 123 456 789'),
});

// Business app specific schema
const BusinessAppEnvSchema = CommonVercelEnvSchema.extend({
  // Business dashboard specific variables
  NEXT_PUBLIC_DASHBOARD_REFRESH: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(5000)).default('30000'), // 30 seconds
  NEXT_PUBLIC_MAX_STORES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).default('10'),
  NEXT_PUBLIC_MAX_FILE_SIZE: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1024)).default('5242880'), // 5MB
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_EXPORT: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_SESSION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(300)).default('7200'), // 2 hours
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_INTERCOM_APP_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

// Admin app specific schema
const AdminAppEnvSchema = CommonVercelEnvSchema.extend({
  // Admin panel specific variables
  NEXT_PUBLIC_ENABLE_AUDIT_LOGS: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_AUDIT_LOG_RETENTION: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(86400)).default('2592000'), // 30 days in seconds
  NEXT_PUBLIC_SESSION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(300)).default('7200'), // 2 hours
  NEXT_PUBLIC_AUTO_LOGOUT_WARNING: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(60)).default('300'), // 5 minutes warning
  NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(3)).default('5'),
  NEXT_PUBLIC_LOCKOUT_DURATION: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(300)).default('900'), // 15 minutes
  NEXT_PUBLIC_ENABLE_2FA: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_LOG_ROCKET_ID: z.string().optional(),
});

// Type definitions
export type CustomerAppEnv = z.infer<typeof CustomerAppEnvSchema>;
export type BusinessAppEnv = z.infer<typeof BusinessAppEnvSchema>;
export type AdminAppEnv = z.infer<typeof AdminAppEnvSchema>;

// Production environment configurations
export const CUSTOMER_PRODUCTION_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'https://api.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://vocilia.com',
  
  // PWA Configuration
  NEXT_PUBLIC_ENABLE_PWA: 'true',
  NEXT_PUBLIC_ENABLE_OFFLINE: 'true',
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'true',
  
  // Timeouts and Limits
  NEXT_PUBLIC_QR_TIMEOUT: '300', // 5 minutes
  NEXT_PUBLIC_SESSION_TIMEOUT: '1800', // 30 minutes
  
  // Analytics and Monitoring
  NEXT_PUBLIC_ANALYTICS_ID: '${NEXT_PUBLIC_ANALYTICS_ID}',
  NEXT_PUBLIC_SENTRY_DSN: '${NEXT_PUBLIC_SENTRY_DSN}',
  NEXT_PUBLIC_HOTJAR_ID: '${NEXT_PUBLIC_HOTJAR_ID}',
  
  // Support Information
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@vocilia.com',
  NEXT_PUBLIC_SUPPORT_PHONE: '+46 123 456 789',
} as const;

export const BUSINESS_PRODUCTION_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'https://api.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://business.vocilia.com',
  
  // Dashboard Configuration
  NEXT_PUBLIC_DASHBOARD_REFRESH: '30000', // 30 seconds
  NEXT_PUBLIC_MAX_STORES: '10',
  NEXT_PUBLIC_MAX_FILE_SIZE: '5242880', // 5MB
  
  // Features
  NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
  NEXT_PUBLIC_ENABLE_EXPORT: 'true',
  
  // Security
  NEXT_PUBLIC_SESSION_TIMEOUT: '7200', // 2 hours
  
  // Third-party Services
  NEXT_PUBLIC_ANALYTICS_ID: '${NEXT_PUBLIC_ANALYTICS_ID}',
  NEXT_PUBLIC_SENTRY_DSN: '${NEXT_PUBLIC_SENTRY_DSN}',
  NEXT_PUBLIC_INTERCOM_APP_ID: '${NEXT_PUBLIC_INTERCOM_APP_ID}',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}',
} as const;

export const ADMIN_PRODUCTION_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'https://api.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://admin.vocilia.com',
  
  // Audit and Logging
  NEXT_PUBLIC_ENABLE_AUDIT_LOGS: 'true',
  NEXT_PUBLIC_AUDIT_LOG_RETENTION: '2592000', // 30 days
  
  // Security Configuration
  NEXT_PUBLIC_SESSION_TIMEOUT: '7200', // 2 hours
  NEXT_PUBLIC_AUTO_LOGOUT_WARNING: '300', // 5 minutes warning
  NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS: '5',
  NEXT_PUBLIC_LOCKOUT_DURATION: '900', // 15 minutes
  NEXT_PUBLIC_ENABLE_2FA: 'false', // Will be enabled later
  
  // Monitoring
  NEXT_PUBLIC_SENTRY_DSN: '${NEXT_PUBLIC_SENTRY_DSN}',
  NEXT_PUBLIC_LOG_ROCKET_ID: '${NEXT_PUBLIC_LOG_ROCKET_ID}',
} as const;

// Staging environment configurations
export const CUSTOMER_STAGING_ENV = {
  ...CUSTOMER_PRODUCTION_ENV,
  NODE_ENV: 'staging',
  NEXT_PUBLIC_API_URL: 'https://api-staging.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://staging.vocilia.com',
  NEXT_PUBLIC_SESSION_TIMEOUT: '3600', // 1 hour for testing
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'false', // Disable in staging
} as const;

export const BUSINESS_STAGING_ENV = {
  ...BUSINESS_PRODUCTION_ENV,
  NODE_ENV: 'staging',
  NEXT_PUBLIC_API_URL: 'https://api-staging.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://business-staging.vocilia.com',
  NEXT_PUBLIC_DASHBOARD_REFRESH: '10000', // 10 seconds for testing
  NEXT_PUBLIC_SESSION_TIMEOUT: '3600', // 1 hour for testing
} as const;

export const ADMIN_STAGING_ENV = {
  ...ADMIN_PRODUCTION_ENV,
  NODE_ENV: 'staging',
  NEXT_PUBLIC_API_URL: 'https://api-staging.vocilia.com',
  NEXT_PUBLIC_APP_URL: 'https://admin-staging.vocilia.com',
  NEXT_PUBLIC_SESSION_TIMEOUT: '3600', // 1 hour for testing
  NEXT_PUBLIC_AUTO_LOGOUT_WARNING: '180', // 3 minutes warning
} as const;

// Development environment configurations
export const CUSTOMER_DEVELOPMENT_ENV = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_ENABLE_PWA: 'false', // Disable PWA in development
  NEXT_PUBLIC_ENABLE_OFFLINE: 'false',
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: 'false',
  NEXT_PUBLIC_QR_TIMEOUT: '86400', // 24 hours for development
  NEXT_PUBLIC_SESSION_TIMEOUT: '86400', // 24 hours for development
  NEXT_PUBLIC_SUPPORT_EMAIL: 'dev@vocilia.com',
  NEXT_PUBLIC_SUPPORT_PHONE: '+46 123 456 789',
} as const;

export const BUSINESS_DEVELOPMENT_ENV = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3002',
  NEXT_PUBLIC_DASHBOARD_REFRESH: '5000', // 5 seconds for development
  NEXT_PUBLIC_MAX_STORES: '100', // More stores for development
  NEXT_PUBLIC_MAX_FILE_SIZE: '10485760', // 10MB for development
  NEXT_PUBLIC_ENABLE_ANALYTICS: 'false',
  NEXT_PUBLIC_ENABLE_EXPORT: 'true',
  NEXT_PUBLIC_SESSION_TIMEOUT: '86400', // 24 hours for development
} as const;

export const ADMIN_DEVELOPMENT_ENV = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: '${NEXT_PUBLIC_SUPABASE_URL}',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '${NEXT_PUBLIC_SUPABASE_ANON_KEY}',
  NEXT_PUBLIC_API_URL: 'http://localhost:3001',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3003',
  NEXT_PUBLIC_ENABLE_AUDIT_LOGS: 'true',
  NEXT_PUBLIC_AUDIT_LOG_RETENTION: '604800', // 7 days for development
  NEXT_PUBLIC_SESSION_TIMEOUT: '86400', // 24 hours for development
  NEXT_PUBLIC_AUTO_LOGOUT_WARNING: '3600', // 1 hour warning
  NEXT_PUBLIC_MAX_LOGIN_ATTEMPTS: '10', // More attempts for development
  NEXT_PUBLIC_LOCKOUT_DURATION: '60', // 1 minute lockout
  NEXT_PUBLIC_ENABLE_2FA: 'false',
} as const;

// Vercel deployment configuration interface
export interface VercelDeploymentConfig {
  app: 'customer' | 'business' | 'admin';
  environment: 'development' | 'staging' | 'production';
  projectId: string;
  environmentVariables: Record<string, string>;
  buildCommand: string;
  outputDirectory: string;
  framework: string;
  nodeVersion: string;
  regions: string[];
  functions?: Record<string, any>;
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  redirects?: Array<{ source: string; destination: string; permanent?: boolean }>;
  rewrites?: Array<{ source: string; destination: string }>;
}

// Vercel configuration templates
export const CUSTOMER_VERCEL_CONFIG: VercelDeploymentConfig = {
  app: 'customer',
  environment: 'production',
  projectId: '${VERCEL_CUSTOMER_PROJECT_ID}',
  environmentVariables: CUSTOMER_PRODUCTION_ENV,
  buildCommand: 'pnpm build',
  outputDirectory: '.next',
  framework: 'nextjs',
  nodeVersion: '18.x',
  regions: ['arn1', 'fra1'], // Stockholm and Frankfurt for EU users
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ]
    },
    {
      source: '/manifest.json',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400' }
      ]
    }
  ],
  redirects: [
    {
      source: '/app',
      destination: '/',
      permanent: false
    }
  ]
};

export const BUSINESS_VERCEL_CONFIG: VercelDeploymentConfig = {
  app: 'business',
  environment: 'production',
  projectId: '${VERCEL_BUSINESS_PROJECT_ID}',
  environmentVariables: BUSINESS_PRODUCTION_ENV,
  buildCommand: 'pnpm build',
  outputDirectory: '.next',
  framework: 'nextjs',
  nodeVersion: '18.x',
  regions: ['arn1', 'fra1'],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' } // Business app should not be indexed
      ]
    }
  ]
};

export const ADMIN_VERCEL_CONFIG: VercelDeploymentConfig = {
  app: 'admin',
  environment: 'production',
  projectId: '${VERCEL_ADMIN_PROJECT_ID}',
  environmentVariables: ADMIN_PRODUCTION_ENV,
  buildCommand: 'pnpm build',
  outputDirectory: '.next',
  framework: 'nextjs',
  nodeVersion: '18.x',
  regions: ['arn1'], // Only Stockholm for admin panel
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
      ]
    }
  ]
};

// Validation functions
export function validateCustomerEnv(env: Record<string, string>): CustomerAppEnv {
  return CustomerAppEnvSchema.parse(env);
}

export function validateBusinessEnv(env: Record<string, string>): BusinessAppEnv {
  return BusinessAppEnvSchema.parse(env);
}

export function validateAdminEnv(env: Record<string, string>): AdminAppEnv {
  return AdminAppEnvSchema.parse(env);
}

// Environment configuration getters
export function getEnvironmentConfig(
  app: 'customer' | 'business' | 'admin',
  environment: 'development' | 'staging' | 'production'
): Record<string, string> {
  const configMap = {
    customer: {
      development: CUSTOMER_DEVELOPMENT_ENV,
      staging: CUSTOMER_STAGING_ENV,
      production: CUSTOMER_PRODUCTION_ENV,
    },
    business: {
      development: BUSINESS_DEVELOPMENT_ENV,
      staging: BUSINESS_STAGING_ENV,
      production: BUSINESS_PRODUCTION_ENV,
    },
    admin: {
      development: ADMIN_DEVELOPMENT_ENV,
      staging: ADMIN_STAGING_ENV,
      production: ADMIN_PRODUCTION_ENV,
    },
  };

  return configMap[app][environment];
}

export function getVercelConfig(
  app: 'customer' | 'business' | 'admin',
  environment: 'staging' | 'production'
): VercelDeploymentConfig {
  const baseConfigs = {
    customer: CUSTOMER_VERCEL_CONFIG,
    business: BUSINESS_VERCEL_CONFIG,
    admin: ADMIN_VERCEL_CONFIG,
  };

  const config = { ...baseConfigs[app] };
  config.environment = environment;
  config.environmentVariables = getEnvironmentConfig(app, environment);

  return config;
}

// Helper to check missing environment variables
export function getMissingEnvVars(
  app: 'customer' | 'business' | 'admin',
  env: Record<string, string>
): string[] {
  try {
    switch (app) {
      case 'customer':
        validateCustomerEnv(env);
        break;
      case 'business':
        validateBusinessEnv(env);
        break;
      case 'admin':
        validateAdminEnv(env);
        break;
    }
    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors.map(err => err.path.join('.'));
    }
    return ['Validation failed'];
  }
}

export default {
  validateCustomerEnv,
  validateBusinessEnv,
  validateAdminEnv,
  getEnvironmentConfig,
  getVercelConfig,
  getMissingEnvVars,
  CUSTOMER_VERCEL_CONFIG,
  BUSINESS_VERCEL_CONFIG,
  ADMIN_VERCEL_CONFIG,
};