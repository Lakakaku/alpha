import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestEnvironment {
  id: string;
  name: string;
  type: 'local' | 'branch' | 'preview' | 'staging';
  config: {
    databaseUrl: string;
    apiBaseUrl: string;
    frontendUrl: string;
    authConfig: Record<string, any>;
  };
  browserConfig: {
    browsers: string[];
    viewport: {
      width: number;
      height: number;
    };
    headless: boolean;
  };
  performanceConfig: {
    maxConcurrentUsers: number;
    testDuration: number;
    thresholds: {
      responseTime: number;
      pageLoad: number;
      errorRate: number;
    };
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestEnvironmentRequest {
  name: string;
  type: 'local' | 'branch' | 'preview' | 'staging';
  config: {
    databaseUrl: string;
    apiBaseUrl: string;
    frontendUrl: string;
    authConfig?: Record<string, any>;
  };
  browserConfig?: {
    browsers?: string[];
    viewport?: {
      width: number;
      height: number;
    };
    headless?: boolean;
  };
  performanceConfig?: {
    maxConcurrentUsers?: number;
    testDuration?: number;
    thresholds?: {
      responseTime?: number;
      pageLoad?: number;
      errorRate?: number;
    };
  };
  enabled?: boolean;
}

export interface UpdateTestEnvironmentRequest {
  name?: string;
  type?: 'local' | 'branch' | 'preview' | 'staging';
  config?: {
    databaseUrl?: string;
    apiBaseUrl?: string;
    frontendUrl?: string;
    authConfig?: Record<string, any>;
  };
  browserConfig?: {
    browsers?: string[];
    viewport?: {
      width?: number;
      height?: number;
    };
    headless?: boolean;
  };
  performanceConfig?: {
    maxConcurrentUsers?: number;
    testDuration?: number;
    thresholds?: {
      responseTime?: number;
      pageLoad?: number;
      errorRate?: number;
    };
  };
  enabled?: boolean;
}

export class TestEnvironmentModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestEnvironmentRequest): Promise<TestEnvironment> {
    const { data: environment, error } = await this.supabase
      .from('test_environments')
      .insert({
        name: data.name,
        type: data.type,
        config: {
          databaseUrl: data.config.databaseUrl,
          apiBaseUrl: data.config.apiBaseUrl,
          frontendUrl: data.config.frontendUrl,
          authConfig: data.config.authConfig || {},
        },
        browser_config: {
          browsers: data.browserConfig?.browsers || ['chrome'],
          viewport: data.browserConfig?.viewport || { width: 1920, height: 1080 },
          headless: data.browserConfig?.headless ?? true,
        },
        performance_config: {
          maxConcurrentUsers: data.performanceConfig?.maxConcurrentUsers || 10,
          testDuration: data.performanceConfig?.testDuration || 60,
          thresholds: {
            responseTime: data.performanceConfig?.thresholds?.responseTime || 1000,
            pageLoad: data.performanceConfig?.thresholds?.pageLoad || 3000,
            errorRate: data.performanceConfig?.thresholds?.errorRate || 1,
          },
        },
        enabled: data.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test environment: ${error.message}`);
    }

    return this.mapToTestEnvironment(environment);
  }

  async findById(id: string): Promise<TestEnvironment | null> {
    const { data: environment, error } = await this.supabase
      .from('test_environments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test environment: ${error.message}`);
    }

    return this.mapToTestEnvironment(environment);
  }

  async findAll(params?: {
    type?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<TestEnvironment[]> {
    let query = this.supabase.from('test_environments').select('*');

    if (params?.type) {
      query = query.eq('type', params.type);
    }
    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: environments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test environments: ${error.message}`);
    }

    return environments?.map(env => this.mapToTestEnvironment(env)) || [];
  }

  async update(id: string, data: UpdateTestEnvironmentRequest): Promise<TestEnvironment> {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    // Handle nested config updates
    if (data.config) {
      const currentEnv = await this.findById(id);
      if (!currentEnv) {
        throw new Error('Environment not found');
      }
      
      updateData.config = {
        ...currentEnv.config,
        ...data.config,
        authConfig: data.config.authConfig !== undefined 
          ? data.config.authConfig 
          : currentEnv.config.authConfig,
      };
    }

    if (data.browserConfig) {
      const currentEnv = await this.findById(id);
      if (!currentEnv) {
        throw new Error('Environment not found');
      }
      
      updateData.browser_config = {
        ...currentEnv.browserConfig,
        ...data.browserConfig,
        viewport: data.browserConfig.viewport 
          ? { ...currentEnv.browserConfig.viewport, ...data.browserConfig.viewport }
          : currentEnv.browserConfig.viewport,
      };
    }

    if (data.performanceConfig) {
      const currentEnv = await this.findById(id);
      if (!currentEnv) {
        throw new Error('Environment not found');
      }
      
      updateData.performance_config = {
        ...currentEnv.performanceConfig,
        ...data.performanceConfig,
        thresholds: data.performanceConfig.thresholds 
          ? { ...currentEnv.performanceConfig.thresholds, ...data.performanceConfig.thresholds }
          : currentEnv.performanceConfig.thresholds,
      };
    }

    const { data: environment, error } = await this.supabase
      .from('test_environments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test environment: ${error.message}`);
    }

    return this.mapToTestEnvironment(environment);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_environments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test environment: ${error.message}`);
    }
  }

  async findByType(type: 'local' | 'branch' | 'preview' | 'staging'): Promise<TestEnvironment[]> {
    return this.findAll({ type, enabled: true });
  }

  async findEnabled(): Promise<TestEnvironment[]> {
    return this.findAll({ enabled: true });
  }

  async findDefault(): Promise<TestEnvironment | null> {
    const environments = await this.findByType('local');
    return environments[0] || null;
  }

  async validateConfiguration(id: string): Promise<{ valid: boolean; errors: string[] }> {
    const environment = await this.findById(id);
    if (!environment) {
      return { valid: false, errors: ['Environment not found'] };
    }

    const errors: string[] = [];

    // Validate URLs
    try {
      new URL(environment.config.databaseUrl);
    } catch {
      errors.push('Invalid database URL');
    }

    try {
      new URL(environment.config.apiBaseUrl);
    } catch {
      errors.push('Invalid API base URL');
    }

    try {
      new URL(environment.config.frontendUrl);
    } catch {
      errors.push('Invalid frontend URL');
    }

    // Validate browser config
    if (!environment.browserConfig.browsers || environment.browserConfig.browsers.length === 0) {
      errors.push('At least one browser must be specified');
    }

    // Validate performance thresholds
    if (environment.performanceConfig.thresholds.responseTime <= 0) {
      errors.push('Response time threshold must be positive');
    }

    if (environment.performanceConfig.thresholds.pageLoad <= 0) {
      errors.push('Page load threshold must be positive');
    }

    if (environment.performanceConfig.thresholds.errorRate < 0 || environment.performanceConfig.thresholds.errorRate > 100) {
      errors.push('Error rate threshold must be between 0 and 100');
    }

    return { valid: errors.length === 0, errors };
  }

  private mapToTestEnvironment(row: any): TestEnvironment {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      config: row.config,
      browserConfig: row.browser_config,
      performanceConfig: row.performance_config,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}