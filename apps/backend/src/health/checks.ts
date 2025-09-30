import { SupabaseClient } from '@supabase/supabase-js';
import { getMainClient, getServiceClient, testDatabaseConnection } from '../config/database';
import { config } from '../config';
import { logger } from '../middleware/logging';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  duration: number;
  details?: any;
  error?: string;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    supabase: HealthCheckResult;
    memory: HealthCheckResult;
    disk: HealthCheckResult;
    external: HealthCheckResult;
  };
}

// Database connectivity check
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Test main database connection
    await testDatabaseConnection();
    
    // Test a simple query
    const client = getMainClient();
    const { data, error } = await client
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration,
      details: {
        responseTime: duration,
        connectionPool: 'active'
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

// Supabase service check
export async function checkSupabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const client = getServiceClient();
    
    // Test Supabase Auth service
    const { data: authData, error: authError } = await client.auth.getSession();
    
    // Test Supabase API availability
    const { data, error } = await client
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (expected)
      throw new Error(`Supabase API error: ${error.message}`);
    }

    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration,
      details: {
        responseTime: duration,
        authService: authError ? 'degraded' : 'healthy',
        apiService: 'healthy'
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown Supabase error'
    };
  }
}

// Memory usage check
export async function checkMemory(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal + usage.external;
    const usedMemory = usage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    const duration = Date.now() - start;
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
    }
    
    return {
      status,
      timestamp: new Date().toISOString(),
      duration,
      details: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        usagePercent: Math.round(memoryUsagePercent)
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown memory check error'
    };
  }
}

// Disk space check (basic)
export async function checkDisk(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if logs directory is writable
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Test write access
      const testFile = path.join(logsDir, 'health-check-test.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (diskError) {
      throw new Error('Logs directory not writable');
    }
    
    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration,
      details: {
        logsDirectory: 'writable',
        workingDirectory: process.cwd()
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown disk check error'
    };
  }
}

// External services check (if any)
export async function checkExternalServices(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Check email service if configured
    if (config.services.emailService) {
      // Basic connectivity check (no actual email sending)
      // In a real implementation, you might want to test email service connectivity
    }

    // Check any other external APIs or services
    // For now, just return healthy since we don't have external dependencies

    const duration = Date.now() - start;

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration,
      details: {
        emailService: config.services.emailService ? 'configured' : 'not_configured',
        externalApis: 'none_configured'
      }
    };
  } catch (error) {
    const duration = Date.now() - start;
    
    return {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      duration,
      error: error instanceof Error ? error.message : 'Unknown external services error'
    };
  }
}

// Comprehensive health check
export async function performHealthCheck(): Promise<SystemHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [database, supabase, memory, disk, external] = await Promise.all([
      checkDatabase(),
      checkSupabase(),
      checkMemory(),
      checkDisk(),
      checkExternalServices()
    ]);

    // Determine overall system status
    const checks = { database, supabase, memory, disk, external };
    const statuses = Object.values(checks).map(check => check.status);
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const healthStatus: SystemHealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      uptime: Math.floor(process.uptime()),
      checks
    };

    // Log health check results
    if (overallStatus === 'unhealthy') {
      logger.error('Health check failed', { healthStatus });
    } else if (overallStatus === 'degraded') {
      logger.warn('Health check shows degraded performance', { healthStatus });
    } else {
      logger.debug('Health check passed', { 
        status: overallStatus,
        duration: Date.now() - startTime
      });
    }

    return healthStatus;
  } catch (error) {
    logger.error('Health check system error:', error);
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.env,
      uptime: Math.floor(process.uptime()),
      checks: {
        database: { status: 'unhealthy', timestamp: new Date().toISOString(), duration: 0, error: 'Health check system error' },
        supabase: { status: 'unhealthy', timestamp: new Date().toISOString(), duration: 0, error: 'Health check system error' },
        memory: { status: 'unhealthy', timestamp: new Date().toISOString(), duration: 0, error: 'Health check system error' },
        disk: { status: 'unhealthy', timestamp: new Date().toISOString(), duration: 0, error: 'Health check system error' },
        external: { status: 'unhealthy', timestamp: new Date().toISOString(), duration: 0, error: 'Health check system error' }
      }
    };
  }
}

// Simplified health check for basic endpoints
export async function performBasicHealthCheck(): Promise<{ status: string; timestamp: string }> {
  try {
    await testDatabaseConnection();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Basic health check failed:', error);
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    };
  }
}

// Railway-specific health check format
export async function railwayHealthCheck(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const health = await performHealthCheck();
    
    return {
      success: health.status === 'healthy',
      data: health.status === 'healthy' ? health : undefined,
      error: health.status !== 'healthy' ? `System status: ${health.status}` : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown health check error'
    };
  }
}