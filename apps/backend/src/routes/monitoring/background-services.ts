import { Router } from 'express';
import { alertProcessor, dataAggregator } from '../../services/monitoring';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

/**
 * @route GET /api/monitoring/background-services/status
 * @desc Get status of all background monitoring services
 * @access Admin
 */
router.get('/status', adminAuthMiddleware, async (req, res) => {
  try {
    const alertProcessorStatus = alertProcessor.getStatus();
    const dataAggregatorStatus = dataAggregator.getStatus();

    res.json({
      success: true,
      data: {
        alertProcessor: alertProcessorStatus,
        dataAggregator: dataAggregatorStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Error getting background services status', error as Error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get background services status',
    });
  }
});

/**
 * @route GET /api/monitoring/background-services/health
 * @desc Get health check results for all background services
 * @access Admin
 */
router.get('/health', adminAuthMiddleware, async (req, res) => {
  try {
    const [alertProcessorHealth, dataAggregatorHealth] = await Promise.all([
      alertProcessor.healthCheck(),
      dataAggregator.healthCheck(),
    ]);

    const overallHealthy = alertProcessorHealth.healthy && dataAggregatorHealth.healthy;

    res.json({
      success: true,
      data: {
        overall: {
          healthy: overallHealthy,
          status: overallHealthy ? 'healthy' : 'degraded',
        },
        alertProcessor: alertProcessorHealth,
        dataAggregator: dataAggregatorHealth,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Error getting background services health', error as Error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get background services health',
    });
  }
});

/**
 * @route GET /api/monitoring/background-services/metrics
 * @desc Get metrics for all background services
 * @access Admin
 */
router.get('/metrics', adminAuthMiddleware, async (req, res) => {
  try {
    const alertProcessorMetrics = alertProcessor.getMetrics();
    const dataAggregatorMetrics = dataAggregator.getMetrics();

    res.json({
      success: true,
      data: {
        alertProcessor: alertProcessorMetrics,
        dataAggregator: dataAggregatorMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Error getting background services metrics', error as Error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get background services metrics',
    });
  }
});

/**
 * @route POST /api/monitoring/background-services/alert-processor/start
 * @desc Start the alert processor
 * @access Admin
 */
router.post('/alert-processor/start', adminAuthMiddleware, async (req, res) => {
  try {
    await alertProcessor.start();

    loggingService.info('Alert processor started via API', {
      adminId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Alert processor started successfully',
      data: alertProcessor.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error starting alert processor via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to start alert processor',
    });
  }
});

/**
 * @route POST /api/monitoring/background-services/alert-processor/stop
 * @desc Stop the alert processor
 * @access Admin
 */
router.post('/alert-processor/stop', adminAuthMiddleware, async (req, res) => {
  try {
    await alertProcessor.stop();

    loggingService.info('Alert processor stopped via API', {
      adminId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Alert processor stopped successfully',
      data: alertProcessor.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error stopping alert processor via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to stop alert processor',
    });
  }
});

/**
 * @route POST /api/monitoring/background-services/alert-processor/restart
 * @desc Restart the alert processor
 * @access Admin
 */
router.post('/alert-processor/restart', adminAuthMiddleware, async (req, res) => {
  try {
    const { config } = req.body;

    await alertProcessor.restart(config);

    loggingService.info('Alert processor restarted via API', {
      adminId: req.user?.id,
      config,
    });

    res.json({
      success: true,
      message: 'Alert processor restarted successfully',
      data: alertProcessor.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error restarting alert processor via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to restart alert processor',
    });
  }
});

/**
 * @route PUT /api/monitoring/background-services/alert-processor/config
 * @desc Update alert processor configuration
 * @access Admin
 */
router.put('/alert-processor/config', adminAuthMiddleware, async (req, res) => {
  try {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      throw new ValidationError('Valid configuration object is required');
    }

    alertProcessor.updateConfig(config);

    loggingService.info('Alert processor configuration updated via API', {
      adminId: req.user?.id,
      config,
    });

    res.json({
      success: true,
      message: 'Alert processor configuration updated successfully',
      data: alertProcessor.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error updating alert processor configuration via API', error as Error, {
      adminId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update alert processor configuration',
      });
    }
  }
});

/**
 * @route POST /api/monitoring/background-services/data-aggregator/start
 * @desc Start the data aggregator
 * @access Admin
 */
router.post('/data-aggregator/start', adminAuthMiddleware, async (req, res) => {
  try {
    await dataAggregator.start();

    loggingService.info('Data aggregator started via API', {
      adminId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Data aggregator started successfully',
      data: dataAggregator.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error starting data aggregator via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to start data aggregator',
    });
  }
});

/**
 * @route POST /api/monitoring/background-services/data-aggregator/stop
 * @desc Stop the data aggregator
 * @access Admin
 */
router.post('/data-aggregator/stop', adminAuthMiddleware, async (req, res) => {
  try {
    await dataAggregator.stop();

    loggingService.info('Data aggregator stopped via API', {
      adminId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Data aggregator stopped successfully',
      data: dataAggregator.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error stopping data aggregator via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to stop data aggregator',
    });
  }
});

/**
 * @route POST /api/monitoring/background-services/data-aggregator/restart
 * @desc Restart the data aggregator
 * @access Admin
 */
router.post('/data-aggregator/restart', adminAuthMiddleware, async (req, res) => {
  try {
    const { config } = req.body;

    await dataAggregator.restart(config);

    loggingService.info('Data aggregator restarted via API', {
      adminId: req.user?.id,
      config,
    });

    res.json({
      success: true,
      message: 'Data aggregator restarted successfully',
      data: dataAggregator.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error restarting data aggregator via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to restart data aggregator',
    });
  }
});

/**
 * @route PUT /api/monitoring/background-services/data-aggregator/config
 * @desc Update data aggregator configuration
 * @access Admin
 */
router.put('/data-aggregator/config', adminAuthMiddleware, async (req, res) => {
  try {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      throw new ValidationError('Valid configuration object is required');
    }

    dataAggregator.updateConfig(config);

    loggingService.info('Data aggregator configuration updated via API', {
      adminId: req.user?.id,
      config,
    });

    res.json({
      success: true,
      message: 'Data aggregator configuration updated successfully',
      data: dataAggregator.getStatus(),
    });
  } catch (error) {
    loggingService.error('Error updating data aggregator configuration via API', error as Error, {
      adminId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update data aggregator configuration',
      });
    }
  }
});

