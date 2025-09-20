import { Router, Request, Response } from 'express';
import { createClient } from '@alpha/database';

const router = Router();

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

interface DetailedHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    aiService: HealthCheck;
  };
}

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detailed health check with dependency checks
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: DetailedHealthResponse['checks'] = {
    database: { status: 'unhealthy' },
    aiService: { status: 'healthy' },
  };

  // Check database connection
  try {
    const dbStartTime = Date.now();
    const supabase = createClient();
    
    // Simple database connectivity test
    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    
    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStartTime,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }

  // Check AI service (placeholder - would typically ping actual AI service)
  try {
    const aiStartTime = Date.now();
    
    // Simulate AI service check
    // In production, this would be an actual health check to your AI service
    await new Promise(resolve => setTimeout(resolve, 10));
    
    checks.aiService = {
      status: 'healthy',
      responseTime: Date.now() - aiStartTime,
    };
  } catch (error) {
    checks.aiService = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'AI service unavailable',
    };
  }

  // Get memory usage
  const memoryUsage = process.memoryUsage();

  // Determine overall health status
  const isHealthy = Object.values(checks).every(check => check.status === 'healthy');
  const status = isHealthy ? 'healthy' : 'unhealthy';
  const statusCode = isHealthy ? 200 : 503;

  const response: DetailedHealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks,
  };

  res.status(statusCode).json(response);
});

export { router as healthRoutes };