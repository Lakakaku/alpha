import { Request, Response, NextFunction } from 'express';
import { supabase } from '@vocilia/database';
import { createClient } from '@supabase/supabase-js';

/**
 * Health check middleware for deployment endpoints
 * Provides various health check capabilities for monitoring deployment status
 */

export interface HealthCheckOptions {
  includeDatabase?: boolean;
  includeJobs?: boolean;
  includeExternal?: boolean;
  timeout?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration?: number;
      details?: any;
    };
  };
}

export interface DatabaseHealthInfo {
  connected: boolean;
  latency: number;
  poolStats?: {
    total: number;
    active: number;
    idle: number;
  };
  migrationStatus: string;
}

export interface JobHealthInfo {
  scheduler: {
    running: boolean;
    jobs: number;
  };
  queues: {
    pending: number;
    failed: number;
    completed: number;
  };
  lastExecution?: string;
}

/**
 * Basic health check - simple uptime and status
 */
export const basicHealthCheck = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          server: {
            status: 'pass',
            message: 'Server is running',
            duration: 0
          }
        }
      };

      res.status(200).json(health);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Database health check - connection and performance
 */
export const databaseHealthCheck = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Check migration status
      const { data: migrationData } = await supabase
        .from('supabase_migrations')
        .select('version')
        .order('version', { ascending: false })
        .limit(1);

      const dbHealth: DatabaseHealthInfo = {
        connected: true,
        latency: duration,
        migrationStatus: migrationData?.[0]?.version || 'unknown'
      };

      const health: HealthStatus = {
        status: duration > 1000 ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: {
            status: duration > 2000 ? 'fail' : duration > 1000 ? 'warn' : 'pass',
            message: `Database responsive in ${duration}ms`,
            duration,
            details: dbHealth
          }
        }
      };

      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const health: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Database connection failed',
            duration
          }
        }
      };

      res.status(503).json(health);
    }
  };
};

/**
 * Jobs health check - background job status
 */
export const jobsHealthCheck = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check deployment monitoring jobs
      const { data: monitoringJobs, error: monitoringError } = await supabase
        .from('deployment_monitoring_data')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('timestamp', { ascending: false })
        .limit(10);

      if (monitoringError) {
        throw new Error(`Monitoring jobs error: ${monitoringError.message}`);
      }

      // Check backup jobs
      const { data: backupJobs, error: backupError } = await supabase
        .from('deployment_backup_records')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(5);

      if (backupError) {
        throw new Error(`Backup jobs error: ${backupError.message}`);
      }

      const recentMonitoring = monitoringJobs?.length || 0;
      const recentBackups = backupJobs?.length || 0;
      
      const jobHealth: JobHealthInfo = {
        scheduler: {
          running: true,
          jobs: recentMonitoring + recentBackups
        },
        queues: {
          pending: 0,
          failed: 0,
          completed: recentMonitoring + recentBackups
        },
        lastExecution: monitoringJobs?.[0]?.timestamp || backupJobs?.[0]?.created_at
      };

      const isHealthy = recentMonitoring > 0; // Should have monitoring data in last 5 minutes
      
      const health: HealthStatus = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          jobs: {
            status: isHealthy ? 'pass' : 'warn',
            message: `${recentMonitoring} monitoring jobs, ${recentBackups} backup jobs in recent period`,
            details: jobHealth
          }
        }
      };

      res.status(isHealthy ? 200 : 503).json(health);
    } catch (error) {
      const health: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          jobs: {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Jobs health check failed'
          }
        }
      };

      res.status(503).json(health);
    }
  };
};

/**
 * Detailed health check - combines all health checks
 */
export const detailedHealthCheck = (options: HealthCheckOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const {
      includeDatabase = true,
      includeJobs = true,
      includeExternal = false,
      timeout = 5000
    } = options;

    const startTime = Date.now();
    const checks: HealthStatus['checks'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    try {
      // Basic server check
      checks.server = {
        status: 'pass',
        message: 'Server is running',
        duration: 0
      };

      // Database check
      if (includeDatabase) {
        const dbStartTime = Date.now();
        try {
          const { data, error } = await supabase
            .from('stores')
            .select('id')
            .limit(1);

          const dbDuration = Date.now() - dbStartTime;

          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }

          checks.database = {
            status: dbDuration > 2000 ? 'fail' : dbDuration > 1000 ? 'warn' : 'pass',
            message: `Database responsive in ${dbDuration}ms`,
            duration: dbDuration
          };

          if (checks.database.status === 'fail') overallStatus = 'unhealthy';
          else if (checks.database.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
        } catch (error) {
          checks.database = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Database check failed'
          };
          overallStatus = 'unhealthy';
        }
      }

      // Jobs check
      if (includeJobs) {
        const jobsStartTime = Date.now();
        try {
          const { data: monitoringJobs } = await supabase
            .from('deployment_monitoring_data')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .limit(1);

          const jobsDuration = Date.now() - jobsStartTime;
          const hasRecentJobs = (monitoringJobs?.length || 0) > 0;

          checks.jobs = {
            status: hasRecentJobs ? 'pass' : 'warn',
            message: hasRecentJobs ? 'Background jobs running' : 'No recent job activity',
            duration: jobsDuration
          };

          if (checks.jobs.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
        } catch (error) {
          checks.jobs = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Jobs check failed'
          };
          if (overallStatus !== 'unhealthy') overallStatus = 'degraded';
        }
      }

      // External services check
      if (includeExternal) {
        const extStartTime = Date.now();
        try {
          // Check Supabase API status
          const supabaseHealth = await fetch('https://status.supabase.com/api/v2/status.json', {
            timeout: 3000
          });
          
          const extDuration = Date.now() - extStartTime;
          
          checks.external = {
            status: supabaseHealth.ok ? 'pass' : 'warn',
            message: `External services responsive in ${extDuration}ms`,
            duration: extDuration
          };

          if (checks.external.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
        } catch (error) {
          checks.external = {
            status: 'warn',
            message: 'External services check failed (non-critical)'
          };
        }
      }

      const totalDuration = Date.now() - startTime;

      const health: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks
      };

      const statusCode = overallStatus === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);

    } catch (error) {
      const health: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          error: {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Health check failed'
          }
        }
      };

      res.status(503).json(health);
    }
  };
};

/**
 * Health check middleware for automatic endpoint setup
 */
export const setupHealthChecks = (app: any) => {
  // Basic health check endpoint
  app.get('/health', basicHealthCheck());
  
  // Detailed health check endpoint
  app.get('/health/detailed', detailedHealthCheck({
    includeDatabase: true,
    includeJobs: true,
    includeExternal: true
  }));
  
  // Database-specific health check
  app.get('/health/database', databaseHealthCheck());
  
  // Jobs-specific health check
  app.get('/health/jobs', jobsHealthCheck());
};

export default {
  basicHealthCheck,
  databaseHealthCheck,
  jobsHealthCheck,
  detailedHealthCheck,
  setupHealthChecks
};