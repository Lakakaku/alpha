export interface EnvironmentConfiguration {
  environment_id: string;
  platform: 'railway' | 'vercel' | 'supabase';
  app_name: string;
  environment_type: 'production' | 'staging' | 'development';
  config_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface CreateEnvironmentConfigurationRequest {
  environment_id: string;
  platform: 'railway' | 'vercel' | 'supabase';
  app_name: string;
  environment_type: 'production' | 'staging' | 'development';
  config_data: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateEnvironmentConfigurationRequest {
  platform?: 'railway' | 'vercel' | 'supabase';
  app_name?: string;
  environment_type?: 'production' | 'staging' | 'development';
  config_data?: Record<string, any>;
  is_active?: boolean;
}

export class EnvironmentConfigurationModel {
  static validatePlatform(platform: string): platform is 'railway' | 'vercel' | 'supabase' {
    return ['railway', 'vercel', 'supabase'].includes(platform);
  }

  static validateEnvironmentType(type: string): type is 'production' | 'staging' | 'development' {
    return ['production', 'staging', 'development'].includes(type);
  }

  static validateAppName(appName: string): boolean {
    return /^[a-zA-Z0-9\-_]+$/.test(appName);
  }

  static validateEnvironmentId(environmentId: string): boolean {
    return /^[a-zA-Z0-9\-_]+$/.test(environmentId) && environmentId.length >= 3;
  }

  static create(data: CreateEnvironmentConfigurationRequest): EnvironmentConfiguration {
    if (!this.validateEnvironmentId(data.environment_id)) {
      throw new Error('Invalid environment ID format');
    }

    if (!this.validatePlatform(data.platform)) {
      throw new Error('Invalid platform type');
    }

    if (!this.validateEnvironmentType(data.environment_type)) {
      throw new Error('Invalid environment type');
    }

    if (!this.validateAppName(data.app_name)) {
      throw new Error('Invalid app name format');
    }

    const now = new Date();
    
    return {
      environment_id: data.environment_id,
      platform: data.platform,
      app_name: data.app_name,
      environment_type: data.environment_type,
      config_data: data.config_data || {},
      created_at: now,
      updated_at: now,
      is_active: data.is_active ?? true
    };
  }

  static update(
    existing: EnvironmentConfiguration, 
    updates: UpdateEnvironmentConfigurationRequest
  ): EnvironmentConfiguration {
    const updated: EnvironmentConfiguration = { ...existing };

    if (updates.platform !== undefined) {
      if (!this.validatePlatform(updates.platform)) {
        throw new Error('Invalid platform type');
      }
      updated.platform = updates.platform;
    }

    if (updates.app_name !== undefined) {
      if (!this.validateAppName(updates.app_name)) {
        throw new Error('Invalid app name format');
      }
      updated.app_name = updates.app_name;
    }

    if (updates.environment_type !== undefined) {
      if (!this.validateEnvironmentType(updates.environment_type)) {
        throw new Error('Invalid environment type');
      }
      updated.environment_type = updates.environment_type;
    }

    if (updates.config_data !== undefined) {
      updated.config_data = updates.config_data;
    }

    if (updates.is_active !== undefined) {
      updated.is_active = updates.is_active;
    }

    updated.updated_at = new Date();
    return updated;
  }

  static getConfigValue(config: EnvironmentConfiguration, key: string): any {
    return config.config_data[key];
  }

  static setConfigValue(
    config: EnvironmentConfiguration, 
    key: string, 
    value: any
  ): EnvironmentConfiguration {
    const updated = { ...config };
    updated.config_data = { ...config.config_data, [key]: value };
    updated.updated_at = new Date();
    return updated;
  }

  static isProduction(config: EnvironmentConfiguration): boolean {
    return config.environment_type === 'production';
  }

  static getPlatformSpecificConfig(
    config: EnvironmentConfiguration
  ): Record<string, any> {
    const platformConfigs = {
      railway: ['DATABASE_URL', 'REDIS_URL', 'PORT'],
      vercel: ['VERCEL_URL', 'VERCEL_ENV', 'NEXT_PUBLIC_API_URL'],
      supabase: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    };

    const platformKeys = platformConfigs[config.platform] || [];
    const filteredConfig: Record<string, any> = {};

    platformKeys.forEach(key => {
      if (config.config_data[key] !== undefined) {
        filteredConfig[key] = config.config_data[key];
      }
    });

    return filteredConfig;
  }
}