/**
 * @route POST /api/monitoring/background-services/data-aggregator/aggregate
 * @desc Manually trigger aggregation for a specific period
 * @access Admin
 */
router.post('/data-aggregator/aggregate', adminAuthMiddleware, async (req, res) => {
  try {
    const { periodType, startTime, endTime } = req.body;

    if (!periodType || !['hourly', 'daily', 'weekly', 'monthly'].includes(periodType)) {
      throw new ValidationError('Valid period type is required (hourly, daily, weekly, monthly)');
    }

    const aggregations = await dataAggregator.aggregateForPeriod(periodType, startTime, endTime);

    loggingService.info('Manual aggregation triggered via API', {
      adminId: req.user?.id,
      periodType,
      startTime,
      endTime,
      aggregationsCount: aggregations.length,
    });

    res.json({
      success: true,
      message: 'Aggregation completed successfully',
      data: {
        periodType,
        startTime,
        endTime,
        aggregationsCount: aggregations.length,
        aggregations,
      },
    });
  } catch (error) {
    loggingService.error('Error triggering manual aggregation via API', error as Error, {
      adminId: req.user?.id,
    });

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to trigger aggregation',
      });
    }
  }
});

/**
 * @route GET /api/monitoring/background-services/data-aggregator/aggregated-data
 * @desc Get aggregated data for analytics
 * @access Admin
 */
router.get('/data-aggregator/aggregated-data', adminAuthMiddleware, async (req, res) => {
  try {
    const { serviceName, metricType, periodType = 'daily', limit = 30 } = req.query;

    const data = await dataAggregator.getAggregatedData(
      serviceName as any,
      metricType as any,
      periodType as any,
      parseInt(limit as string) || 30
    );

    res.json({
      success: true,
      data: {
        aggregatedData: data,
        filters: {
          serviceName,
          metricType,
          periodType,
          limit: parseInt(limit as string) || 30,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Error getting aggregated data via API', error as Error, {
      adminId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get aggregated data',
    });
  }
});

export { router as backgroundServicesRoutes };