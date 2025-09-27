import { Router, Request, Response } from 'express';
import { monitoringService } from '../../services/monitoring/monitoring-service';
import { loggingService } from '../../services/loggingService';

const router = Router();

/**
 * GET /api/monitoring/health
 * System health check endpoint for external monitoring services
 * Note: This endpoint is public and does not require admin authentication
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get system health status from monitoring service
    const healthStatus = await monitoringService.getHealthStatus();

    // Set appropriate HTTP status code based on health status
    let statusCode = 200;
    if (healthStatus.status === 'degraded') {
      statusCode = 200; // Still return 200 for degraded but functional systems
    } else if (healthStatus.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable for unhealthy systems
    }

    // Log health check request (debug level to avoid spam)
    loggingService.debug('Health check requested', {
      systemStatus: healthStatus.status,
      responseTime: healthStatus.metrics.response_time_ms,
      errorRate: healthStatus.metrics.error_rate,
      uptime: healthStatus.metrics.uptime_seconds,
      requestIp: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    // Log health check error
    loggingService.error('Health check failed', error as Error, {
      requestIp: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Return unhealthy status if we can't determine health
    const unhealthyStatus = {
      status: 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy' as const,
        api: 'unhealthy' as const,
        monitoring: 'unhealthy' as const,
      },
      metrics: {
        uptime_seconds: Math.floor(process.uptime()),
        response_time_ms: 0,
        error_rate: 100,
      },
      error: 'Health check system failure'
    };

    res.status(503).json(unhealthyStatus);
  }
});

export default router;