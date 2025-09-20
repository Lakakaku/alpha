import dotenv from 'dotenv';
import { loggingService } from '../services/loggingService';

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  // Server configuration
  port: number;
  host: string;
  env: 'development' | 'staging' | 'production' | 'test';
  
  // Database configuration
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  
  // Authentication configuration
  auth: {
    jwtSecret?: string;
    tokenExpirationHours: number;
    refreshTokenExpirationDays: number;
    passwordMinLength: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
  };
  
  // Security configuration
  security: {
    corsOrigins: string[];
    rateLimitWindow: number;
    rateLimitMax: number;
    helmetEnabled: boolean;
    httpsOnly: boolean;
  };
  
  // Logging configuration
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableFileLogging: boolean;
    maxLogFileSize: number;
    maxLogFiles: number;
  };
  
  // Frontend URLs
  frontend: {
    customerUrl: string;
    businessUrl: string;
    adminUrl: string;
  };
  
  // External services
  services: {
    emailService?: {
      provider: string;
      apiKey?: string;
      fromEmail: string;
    };
    aiService?: {
      apiUrl: string;
      apiKey?: string;
      timeout: number;
    };
  };
  
  // Feature flags
  features: {
    enableRegistration: boolean;
    enablePasswordReset: boolean;
    enableRealtime: boolean;
    enableAuditLogging: boolean;
    enableMetrics: boolean;
  };
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
    this.logConfig();
  }

  private loadConfig(): AppConfig {
    return {
      // Server configuration
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      env: (process.env.NODE_ENV as any) || 'development',
      
      // Database configuration
      supabase: {
        url: this.requireEnv('SUPABASE_URL'),
        anonKey: this.requireEnv('SUPABASE_ANON_KEY'),
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      
      // Authentication configuration
      auth: {
        jwtSecret: process.env.JWT_SECRET,
        tokenExpirationHours: parseInt(process.env.TOKEN_EXPIRATION_HOURS || '24'),
        refreshTokenExpirationDays: parseInt(process.env.REFRESH_TOKEN_EXPIRATION_DAYS || '30'),
        passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
        lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15'),
      },
      
      // Security configuration
      security: {
        corsOrigins: this.parseStringArray(process.env.CORS_ORIGINS),
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        helmetEnabled: process.env.HELMET_ENABLED !== 'false',
        httpsOnly: process.env.HTTPS_ONLY === 'true',
      },
      
      // Logging configuration
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
        maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '10485760'), // 10MB
        maxLogFiles: parseInt(process.env.MAX_LOG_FILES || '5'),
      },
      
      // Frontend URLs
      frontend: {
        customerUrl: process.env.CUSTOMER_FRONTEND_URL || 'https://customer.vocilia.se',
        businessUrl: process.env.BUSINESS_FRONTEND_URL || 'https://business.vocilia.se',
        adminUrl: process.env.ADMIN_FRONTEND_URL || 'https://admin.vocilia.se',
      },
      
      // External services
      services: {
        emailService: process.env.EMAIL_PROVIDER ? {
          provider: process.env.EMAIL_PROVIDER,
          apiKey: process.env.EMAIL_API_KEY,
          fromEmail: process.env.EMAIL_FROM || 'noreply@vocilia.se',
        } : undefined,
        
        aiService: process.env.AI_SERVICE_URL ? {
          apiUrl: process.env.AI_SERVICE_URL,
          apiKey: process.env.AI_SERVICE_API_KEY,
          timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || '30000'),
        } : undefined,
      },
      
      // Feature flags
      features: {
        enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
        enablePasswordReset: process.env.ENABLE_PASSWORD_RESET !== 'false',
        enableRealtime: process.env.ENABLE_REALTIME !== 'false',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
      },
    };
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private parseStringArray(value?: string): string[] {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Validate port
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // Validate environment
    if (!['development', 'staging', 'production', 'test'].includes(this.config.env)) {
      errors.push('NODE_ENV must be one of: development, staging, production, test');
    }

    // Validate URLs
    try {
      new URL(this.config.supabase.url);
    } catch {
      errors.push('SUPABASE_URL must be a valid URL');
    }

    try {
      new URL(this.config.frontend.customerUrl);
      new URL(this.config.frontend.businessUrl);
      new URL(this.config.frontend.adminUrl);
    } catch {
      errors.push('Frontend URLs must be valid URLs');
    }

    // Validate logging level
    if (!['error', 'warn', 'info', 'debug'].includes(this.config.logging.level)) {
      errors.push('LOG_LEVEL must be one of: error, warn, info, debug');
    }

    // Validate auth configuration
    if (this.config.auth.tokenExpirationHours < 1) {
      errors.push('Token expiration must be at least 1 hour');
    }

    if (this.config.auth.passwordMinLength < 6) {
      errors.push('Password minimum length must be at least 6 characters');
    }

    // Production-specific validations
    if (this.config.env === 'production') {
      if (!this.config.supabase.serviceRoleKey) {
        errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production');
      }

      if (!this.config.auth.jwtSecret) {
        errors.push('JWT_SECRET is required in production');
      }

      if (!this.config.security.httpsOnly) {
        console.warn('Warning: HTTPS_ONLY is not enabled in production');
      }

      if (this.config.logging.level === 'debug') {
        console.warn('Warning: Debug logging is enabled in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  private logConfig(): void {
    // Log configuration (excluding sensitive data)
    const safeConfig = {
      port: this.config.port,
      host: this.config.host,
      env: this.config.env,
      logging: this.config.logging,
      features: this.config.features,
      frontend: this.config.frontend,
      security: {
        ...this.config.security,
        corsOrigins: this.config.security.corsOrigins.length > 0 ? '[CONFIGURED]' : '[NOT SET]',
      },
      services: {
        emailService: this.config.services.emailService ? '[CONFIGURED]' : '[NOT SET]',
        aiService: this.config.services.aiService ? '[CONFIGURED]' : '[NOT SET]',
      },
    };

    loggingService.info('Configuration loaded', safeConfig);

    // Log warnings for missing optional services
    if (!this.config.services.emailService) {
      loggingService.warn('Email service not configured - password reset functionality will be limited');
    }

    if (!this.config.services.aiService) {
      loggingService.warn('AI service not configured - AI features will be disabled');
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.env === 'development';
  }

  public isProduction(): boolean {
    return this.config.env === 'production';
  }

  public isTest(): boolean {
    return this.config.env === 'test';
  }

  public getServerAddress(): string {
    return `${this.config.security.httpsOnly ? 'https' : 'http'}://${this.config.host}:${this.config.port}`;
  }

  public getCorsOrigins(): string[] {
    if (this.config.security.corsOrigins.length === 0) {
      // Default CORS origins based on environment
      if (this.isDevelopment()) {
        return [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002',
        ];
      } else {
        return [
          this.config.frontend.customerUrl,
          this.config.frontend.businessUrl,
          this.config.frontend.adminUrl,
        ];
      }
    }
    
    return this.config.security.corsOrigins;
  }

  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature];
  }

  public updateFeature(feature: keyof AppConfig['features'], enabled: boolean): void {
    this.config.features[feature] = enabled;
    loggingService.info(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Singleton instance
export const configManager = new ConfigManager();

// Export convenience functions
export function getConfig(): AppConfig {
  return configManager.getConfig();
}

export function get<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return configManager.get(key);
}

export function isDevelopment(): boolean {
  return configManager.isDevelopment();
}

export function isProduction(): boolean {
  return configManager.isProduction();
}

export function isTest(): boolean {
  return configManager.isTest();
}

export function getCorsOrigins(): string[] {
  return configManager.getCorsOrigins();
}

export function isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
  return configManager.isFeatureEnabled(feature);
}

// Export the config instance for direct access
export const config = configManager.getConfig();